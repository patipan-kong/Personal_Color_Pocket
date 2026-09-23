import { describe, expect, it } from 'vitest'
import { hexToOklab } from '../../personalColor/colorUtils'
import { sampleRadiusFor } from '../coordinates'
import { PHOTO_CLOSE_DISTANCE, PHOTO_LIGHTNESS_WEIGHT, PHOTO_RELATED_DISTANCE } from '../photoMatch'
import {
  CLIPPED_FRACTION_WARN, DEFAULT_SAMPLE_RADIUS, DEFAULT_TRIM_FRACTION, HIGHLIGHT_CHANNEL_MIN, MIXED_SPREAD, SHADOW_CHANNEL_MAX, samplePhotoRegion,
} from '../sampling'
import { diagnosePoint, diagnoseTap, INVESTIGATION_RADII } from './diagnostics'
import {
  BLUE_CAST, OBSERVED, SHADE_SKY, WHITE, castSeries, categories, changedSubtypes, contextHint, exposureSeries, failureScenarios, flagOnset, garmentScene,
  garmentTaps, jitter, lightestRisk, litHex, mixedFixtures, runFixtures, solidHex, solidSample, whiteBalanceExperiment, whiteGarmentFixtures,
} from './experiments'
import { lit, oklabToRgb, scene } from './lightModel'
import { hexToRgb, rgbToOklab } from '../../personalColor/colorUtils'
import { buildReport } from './report'

// Slice 5e: INVESTIGATION ONLY. These tests pin the findings in
// docs/V1_2_SLICE_5E_REAL_WORLD_SAMPLING_INVESTIGATION.md against the UNCHANGED production sampler
// and matcher. They are evidence, not calibration: nothing here tunes a production constant.

const white = whiteGarmentFixtures()
const mixed = mixedFixtures()
const whiteRows = runFixtures(white)
const mixedRows = runFixtures(mixed)
const byId = (id: string) => [...whiteRows, ...mixedRows].find((row) => row.fixture.id === id)!

describe('the investigation cannot reach production', () => {
  it('no app source file imports the investigation folder', () => {
    const sources = import.meta.glob('../../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const app = Object.entries(sources).filter(([path]) => !/\.test\.tsx?$/.test(path) && !path.startsWith('./') && !path.includes('/test/'))
    expect(app.length).toBeGreaterThan(30)
    expect(app.filter(([, source]) => /investigation/.test(source)).map(([path]) => path)).toEqual([])
  })

  it('the production sampling and matching constants are the frozen Slice 1 / 2 / 4 values', () => {
    expect([DEFAULT_SAMPLE_RADIUS, DEFAULT_TRIM_FRACTION, MIXED_SPREAD, HIGHLIGHT_CHANNEL_MIN, SHADOW_CHANNEL_MAX, CLIPPED_FRACTION_WARN]).toEqual([24, .2, .045, 250, 5, .35])
    expect([PHOTO_LIGHTNESS_WEIGHT, PHOTO_CLOSE_DISTANCE, PHOTO_RELATED_DISTANCE]).toEqual([.5, .045, .085])
    expect(sampleRadiusFor({ width: 1600, height: 1200 })).toBe(24)
  })
})

describe('diagnostic harness', () => {
  it('reports the exact production sample and recomputes the production estimator identically', () => {
    for (const { fixture, diagnosis } of [...whiteRows, ...mixedRows]) {
      expect(diagnosis.production).toEqual(samplePhotoRegion(fixture.image, fixture.point, { radius: 24 }))
      expect(diagnosis.distribution!.trimmedMeanHex).toBe(diagnosis.sample!.hex)
      if (diagnosis.production.kind !== 'color') throw new Error(fixture.id)
      const { regionPixelCount, opaquePixelCount, retainedPixelCount } = diagnosis.production.diagnostics
      expect(diagnosis.region).toEqual({ pixelCount: regionPixelCount, opaqueCount: opaquePixelCount, keptCount: retainedPixelCount })
      expect(regionPixelCount).toBe(1804)
      expect(diagnosis.radii.map(({ radius }) => radius)).toEqual(INVESTIGATION_RADII)
    }
  })

  it('maps a display tap with the unchanged Slice 4 geometry', () => {
    const image = white[5].image
    const diagnosis = diagnoseTap(image, { point: { x: 195, y: 195 }, imageRect: { x: 0, y: 0, width: 390, height: 390 } })
    expect('point' in diagnosis && diagnosis.point).toEqual({ x: 300, y: 300 })
    expect(diagnoseTap(image, { point: { x: 400, y: 10 }, imageRect: { x: 0, y: 0, width: 390, height: 390 } })).toEqual({ kind: 'outside-displayed-image' })
  })

  it('the investigation OKLab inverse round-trips the production conversion', () => {
    for (const hex of ['#9FABB4', '#F4F4F2', '#1F2A44', '#E9785D']) {
      const rgb = hexToRgb(hex)!
      const back = oklabToRgb(rgbToOklab(rgb))
      expect([back.r, back.g, back.b].map(Math.round)).toEqual([rgb.r, rgb.g, rgb.b])
    }
  })
})

describe('Q1: a correct sampler can return #9FABB4 from white fabric', () => {
  it('white fabric in open shade under blue skylight renders as #9FABB4 in this light model', () => {
    expect(litHex(WHITE, SHADE_SKY)).toBe(OBSERVED)
  })

  it('the shaded-white patch and a genuinely blue-grey patch give the same sample, with no warning', () => {
    const shaded = byId('F').diagnosis
    const blueGrey = byId('D').diagnosis
    expect(shaded.sample!.hex).toBe(OBSERVED)
    expect(blueGrey.sample!.hex).toBe(OBSERVED)
    expect(shaded.sample!.flags).toEqual([])
    expect(categories(shaded.production as never)).toEqual(categories(blueGrey.production as never))
  })

  it('the observed colour is a light, low-chroma, cool tint', () => {
    const lab = hexToOklab(OBSERVED)!
    expect(lab.l).toBeCloseTo(.735, 3)
    expect(byId('F').diagnosis.cast).toMatchObject({ tint: 'cool', consistentButTinted: true })
    expect(byId('F').diagnosis.cast!.blueMinusRed).toBeGreaterThan(15)
  })
})

describe('Q2 / §11: `shadow` means crushed near-black pixels, not photographic shadow', () => {
  it('an ordinary shadow on white never raises it; white must be darkened below 1% of normal light', () => {
    expect(byId('F').diagnosis.sample!.shadowFraction).toBe(0)
    expect(byId('E').diagnosis.sample!.flags).not.toContain('shadow')
    expect(flagOnset(WHITE, 'shadow')!).toBeLessThan(.01)
    for (const intensity of [.1, .2, .35, .5]) expect(solidSample(lit(hexToRgb(WHITE)!, { intensity })).diagnostics.flags).toEqual([])
  })

  it('it fires on black fabric only when it is several stops underexposed', () => {
    expect(flagOnset('#1C1C1E', 'shadow')!).toBeLessThan(.2)
  })
})

describe('§12: `highlight` means clipped near-white pixels', () => {
  it('normally exposed white fabric only needs ~7% more light to raise it', () => {
    const onset = flagOnset(WHITE, 'highlight')!
    expect(onset).toBeGreaterThan(1)
    expect(onset).toBeLessThan(1.1)
    expect(byId('A').diagnosis.sample!.flags).toEqual(['highlight'])
  })

  it('brightly lit but unclipped light fabric does not raise it', () => {
    expect(solidSample(lit(hexToRgb('#F3E5C8')!, { intensity: 1.4 })).diagnostics.flags).toEqual([])
  })
})

describe('Q3 / §13: what `mixed` can and cannot catch', () => {
  it('stays silent for uniform, smoothly shaded, cast and gently folded regions', () => {
    for (const id of ['M1', 'M2', 'M5', 'M6', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) expect(byId(id).diagnosis.sample!.flags).toEqual([])
  })

  it('fires for hard/soft shadow edges, prints, stripes and colour boundaries inside the disc', () => {
    for (const id of ['M3', 'M4', 'M7', 'M8', 'M9', 'K', 'L']) expect(byId(id).diagnosis.sample!.flags).toContain('mixed')
  })

  it('a uniformly blue-cast white region is consistent, not mixed', () => {
    const { sample, cast } = byId('M5').diagnosis
    expect(sample!.spread).toBeLessThan(MIXED_SPREAD / 3)
    expect(cast).toMatchObject({ tint: 'cool', consistentButTinted: true })
  })
})

describe('Q6–Q8: tap position and radius', () => {
  it('in a uniformly shaded area every investigated radius returns the same colour', () => {
    expect(new Set(byId('F').diagnosis.radii.map(({ hex }) => hex))).toEqual(new Set([OBSERVED, '#9EABB4']))
  })

  it('near a boundary a small radius avoids the other colour and a large one takes in more of it', () => {
    const radii = byId('K').diagnosis.radii
    expect(radii.filter(({ radius }) => radius <= 12).every(({ flags }) => flags.length === 0)).toBe(true)
    expect(radii.filter(({ radius }) => radius >= 24).every(({ flags }) => flags.includes('mixed'))).toBe(true)
  })

  it('in folds a small radius follows the fold, the production radius averages it', () => {
    const radii = byId('J').diagnosis.radii
    expect(radii[0].l).toBeLessThan(radii[3].l - .05)
  })

  it('taps are stable on even areas and sensitive only near a shadow edge', () => {
    const image = garmentScene()
    expect(jitter(image, 450, 300).worstDeltaE).toBe(0)
    expect(jitter(image, 1000, 300).worstDeltaE).toBe(0)
    expect(jitter(image, 810, 300).worstChangedSubtypes).toBeGreaterThan(3)
  })
})

describe('Q4 / Q5: exposure and cast move a nominal white across categories', () => {
  const series = exposureSeries()
  const whiteSeries = series.find(({ name }) => name === 'white')!

  it('a half-stop underexposure already changes the category for several subtypes', () => {
    expect(whiteSeries.cells.find(({ intensity }) => intensity === .7)!.changed).toBeGreaterThanOrEqual(3)
    expect(whiteSeries.cells.find(({ intensity }) => intensity === .5)!.deltaE).toBeGreaterThan(.15)
  })

  it('overexposure clips white to #FFFFFF with a highlight warning', () => {
    expect(whiteSeries.cells.find(({ intensity }) => intensity === 1.2)).toMatchObject({ hex: '#FFFFFF', flags: ['highlight'] })
  })

  it('casts move light colours far more in category than dark ones', () => {
    const casts = castSeries()
    const worst = (name: string) => Math.max(...casts.find((row) => row.name === name)!.cells.map(({ changed }) => changed))
    expect(worst('cream')).toBeGreaterThan(worst('black'))
    expect(worst('light pink')).toBeGreaterThan(worst('navy'))
  })
})

describe('Q9 / Q10: three taps (offline simulation only)', () => {
  const scenarios = Object.fromEntries(failureScenarios().map((scenario) => [scenario.id, scenario]))
  const result = (id: string, strategy: string) => scenarios[id].results.find((row) => row.strategy === strategy)!

  it('no strategy recovers white when every tap is in the same shade', () => {
    for (const row of scenarios['white, all taps in shade'].results) expect(row.deltaE).toBeGreaterThan(.2)
  })

  it('averaging is pulled by one outlier; the middle-lightness tap is not', () => {
    expect(result('deep shadow', 'meanRgb').deltaE).toBeGreaterThan(.1)
    expect(result('deep shadow', 'medianL').deltaE).toBeLessThan(.02)
    expect(result('near another colour', 'meanRgb').changed).toBeGreaterThan(0)
    expect(result('near another colour', 'medianL').changed).toBe(0)
  })

  it('no strategy can fix a patterned area', () => {
    for (const row of scenarios.patterned.results) expect(row.deltaE).toBeGreaterThan(.25)
  })

  it('"take the lightest" lightens genuinely muted or mid-tone materials', () => {
    for (const row of lightestRisk()) {
      expect(row.lightestDeltaE).toBeGreaterThan(.05)
      expect(row.medianDeltaE).toBe(0)
    }
    expect(result('genuinely muted (grey-beige)', 'lightest').changed).toBeGreaterThan(0)
  })
})

describe('§20: global white balance is not safe without a known neutral', () => {
  const cases = Object.fromEntries(whiteBalanceExperiment().map((row) => [row.id, Object.fromEntries(row.results.map((result) => [result.method, result]))]))

  it('gray-world "corrects" a correctly photographed cream garment into grey', () => {
    expect(cases['cream garment, neutral light'].none.deltaE).toBe(0)
    expect(cases['cream garment, neutral light'].grayWorld.changed).toBeGreaterThan(0)
    expect(cases['cream garment, neutral light'].whitePatch.hex).toBe('#FFFFFF')
  })

  it('gray-world does not rescue the shaded white shirt when the scene has other colours', () => {
    expect(cases['white in shade + warm wall'].grayWorld.deltaE).toBeGreaterThan(.2)
  })
})

describe('§22 option G: relative-light hint (prototype, NOT production)', () => {
  const image = garmentScene()
  it('can flag a tap in shade next to lit fabric of the same kind', () => {
    expect(contextHint(image, 860).hint).toBe(true)
    expect(contextHint(image, 450).hint).toBe(false)
  })

  it('cannot see uniform shade, and false-alarms on a genuinely two-tone garment', () => {
    expect(contextHint(image, 1000).hint).toBe(false)
    expect(contextHint(white[5].image, 300).hint).toBe(false)
    const twoTone = scene(600, 600, (x) => x < 300 ? hexToRgb(WHITE)! : hexToRgb('#A7A9AC')!, 4)
    expect(contextHint(twoTone, 340).hint).toBe(true)
  })

  it('garment taps: identical shaded taps differ from lit ones only by light', () => {
    const taps = garmentTaps(image)
    const shade = taps.filter(({ label }) => label.startsWith('shade')).map(({ sample }) => sample.hex)
    expect(new Set(shade)).toEqual(new Set([OBSERVED]))
    expect(changedSubtypes(taps[2].categories, categories(solidHex(OBSERVED)))).toBeGreaterThan(3)
    expect(lit(hexToRgb(WHITE)!, BLUE_CAST).b).toBeGreaterThan(lit(hexToRgb(WHITE)!, BLUE_CAST).r)
  })
})

// Prints every table used in the 5e record. Opt-in: PHOTO_INVESTIGATION_REPORT=1.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
it.runIf(!!env.PHOTO_INVESTIGATION_REPORT)('prints the investigation report', () => {
  console.log(buildReport())
}, 120000)
