import { describe, expect, it } from 'vitest'
import { GARMENT_TYPES } from '../wardrobe/taxonomy'
import { BASIC_WARDROBE_COLORS } from '../wardrobe/colors'
import { buildInspirationOutfitRequest, fingerprintInspirationOutfitRequest } from './inspirationRequest'

const monday = new Date(2026, 8, 21, 10)

describe('production Inspiration request construction and privacy', () => {
  it.each([
    ['zero', []],
    ['one', ['work']],
    ['two', ['work', 'money']],
  ] as const)('builds Lucky %s with finite app-owned candidates', (_label, goals) => {
    const request = buildInspirationOutfitRequest({ date: monday, goals, subtype: 'warm-spring', occasion: 'work' })
    expect(request.luckyPreferences.length).toBeLessThanOrEqual(2)
    expect(request.allowedGarmentTypes).toEqual(GARMENT_TYPES)
    expect(request.canonicalColorIds.length).toBeGreaterThan(0)
    expect(request.genericColorIds).toEqual(BASIC_WARDROBE_COLORS.map((color) => color.id))
  })

  it('works without Personal Color using only generic app-owned identities', () => {
    const request = buildInspirationOutfitRequest({ date: monday, goals: [], occasion: 'casual' })
    expect(request.subtype).toBeNull()
    expect(request.canonicalColorIds).toEqual([])
    expect(request.genericColorIds.length).toBeGreaterThan(0)
  })

  it('excludes wardrobe, private profile, presentation, storage, photos, and previous results', () => {
    const wire = JSON.stringify(buildInspirationOutfitRequest({ date: monday, goals: ['work'], subtype: 'warm-spring', occasion: 'date' }))
    for (const forbidden of ['wardrobe', 'customName', 'quiz', 'answer', 'presentation', 'language', 'localStorage', 'photo', 'previousResult']) expect(wire).not.toContain(forbidden)
    expect(wire).not.toMatch(/wardrobe-[a-z0-9-]+/)
  })

  it('omits locale and fingerprints every selection fact', () => {
    const request = buildInspirationOutfitRequest({ date: monday, goals: ['work'], subtype: 'warm-spring', occasion: 'date' })
    expect(request).not.toHaveProperty('language')
    expect(fingerprintInspirationOutfitRequest({ ...request, occasion: 'formal' })).not.toBe(fingerprintInspirationOutfitRequest(request))
    expect(fingerprintInspirationOutfitRequest({ ...request, luckyPreferences: [] })).not.toBe(fingerprintInspirationOutfitRequest(request))
  })
})
