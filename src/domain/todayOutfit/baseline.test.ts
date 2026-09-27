import { describe, expect, it } from 'vitest'
import { OUTFIT_BAKEOFF_CASES } from './cases'
import { recommendDeterministicOutfit } from './baseline'

describe('deterministic Today Outfit baseline', () => {
  it('is reproducible and never mutates its input', () => {
    const input = structuredClone(OUTFIT_BAKEOFF_CASES[0])
    const before = structuredClone(input)
    expect(recommendDeterministicOutfit(input)).toEqual(recommendDeterministicOutfit(input))
    expect(input).toEqual(before)
  })
  it('selects only supplied IDs with category-correct required slots', () => {
    const input = OUTFIT_BAKEOFF_CASES.find((item) => item.id === 'outerwear-tradeoff')!
    const result = recommendDeterministicOutfit(input)
    expect(result.status).toBe('success')
    if (result.status !== 'success') return
    for (const [field, category] of Object.entries({ topId: 'top', bottomId: 'bottom', outerwearId: 'outerwear', shoesId: 'shoes' })) {
      const id = result.selectedItemIds[field as keyof typeof result.selectedItemIds]
      if (id) expect(input.wardrobe.find((item) => item.id === id)?.category).toBe(category)
    }
  })
  it('returns an explicit failure when a required clothing slot is absent', () => {
    const input = { ...OUTFIT_BAKEOFF_CASES[0], wardrobe: OUTFIT_BAKEOFF_CASES[0].wardrobe.filter((item) => item.category !== 'shoes') }
    expect(recommendDeterministicOutfit(input)).toEqual({ status: 'failure', reason: 'A top, bottom, and shoes are required for a complete outfit.' })
  })
  it('documents its narrow knowledge in every successful result', () => {
    const result = recommendDeterministicOutfit(OUTFIT_BAKEOFF_CASES[0])
    expect(result.status).toBe('success')
    if (result.status === 'success') expect(result.reasoning).toMatch(/does not understand silhouette, fabric, cultural dress codes, or aesthetic coordination/)
  })
})
