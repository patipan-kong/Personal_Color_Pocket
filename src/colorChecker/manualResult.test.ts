import { describe, expect, it } from 'vitest'
import { checkColor } from '../domain/personalColor/colorMatch'
import { palettes } from '../domain/personalColor/palettes'
import { subtypeOrder } from '../domain/personalColor/seasons'
import type { MatchRating, Subtype } from '../domain/personalColor/types'
import { getPlacementGuide } from '../domain/photoColor/placement'
import { colorDisplayName } from '../i18n'
import { en } from '../i18n/en'
import { th } from '../i18n/th'
import { getManualSuitability, toManualResultView } from './manualResult'
import adapterSource from './manualResult.ts?raw'

const RATINGS: MatchRating[] = ['Great Match', 'Good Match', 'Wearable', 'Tricky']

// checkColor() output captured BEFORE Slice 5d changed any UI (HEAD eb46f35). Presentation work must
// never move these: input, subtype, rating, score (9 dp), closestColors, reason.referenceColor, pairWith.
// Do NOT update these to make a change pass.
const BASELINE: [input: string, subtype: Subtype, rating: MatchRating, score: number, closest: string, reference: string | null, pairWith: string][] = [
  // exact palette colours: Best, Neutral, Accent, Harder
  ['#E9785D', 'warm-spring', 'Great Match', 0.92, 'warm-spring-best-1,warm-spring-best-8', 'warm-spring-best-1', 'warm-spring-neutral-4,warm-spring-best-4,warm-spring-accent-3'],
  ['#FFF0CF', 'warm-spring', 'Good Match', 0.687807167, 'warm-spring-best-3,warm-spring-best-2', 'warm-spring-best-3', 'warm-spring-neutral-2,warm-spring-best-2,warm-spring-accent-2'],
  ['#F48A45', 'warm-spring', 'Great Match', 0.84215132, 'warm-spring-best-2,warm-spring-best-1', 'warm-spring-best-2', 'warm-spring-neutral-4,warm-spring-best-4,warm-spring-accent-3'],
  ['#9B738A', 'warm-spring', 'Tricky', 0.148066626, 'warm-spring-best-6,warm-spring-best-7', 'warm-spring-harder-1', 'warm-spring-neutral-5,warm-spring-best-2,warm-spring-accent-2'],
  // chromatic strong / middle / poor
  ['#1F7A8C', 'warm-spring', 'Good Match', 0.690415867, 'warm-spring-best-7,warm-spring-best-5', 'warm-spring-best-7', 'warm-spring-neutral-3,warm-spring-best-4,warm-spring-accent-4'],
  ['#2E86AB', 'warm-spring', 'Wearable', 0.499923892, 'warm-spring-best-7,warm-spring-best-5', null, 'warm-spring-neutral-3,warm-spring-best-4,warm-spring-accent-4'],
  ['#D98463', 'warm-spring', 'Wearable', 0.656103514, 'warm-spring-best-1,warm-spring-best-8', null, 'warm-spring-neutral-4,warm-spring-best-5,warm-spring-accent-3'],
  // neutrals; #FFFFFF and #808080 are the "about 29%" results the old card showed as its headline
  ['#FFFFFF', 'warm-spring', 'Tricky', 0.288920648, 'warm-spring-best-3,warm-spring-best-2', 'warm-spring-harder-2', 'warm-spring-neutral-2,warm-spring-best-3,warm-spring-accent-2'],
  ['#808080', 'warm-spring', 'Tricky', 0.27799413, 'warm-spring-best-7,warm-spring-best-5', 'warm-spring-harder-3', 'warm-spring-neutral-2,warm-spring-best-2,warm-spring-accent-2'],
  ['#000000', 'warm-spring', 'Tricky', 0.109861388, 'warm-spring-best-7,warm-spring-best-6', 'warm-spring-harder-4', 'warm-spring-neutral-5,warm-spring-best-7,warm-spring-accent-5'],
  ['#FF0000', 'warm-spring', 'Tricky', 0.46170268, 'warm-spring-best-6,warm-spring-best-8', 'warm-spring-harder-4', 'warm-spring-neutral-4,warm-spring-best-2,warm-spring-accent-2'],
  ['#7B3F61', 'warm-spring', 'Tricky', 0.305752833, 'warm-spring-best-7,warm-spring-best-6', 'warm-spring-harder-4', 'warm-spring-neutral-3,warm-spring-best-6,warm-spring-accent-5'],
  // a second subtype
  ['#C85E82', 'cool-summer', 'Great Match', 0.92, 'cool-summer-best-1,cool-summer-best-2', 'cool-summer-best-1', 'cool-summer-neutral-5,cool-summer-best-8,cool-summer-accent-2'],
  ['#A89FA0', 'cool-summer', 'Good Match', 0.737800609, 'cool-summer-best-3,cool-summer-best-8', 'cool-summer-best-3', 'cool-summer-neutral-4,cool-summer-best-7,cool-summer-accent-1'],
  ['#E9785D', 'cool-summer', 'Tricky', 0.370107066, 'cool-summer-best-2,cool-summer-best-1', 'cool-summer-harder-1', 'cool-summer-neutral-4,cool-summer-best-4,cool-summer-accent-5'],
  ['#6A7FA8', 'cool-summer', 'Good Match', 0.673061884, 'cool-summer-best-4,cool-summer-best-5', 'cool-summer-best-4', 'cool-summer-neutral-5,cool-summer-best-2,cool-summer-accent-1'],
]

const ids = (colors: { id: string }[]) => colors.map((color) => color.id).join(',')
const steps = [0, 51, 102, 153, 204, 255]
const grid = steps.flatMap((r) => steps.flatMap((g) => steps.map((b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase())))

describe('manual domain output is unchanged (Slice 5d is presentation only)', () => {
  it.each(BASELINE)('%s (%s) keeps rating, score, closest colours, reason and pairings', (input, subtype, rating, score, closest, reference, pairWith) => {
    const match = checkColor(input, subtype)!
    expect(match.rating).toBe(rating)
    expect(match.score.toFixed(9)).toBe(score.toFixed(9))
    expect(ids(match.closestColors)).toBe(closest)
    expect(match.reason).toEqual({ type: rating, referenceColor: reference ? expect.objectContaining({ id: reference }) : null })
    expect(ids(match.pairWith)).toBe(pairWith)
  })

  it('the baseline covers every existing rating', () => {
    expect(new Set(BASELINE.map(([, , rating]) => rating))).toEqual(new Set(RATINGS))
  })

  it('building the view neither changes nor re-scores the result', () => {
    for (const [input, subtype] of BASELINE) {
      const match = checkColor(input, subtype)!
      const before = JSON.stringify(match)
      toManualResultView(match, en, 'women')
      toManualResultView(match, th, 'men')
      expect(JSON.stringify(match)).toBe(before)
      expect(JSON.stringify(checkColor(input, subtype))).toBe(before)
    }
  })
})

describe('manual rating → shared verdict (no new thresholds)', () => {
  it('is a fixed 1:1 relabelling of the four existing ratings', () => {
    expect(RATINGS.map(getManualSuitability)).toEqual(['strong', 'good', 'conditional', 'weak'])
  })

  it('never produces "outside": the manual engine has no such rating', () => {
    for (const subtype of subtypeOrder) for (const hex of grid) expect(getManualSuitability(checkColor(hex, subtype)!.rating)).not.toBe('outside')
  })

  it('rejects an unknown rating instead of guessing', () => {
    expect(() => getManualSuitability('Okay' as MatchRating)).toThrow(RangeError)
  })

  it('the adapter never reads the score and has no numeric cut-off', () => {
    const code = adapterSource.replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/\.score\b|score\s*[<>]=?|[<>]=?\s*0?\.\d|Math\.|distance|checkColor|pairingSuggestions|getPalette/)
    expect(code).toMatch(/getManualSuitability\(rating\)/)
  })
})

describe('toManualResultView', () => {
  it.each(subtypeOrder)('%s: every grid colour relabels its own rating and passes engine data through', (subtype) => {
    for (const hex of grid) {
      const match = checkColor(hex, subtype)!
      const view = toManualResultView(match, en, 'women')
      expect(view.hex).toBe(match.normalizedHex)
      expect(view.suitability).toBe(getManualSuitability(match.rating))
      expect(view.category).toEqual({ key: match.rating.toLowerCase().replace(' ', '-'), label: en.ratings[match.rating] })
      expect(view.pairWith).toBe(match.pairWith)
      expect(view.reference).toEqual({ kind: 'nearestBest', color: match.closestColors[0], group: null })
      expect(view.why).toBe(en.checker.why[match.rating])
    }
  })

  it('uses the shared placement table: Great → face, Good → harmonious, Wearable → second colour, Tricky → below the face', () => {
    const intents = { 'Great Match': 'face', 'Good Match': 'harmonious', Wearable: 'second-color', Tricky: 'below-face' } as const
    for (const [input, subtype, rating] of BASELINE) {
      for (const presentation of ['women', 'men'] as const) {
        expect(toManualResultView(checkColor(input, subtype)!, en, presentation).placement).toEqual(getPlacementGuide(intents[rating], presentation))
      }
    }
  })

  it('has no photo-only parts: no caveat, warnings, resemblance note or photo details', () => {
    const view = toManualResultView(checkColor('#808080', 'warm-spring')!, th, 'women')
    expect(view).toMatchObject({ caveat: null, warnings: [], note: null, details: [], sampleLabel: 'สีที่เลือก' })
  })

  it('the reason names no colour, because the engine reference colours are not always close', () => {
    // An exact Neutral rates Great Match, yet reason.referenceColor is still the nearest BEST colour.
    const neutral = checkColor(palettes['deep-winter'].neutrals[4].hex, 'deep-winter')!
    expect(neutral.rating).toBe('Great Match')
    // Tricky's referenceColor is a Harder colour that can be far away (plan §10.1).
    const tricky = checkColor('#808080', 'warm-spring')!
    for (const match of [neutral, tricky]) {
      for (const [language, locale] of [['en', en], ['th', th]] as const) {
        const why = toManualResultView(match, locale, 'women').why
        expect(why).not.toContain(colorDisplayName(language, match.reason.referenceColor!))
        expect(why).toBe(locale.checker.why[match.rating])
      }
    }
    expect(toManualResultView(neutral, en, 'women').why).toBe('It sits right among the colors recommended for you, so it works beautifully near your face.')
  })

  it('the reference is labelled as the nearest Best colour, never as a similar colour', () => {
    const neutral = checkColor(palettes['deep-winter'].neutrals[4].hex, 'deep-winter')!
    expect(toManualResultView(neutral, en, 'women').reference).toEqual({ kind: 'nearestBest', color: neutral.closestColors[0], group: null })
    expect(en.colorResult.reference.nearestBest).toBe('Nearest of your Best colors')
    expect(th.colorResult.reference.nearestBest).toBe('สีเด่นในพาเลตต์ที่ใกล้ที่สุด')
  })

  it('the reason never mentions a score or percentage', () => {
    for (const locale of [en, th]) for (const rating of RATINGS) expect(locale.checker.why[rating]).not.toMatch(/\d|%|score|คะแนน/i)
  })
})

describe('representative cases', () => {
  const palette = palettes['warm-spring']
  it('an exact Best colour is the strong verdict; the "29%" white is not ideal near the face', () => {
    expect(toManualResultView(checkColor(palette.best[0].hex, 'warm-spring')!, en, 'women').suitability).toBe('strong')
    expect(toManualResultView(checkColor('#FFFFFF', 'warm-spring')!, en, 'women').suitability).toBe('weak')
    expect(toManualResultView(checkColor('#2E86AB', 'warm-spring')!, en, 'women').suitability).toBe('conditional')
    expect(toManualResultView(checkColor('#1F7A8C', 'warm-spring')!, en, 'women').suitability).toBe('good')
  })
})
