import { describe, expect, it } from 'vitest'
import { getPalette } from '../personalColor/palettes'
import { subtypeOrder } from '../personalColor/seasons'
import { attemptAiFallback, resolveAiFallbackSelection } from './aiFallback'
import aiFallbackSource from './aiFallback.ts?raw'
import { inspectHex } from './realMatchFixtures'

// V2.0 Slice 0.5B (spike, plan §O): proves the resolver against the REAL canonical palette data
// and, for the category shortcut specifically, against the REAL deterministic sampler+matcher
// (inspectHex), so a passing test means the shortcut never diverges from what matchPhotoColor
// would independently compute for the same colour.

describe('resolveAiFallbackSelection', () => {
  it('a successful selection resolves to the real canonical colour, category and suitability', () => {
    const palette = getPalette('warm-spring')
    const chosen = palette.best[0]
    const resolution = resolveAiFallbackSelection({ subtype: 'warm-spring', colorId: chosen.id })
    expect(resolution).toEqual({
      ok: true,
      result: {
        source: 'ai-fallback',
        subtype: 'warm-spring',
        color: chosen,
        group: 'best',
        category: 'near-face',
        suitability: 'strong',
        pairWith: expect.any(Array),
      },
    })
  })

  it('a neutrals selection resolves to neutral-base / good', () => {
    const palette = getPalette('warm-spring')
    const resolution = resolveAiFallbackSelection({ subtype: 'warm-spring', colorId: palette.neutrals[0].id })
    expect(resolution.ok).toBe(true)
    if (!resolution.ok) throw new Error('expected ok')
    expect(resolution.result.category).toBe('neutral-base')
    expect(resolution.result.suitability).toBe('good')
  })

  it('a harder selection resolves to away-from-face / weak, never outside', () => {
    const palette = getPalette('warm-spring')
    const resolution = resolveAiFallbackSelection({ subtype: 'warm-spring', colorId: palette.harder[0].id })
    expect(resolution.ok).toBe(true)
    if (!resolution.ok) throw new Error('expected ok')
    expect(resolution.result.category).toBe('away-from-face')
    expect(resolution.result.suitability).toBe('weak')
  })

  it('never fabricates a hex: the resolved colour is always the exact object from getPalette', () => {
    const palette = getPalette('cool-winter')
    const chosen = palette.accents[2]
    const resolution = resolveAiFallbackSelection({ subtype: 'cool-winter', colorId: chosen.id })
    expect(resolution.ok).toBe(true)
    if (!resolution.ok) throw new Error('expected ok')
    expect(resolution.result.color.hex).toBe(chosen.hex)
    expect(resolution.result.color).toBe(chosen) // same object identity, not a re-derived copy
  })

  it('an unknown/hallucinated color id fails safely, not with a thrown error', () => {
    expect(resolveAiFallbackSelection({ subtype: 'warm-spring', colorId: 'not-a-real-id' }))
      .toEqual({ ok: false, reason: 'unknown-color-id' })
  })

  it('every canonical color, in every subtype, resolves to exactly the category the REAL sampler+matcher would independently compute for that same hex', () => {
    for (const subtype of subtypeOrder) {
      const palette = getPalette(subtype)
      for (const group of ['best', 'accents', 'neutrals', 'harder'] as const) {
        for (const color of palette[group]) {
          const resolution = resolveAiFallbackSelection({ subtype, colorId: color.id })
          expect(resolution.ok, `${subtype}/${color.id}`).toBe(true)
          if (!resolution.ok) continue
          const real = inspectHex(color.hex, subtype)
          expect(resolution.result.category, `${subtype}/${color.id}`).toBe(real.match.category)
          expect(resolution.result.suitability, `${subtype}/${color.id}`).not.toBe('outside')
        }
      }
    }
  })
})

describe('attemptAiFallback', () => {
  const colorId = getPalette('warm-spring').best[0].id

  it('a clean successful attempt resolves to a result', () => {
    const outcome = attemptAiFallback({ providerOk: true, targetMatched: true, sampleUsable: true, colorId, subtype: 'warm-spring' })
    expect(outcome.kind).toBe('result')
    if (outcome.kind !== 'result') throw new Error('expected a result')
    expect(outcome.result.source).toBe('ai-fallback')
  })

  it('provider failure is terminal and never attempts resolution, even with a valid colorId', () => {
    expect(attemptAiFallback({ providerOk: false, targetMatched: true, sampleUsable: true, colorId, subtype: 'warm-spring' }))
      .toEqual({ kind: 'terminal', reason: 'provider-failed' })
  })

  it('a target mismatch is terminal, even with a valid colorId', () => {
    expect(attemptAiFallback({ providerOk: true, targetMatched: false, sampleUsable: true, colorId, subtype: 'warm-spring' }))
      .toEqual({ kind: 'terminal', reason: 'target-mismatch' })
  })

  it('an unusable sample is terminal, even with a valid colorId', () => {
    expect(attemptAiFallback({ providerOk: true, targetMatched: true, sampleUsable: false, colorId, subtype: 'warm-spring' }))
      .toEqual({ kind: 'terminal', reason: 'sample-unusable' })
  })

  it('no colorId (AI declined/uncertain) is terminal, not a crash', () => {
    expect(attemptAiFallback({ providerOk: true, targetMatched: true, sampleUsable: true, colorId: null, subtype: 'warm-spring' }))
      .toEqual({ kind: 'terminal', reason: 'unknown-color-id' })
  })

  it('a hallucinated colorId is terminal, not a crash, even when target/sample are fine', () => {
    expect(attemptAiFallback({ providerOk: true, targetMatched: true, sampleUsable: true, colorId: 'made-up', subtype: 'warm-spring' }))
      .toEqual({ kind: 'terminal', reason: 'unknown-color-id' })
  })

  it('is a single terminal step: the source has no loop and no recursive/provider call', () => {
    const body = aiFallbackSource.slice(aiFallbackSource.indexOf('{', aiFallbackSource.indexOf('export function attemptAiFallback')))
    for (const token of ['attemptAiFallback(', 'while (', 'for (', 'fetch(', 'setTimeout(']) expect(body).not.toContain(token)
  })
})

describe('module boundaries', () => {
  it('never touches the deterministic sampler/matcher and never fabricates RGB/OKLab', () => {
    const imports = [...aiFallbackSource.matchAll(/from '([^']+)'/g)].map((match) => match[1]).sort()
    expect(imports).toEqual(['../personalColor/colorMatch', '../personalColor/palettes', '../personalColor/types', './suitability', './suitability', './types'])
    const body = aiFallbackSource.replace(/\/\/.*$/gm, '')
    for (const token of ['samplePhotoRegion', 'matchPhotoColor', 'rgbToOklab', 'hexToOklab', 'fetch']) {
      expect(body).not.toMatch(new RegExp(token))
    }
  })
})
