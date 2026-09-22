import { describe, expect, it } from 'vitest'
import { palettes } from './palettes'
import { subtypeOrder } from './seasons'

describe('curated palettes', () => {
  it('covers all 12 subtypes with useful category sizes', () => {
    expect(Object.keys(palettes)).toHaveLength(12)
    subtypeOrder.forEach((subtype) => {
      expect(palettes[subtype].best.length).toBeGreaterThanOrEqual(8)
      expect(palettes[subtype].neutrals.length).toBeGreaterThanOrEqual(5)
      expect(palettes[subtype].accents.length).toBeGreaterThanOrEqual(5)
      expect(palettes[subtype].harder.length).toBeGreaterThanOrEqual(4)
      expect(palettes[subtype].metals.length).toBeGreaterThanOrEqual(2)
    })
  })
  it('contains valid HEX colors and unique IDs', () => {
    const ids: string[] = []
    subtypeOrder.forEach((subtype) => {
      const palette = palettes[subtype]
      const entries = [...palette.best, ...palette.neutrals, ...palette.accents, ...palette.harder, ...palette.metals]
      entries.forEach((entry) => { ids.push(entry.id); expect(entry.hex).toMatch(/^#[0-9A-F]{6}$/) })
    })
    expect(new Set(ids).size).toBe(ids.length)
  })
})
