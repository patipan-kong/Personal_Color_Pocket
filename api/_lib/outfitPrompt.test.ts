import { describe, expect, it } from 'vitest'
import { OUTFIT_BAKEOFF_CASES } from '../../src/domain/todayOutfit/cases.js'
import { buildOutfitPrompt } from './outfitPrompt.js'

describe('Today Outfit canonical provider prompt', () => {
  it('grounds every provider in IDs, subtype facts, near-face priority, occasion, and JSON-only output', () => {
    const prompt = buildOutfitPrompt(OUTFIT_BAKEOFF_CASES[0])
    for (const phrase of ['Select only IDs', 'Never invent', 'Personal Color matters most near the face', 'Do not output colors, HEX corrections, subtype', 'JSON only', 'warm-spring', 'cream-tee']) expect(prompt).toContain(phrase)
  })
  it('contains no photo/image instructions', () => expect(buildOutfitPrompt(OUTFIT_BAKEOFF_CASES[0])).not.toMatch(/base64|image_url|photo upload/i))
})
