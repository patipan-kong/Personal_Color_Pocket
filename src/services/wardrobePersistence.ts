import { parseWardrobeRecord } from '../domain/wardrobe/wardrobe'
import type { WardrobeRecordV1, WardrobeRecordRepair } from '../domain/wardrobe/wardrobe'

export const WARDROBE_STORAGE_KEY = 'personal-color-pocket:wardrobe:v1'
export const WARDROBE_STORAGE_VERSION = 1
// Safety/storage validation ceiling, not a product recommendation. It leaves ample room above the
// expected ~100-item wardrobe while bounding corrupted or unexpectedly large payloads.
export const MAX_WARDROBE_ITEMS = 250

export interface StoredWardrobeV1 {
  readonly version: typeof WARDROBE_STORAGE_VERSION
  readonly items: readonly WardrobeRecordV1[]
}

interface LoadedWardrobe {
  readonly status: 'loaded'
  readonly items: readonly WardrobeRecordV1[]
  readonly repaired: boolean
  readonly skippedItemCount: number
  readonly repairs: readonly WardrobeRecordRepair[]
}

export type WardrobeLoadResult = LoadedWardrobe
  | { readonly status: 'corrupt'; readonly items: readonly []; readonly reason: 'malformed-json' | 'invalid-envelope' }
  | { readonly status: 'unsupported-version'; readonly items: readonly []; readonly version: number }
  | { readonly status: 'unavailable'; readonly items: readonly []; readonly reason: 'storage-read-failed' }

export type WardrobeSaveResult =
  | { readonly ok: true; readonly items: readonly WardrobeRecordV1[] }
  | { readonly ok: false; readonly reason: 'invalid-records' | 'duplicate-ids' | 'collection-too-large' | 'storage-write-failed' }

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem'>

const emptyLoaded = (): LoadedWardrobe => ({ status: 'loaded', items: [], repaired: false, skippedItemCount: 0, repairs: [] })
const isPlainRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function loadWardrobe(storage: ReadStorage = localStorage): WardrobeLoadResult {
  let raw: string | null
  try {
    raw = storage.getItem(WARDROBE_STORAGE_KEY)
  } catch {
    return { status: 'unavailable', items: [], reason: 'storage-read-failed' }
  }
  if (raw === null) return emptyLoaded()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'corrupt', items: [], reason: 'malformed-json' }
  }
  if (!isPlainRecord(parsed) || typeof parsed.version !== 'number' || !Number.isInteger(parsed.version)) {
    return { status: 'corrupt', items: [], reason: 'invalid-envelope' }
  }
  if (parsed.version !== WARDROBE_STORAGE_VERSION) return { status: 'unsupported-version', items: [], version: parsed.version }
  if (!Array.isArray(parsed.items)) return { status: 'corrupt', items: [], reason: 'invalid-envelope' }

  const items: WardrobeRecordV1[] = []
  const ids = new Set<string>()
  const repairs: WardrobeRecordRepair[] = []
  let skippedItemCount = Math.max(0, parsed.items.length - MAX_WARDROBE_ITEMS)
  for (const rawItem of parsed.items.slice(0, MAX_WARDROBE_ITEMS)) {
    const result = parseWardrobeRecord(rawItem)
    if (!result.ok || ids.has(result.value.id)) {
      skippedItemCount += 1
      continue
    }
    ids.add(result.value.id)
    items.push(result.value)
    repairs.push(...result.repairs)
  }
  return {
    status: 'loaded',
    items,
    repaired: repairs.length > 0 || skippedItemCount > 0,
    skippedItemCount,
    repairs,
  }
}

export function saveWardrobe(items: readonly WardrobeRecordV1[], storage: WriteStorage = localStorage): WardrobeSaveResult {
  if (items.length > MAX_WARDROBE_ITEMS) return { ok: false, reason: 'collection-too-large' }
  const validated: WardrobeRecordV1[] = []
  const ids = new Set<string>()
  for (const item of items) {
    const result = parseWardrobeRecord(item)
    if (!result.ok) return { ok: false, reason: 'invalid-records' }
    if (ids.has(result.value.id)) return { ok: false, reason: 'duplicate-ids' }
    ids.add(result.value.id)
    validated.push(result.value)
  }
  try {
    const envelope: StoredWardrobeV1 = { version: WARDROBE_STORAGE_VERSION, items: validated }
    storage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify(envelope))
    return { ok: true, items: validated }
  } catch {
    return { ok: false, reason: 'storage-write-failed' }
  }
}
