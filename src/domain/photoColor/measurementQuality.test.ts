import { describe, expect, it } from 'vitest'
import { assessPhotoMeasurement } from './measurementQuality'
import measurementQualitySource from './measurementQuality.ts?raw'
import { inspectHex, realMatchFor, solidImage } from './realMatchFixtures'
import { samplePhotoRegion } from './sampling'
import type { PhotoColorSample, PixelSource } from './types'

// V2.0 Slice 0.5A (spike, plan §M): proves assessPhotoMeasurement against the REAL sampler, not
// hand-built diagnostics objects -- a passing test means the conclusion holds against the shipped
// engine. See docs/V2_AI_COLOR_LAB.md §35 for the audit these cases are drawn from.

function sampleOf(image: PixelSource, radius = 24): PhotoColorSample {
  const result = samplePhotoRegion(image, { x: image.width / 2, y: image.height / 2 }, { radius })
  if (result.kind !== 'color') throw new Error('expected a color sample')
  return result
}

describe('assessPhotoMeasurement', () => {
  it('Case 1: a clean uniform fabric sample is not penalized', () => {
    const sample = inspectHex('#B85C46', 'warm-spring').sample // curated terracotta-ish colour
    expect(sample.diagnostics.spread).toBe(0)
    expect(assessPhotoMeasurement(sample)).toEqual({ issues: [] })
  })

  it('Case 2: a realistic clean near-black fabric is not penalized merely for being deep', () => {
    // Genuinely dark but not sensor-crushed (channels well above SHADOW_CHANNEL_MAX=5) -- the
    // only kind of "near-black" a real, correctly-exposed photo of dark fabric produces.
    const sample = sampleOf(solidImage('#141414'))
    expect(assessPhotoMeasurement(sample)).toEqual({ issues: [] })
  })

  it('Case 3: a realistic clean near-white fabric is not penalized merely for being light', () => {
    // A real curated pale colour (channels well below HIGHLIGHT_CHANNEL_MIN=250), the kind a
    // correctly-exposed photo of a light garment actually produces.
    const sample = inspectHex('#F5E6D3', 'warm-spring').sample
    expect(assessPhotoMeasurement(sample)).toEqual({ issues: [] })
  })

  it('Case 3 (documented limitation, unchanged from the existing sampler): a LITERAL, sensor-saturated uniform white still trips "highlight" -- current diagnostics cannot tell a truly clipped photo from a synthetic all-255 input, because both have zero spread and 100% of channels at the ceiling. See §35 for why this is not fixed in this spike.', () => {
    const sample = sampleOf(solidImage('#FFFFFF'))
    expect(sample.diagnostics.spread).toBe(0) // a clean measurement by every other signal
    expect(assessPhotoMeasurement(sample).issues).toContain('highlight')
  })

  it('Case 4: a mixed boundary sample (garment/background checkerboard) is degraded', () => {
    const width = 24, height = 24
    const data = new Uint8ClampedArray(width * height * 4)
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const index = (row * width + col) * 4
        const light = (col + row) % 2 === 0
        data.set([light ? 245 : 40, light ? 235 : 30, light ? 210 : 20, 255], index)
      }
    }
    const sample = sampleOf({ width, height, data }, 10)
    expect(sample.diagnostics.flags).toContain('mixed')
    expect(assessPhotoMeasurement(sample).issues).toContain('mixed')
  })

  it('Case 5/6: shadow and highlight, as the sampler itself defines them, are surfaced unchanged', () => {
    const shadow = sampleOf(solidImage('#020203'))
    expect(assessPhotoMeasurement(shadow)).toEqual({ issues: ['shadow'] })
    const highlight = sampleOf(solidImage('#FEFEFE'))
    expect(assessPhotoMeasurement(highlight)).toEqual({ issues: ['highlight'] })
  })

  it('Case 7: low chroma alone (neutral gray) is not penalized', () => {
    const sample = sampleOf(solidImage('#808080'))
    expect(assessPhotoMeasurement(sample)).toEqual({ issues: [] })
  })

  it('Case 8: a clean sample far from every palette reference (category "outside") is still not penalized -- measurement quality is independent of palette distance', () => {
    const far = realMatchFor('warm-spring', 'outside')
    expect(far).not.toBeNull()
    expect(assessPhotoMeasurement(far!.sample)).toEqual({ issues: [] })
  })

  it('is deterministic', () => {
    const sample = inspectHex('#F5E6D3', 'warm-spring').sample
    expect(assessPhotoMeasurement(sample)).toEqual(assessPhotoMeasurement(sample))
  })

  it('reads only sample.diagnostics.flags -- structurally cannot see category, distance or subtype', () => {
    // Only the import list is checked against forbidden modules: the file's own prose comments
    // legitimately discuss (and disclaim) suitability/AI/palette by name.
    const imports = [...measurementQualitySource.matchAll(/from '([^']+)'/g)].map((match) => match[1])
    expect(imports).toEqual(['./types'])
    const body = measurementQualitySource.replace(/\/\/.*$/gm, '')
    for (const token of ['photoMatch', 'suitability', 'palette', 'Subtype', 'aiColorLab', 'fetch']) {
      expect(body).not.toMatch(new RegExp(token))
    }
  })
})
