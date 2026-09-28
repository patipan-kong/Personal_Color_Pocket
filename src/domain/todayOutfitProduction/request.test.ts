import { describe, expect, it } from 'vitest'
import type { WardrobeRecordV1 } from '../wardrobe/wardrobe'
import { buildOwnedOutfitRequest, fingerprintOwnedOutfitRequest, resolveOwnedLuckyPreferences } from './request'

const monday = new Date(2026, 8, 21, 10)
const wardrobe: WardrobeRecordV1[] = [
  { id: 'top', garmentType: 'shirt', color: { hex: '#FFF0CF' }, formality: 'smart-casual', customName: 'My private office shirt' },
  { id: 'bottom', garmentType: 'trousers', color: { hex: '#314C5A' }, formality: 'smart-casual' },
  { id: 'shoes', garmentType: 'loafers', color: { hex: '#82624A' }, formality: 'smart-casual' },
]

describe('production owned-outfit request construction', () => {
  it('sends zero Lucky preferences without invoking fabricated facts', () => {
    const request = buildOwnedOutfitRequest({ date: monday, goals: [], language: 'en', occasion: 'work', wardrobe })
    expect(request.luckyPreferences).toEqual([])
    expect(request.wardrobe.every((item) => item.luckyFamilyMatches.length === 0)).toBe(true)
    expect(request.subtype).toBeNull()
  })

  it('resolves one or two current-day Lucky preferences and merges duplicate families', () => {
    expect(resolveOwnedLuckyPreferences(monday, ['work'])).toEqual([{ family: 'green', hex: null, suitability: 'accessory', priority: 'soft' }])
    expect(resolveOwnedLuckyPreferences(monday, ['work', 'money'])).toHaveLength(2)
    expect(resolveOwnedLuckyPreferences(monday, ['work', 'work'])).toHaveLength(1)
  })

  it('includes deterministic subtype compatibility while excluding customName and display names', () => {
    const request = buildOwnedOutfitRequest({ date: monday, goals: ['work'], language: 'th', subtype: 'warm-spring', occasion: 'work', wardrobe })
    expect(request.subtype).toBe('warm-spring')
    expect(request.wardrobe[0].personalColorCompatibility).toMatchObject({ rating: expect.any(String), score: expect.any(Number) })
    const wire = JSON.stringify(request)
    expect(wire).not.toContain('customName')
    expect(wire).not.toContain('My private office shirt')
    expect(wire).not.toContain('canonicalColorId')
  })

  it('keeps a result current across locale-only changes while still fingerprinting selection facts', () => {
    const english = buildOwnedOutfitRequest({ date: monday, goals: ['work'], language: 'en', subtype: 'warm-spring', occasion: 'work', wardrobe })
    const thai = { ...english, language: 'th' as const }
    expect(fingerprintOwnedOutfitRequest(thai)).toBe(fingerprintOwnedOutfitRequest(english))
    expect(fingerprintOwnedOutfitRequest({ ...english, occasion: 'formal' })).not.toBe(fingerprintOwnedOutfitRequest(english))
  })
})
