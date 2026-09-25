import { describe, expect, it } from 'vitest'
import { getPalette } from '../domain/personalColor/palettes'
import { subtypeOrder } from '../domain/personalColor/seasons'
import { buildPaletteCandidates } from './buildPaletteRequest'

// V2.0 Slice 0.5C (plan §S): "request includes only canonical colors for the active subtype" and
// "category/suitability labels are not leaked into the AI choice list."

describe('buildPaletteCandidates', () => {
  it('includes every best/neutrals/accents/harder color for the subtype, and nothing else', () => {
    const palette = getPalette('warm-spring')
    const expectedCount = palette.best.length + palette.neutrals.length + palette.accents.length + palette.harder.length
    expect(buildPaletteCandidates('warm-spring')).toHaveLength(expectedCount)
  })

  it('excludes metals (jewelry recommendations are not garment colors)', () => {
    const candidates = buildPaletteCandidates('warm-spring')
    const metalIds = getPalette('warm-spring').metals.map((metal) => metal.id)
    for (const metalId of metalIds) expect(candidates.some((candidate) => candidate.colorId === metalId)).toBe(false)
  })

  it('each candidate is EXACTLY {colorId, name, hex} -- no group, category, or suitability leak (plan §H)', () => {
    for (const candidate of buildPaletteCandidates('warm-spring')) {
      expect(Object.keys(candidate).sort()).toEqual(['colorId', 'hex', 'name'])
    }
  })

  it('every candidate colorId, for every subtype, round-trips to the exact same canonical PaletteColor', () => {
    for (const subtype of subtypeOrder) {
      const palette = getPalette(subtype)
      const byId = new Map([...palette.best, ...palette.neutrals, ...palette.accents, ...palette.harder].map((color) => [color.id, color]))
      for (const candidate of buildPaletteCandidates(subtype)) {
        const real = byId.get(candidate.colorId)
        expect(real, candidate.colorId).toBeDefined()
        expect(candidate.name).toBe(real!.name)
        expect(candidate.hex).toBe(real!.hex)
      }
    }
  })
})
