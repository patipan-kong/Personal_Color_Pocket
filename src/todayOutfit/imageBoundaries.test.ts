import { describe, expect, it } from 'vitest'
import appSource from '../App.tsx?raw'
import devServerSource from '../../api/devServer.ts?raw'
import imageContractSource from '../domain/todayOutfitImage/contract.ts?raw'

describe('Today Outfit image experiment boundaries', () => {
  it('remains under the existing DEV-only outfit Lab gate', () => {
    expect(appSource).toContain("import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === 'outfit'")
    expect(devServerSource).toContain('/api\\/ai-outfit-image')
  })

  it('keeps Gemini transport and free-form prompts out of the image domain', () => {
    expect(imageContractSource).not.toMatch(/generativelanguage|GEMINI_API_KEY|fetch\(/)
    expect(imageContractSource).not.toMatch(/userPrompt|freeFormPrompt/)
  })

  it('does not add image generation to normal App navigation', () => {
    expect(appSource).not.toContain("debug: 'outfit-image'")
    expect(appSource).not.toContain('TodayOutfitImageLab')
  })
})
