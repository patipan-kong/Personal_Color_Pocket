import { describe, expect, it } from 'vitest'
import { OUTFIT_BAKEOFF_CASES } from './cases'
import { buildOutfitStylingContext } from './facts'

describe('app-owned styling context', () => {
  it('derives subtype compatibility deterministically and exposes no field for AI to redefine it', () => {
    const input = OUTFIT_BAKEOFF_CASES[0]
    const context = buildOutfitStylingContext(input)
    expect(context.subtype).toBe(input.subtype)
    expect(context.wardrobe.every((item) => item.personalColorCompatibility && typeof item.personalColorCompatibility.score === 'number')).toBe(true)
    expect(JSON.stringify(context)).not.toContain('recommendedSubtype')
  })
})
