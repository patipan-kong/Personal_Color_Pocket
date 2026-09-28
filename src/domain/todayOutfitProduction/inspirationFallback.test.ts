import { describe, expect, it } from 'vitest'
import { TODAY_OCCASIONS } from './todayInputs'
import { buildInspirationOutfitRequest } from './inspirationRequest'
import { recommendInspirationOutfitFallback } from './inspirationFallback'
import { inspirationPieces } from './inspirationPresentation'
import { validateInspirationOutfitRecommendation } from './inspirationContract'

const monday = new Date(2026, 8, 21, 10)

describe('deterministic Inspiration fallback', () => {
  it.each(TODAY_OCCASIONS)('returns a complete valid, stable %s look', (occasion) => {
    const request = buildInspirationOutfitRequest({ date: monday, goals: [], subtype: 'warm-spring', occasion })
    const first = recommendInspirationOutfitFallback(request)
    expect(first).not.toBeNull()
    expect(first).toEqual(recommendInspirationOutfitFallback(request))
    expect(validateInspirationOutfitRecommendation(first, request).ok).toBe(true)
    expect(inspirationPieces(first!).at(-1)?.garmentType).toMatch(/shoes|sneakers|loafers|flats|heels|boots|sandals/)
  })

  it('supports both separates and one-piece results', () => {
    const casual = buildInspirationOutfitRequest({ date: monday, goals: [], occasion: 'casual' })
    const formal = buildInspirationOutfitRequest({ date: monday, goals: [], occasion: 'formal' })
    expect(recommendInspirationOutfitFallback(casual)?.outfit.kind).toBe('separates')
    expect(recommendInspirationOutfitFallback(formal)?.outfit.kind).toBe('one-piece')
  })

  it('uses a canonical Personal Color near the face and keeps Lucky as a below-face soft preference', () => {
    const request = buildInspirationOutfitRequest({ date: monday, goals: ['work'], subtype: 'warm-spring', occasion: 'work' })
    const result = recommendInspirationOutfitFallback(request)!
    expect(result.outfit.kind).toBe('separates')
    if (result.outfit.kind !== 'separates') return
    expect(result.outfit.top.color.kind).toBe('canonical')
    expect(result.outfit.bottom.color.kind).toBe('generic')
  })

  it('works without subtype and does not fabricate canonical identities', () => {
    const request = buildInspirationOutfitRequest({ date: monday, goals: ['money'], occasion: 'wedding-guest' })
    const result = recommendInspirationOutfitFallback(request)!
    expect(inspirationPieces(result).every((piece) => piece.color.kind === 'generic')).toBe(true)
  })
})
