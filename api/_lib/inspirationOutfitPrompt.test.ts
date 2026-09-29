import { describe, expect, it } from 'vitest'
import type { InspirationOutfitRequest } from '../../src/domain/todayOutfitProduction/inspirationContract.js'
import { BASIC_WARDROBE_COLORS } from '../../src/domain/wardrobe/colors.js'
import { allowedGarmentTypesForGender } from '../../src/domain/wardrobe/taxonomy.js'
import { buildInspirationOutfitPrompt } from './inspirationOutfitPrompt.js'

const marker = 'STRUCTURED INPUT:\n'
const facts = (prompt: string) => JSON.parse(prompt.slice(prompt.indexOf(marker) + marker.length)) as { gender: string | null; allowedGarments: { garmentType: string }[] }
const build = (gender: 'men' | 'women' | null) => buildInspirationOutfitPrompt({ version: 1, subtype: null, occasion: 'casual', gender, canonicalColorIds: [], genericColorIds: BASIC_WARDROBE_COLORS.map((color) => color.id), luckyPreferences: [] } satisfies InspirationOutfitRequest)

describe('Inspiration prompt gender constraint', () => {
  it('gives the provider the selected gender and only its derived garment taxonomy', () => {
    const men = facts(build('men'))
    expect(men.gender).toBe('men')
    expect(men.allowedGarments.map((garment) => garment.garmentType)).toEqual(allowedGarmentTypesForGender('men'))
    expect(men.allowedGarments.map((garment) => garment.garmentType)).not.toContain('heels')
    expect(facts(build('women')).allowedGarments.map((garment) => garment.garmentType)).toContain('heels')
  })

  it('states gender applicability as a hard validity constraint, not a preference', () => {
    expect(build('men')).toMatch(/HARD validity constraint/)
    expect(build('men')).not.toMatch(/prefer[^.]*gender/i)
  })
})
