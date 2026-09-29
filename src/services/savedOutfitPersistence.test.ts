import { beforeEach, describe, expect, it } from 'vitest'
import { buildOwnedOutfitRequest } from '../domain/todayOutfitProduction/request'
import type { ProductionTodayOutfitResult } from '../domain/todayOutfitProduction/result'
import type { WardrobeRecordV1 } from '../domain/wardrobe/wardrobe'
import {
  SAVED_OUTFITS_STORAGE_KEY,
  addSavedOutfit,
  loadSavedOutfits,
  removeSavedOutfit,
  setSavedOutfitPreviewImage,
} from './savedOutfitPersistence'

const wardrobe: WardrobeRecordV1[] = [
  { id: 'top', garmentType: 't-shirt', color: { hex: '#112233' }, formality: 'casual' },
  { id: 'bottom', garmentType: 'jeans', color: { hex: '#334455' }, formality: 'casual' },
  { id: 'shoes', garmentType: 'sneakers', color: { hex: '#FFFFFF' }, formality: 'casual' },
]

function look(): ProductionTodayOutfitResult {
  const request = buildOwnedOutfitRequest({ date: new Date(2026, 8, 21), goals: [], language: 'en', occasion: 'casual', wardrobe })
  return {
    mode: 'owned', request,
    result: {
      source: 'ai',
      recommendation: {
        selection: { kind: 'separates', topId: 'top', bottomId: 'bottom', outerwearId: null, shoesId: 'shoes' },
        reasoning: { occasion: 'safe', personalColor: null, luckyColor: null },
      },
    },
  }
}

describe('Saved Outfit structured persistence', () => {
  beforeEach(() => localStorage.clear())

  it('saves authoritative structured data without any image data URL in localStorage', () => {
    const saved = addSavedOutfit(look(), localStorage, 1_700_000_000_000)
    expect(saved.ok).toBe(true)
    expect(loadSavedOutfits().status).toBe('loaded')
    expect(localStorage.getItem(SAVED_OUTFITS_STORAGE_KEY)).not.toMatch(/data:image|base64/i)
  })

  it('adds only an opaque image reference and preserves the structured outfit', () => {
    const saved = addSavedOutfit(look(), localStorage, 1_700_000_000_001)
    expect(saved.ok && saved.outfit).toBeTruthy()
    const linked = setSavedOutfitPreviewImage(saved.outfit!.id, `preview-${saved.outfit!.id}`)
    expect(linked.ok).toBe(true)
    const loaded = loadSavedOutfits()
    expect(loaded.status).toBe('loaded')
    if (loaded.status !== 'loaded') return
    expect(loaded.outfits[0].previewImageId).toBe(`preview-${saved.outfit!.id}`)
    expect(loaded.outfits[0].look).toEqual(look())
    expect(localStorage.getItem(SAVED_OUTFITS_STORAGE_KEY)).not.toMatch(/data:image|base64/i)
  })

  it('removes one Saved Outfit without removing another', () => {
    const first = addSavedOutfit(look(), localStorage, 1_700_000_000_010)
    const second = addSavedOutfit(look(), localStorage, 1_700_000_000_011)
    expect(first.ok && first.outfit && second.ok && second.outfit).toBeTruthy()
    const removed = removeSavedOutfit(first.outfit!.id)
    expect(removed.ok).toBe(true)
    expect(removed.ok && removed.outfits.map((outfit) => outfit.id)).toEqual([second.outfit!.id])
  })

  it('does not overwrite unreadable metadata when adding a new outfit', () => {
    localStorage.setItem(SAVED_OUTFITS_STORAGE_KEY, '{bad')
    expect(addSavedOutfit(look())).toEqual({ ok: false, reason: 'unreadable' })
    expect(localStorage.getItem(SAVED_OUTFITS_STORAGE_KEY)).toBe('{bad')
  })
})
