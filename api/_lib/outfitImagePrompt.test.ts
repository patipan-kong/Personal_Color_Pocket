import { describe, expect, it } from 'vitest'
import { recommendDeterministicOutfit } from '../../src/domain/todayOutfit/baseline'
import { OUTFIT_BAKEOFF_CASES } from '../../src/domain/todayOutfit/cases'
import { deriveTodayOutfitImageRequest } from '../../src/domain/todayOutfitImage/contract'
import { buildOutfitImagePrompt } from './outfitImagePrompt'

function promptFor(caseIndex: number) {
  const input = OUTFIT_BAKEOFF_CASES[caseIndex]
  const result = recommendDeterministicOutfit(input)
  if (result.status !== 'success') throw new Error('fixture must succeed')
  return buildOutfitImagePrompt(deriveTodayOutfitImageRequest(input, result, 'gemini-image-lite'))
}

describe('Today Outfit image prompt', () => {
  it('deterministically includes selected categories, garment names, and HEX values', () => {
    const prompt = promptFor(0)
    expect(prompt).toContain('TOP')
    expect(prompt).toContain('Cream T-shirt')
    expect(prompt).toContain('#FFF0CF')
    expect(prompt).toContain('BOTTOM')
    expect(prompt).toContain('SHOES')
    expect(promptFor(0)).toBe(prompt)
  })

  it('omits outerwear when it is null and includes it when selected', () => {
    expect(promptFor(0)).not.toContain('OUTERWEAR')
    expect(promptFor(3)).toContain('OUTERWEAR')
  })

  it('requires no person, text, extra accessories, stylist reasoning, or user prompt', () => {
    const prompt = promptFor(0)
    expect(prompt).toMatch(/No person/)
    expect(prompt).toMatch(/No text/)
    expect(prompt).toMatch(/No decorative accessories/)
    expect(prompt).toMatch(/Do not choose, recommend, improve, or change/)
    expect(prompt).not.toMatch(/personalColorNotes|reasoning|occasionContext|user prompt/i)
  })
})
