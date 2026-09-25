import { describe, expect, it } from 'vitest'
import type { NormalizedAiColorResult } from '../aiColorLab/contract'
import { deriveSampleAdvisory, NO_ADVISORY, suggestsAiAssist, toAiColorNormalization } from './aiNormalization'
import { inspectHex, solidImage } from './realMatchFixtures'
import { samplePhotoRegion } from './sampling'
import type { PhotoColorSample } from './types'

// V2.0 Slice 0.3B (spike, plan §G): proves the invariants the design in aiNormalization.ts claims,
// using the REAL deterministic engine (inspectHex -> samplePhotoRegion -> matchPhotoColor via
// realMatchFixtures.ts, the same helper the production match-engine tests use) rather than
// hand-built sample objects, so a passing test means the boundary actually holds against the
// shipped sampler/matcher, not a mock of it.

function aiResult(overrides: Partial<NormalizedAiColorResult> = {}): NormalizedAiColorResult {
  return {
    provider: 'gemini', model: 'gemini-3.5-flash',
    targetAssessment: { objectType: 'shirt', objectDescription: 'cream shirt', targetMatched: true },
    perceivedColorName: 'Cream', colorFamily: 'neutral', temperature: 'warm', value: 'light', chroma: 'muted',
    lighting: { condition: 'soft daylight', cast: 'neutral', severity: 'low' },
    sampleAssessment: { usable: true, issue: 'none' },
    suitability: 'recommended', confidence: 'high', reasoning: 'Warm, light, muted cream fits a Warm Spring palette well.',
    ...overrides,
  }
}

// A clean sample (real curated color, no sampler flags) for the D5 corroboration tests.
const cleanSample: PhotoColorSample = inspectHex('#F5E6D3', 'warm-spring').sample

// A sampler-flagged sample: a mixed/striped region genuinely trips the 'mixed' flag.
function stripedSample(): PhotoColorSample {
  const width = 24, height = 24
  const data = new Uint8ClampedArray(width * height * 4)
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const index = (row * width + col) * 4
      const light = (col + row) % 2 === 0
      data.set([light ? 245 : 40, light ? 235 : 30, light ? 210 : 20, 255], index)
    }
  }
  const sample = samplePhotoRegion({ width, height, data }, { x: width / 2, y: height / 2 }, { radius: 10 })
  if (sample.kind !== 'color') throw new Error('expected a color sample')
  return sample
}

describe('toAiColorNormalization', () => {
  it('carries only observational fields, never suitability or reasoning', () => {
    const result = aiResult()
    const normalization = toAiColorNormalization(result)
    expect(normalization).toEqual({
      targetAssessment: result.targetAssessment,
      perceivedColorName: result.perceivedColorName,
      colorFamily: result.colorFamily,
      temperature: result.temperature,
      value: result.value,
      chroma: result.chroma,
      lighting: result.lighting,
      sampleAssessment: result.sampleAssessment,
      confidence: result.confidence,
    })
    expect(normalization).not.toHaveProperty('suitability')
    expect(normalization).not.toHaveProperty('reasoning')
  })

  it('recommendation isolation: changing suitability/reasoning never changes the normalization', () => {
    const a = toAiColorNormalization(aiResult({ suitability: 'recommended', reasoning: 'Great pick.' }))
    const b = toAiColorNormalization(aiResult({ suitability: 'more_considered', reasoning: 'Avoid this one.' }))
    expect(a).toEqual(b)
  })
})

describe('deriveSampleAdvisory', () => {
  it('D1/D2: no AI opinion (disabled, unavailable, timeout, malformed response) -> NO_ADVISORY', () => {
    expect(deriveSampleAdvisory(cleanSample, null)).toBe(NO_ADVISORY)
  })

  it('flags a target mismatch regardless of confidence', () => {
    const normalization = toAiColorNormalization(aiResult({
      targetAssessment: { objectType: 'shoe', objectDescription: 'a shoe, not a shirt', targetMatched: false },
      confidence: 'high',
    }))
    const advisory = deriveSampleAdvisory(cleanSample, normalization)
    expect(advisory.caveat).toBe(true)
    expect(advisory.reasons).toContain('target-mismatch')
  })

  it('flags an AI-reported unusable sample', () => {
    const normalization = toAiColorNormalization(aiResult({ sampleAssessment: { usable: false, issue: 'shadow' } }))
    const advisory = deriveSampleAdvisory(cleanSample, normalization)
    expect(advisory.caveat).toBe(true)
    expect(advisory.reasons).toContain('sample-unusable')
  })

  it('D5: a lighting-cast concern on an otherwise CLEAN deterministic sample is not flagged, even at high severity', () => {
    const normalization = toAiColorNormalization(aiResult({
      lighting: { condition: 'warm indoor light', cast: 'warm', severity: 'high' },
      confidence: 'low',
    }))
    expect(cleanSample.diagnostics.flags).toEqual([])
    const advisory = deriveSampleAdvisory(cleanSample, normalization)
    expect(advisory.caveat).toBe(false)
    expect(advisory.reasons).not.toContain('lighting-cast-corroborated')
  })

  it('D5: the SAME lighting-cast report is corroborated once the deterministic sampler itself flags the region', () => {
    const sample = stripedSample()
    expect(sample.diagnostics.flags.length).toBeGreaterThan(0)
    const normalization = toAiColorNormalization(aiResult({ lighting: { condition: 'mixed', cast: 'warm', severity: 'medium' } }))
    const advisory = deriveSampleAdvisory(sample, normalization)
    expect(advisory.caveat).toBe(true)
    expect(advisory.reasons).toContain('lighting-cast-corroborated')
  })

  it('low confidence alone, with a neutral cast, never produces a caveat', () => {
    const normalization = toAiColorNormalization(aiResult({ confidence: 'low' }))
    const advisory = deriveSampleAdvisory(cleanSample, normalization)
    expect(advisory).toEqual(NO_ADVISORY)
  })

  it('never returns any color/category field -- structurally cannot override deterministic evidence', () => {
    const normalization = toAiColorNormalization(aiResult({ targetAssessment: { objectType: 'x', objectDescription: 'x', targetMatched: false } }))
    const advisory = deriveSampleAdvisory(cleanSample, normalization)
    expect(Object.keys(advisory).sort()).toEqual(['caveat', 'reasons'])
  })
})

describe('suggestsAiAssist', () => {
  it('reuses the real sampler flags for a mixed region', () => {
    expect(suggestsAiAssist(stripedSample())).toContain('sampler-flag-mixed')
  })

  it('flags an ambiguous near-gray neutral (below matchPhotoColor\'s own NEUTRAL_CHROMA_MAX)', () => {
    const image = solidImage('#808080')
    const sample = samplePhotoRegion(image, { x: image.width / 2, y: image.height / 2 }, { radius: 8 })
    if (sample.kind !== 'color') throw new Error('expected a color sample')
    expect(suggestsAiAssist(sample)).toContain('ambiguous-neutral')
  })

  it('flags extreme lightness for near-white', () => {
    const image = solidImage('#FDFDFD')
    const sample = samplePhotoRegion(image, { x: image.width / 2, y: image.height / 2 }, { radius: 8 })
    if (sample.kind !== 'color') throw new Error('expected a color sample')
    expect(suggestsAiAssist(sample)).toContain('extreme-lightness')
  })

  it('flags extreme lightness for near-black', () => {
    const image = solidImage('#0A0A0A')
    const sample = samplePhotoRegion(image, { x: image.width / 2, y: image.height / 2 }, { radius: 8 })
    if (sample.kind !== 'color') throw new Error('expected a color sample')
    expect(suggestsAiAssist(sample)).toContain('extreme-lightness')
  })

  it('returns no signals for an ordinary, clean, saturated, mid-lightness color', () => {
    const image = solidImage('#2E5AAC') // a mid-tone saturated blue: not neutral, not extreme
    const sample = samplePhotoRegion(image, { x: image.width / 2, y: image.height / 2 }, { radius: 8 })
    if (sample.kind !== 'color') throw new Error('expected a color sample')
    expect(suggestsAiAssist(sample)).toEqual([])
  })
})
