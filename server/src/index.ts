// API de Fardell: comptes d'usuari i una còpia del JSON de dades per usuari.
// Worker de Cloudflare sense dependències; les dades viuen a D1 (SQLite).
//
// Endpoints (tots JSON):
//   POST   /api/register  { email, password }            → { token, email }
//   POST   /api/login     { email, password }            → { token, email }
//   POST   /api/logout    (Bearer)                       → 204
//   GET    /api/data      (Bearer)                       → { payload, updatedAt }
//   PUT    /api/data      (Bearer) { payload, baseUpdatedAt } → { updatedAt } | 409
//   DELETE /api/account   (Bearer) { password }          → 204

export interface Env {
  DB: D1Database
}

const MAX_PAYLOAD_BYTES = 1_000_000
const PBKDF2_ITERATIONS = 100_000

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age': '86400',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

const fail = (status: number, error: string) => json({ error }, status)

// ── Criptografia (Web Crypto, disponible als Workers) ───────────────────────

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  )
  return toHex(bits)
}

async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function randomHex(bytes: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer)
}

// ── Utilitats ────────────────────────────────────────────────────────────────

type UserRow = { id: string; email: string; password_hash: string; salt: string }

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const body = await req.json().catch(() => null)
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null
}

async function createSession(env: Env, userId: string): Promise<string> {
  const token = randomHex(32)
  const now = new Date().toISOString()
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, last_used_at) VALUES (?, ?, ?, ?)',
  )
    .bind(await sha256Hex(token), userId, now, now)
    .run()
  return token
}

/** Retorna l'id de l'usuari del testimoni Bearer, o null si no és vàlid. */
async function authenticate(req: Request, env: Env): Promise<string | null> {
  const header = req.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!/^[0-9a-f]{64}$/.test(token)) return null
  const tokenHash = await sha256Hex(token)
  const row = await env.DB.prepare('SELECT user_id FROM sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .first<{ user_id: string }>()
  if (!row) return null
  await env.DB.prepare('UPDATE sessions SET last_used_at = ? WHERE token_hash = ?')
    .bind(new Date().toISOString(), tokenHash)
    .run()
  return row.user_id
}

async function verifyPassword(user: UserRow, password: unknown): Promise<boolean> {
  if (typeof password !== 'string') return false
  return constantTimeEqual(await hashPassword(password, user.salt), user.password_hash)
}

// ── Endpoints ────────────────────────────────────────────────────────────────

async function register(req: Request, env: Env): Promise<Response> {
  const body = await readBody(req)
  const email = normalizeEmail(body?.email)
  const password = body?.password
  if (!email) return fail(400, 'email')
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    return fail(400, 'password')
  }
  const salt = randomHex(16)
  const id = crypto.randomUUID()
  try {
    await env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(id, email, await hashPassword(password, salt), salt, new Date().toISOString())
      .run()
  } catch {
    return fail(409, 'exists') // la restricció UNIQUE de l'email
  }
  return json({ token: await createSession(env, id), email }, 201)
}

async function login(req: Request, env: Env): Promise<Response> {
  const body = await readBody(req)
  const email = normalizeEmail(body?.email)
  if (!email) return fail(401, 'credentials')
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<UserRow>()
  if (!user || !(await verifyPassword(user, body?.password))) return fail(401, 'credentials')
  return json({ token: await createSession(env, user.id), email: user.email })
}

async function logout(req: Request, env: Env): Promise<Response> {
  const header = req.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await sha256Hex(token))
      .run()
  }
  return new Response(null, { status: 204, headers: CORS })
}

async function getData(env: Env, userId: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT payload, updated_at FROM gear_data WHERE user_id = ?')
    .bind(userId)
    .first<{ payload: string; updated_at: string }>()
  if (!row) return json({ payload: null, updatedAt: null })
  return json({ payload: JSON.parse(row.payload), updatedAt: row.updated_at })
}

async function putData(req: Request, env: Env, userId: string): Promise<Response> {
  const body = await readBody(req)
  const payload = body?.payload
  if (typeof payload !== 'object' || payload === null) return fail(400, 'payload')
  const text = JSON.stringify(payload)
  if (text.length > MAX_PAYLOAD_BYTES) return fail(413, 'too-large')

  // Control de concurrència optimista: el client diu quina versió del servidor
  // coneixia (baseUpdatedAt); si mentrestant un altre dispositiu ha desat, 409.
  const baseUpdatedAt = body?.baseUpdatedAt ?? null
  const current = await env.DB.prepare('SELECT updated_at FROM gear_data WHERE user_id = ?')
    .bind(userId)
    .first<{ updated_at: string }>()
  if (current && current.updated_at !== baseUpdatedAt) {
    return json({ error: 'conflict', updatedAt: current.updated_at }, 409)
  }

  const updatedAt = new Date().toISOString()
  await env.DB.prepare(
    `INSERT INTO gear_data (user_id, payload, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  )
    .bind(userId, text, updatedAt)
    .run()
  return json({ updatedAt })
}

async function deleteAccount(req: Request, env: Env, userId: string): Promise<Response> {
  const body = await readBody(req)
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first<UserRow>()
  if (!user || !(await verifyPassword(user, body?.password))) return fail(401, 'credentials')
  // Les sessions i les dades cauen en cascada (ON DELETE CASCADE).
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()
  return new Response(null, { status: 204, headers: CORS })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    const { pathname } = new URL(req.url)
    const route = `${req.method} ${pathname}`
    try {
      if (route === 'POST /api/register') return await register(req, env)
      if (route === 'POST /api/login') return await login(req, env)
      if (route === 'POST /api/logout') return await logout(req, env)

      if (
        route === 'GET /api/data' ||
        route === 'PUT /api/data' ||
        route === 'DELETE /api/account'
      ) {
        const userId = await authenticate(req, env)
        if (!userId) return fail(401, 'unauthorized')
        if (route === 'GET /api/data') return await getData(env, userId)
        if (route === 'PUT /api/data') return await putData(req, env, userId)
        return await deleteAccount(req, env, userId)
      }

      return fail(404, 'not-found')
    } catch (e) {
      console.error(e)
      return fail(500, 'server')
    }
  },
}
