import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import starter from './data/starter.json'
import { getLocale } from './i18n'

export type Category = {
  id: string
  name: string
  color: string
}

export type GearItem = {
  id: string
  name: string
  categoryId: string
  tags: string[]
  weightGrams: number | null
  notes: string
  photo: string | null
  /** On va col·locat dins la motxilla («fondo», «bolsillo exterior»…). */
  placement?: string
  /** Pes de la funda quan es pesa a part, en grams. */
  caseWeightGrams?: number
  /** Càrrega màxima recomanada (per a motxilles), en grams. */
  maxLoadGrams?: number
  /** Característiques lliures, només informatives («Capacidad: 750 ml», «R-value: 4,2»…). */
  specs?: { label: string; value: string }[]
  /** Retirat: ja no es fa servir (trencat, substituït…), però se'n guarda la fitxa. */
  deprecated?: boolean
  /** Per què s'ha retirat. */
  deprecatedReason?: string
  /**
   * Dependències per capacitat: etiquetes que algun ALTRE element del mateix
   * grup ha de tenir («fuel», «mechero»…). Si cap element les cobreix, la
   * motxilla o el kit mostren un avís — mai no bloquegen res.
   */
  needs?: string[]
  /** Entrada del catàleg d'on prové la fitxa, si es va crear des del catàleg. */
  catalogId?: string
}

/** Un element dins d'un grup: la quantitat i el «a sobre» són del grup, no de l'element. */
export type GroupMember = {
  id: string
  /** Unitats que van al grup (per defecte, 1). */
  qty?: number
  /**
   * Quantes d'aquestes unitats es porten a sobre en aquest grup (roba posada,
   * bastons a la mà…): surten a la llista però no compten en el pes
   * transportat ni en el % de càrrega. De 0 (omès) fins a qty.
   */
  wornQty?: number
}

/**
 * Un grup és una llista de material amb nom: si té `backpackId` és una
 * motxilla preparada; si no, és un kit reutilitzable. Els grups poden
 * contenir altres grups (kits dins de motxilles, kits dins de kits, o una
 * motxilla carregada dins d'una altra).
 */
export type Group = {
  id: string
  name: string
  backpackId: string | null
  members: GroupMember[]
  groupIds: string[]
}

/** Ressenya d'un plat o recepta cuinats, amb el material emprat. */
export type Review = {
  id: string
  /** Plat o recepta ressenyats. */
  name: string
  /** Sabor, d'1 a 5 estrelles. */
  taste?: number
  tasteNotes?: string
  /** Com de fàcil ha estat la neteja, d'1 (malson) a 5 (res a fregar). */
  cleaning?: number
  cleaningNotes?: string
  /** Preu, d'1 (car) a 5 (ben de preu); el `price` de sota és l'import. */
  priceRating?: number
  /** Dificultat, d'1 (molt complicat) a 5 (sense cap misteri). */
  difficulty?: number
  difficultyNotes?: string
  /** Kits de cuina emprats. */
  kitIds: string[]
  /** Elements solts emprats, a banda dels kits. */
  itemIds: string[]
  /** Ingredients que no van amb el material («ceba», «brou»…). */
  extraIngredients?: string[]
  /** Preu aproximat dels ingredients, en euros. */
  price?: number
  notes: string
  /** Enllaç a la recepta (web, vídeo…). */
  url?: string
  /** Data de la ressenya, en format ISO (aaaa-mm-dd). */
  date: string
}

export type GearData = {
  schemaVersion: number
  categories: Category[]
  items: GearItem[]
  groups: Group[]
  reviews: Review[]
}

export const BACKPACK_CATEGORY = 'mochilas'

/** La versió de l'esquema que escriu l'app (starter.json l'ha de dur igual). */
export const SCHEMA_VERSION = 6

const STORAGE_KEY = 'fardell:data'

/** Les dades inicials: només la taxonomia de categories, sense cap element.
 * Tot el material és de l'usuari: creat a mà o triat del catàleg. */
export const starterData = starter as GearData

export type Action =
  | { type: 'item/add'; item: GearItem }
  | { type: 'items/addMany'; items: GearItem[]; categories: Category[] }
  | { type: 'item/update'; item: GearItem }
  | { type: 'item/delete'; id: string }
  | { type: 'category/add'; category: Category }
  | { type: 'category/update'; category: Category }
  | { type: 'category/delete'; id: string }
  | { type: 'group/add'; group: Group }
  | { type: 'group/rename'; id: string; name: string }
  | { type: 'group/delete'; id: string }
  | { type: 'group/addItem'; groupId: string; itemId: string }
  | { type: 'group/removeItem'; groupId: string; itemId: string }
  | { type: 'group/setItemQty'; groupId: string; itemId: string; qty: number }
  | { type: 'group/cycleWorn'; groupId: string; itemId: string }
  | { type: 'group/toggleGroup'; groupId: string; childId: string }
  | { type: 'review/add'; review: Review }
  | { type: 'review/update'; review: Review }
  | { type: 'review/delete'; id: string }
  | { type: 'data/import'; data: GearData }
  | { type: 'data/reset' }

function reducer(data: GearData, action: Action): GearData {
  switch (action.type) {
    case 'item/add':
      return { ...data, items: [...data.items, action.item] }
    case 'items/addMany':
      return {
        ...data,
        categories: [...data.categories, ...action.categories],
        items: [...data.items, ...action.items],
      }
    case 'item/update':
      return {
        ...data,
        items: data.items.map((it) => (it.id === action.item.id ? action.item : it)),
      }
    case 'item/delete':
      return {
        ...data,
        items: data.items.filter((it) => it.id !== action.id),
        groups: data.groups.map((g) => ({
          ...g,
          // Si era la motxilla d'un grup, el grup passa a ser un kit: no es perd res.
          backpackId: g.backpackId === action.id ? null : g.backpackId,
          members: g.members.filter((m) => m.id !== action.id),
        })),
        reviews: data.reviews.map((r) => ({
          ...r,
          itemIds: r.itemIds.filter((id) => id !== action.id),
        })),
      }
    case 'category/add':
      return { ...data, categories: [...data.categories, action.category] }
    case 'category/update':
      return {
        ...data,
        categories: data.categories.map((c) => (c.id === action.category.id ? action.category : c)),
      }
    // Suprimir una categoria NO suprimeix els seus elements: queden amb el
    // categoryId antic i categoryOf() els mostra amb un color neutre.
    case 'category/delete':
      return { ...data, categories: data.categories.filter((c) => c.id !== action.id) }
    case 'group/add':
      return { ...data, groups: [...data.groups, action.group] }
    case 'group/rename':
      return {
        ...data,
        groups: data.groups.map((g) => (g.id === action.id ? { ...g, name: action.name } : g)),
      }
    case 'group/delete':
      return {
        ...data,
        groups: data.groups
          .filter((g) => g.id !== action.id)
          .map((g) => ({ ...g, groupIds: g.groupIds.filter((id) => id !== action.id) })),
        // Les ressenyes que usaven el kit es queden sense ell, però no es perden.
        reviews: data.reviews.map((r) => ({
          ...r,
          kitIds: r.kitIds.filter((id) => id !== action.id),
        })),
      }
    case 'group/addItem':
      return updateGroup(data, action.groupId, (g) =>
        g.members.some((m) => m.id === action.itemId)
          ? g
          : { ...g, members: [...g.members, { id: action.itemId }] },
      )
    case 'group/removeItem':
      return updateGroup(data, action.groupId, (g) => ({
        ...g,
        members: g.members.filter((m) => m.id !== action.itemId),
      }))
    case 'group/setItemQty': {
      const qty = Math.max(1, Math.round(action.qty))
      return updateGroup(data, action.groupId, (g) => ({
        ...g,
        members: g.members.map((m) => {
          if (m.id !== action.itemId) return m
          const wornQty = Math.min(m.wornQty ?? 0, qty)
          return {
            ...m,
            qty: qty === 1 ? undefined : qty,
            wornQty: wornQty === 0 ? undefined : wornQty,
          }
        }),
      }))
    }
    // Cicle: 0 → 1 → … → qty (totes a sobre) → 0.
    case 'group/cycleWorn':
      return updateGroup(data, action.groupId, (g) => ({
        ...g,
        members: g.members.map((m) => {
          if (m.id !== action.itemId) return m
          const qty = m.qty ?? 1
          const next = ((m.wornQty ?? 0) + 1) % (qty + 1)
          return { ...m, wornQty: next === 0 ? undefined : next }
        }),
      }))
    case 'group/toggleGroup':
      return {
        ...data,
        groups: data.groups.map((g) => {
          if (g.id !== action.groupId) return g
          const has = g.groupIds.includes(action.childId)
          return {
            ...g,
            groupIds: has
              ? g.groupIds.filter((id) => id !== action.childId)
              : [...g.groupIds, action.childId],
          }
        }),
      }
    case 'review/add':
      return { ...data, reviews: [...data.reviews, action.review] }
    case 'review/update':
      return {
        ...data,
        reviews: data.reviews.map((r) => (r.id === action.review.id ? action.review : r)),
      }
    case 'review/delete':
      return { ...data, reviews: data.reviews.filter((r) => r.id !== action.id) }
    case 'data/import':
      return action.data
    case 'data/reset':
      return starterData
  }
}

function updateGroup(data: GearData, groupId: string, fn: (g: Group) => Group): GearData {
  return { ...data, groups: data.groups.map((g) => (g.id === groupId ? fn(g) : g)) }
}

// ── Política de migracions ──────────────────────────────────────────────────
// Les dades de l'usuari viuen al dispositiu i NO es poden descartar a la
// lleugera. Regles:
//  1. Afegir un camp OPCIONAL no requereix apujar schemaVersion: les dades
//     desades segueixen sent vàlides tal qual.
//  2. Si un canvi és incompatible (camp que canvia de forma, renom, unitats),
//     apugeu SCHEMA_VERSION (i starter.json) i afegiu un pas a migrate() que
//     TRANSFORMI les dades de la versió anterior sense perdre res.
//  3. Tornar a l'inventari buit és només l'últim recurs per a dades corruptes
//     o de versions desconegudes (més noves que l'app, per exemple).

function looksLikeGearData(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.categories) &&
    Array.isArray(v.items) &&
    (Array.isArray(v.groups) || Array.isArray(v.packs))
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function migrate(raw: Record<string, unknown>): GearData {
  let data: any = raw
  // v2 → v3: només es van afegir camps opcionals; les dades són vàlides tal qual.
  if (data.schemaVersion === 2) data = { ...data, schemaVersion: 3 }
  // v3 → v4: `packs` passa a `groups` (amb groupIds) i el camp numèric
  // `kit` dels elements es converteix en grups amb nom.
  if (data.schemaVersion === 3) {
    const items = data.items as (GearItem & { kit?: number })[]
    const kitNumbers = [...new Set(items.map((it) => it.kit).filter((k): k is number => k != null))]
    // Forma intermèdia v4 (amb itemIds); el pas v4 → v5 de sota la converteix.
    const kitGroups = kitNumbers.map((n) => ({
      id: `kit-${n}`,
      name: `Kit ${n}`,
      backpackId: null,
      itemIds: items.filter((it) => it.kit === n).map((it) => it.id),
      groupIds: [],
    }))
    const { packs, ...rest } = data
    data = {
      ...rest,
      schemaVersion: 4,
      items: items.map(({ kit, ...it }) => it),
      groups: [
        ...((packs ?? []) as any[]).map((p) => ({
          ...p,
          backpackId: p.backpackId ?? null,
          groupIds: p.groupIds ?? [],
        })),
        ...kitGroups,
      ],
    }
  }
  // v4 → v5: `itemIds` passa a `members` (amb qty i worn per grup) i el camp
  // `worn` dels elements es converteix en worn de cadascuna de les seves
  // pertinences a grups.
  if (data.schemaVersion === 4) {
    const wornIds = new Set(
      (data.items as any[]).filter((it) => it.worn === true).map((it) => it.id as string),
    )
    data = {
      ...data,
      schemaVersion: 5,
      items: (data.items as any[]).map(({ worn, ...it }) => it),
      groups: (data.groups as any[]).map((g) => {
        const { itemIds, ...rest } = g
        return {
          ...rest,
          members: ((itemIds ?? []) as string[]).map((id) =>
            wornIds.has(id) ? { id, worn: true } : { id },
          ),
        }
      }),
    }
  }
  // v5 → v6: el booleà `worn` de les pertinences passa a `wornQty` (quantes
  // unitats es porten a sobre); worn=true equivalia a totes.
  if (data.schemaVersion === 5) {
    data = {
      ...data,
      schemaVersion: 6,
      groups: (data.groups as any[]).map((g) => ({
        ...g,
        members: (g.members as any[]).map(({ worn, ...m }) =>
          worn === true ? { ...m, wornQty: m.qty ?? 1 } : m,
        ),
      })),
    }
  }
  // `reviews` es va afegir com a camp opcional (regla 1: sense apujar la
  // versió); es completa si falta. Formes primerenques: el `kitId` passa a
  // `kitIds` i la puntuació general `rating` desapareix (ara és la mitjana
  // calculada de les altres; vegeu reviewScore).
  if (!Array.isArray(data.reviews)) data = { ...data, reviews: [] }
  data = {
    ...data,
    reviews: (data.reviews as any[]).map(({ kitId, rating, ...r }) => ({
      ...r,
      kitIds: r.kitIds ?? (kitId ? [kitId] : []),
      itemIds: r.itemIds ?? [],
    })),
  }
  return data as GearData
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Valida i migra unes dades (de localStorage o d'un fitxer importat). */
export function parseGearData(value: unknown): GearData | null {
  if (!looksLikeGearData(value)) return null
  const migrated = migrate(value)
  return migrated.schemaVersion === SCHEMA_VERSION ? migrated : null
}

/** Les dades del dispositiu, tal qual: són de l'usuari i no es fusionen amb
 * res (la fusió amb la llavor es va retirar el juliol del 2026, quan la
 * llavor va deixar de dur material). Sense dades (o corruptes): les inicials. */
function load(): GearData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = parseGearData(JSON.parse(raw) as unknown)
      if (parsed) return parsed
    }
  } catch {
    // dades corruptes: es comença amb les categories inicials
  }
  return starterData
}

const StoreContext = createContext<{ data: GearData; dispatch: Dispatch<Action> } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  return <StoreContext.Provider value={{ data, dispatch }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore s’ha de fer servir dins de StoreProvider')
  return ctx
}

// ── Utilitats ────────────────────────────────────────────────────────────────

export function newId(): string {
  if ('randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function categoryOf(data: GearData, categoryId: string): Category {
  return (
    data.categories.find((c) => c.id === categoryId) ?? {
      id: categoryId,
      name: categoryId,
      color: '#6e6a5e',
    }
  )
}

export function itemOf(data: GearData, id: string): GearItem | undefined {
  return data.items.find((it) => it.id === id)
}

export function groupOf(data: GearData, id: string): Group | undefined {
  return data.groups.find((g) => g.id === id)
}

/** Ruta d'un grup: les motxilles i els kits tenen llistes separades. */
export function groupPath(group: Group): string {
  return `${group.backpackId ? '/motxilles' : '/kits'}/${group.id}`
}

export type EffectiveMember = { qty: number; wornQty: number }

/**
 * Pertinences efectives del grup, grups imbricats inclosos (una motxilla
 * imbricada hi aporta la seva pròpia motxilla, perquè es carrega). No inclou
 * la motxilla pròpia del grup arrel. Si una mateixa peça arriba per dos
 * camins, valen la quantitat i el «a sobre» MÉS GRANS (no la suma: és la
 * mateixa peça física). A prova de cicles.
 */
export function collectGroupMembers(data: GearData, group: Group): Map<string, EffectiveMember> {
  const acc = new Map<string, EffectiveMember>()
  const visited = new Set<string>()
  const add = (id: string, qty: number, wornQty: number) => {
    const prev = acc.get(id)
    acc.set(
      id,
      prev
        ? { qty: Math.max(prev.qty, qty), wornQty: Math.max(prev.wornQty, wornQty) }
        : { qty, wornQty },
    )
  }
  const walk = (g: Group) => {
    if (visited.has(g.id)) return
    visited.add(g.id)
    for (const m of g.members) add(m.id, m.qty ?? 1, Math.min(m.wornQty ?? 0, m.qty ?? 1))
    for (const childId of g.groupIds) {
      const child = groupOf(data, childId)
      if (!child) continue
      if (child.backpackId) add(child.backpackId, 1, 0)
      walk(child)
    }
  }
  walk(group)
  return acc
}

/** Ids únics de tots els elements continguts (comoditat sobre collectGroupMembers). */
export function collectGroupItemIds(data: GearData, group: Group): Set<string> {
  return new Set(collectGroupMembers(data, group).keys())
}

/** Unitats totals del grup (les quantitats compten; el que es porta a sobre, també). */
export function groupUnitCount(data: GearData, group: Group): number {
  let units = 0
  for (const m of collectGroupMembers(data, group).values()) units += m.qty
  return units
}

/**
 * Pes del contingut transportat (sense la motxilla pròpia ni el que es porta
 * a sobre): es compara amb la càrrega màxima.
 */
export function groupContentsWeight(data: GearData, group: Group): number {
  let sum = 0
  for (const [id, m] of collectGroupMembers(data, group)) {
    sum += (m.qty - m.wornQty) * (itemOf(data, id)?.weightGrams ?? 0)
  }
  return sum
}

/** Pes del que es porta a sobre en aquest grup (no va dins la motxilla). */
export function groupWornWeight(data: GearData, group: Group): number {
  let sum = 0
  for (const [id, m] of collectGroupMembers(data, group)) {
    sum += m.wornQty * (itemOf(data, id)?.weightGrams ?? 0)
  }
  return sum
}

/** Pes total del grup, amb la seva motxilla inclosa si en té. */
export function groupWeight(data: GearData, group: Group): number {
  const backpack = group.backpackId ? itemOf(data, group.backpackId) : undefined
  return groupContentsWeight(data, group) + (backpack?.weightGrams ?? 0)
}

/** Pes transportat per categoria (motxilla pròpia inclosa; sense el que es porta a sobre). */
export function groupWeightByCategory(data: GearData, group: Group): Map<string, number> {
  const members = collectGroupMembers(data, group)
  if (group.backpackId && !members.has(group.backpackId)) {
    members.set(group.backpackId, { qty: 1, wornQty: 0 })
  }
  const byCategory = new Map<string, number>()
  for (const [id, m] of members) {
    const item = itemOf(data, id)
    if (!item) continue
    byCategory.set(
      item.categoryId,
      (byCategory.get(item.categoryId) ?? 0) + (m.qty - m.wornQty) * (item.weightGrams ?? 0),
    )
  }
  return byCategory
}

/** Percentatge de càrrega sobre la màxima de la motxilla, o null si no n'hi ha. */
export function groupLoadPercent(data: GearData, group: Group): number | null {
  const maxLoad = group.backpackId ? itemOf(data, group.backpackId)?.maxLoadGrams : undefined
  if (!maxLoad) return null
  return Math.round((groupContentsWeight(data, group) / maxLoad) * 100)
}

export type UnmetNeed = { item: GearItem; needs: string[] }

/**
 * Dependències no cobertes del grup: per a cada element amb `needs`, les
 * etiquetes que cap ALTRE element del grup (imbricats inclosos) no aporta.
 * La comparació no distingeix majúscules.
 */
export function groupUnmetNeeds(data: GearData, group: Group): UnmetNeed[] {
  const ids = collectGroupItemIds(data, group)
  if (group.backpackId) ids.add(group.backpackId)
  const items = [...ids]
    .map((id) => itemOf(data, id))
    .filter((it): it is GearItem => Boolean(it))
  const result: UnmetNeed[] = []
  for (const item of items) {
    if (!item.needs?.length) continue
    const unmet = item.needs.filter((need) => {
      const n = need.toLowerCase()
      return !items.some(
        (other) => other.id !== item.id && other.tags.some((tag) => tag.toLowerCase() === n),
      )
    })
    if (unmet.length > 0) result.push({ item, needs: unmet })
  }
  return result
}

/**
 * Categories que compten com a «material de cuina» a l'hora de proposar kits
 * a les ressenyes: cuina pròpiament, foc, combustible i neteja (fregall,
 * sabó…), que en un kit de cuinar hi van de bracet.
 */
export const COOKING_CATEGORY_IDS = new Set(['cocina', 'fuego', 'combustible', 'limpieza'])

/** Cert si més del 75 % de les unitats del kit són material de cuina. */
export function isCookingKit(data: GearData, group: Group): boolean {
  let total = 0
  let cooking = 0
  for (const [id, m] of collectGroupMembers(data, group)) {
    total += m.qty
    const item = itemOf(data, id)
    if (item && COOKING_CATEGORY_IDS.has(item.categoryId)) cooking += m.qty
  }
  return total > 0 && cooking / total > 0.75
}

/** Kits (grups sense motxilla) amb més d'un 75 % de material de cuina. */
export function cookingKits(data: GearData): Group[] {
  return data.groups.filter((g) => g.backpackId == null && isCookingKit(data, g))
}

/**
 * Puntuació total d'una ressenya: la mitjana de les puntuacions posades
 * (sabor, neteja, preu i dificultat), o null si no n'hi ha cap.
 */
export function reviewScore(review: Review): number | null {
  const parts = [review.taste, review.cleaning, review.priceRating, review.difficulty].filter(
    (n): n is number => n != null,
  )
  if (parts.length === 0) return null
  return parts.reduce((sum, n) => sum + n, 0) / parts.length
}

/** Cert si `group` conté el grup `targetId`, directament o transitivament. */
export function groupContainsGroup(data: GearData, group: Group, targetId: string): boolean {
  const visited = new Set<string>()
  const walk = (g: Group): boolean => {
    if (visited.has(g.id)) return false
    visited.add(g.id)
    for (const childId of g.groupIds) {
      if (childId === targetId) return true
      const child = groupOf(data, childId)
      if (child && walk(child)) return true
    }
    return false
  }
  return walk(group)
}

/** «820 g» o «1,18 kg», segons la llengua activa. */
export function formatWeight(grams: number | null): string {
  if (grams === null) return '—'
  if (grams < 1000) return `${grams} g`
  const kg = grams / 1000
  return `${kg.toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`
}
