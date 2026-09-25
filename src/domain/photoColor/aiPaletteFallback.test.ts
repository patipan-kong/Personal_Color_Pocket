import { describe, expect, it } from 'vitest'
import { getPalette } from '../personalColor/palettes'
import aiPaletteFallbackSource from './aiPaletteFallback.ts?raw'
import { resolvePaletteSelectionResult } from './aiPaletteFallback'

// V2.0 Slice 0.5C (plan §I, §S): proves that only status:'selected' can ever produce a
// replacement result, and that a valid selection resolves through the UNMODIFIED Slice 0.5B
// resolver -- no new suitability logic, no fabricated hex.

describe('resolvePaletteSelectionResult', () => {
  it('a valid "selected" colorId resolves through resolveAiFallbackSelection to a full result', () => {
    const chosen = getPalette('warm-spring').best[0]
    const result = { status: 'selected' as const, colorId: chosen.id, target: { objectType: 'shirt', objectDescription: 'x' }, reasoning: 'x' }
    const outcome = resolvePaletteSelectionResult(result, 'warm-spring')
    expect(outcome.kind).toBe('result')
    if (outcome.kind !== 'result') throw new Error('expected a result')
    expect(outcome.resolution.result.color).toBe(chosen) // same object identity, never a re-derived copy
    expect(outcome.resolution.result.category).toBe('near-face')
    expect(outcome.resolution.result.suitability).toBe('strong')
  })

  it('"uncertain" produces no replacement result', () => {
    const result = { status: 'uncertain' as const, target: null, reasoning: 'x' }
    expect(resolvePaletteSelectionResult(result, 'warm-spring')).toEqual({ kind: 'no-replacement', status: 'uncertain' })
  })

  it('"target-mismatch" produces no replacement result', () => {
    const result = { status: 'target-mismatch' as const, target: null, reasoning: 'x' }
    expect(resolvePaletteSelectionResult(result, 'warm-spring')).toEqual({ kind: 'no-replacement', status: 'target-mismatch' })
  })

  it('"unusable" produces no replacement result', () => {
    const result = { status: 'unusable' as const, target: null, reasoning: 'x' }
    expect(resolvePaletteSelectionResult(result, 'warm-spring')).toEqual({ kind: 'no-replacement', status: 'unusable' })
  })

  it('a hallucinated colorId that somehow reached this function (should not happen -- the response validator already rejects it) still fails safely, not with a crash', () => {
    const result = { status: 'selected' as const, colorId: 'not-a-real-id', target: { objectType: 'shirt', objectDescription: 'x' }, reasoning: 'x' }
    expect(resolvePaletteSelectionResult(result, 'warm-spring')).toEqual({ kind: 'unresolved', reason: 'unknown-color-id' })
  })

  it('never fabricates RGB/HEX/OKLab and never imports the deterministic sampler/matcher', () => {
    const imports = [...aiPaletteFallbackSource.matchAll(/from '([^']+)'/g)].map((match) => match[1]).sort()
    expect(imports).toEqual(['../aiColorLab/paletteContract', '../personalColor/types', './aiFallback', './aiFallback'])
    const body = aiPaletteFallbackSource.replace(/\/\/.*$/gm, '')
    for (const token of ['samplePhotoRegion', 'matchPhotoColor', 'rgbToOklab', 'hexToOklab', 'fetch']) {
      expect(body).not.toMatch(new RegExp(token))
    }
  })
})
