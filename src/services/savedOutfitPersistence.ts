import { validateOwnedOutfitRecommendation, validateOwnedOutfitRequest } from '../domain/todayOutfitProduction/contract'
import { validateInspirationOutfitRecommendation, validateInspirationOutfitRequest } from '../domain/todayOutfitProduction/inspirationContract'
import type { ProductionTodayOutfitResult } from '../domain/todayOutfitProduction/result'

export const SAVED_OUTFITS_STORAGE_KEY = 'personal-color-pocket:saved-outfits:v1'
export const SAVED_OUTFITS_STORAGE_VERSION = 1 as const
export const MAX_SAVED_OUTFITS = 100

export interface SavedOutfitV1 {
  readonly id: string
  readonly createdAt: number
  readonly look: ProductionTodayOutfitResult
  readonly previewImageId?: string
}

export interface StoredSavedOutfitsV1 {
  readonly version: typeof SAVED_OUTFITS_STORAGE_VERSION
  readonly outfits: readonly SavedOutfitV1[]
}

export type SavedOutfitsLoadResult =
  | { readonly status: 'loaded'; readonly outfits: readonly SavedOutfitV1[] }
  | { readonly status: 'corrupt' | 'unsupported-version' | 'unavailable'; readonly outfits: readonly [] }

export type SavedOutfitsWriteResult =
  | { readonly ok: true; readonly outfits: readonly SavedOutfitV1[] }
  | { readonly ok: false; readonly reason: 'invalid' | 'unreadable' | 'storage-write-failed' }

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem'>
type StorageLike = ReadStorage & WriteStorage

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/
const plain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
let savedOutfitSequence = 0

function validProductionLook(value: unknown): value is ProductionTodayOutfitResult {
  if (!plain(value) || (value.mode !== 'owned' && value.mode !== 'inspiration') || !plain(value.result)) return false
  if (value.mode === 'owned') {
    const request = validateOwnedOutfitRequest(value.request)
    return request.ok && request.value !== null
      && (value.result.source === 'ai' || value.result.source === 'deterministic-fallback')
      && validateOwnedOutfitRecommendation(value.result.recommendation, request.value).ok
  }
  const request = validateInspirationOutfitRequest(value.request)
  return request.ok && request.value !== null
    && (value.result.source === 'ai' || value.result.source === 'deterministic-fallback')
    && validateInspirationOutfitRecommendation(value.result.recommendation, request.value).ok
}

function parseSavedOutfit(value: unknown): SavedOutfitV1 | null {
  if (!plain(value)) return null
  const fields = Object.keys(value)
  if (fields.some((field) => !['id', 'createdAt', 'look', 'previewImageId'].includes(field))) return null
  if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) return null
  if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt) || value.createdAt <= 0) return null
  if (value.previewImageId !== undefined && (typeof value.previewImageId !== 'string' || !ID_PATTERN.test(value.previewImageId))) return null
  if (!validProductionLook(value.look)) return null
  return value as unknown as SavedOutfitV1
}

export function loadSavedOutfits(storage: ReadStorage = localStorage): SavedOutfitsLoadResult {
  let raw: string | null
  try { raw = storage.getItem(SAVED_OUTFITS_STORAGE_KEY) } catch { return { status: 'unavailable', outfits: [] } }
  if (raw === null) return { status: 'loaded', outfits: [] }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return { status: 'corrupt', outfits: [] } }
  if (!plain(parsed) || typeof parsed.version !== 'number') return { status: 'corrupt', outfits: [] }
  if (parsed.version !== SAVED_OUTFITS_STORAGE_VERSION) return { status: 'unsupported-version', outfits: [] }
  if (!Array.isArray(parsed.outfits) || parsed.outfits.length > MAX_SAVED_OUTFITS) return { status: 'corrupt', outfits: [] }
  const outfits = parsed.outfits.map(parseSavedOutfit)
  if (outfits.some((outfit) => outfit === null)) return { status: 'corrupt', outfits: [] }
  const valid = outfits as SavedOutfitV1[]
  if (new Set(valid.map((outfit) => outfit.id)).size !== valid.length) return { status: 'corrupt', outfits: [] }
  return { status: 'loaded', outfits: valid }
}

export function saveSavedOutfits(outfits: readonly SavedOutfitV1[], storage: WriteStorage = localStorage): SavedOutfitsWriteResult {
  if (outfits.length > MAX_SAVED_OUTFITS || outfits.some((outfit) => !parseSavedOutfit(outfit)) || new Set(outfits.map((outfit) => outfit.id)).size !== outfits.length) return { ok: false, reason: 'invalid' }
  try {
    const envelope: StoredSavedOutfitsV1 = { version: SAVED_OUTFITS_STORAGE_VERSION, outfits }
    const serialized = JSON.stringify(envelope)
    if (/data:image\//i.test(serialized)) return { ok: false, reason: 'invalid' }
    storage.setItem(SAVED_OUTFITS_STORAGE_KEY, serialized)
    return { ok: true, outfits }
  } catch { return { ok: false, reason: 'storage-write-failed' } }
}

export function createSavedOutfitId(now = Date.now()): string {
  savedOutfitSequence = (savedOutfitSequence + 1) % 1_000_000
  return `saved-${now.toString(36)}-${savedOutfitSequence.toString(36)}`
}

export function addSavedOutfit(look: ProductionTodayOutfitResult, storage: StorageLike = localStorage, now = Date.now()): SavedOutfitsWriteResult & { readonly outfit?: SavedOutfitV1 } {
  const loaded = loadSavedOutfits(storage)
  if (loaded.status !== 'loaded') return { ok: false, reason: 'unreadable' }
  const outfit: SavedOutfitV1 = { id: createSavedOutfitId(now), createdAt: now, look }
  const saved = saveSavedOutfits([...loaded.outfits, outfit], storage)
  return saved.ok ? { ...saved, outfit } : saved
}

export function setSavedOutfitPreviewImage(outfitId: string, previewImageId: string, storage: StorageLike = localStorage): SavedOutfitsWriteResult {
  const loaded = loadSavedOutfits(storage)
  if (loaded.status !== 'loaded') return { ok: false, reason: 'unreadable' }
  const index = loaded.outfits.findIndex((outfit) => outfit.id === outfitId)
  if (index < 0 || !ID_PATTERN.test(previewImageId)) return { ok: false, reason: 'invalid' }
  const outfits = loaded.outfits.map((outfit) => outfit.id === outfitId ? { ...outfit, previewImageId } : outfit)
  return saveSavedOutfits(outfits, storage)
}

export function removeSavedOutfit(outfitId: string, storage: StorageLike = localStorage): SavedOutfitsWriteResult {
  const loaded = loadSavedOutfits(storage)
  if (loaded.status !== 'loaded') return { ok: false, reason: 'unreadable' }
  return saveSavedOutfits(loaded.outfits.filter((outfit) => outfit.id !== outfitId), storage)
}
