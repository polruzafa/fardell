// Genera les icones PNG de la PWA sense cap dependència (només node:zlib).
// Dibuixa la marca de Fardell: un farcell lligat (nus taronja + dos plecs)
// sobre una muntanya de dos cims, en la paleta Pedra. És la mateixa forma
// que public/favicon.svg; aquí es rasteritza mostrejant les figures.
// Ús: node scripts/make-icons.mjs

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

const FIELD = [65, 83, 58] // #41533a — verd d'avet
const CREAM = [244, 241, 232] // #f4f1e8
const ACCENT = [232, 84, 29] // #e8541d — taronja de seguretat

// ── PNG mínim ────────────────────────────────────────────────────────────────

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0 // filtre: cap
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y)
      raw.writeUInt8(r, rowStart + 1 + x * 4)
      raw.writeUInt8(g, rowStart + 2 + x * 4)
      raw.writeUInt8(b, rowStart + 3 + x * 4)
      raw.writeUInt8(a, rowStart + 4 + x * 4)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bits per canal
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Geometria de la marca (coordenades 0..64, com el viewBox del SVG) ────────

// Aplana una corba de Bézier cúbica en una polilínia.
function cubic(p0, c1, c2, p3, n = 16) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    const x = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0]
    const y = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]
    pts.push([x, y])
  }
  return pts
}

const MOUNTAIN = [
  [13, 49],
  [27, 29],
  [34, 38],
  [42, 24],
  [51, 49],
]
const FLAP_L = [
  ...cubic([32, 17], [26, 8], [19, 6], [15, 9]),
  ...cubic([15, 9], [18, 15], [26, 16], [32, 18]),
]
const FLAP_R = [
  ...cubic([32, 17], [38, 8], [45, 6], [49, 9]),
  ...cubic([49, 9], [46, 15], [38, 16], [32, 18]),
]
const CLOTH_L = cubic([29, 19], [21, 27], [14, 37], [12.5, 47])
const CLOTH_R = cubic([35, 19], [43, 27], [50, 37], [51.5, 47])
const CLOTH_HALF = 1.2 // meitat del gruix del traç de la roba
const KNOT = { x: 32, y: 17.5, r: 3.4 }

function pointInPoly(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function distToSegment(x, y, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy))
}

function nearPolyline(x, y, pts, r) {
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(x, y, pts[i - 1], pts[i]) <= r) return true
  }
  return false
}

/** Color de la marca (sense fons) al punt (x, y), o null si no hi toca. */
function glyphAt(x, y) {
  if (Math.hypot(x - KNOT.x, y - KNOT.y) <= KNOT.r) return ACCENT
  if (
    pointInPoly(x, y, MOUNTAIN) ||
    pointInPoly(x, y, FLAP_L) ||
    pointInPoly(x, y, FLAP_R) ||
    nearPolyline(x, y, CLOTH_L, CLOTH_HALF) ||
    nearPolyline(x, y, CLOTH_R, CLOTH_HALF)
  ) {
    return CREAM
  }
  return null
}

// Distància signada a un rectangle arrodonit (cantonades del quadrat).
function roundedRect(x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - (hw - r)
  const dy = Math.abs(y - cy) - (hh - r)
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r
}

// ── Composició d'una icona ───────────────────────────────────────────────────

/**
 * `bleed = true` omple tot el quadrat (versió «maskable»/iOS, que el sistema
 * ja arrodoneix); si no, el fons és un quadrat arrodonit sobre transparent.
 * `scale` encongeix el dibuix respecte del centre (zona segura del maskable).
 * Antialiàsing per supermostreig (SS×SS punts per píxel).
 */
function makeIcon(size, { bleed = false, scale = 1 } = {}) {
  const SS = 4
  return png(size, (px, py) => {
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const u = ((px + (sx + 0.5) / SS) / size) * 64
        const v = ((py + (sy + 0.5) / SS) / size) * 64
        if (!bleed && roundedRect(u, v, 32, 32, 32, 32, 14) > 0) continue
        const gx = (u - 32) / scale + 32
        const gy = (v - 32) / scale + 32
        const col = glyphAt(gx, gy) ?? FIELD
        r += col[0]
        g += col[1]
        b += col[2]
        a += 255
      }
    }
    const n = SS * SS
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n), Math.round(a / n)]
  })
}

writeFileSync(join(OUT, 'icon-192.png'), makeIcon(192))
writeFileSync(join(OUT, 'icon-512.png'), makeIcon(512))
// «maskable»: omple el llenç i encongeix el dibuix a la zona segura.
writeFileSync(join(OUT, 'icon-512-maskable.png'), makeIcon(512, { bleed: true, scale: 0.72 }))
writeFileSync(join(OUT, 'apple-touch-icon.png'), makeIcon(180, { bleed: true }))

console.log(`Icones escrites a ${OUT}`)
