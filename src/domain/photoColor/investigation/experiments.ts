import { hexToOklab, hexToRgb, oklabChroma, oklabHue, rgbToHex, rgbToOklab } from '../../personalColor/colorUtils'
import type { OKLab, RGB } from '../../personalColor/colorUtils'
import { subtypeOrder } from '../../personalColor/seasons'
import type { Subtype } from '../../personalColor/types'
import { sampleRadiusFor } from '../coordinates'
import { matchPhotoColor } from '../photoMatch'
import { samplePhotoRegion } from '../sampling'
import type { PhotoColorSample, PhotoMatchCategory, PixelSource } from '../types'
import { deltaE, diagnosePoint } from './diagnostics'
import type { PointDiagnosis } from './diagnostics'
import { NEUTRAL_LIGHT, decode, encode, lit, litHex, mixLight, oklabToRgb, scene, smoothstep } from './lightModel'
import type { Light } from './lightModel'

// INVESTIGATION ONLY (Slice 5e). Synthetic experiments behind docs/V1_2_SLICE_5E_*.md. They call
// the unchanged production sampler and matcher and only OBSERVE. Nothing here is a fixture of a
// real photo: every image is generated from a HEX and a light.

// ---- Vocabulary ----

// One letter per subtype, in subtypeOrder: N near-face, B neutral-base, R related, A away-from-face, O outside.
const LETTER: Record<PhotoMatchCategory, string> = { 'near-face': 'N', 'neutral-base': 'B', related: 'R', 'away-from-face': 'A', outside: 'O' }

export function categories(sample: PhotoColorSample): PhotoMatchCategory[] {
  return subtypeOrder.map((subtype) => matchPhotoColor(sample, subtype).category)
}
export const code = (list: PhotoMatchCategory[]) => list.map((category) => LETTER[category]).join('')
export const changedSubtypes = (first: PhotoMatchCategory[], second: PhotoMatchCategory[]) => first.filter((category, index) => category !== second[index]).length
export const positive = (category: PhotoMatchCategory) => category === 'near-face' || category === 'neutral-base'

// A solid colour through the real sampler, for colour-only series (no geometry involved).
export function solidSample(rgb: RGB): PhotoColorSample {
  const rounded = { r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) }
  const data = new Uint8ClampedArray(16 * 16 * 4)
  for (let index = 0; index < data.length; index += 4) data.set([rounded.r, rounded.g, rounded.b, 255], index)
  const result = samplePhotoRegion({ width: 16, height: 16, data }, { x: 8, y: 8 }, { radius: 6 })
  if (result.kind !== 'color') throw new Error('solid sample must be a colour')
  return result
}
export const solidHex = (hex: string) => solidSample(hexToRgb(hex)!)

export function describeLab(lab: OKLab) {
  const chroma = oklabChroma(lab)
  return { l: lab.l, chroma, hue: chroma >= .01 ? oklabHue(lab) : null }
}

// ---- Materials and lights ----

// "White T-shirt" as a camera typically renders it under neutral, normal light (not clipped).
export const WHITE = '#F4F4F2'
export const OBSERVED = '#9FABB4'
export const NAVY = '#1F2A44'
export const SKIN = '#C99A7E'

// Open shade lit by blue skylight while the camera is balanced for the sunlit scene. Chosen so
// that WHITE lands on (almost exactly) the observed #9FABB4: intensity 0.45, red 0.85, blue 1.14.
export const SHADE_SKY: Light = { intensity: .45, r: .85, b: 1.14 }
export const WARM_SHADE: Light = { intensity: .55, r: 1.08, b: .85 }
export const BLUE_CAST: Light = { intensity: 1, r: .88, b: 1.12 }
export const WARM_CAST: Light = { intensity: 1, r: 1.1, b: .85 }
export const SUN: Light = { intensity: 1.08, r: 1.02, b: .97 }

// The exact light that turns WHITE into OBSERVED, channel by channel (a metamer by construction).
export function lightBetween(material: string, observed: string): Light {
  const from = hexToRgb(material)!
  const to = hexToRgb(observed)!
  const gain = (key: keyof RGB) => decode(to[key]) / decode(from[key])
  return { intensity: 1, r: gain('r'), g: gain('g'), b: gain('b') }
}

const SIZE = 600
const CENTER = { x: SIZE / 2, y: SIZE / 2 }
const NOISE = 4

const uniform = (hex: string, light: Light = NEUTRAL_LIGHT) => { const color = lit(hexToRgb(hex)!, light); return () => color }

// ---- §14 synthetic white-garment matrix ----

export interface Fixture { id: string; label: string; image: PixelSource; point: { x: number; y: number } }

export function whiteGarmentFixtures(): Fixture[] {
  const white = hexToRgb(WHITE)!
  const other = (hex: string) => hexToRgb(hex)!
  const fold = (x: number) => 1 - .35 * Math.sin(Math.PI * x / 40) ** 8
  return [
    { id: 'A', label: 'pure white #FFFFFF', image: scene(SIZE, SIZE, uniform('#FFFFFF')), point: CENTER },
    { id: 'B', label: 'off-white #F2EEE4', image: scene(SIZE, SIZE, uniform('#F2EEE4'), NOISE), point: CENTER },
    { id: 'C', label: 'neutral light grey #D9D9D9', image: scene(SIZE, SIZE, uniform('#D9D9D9'), NOISE), point: CENTER },
    { id: 'D', label: 'uniform blue-grey #9FABB4', image: scene(SIZE, SIZE, uniform(OBSERVED), NOISE), point: CENTER },
    { id: 'E', label: 'warm shadowed white', image: scene(SIZE, SIZE, uniform(WHITE, WARM_SHADE), NOISE), point: CENTER },
    { id: 'F', label: 'cool shadowed white (shade + sky)', image: scene(SIZE, SIZE, uniform(WHITE, SHADE_SKY), NOISE), point: CENTER },
    { id: 'G', label: 'smooth light→shade gradient', image: scene(SIZE, SIZE, (x) => lit(white, mixLight(NEUTRAL_LIGHT, SHADE_SKY, x / SIZE)), NOISE), point: CENTER },
    { id: 'H', label: 'blue environmental cast', image: scene(SIZE, SIZE, uniform(WHITE, BLUE_CAST), NOISE), point: CENTER },
    { id: 'I', label: 'warm environmental cast', image: scene(SIZE, SIZE, uniform(WHITE, WARM_CAST), NOISE), point: CENTER },
    { id: 'J', label: 'white with grey folds', image: scene(SIZE, SIZE, (x) => lit(white, { intensity: fold(x) }), NOISE), point: CENTER },
    // Boundary 6 px from the tap: ≈ 40% of the 24 px disc is navy.
    { id: 'K', label: 'white + dark boundary (≈40% of disc)', image: scene(SIZE, SIZE, (x) => x < 306 ? white : other(NAVY), NOISE), point: CENTER },
    // Boundary 10 px from the tap: ≈ 25% of the disc is skin / background.
    { id: 'L', label: 'white + skin edge (≈25% of disc)', image: scene(SIZE, SIZE, (x) => x < 310 ? white : other(SKIN), NOISE), point: CENTER },
  ]
}

// ---- §13 mixed-region matrix ----

export function mixedFixtures(): Fixture[] {
  const white = hexToRgb(WHITE)!
  const cream = hexToRgb('#F1E6D0')!
  const rose = hexToRgb('#D98C9A')!
  const navy = hexToRgb(NAVY)!
  const fold = (x: number) => 1 - .35 * Math.sin(Math.PI * x / 40) ** 8
  return [
    { id: 'M1', label: 'uniform blue-grey', image: scene(SIZE, SIZE, uniform(OBSERVED), NOISE), point: CENTER },
    { id: 'M2', label: 'white, smooth shadow gradient', image: scene(SIZE, SIZE, (x) => lit(white, mixLight(NEUTRAL_LIGHT, SHADE_SKY, x / SIZE)), NOISE), point: CENTER },
    { id: 'M3', label: 'white, hard shadow edge through tap', image: scene(SIZE, SIZE, (x) => lit(white, x < 300 ? NEUTRAL_LIGHT : SHADE_SKY), NOISE), point: CENTER },
    { id: 'M4', label: 'white, soft shadow edge (40 px) through tap', image: scene(SIZE, SIZE, (x) => lit(white, mixLight(NEUTRAL_LIGHT, SHADE_SKY, smoothstep(280, 320, x))), NOISE), point: CENTER },
    { id: 'M5', label: 'white, uniform blue cast', image: scene(SIZE, SIZE, uniform(WHITE, BLUE_CAST), NOISE), point: CENTER },
    { id: 'M6', label: 'white with grey folds', image: scene(SIZE, SIZE, (x) => lit(white, { intensity: fold(x) }), NOISE), point: CENTER },
    { id: 'M7', label: 'patterned: 6 px white/rose check', image: scene(SIZE, SIZE, (x, y) => (Math.floor(x / 6) + Math.floor(y / 6)) % 2 ? rose : white, NOISE), point: CENTER },
    { id: 'M8', label: 'stripe: 4 px navy/cream', image: scene(SIZE, SIZE, (x) => Math.floor(x / 4) % 2 ? navy : cream, NOISE), point: CENTER },
    { id: 'M9', label: 'two-colour boundary through tap (white/navy)', image: scene(SIZE, SIZE, (x) => x < 300 ? white : navy, NOISE), point: CENTER },
  ]
}

export interface FixtureRow { fixture: Fixture; diagnosis: PointDiagnosis; categories: PhotoMatchCategory[] }

export function runFixtures(fixtures: Fixture[]): FixtureRow[] {
  return fixtures.map((fixture) => {
    const diagnosis = diagnosePoint(fixture.image, fixture.point)
    if (diagnosis.production.kind !== 'color') throw new Error(`${fixture.id} unavailable`)
    return { fixture, diagnosis, categories: categories(diagnosis.production) }
  })
}

// ---- §15 / §16 exposure and colour-cast series ----

export const NOMINALS: [name: string, hex: string][] = [
  ['white', WHITE], ['cream', '#F3E5C8'], ['beige', '#D6C2A4'], ['light pink', '#F2C6CF'],
  ['light blue', '#B3CDE6'], ['navy', NAVY], ['black', '#1C1C1E'],
]

// Linear-light intensity factors. 0.7–1.4 ≈ ±½ stop (ordinary exposure error); 0.35–0.5 ≈ open shade.
export const EXPOSURES = [.35, .5, .7, .85, 1, 1.2, 1.4]

export const CASTS: [name: string, light: Light][] = [
  ['cool modest', { intensity: 1, r: .93, b: 1.08 }], ['cool strong', { intensity: 1, r: .85, b: 1.18 }],
  ['warm modest', { intensity: 1, r: 1.07, b: .9 }], ['warm strong', { intensity: 1, r: 1.15, b: .78 }],
  ['green modest', { intensity: 1, r: .97, g: 1.06, b: .97 }], ['green strong', { intensity: 1, r: .93, g: 1.14, b: .93 }],
  ['magenta modest', { intensity: 1, r: 1.03, g: .94, b: 1.03 }], ['magenta strong', { intensity: 1, r: 1.07, g: .87, b: 1.07 }],
]

export interface SeriesCell { hex: string; lab: ReturnType<typeof describeLab>; deltaE: number; categories: PhotoMatchCategory[]; changed: number; flags: string[] }

function cell(nominal: string, light: Light): SeriesCell {
  const sample = solidSample(lit(hexToRgb(nominal)!, light))
  const reference = solidHex(nominal)
  const list = categories(sample)
  return { hex: sample.hex, lab: describeLab(sample.oklab), deltaE: deltaE(sample.oklab, reference.oklab), categories: list, changed: changedSubtypes(list, categories(reference)), flags: sample.diagnostics.flags }
}

export const exposureSeries = () => NOMINALS.map(([name, hex]) => ({ name, hex, cells: EXPOSURES.map((intensity) => ({ intensity, ...cell(hex, { intensity }) })) }))
export const castSeries = () => NOMINALS.map(([name, hex]) => ({ name, hex, cells: CASTS.map(([cast, light]) => ({ cast, ...cell(hex, light) })) }))

// ---- §17 one nominal white garment, many taps ----

// 1200×600: sunlit left, normal centre, folds, soft shadow edge, shade on the right; a mild cool
// cast everywhere. Taps are all on the SAME material.
export const GARMENT_WIDTH = 1200
export function garmentScene(material = WHITE, sun: Light = SUN): PixelSource {
  const base = hexToRgb(material)!
  const ambient: Light = { intensity: 1, r: .97, b: 1.03 }
  return scene(GARMENT_WIDTH, SIZE, (x) => {
    let light = x < 300 ? sun : ambient
    if (x >= 600 && x < 780) light = { ...ambient, intensity: 1 - .3 * Math.sin(Math.PI * (x - 600) / 60) ** 2 }
    if (x >= 760) light = mixLight(ambient, SHADE_SKY, smoothstep(780, 840, x))
    return lit(base, light)
  }, NOISE, 7)
}

export const GARMENT_POINTS: [label: string, x: number][] = [
  ['lit 1', 150], ['lit 2', 250], ['normal 1', 400], ['normal 2', 520], ['fold shadow', 630], ['between folds', 660],
  ['fold slope', 700], ['shadow edge', 810], ['shade 1', 950], ['shade 2', 1100],
]

export function garmentTaps(image = garmentScene()) {
  return GARMENT_POINTS.map(([label, x]) => {
    const diagnosis = diagnosePoint(image, { x, y: SIZE / 2 })
    if (diagnosis.production.kind !== 'color') throw new Error(label)
    return { label, x, diagnosis, sample: diagnosis.production, categories: categories(diagnosis.production) }
  })
}

// Tap-position sweep across the shadow edge, and finger jitter (±12 px) around each tap.
export function positionSweep(image = garmentScene(), from = 700, to = 900, step = 10) {
  const rows = []
  for (let x = from; x <= to; x += step) {
    const sample = samplePhotoRegion(image, { x, y: SIZE / 2 }, { radius: sampleRadiusFor(image) })
    if (sample.kind !== 'color') continue
    rows.push({ x, hex: sample.hex, l: sample.oklab.l, spread: sample.diagnostics.spread, flags: sample.diagnostics.flags, categories: categories(sample) })
  }
  return rows
}

export function jitter(image: PixelSource, x: number, y: number, offset = 12) {
  const center = samplePhotoRegion(image, { x, y })
  if (center.kind !== 'color') throw new Error('jitter centre')
  let worst = 0
  let flips = 0
  const base = categories(center)
  for (const [dx, dy] of [[offset, 0], [-offset, 0], [0, offset], [0, -offset], [offset, offset], [-offset, -offset]]) {
    const moved = samplePhotoRegion(image, { x: x + dx, y: y + dy })
    if (moved.kind !== 'color') continue
    worst = Math.max(worst, deltaE(moved.oklab, center.oklab))
    flips = Math.max(flips, changedSubtypes(categories(moved), base))
  }
  return { worstDeltaE: worst, worstChangedSubtypes: flips }
}

// ---- §18 multi-tap strategies (offline only) ----

export type Strategy = 'single' | 'meanRgb' | 'medianL' | 'oklabMean' | 'lightest'
export const STRATEGIES: Strategy[] = ['single', 'meanRgb', 'medianL', 'oklabMean', 'lightest']

export function combine(samples: PhotoColorSample[], strategy: Strategy): PhotoColorSample {
  const byL = [...samples].sort((first, second) => first.oklab.l - second.oklab.l)
  switch (strategy) {
    case 'single': return samples[0]
    case 'medianL': return byL[Math.floor(byL.length / 2)]
    case 'lightest': return [...byL].reverse().find((sample) => !sample.diagnostics.flags.includes('highlight')) ?? byL[byL.length - 1]
    case 'meanRgb': {
      const sum = (key: keyof RGB) => samples.reduce((total, sample) => total + sample.rgb[key], 0) / samples.length
      return solidSample({ r: sum('r'), g: sum('g'), b: sum('b') })
    }
    case 'oklabMean': {
      const sum = (key: keyof OKLab) => samples.reduce((total, sample) => total + sample.oklab[key], 0) / samples.length
      return solidSample(oklabToRgb({ l: sum('l'), a: sum('a'), b: sum('b') }))
    }
  }
}

export function triples<T>(items: T[]): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) for (let k = j + 1; k < items.length; k++) result.push([items[i], items[j], items[k]])
  return result
}

// Every 3-tap combination on the garment scene vs the material under neutral light.
export function strategyComparison(taps = garmentTaps(), material = WHITE) {
  const reference = solidHex(material)
  const referenceCategories = categories(reference)
  return STRATEGIES.map((strategy) => {
    const errors: number[] = []
    let agree = 0
    let total = 0
    // 'single' is judged on every tap on its own (not the first of each triple, which would bias
    // it towards whichever taps happen to be listed first).
    const groups = strategy === 'single' ? taps.map(({ sample }) => [sample]) : triples(taps.map(({ sample }) => sample))
    for (const group of groups) {
      const combined = combine(group, strategy)
      errors.push(deltaE(combined.oklab, reference.oklab))
      const list = categories(combined)
      agree += list.filter((category, index) => category === referenceCategories[index]).length
      total += list.length
    }
    errors.sort((a, b) => a - b)
    return { strategy, median: errors[Math.floor(errors.length / 2)], p90: errors[Math.floor(errors.length * .9)], max: errors[errors.length - 1], agreement: agree / total }
  })
}

// Named failure scenarios. Each is three taps and the material the user actually means.
export function failureScenarios() {
  const white = hexToRgb(WHITE)!
  const edge = scene(SIZE, SIZE, (x) => x < 300 ? white : hexToRgb(SKIN)!, NOISE)
  const stripes = scene(SIZE, SIZE, (x) => Math.floor(x / 4) % 2 ? hexToRgb(NAVY)! : hexToRgb('#F1E6D0')!, NOISE)
  const at = (image: PixelSource, x: number) => { const s = samplePhotoRegion(image, { x, y: 300 }); if (s.kind !== 'color') throw new Error('tap'); return s }
  const under = (hex: string, light: Light) => solidSample(lit(hexToRgb(hex)!, light))
  return [
    { id: 'highlight', material: WHITE, taps: [solidHex(WHITE), under(WHITE, { intensity: .97 }), solidHex('#FFFFFF')] },
    { id: 'deep shadow', material: WHITE, taps: [solidHex(WHITE), under(WHITE, { intensity: .95 }), under(WHITE, { ...SHADE_SKY, intensity: .2 })] },
    { id: 'near another colour', material: WHITE, taps: [solidHex(WHITE), under(WHITE, { intensity: .96 }), at(edge, 300)] },
    { id: 'patterned', material: '#F1E6D0', taps: [at(stripes, 300), at(stripes, 302), at(stripes, 305)] },
    { id: 'genuinely dark (navy)', material: NAVY, taps: [under(NAVY, { intensity: 1.35 }), solidHex(NAVY), under(NAVY, { intensity: .55 })] },
    { id: 'genuinely muted (grey-beige)', material: '#A39A8E', taps: [under('#A39A8E', { intensity: 1.35 }), solidHex('#A39A8E'), under('#A39A8E', { intensity: .55 })] },
    { id: 'white, all taps in shade', material: WHITE, taps: [under(WHITE, { ...SHADE_SKY, intensity: .42 }), under(WHITE, SHADE_SKY), under(WHITE, { ...SHADE_SKY, intensity: .48 })] },
  ].map(({ id, material, taps }) => {
    const reference = solidHex(material)
    const referenceCategories = categories(reference)
    return {
      id, material, taps: taps.map((tap) => tap.hex), flags: taps.map((tap) => tap.diagnostics.flags),
      results: STRATEGIES.map((strategy) => {
        const combined = combine(taps, strategy)
        const list = categories(combined)
        return { strategy, hex: combined.hex, deltaE: deltaE(combined.oklab, reference.oklab), changed: changedSubtypes(list, referenceCategories) }
      }),
    }
  })
}

// ---- §19 "take the lightest" risk ----

export const LIGHTEST_RISK: [name: string, hex: string][] = [
  ['mid grey', '#8C8C8C'], ['beige', '#CDB89A'], ['pastel lilac', '#C8B6D8'], ['washed denim', '#7F9BB8'], ['muted olive', '#8A8B6A'],
]

export function lightestRisk() {
  return LIGHTEST_RISK.map(([name, hex]) => {
    const taps = [solidHex(hex), solidSample(lit(hexToRgb(hex)!, { intensity: 1.35 })), solidSample(lit(hexToRgb(hex)!, { intensity: .6 }))]
    const reference = solidHex(hex)
    const lightest = combine(taps, 'lightest')
    const median = combine(taps, 'medianL')
    return {
      name, hex, lightest: lightest.hex, lightestDeltaE: deltaE(lightest.oklab, reference.oklab), lightestChanged: changedSubtypes(categories(lightest), categories(reference)),
      median: median.hex, medianDeltaE: deltaE(median.oklab, reference.oklab),
    }
  })
}

// ---- §20 global white balance (evaluated, NOT implemented) ----

function linearMeans(image: PixelSource) {
  let r = 0, g = 0, b = 0
  for (let index = 0; index < image.data.length; index += 4) { r += decode(image.data[index]); g += decode(image.data[index + 1]); b += decode(image.data[index + 2]) }
  const n = image.data.length / 4
  return { r: r / n, g: g / n, b: b / n }
}

// Gray-world: scale each channel so the image average becomes neutral.
function grayWorld(image: PixelSource, rgb: RGB): RGB {
  const mean = linearMeans(image)
  const grey = (mean.r + mean.g + mean.b) / 3
  return { r: encode(decode(rgb.r) * grey / mean.r), g: encode(decode(rgb.g) * grey / mean.g), b: encode(decode(rgb.b) * grey / mean.b) }
}

// White-patch: scale each channel so the brightest value becomes 255.
function whitePatch(image: PixelSource, rgb: RGB): RGB {
  let r = 0, g = 0, b = 0
  for (let index = 0; index < image.data.length; index += 4) { r = Math.max(r, image.data[index]); g = Math.max(g, image.data[index + 1]); b = Math.max(b, image.data[index + 2]) }
  return { r: encode(decode(rgb.r) / decode(r)), g: encode(decode(rgb.g) / decode(g)), b: encode(decode(rgb.b) / decode(b)) }
}

export function whiteBalanceExperiment() {
  const cream = hexToRgb('#F3E5C8')!
  const white = hexToRgb(WHITE)!
  const wall = hexToRgb('#C8A07A')!
  const cases = [
    // A cream garment filling most of the frame, neutral light: the "cast" gray-world finds IS the garment.
    { id: 'cream garment, neutral light', material: '#F3E5C8', point: { x: 300, y: 300 }, image: scene(SIZE, SIZE, (x) => x < 480 ? cream : hexToRgb('#808080')!, 0) },
    // The white-shirt case: shaded white garment + a warm sunlit wall behind.
    { id: 'white in shade + warm wall', material: WHITE, point: { x: 200, y: 300 }, image: scene(SIZE, SIZE, (x) => x < 420 ? lit(white, SHADE_SKY) : wall, 0) },
    // Same shaded white garment filling the frame.
    { id: 'white in shade, fills frame', material: WHITE, point: { x: 300, y: 300 }, image: scene(SIZE, SIZE, () => lit(white, SHADE_SKY), 0) },
    // A white garment in neutral light next to a clipped highlight (white-patch reference).
    { id: 'white + specular highlight', material: WHITE, point: { x: 300, y: 300 }, image: scene(SIZE, SIZE, (x, y) => x > 560 && y < 40 ? { r: 255, g: 255, b: 255 } : lit(white, BLUE_CAST), 0) },
  ]
  return cases.map(({ id, material, point, image }) => {
    const sample = samplePhotoRegion(image, point)
    if (sample.kind !== 'color') throw new Error(id)
    const reference = solidHex(material)
    const variants = { none: sample, grayWorld: solidSample(grayWorld(image, sample.rgb)), whitePatch: solidSample(whitePatch(image, sample.rgb)) }
    return {
      id, material,
      results: Object.entries(variants).map(([method, result]) => ({
        method, hex: result.hex, deltaE: deltaE(result.oklab, reference.oklab), changed: changedSubtypes(categories(result), categories(reference)),
      })),
    }
  })
}

// ---- §11 / §12 when do the clipping flags fire? ----

// Smallest (highlight) / largest (shadow) linear intensity at which a uniform patch of the material
// raises the flag, found by bisection on the unchanged sampler. null: never within the range.
export function flagOnset(hex: string, flag: 'highlight' | 'shadow') {
  const fires = (intensity: number) => solidSample(lit(hexToRgb(hex)!, { intensity })).diagnostics.flags.includes(flag)
  let low = flag === 'highlight' ? 1e-3 : 1e-4
  let high = flag === 'highlight' ? 64 : 1
  if (flag === 'highlight' ? !fires(high) : !fires(low)) return null
  for (let step = 0; step < 40; step++) {
    const middle = (low + high) / 2
    if (fires(middle) === (flag === 'highlight')) high = middle
    else low = middle
  }
  return flag === 'highlight' ? high : low
}

// ---- Relative-light hint (Option G prototype) over the fixtures ----

export function contextHint(image: PixelSource, x: number, y = 300) {
  const diagnosis = diagnosePoint(image, { x, y })
  return { x, hex: diagnosis.sample?.hex, share: diagnosis.context?.lighterSimilarShare ?? 0, hint: diagnosis.context?.probableLocalShadow ?? false }
}

// Near-neutral light colours with a visible tint: how many CURATED palette colours would a
// "light, near-neutral, tinted" hint also fire on? (False-positive exposure of such a hint.)
export function tintedLightNeutralRule(lab: OKLab) {
  const chroma = oklabChroma(lab)
  return lab.l >= .6 && chroma >= .01 && chroma < .05
}

export { lit, litHex, rgbToHex, rgbToOklab, hexToOklab }
export type { Subtype }
