import { describe, expect, it } from 'vitest'
import { subtypeOrder } from '../personalColor/seasons'
import { en } from '../../i18n/en'
import { th } from '../../i18n/th'
import { colorDisplayName } from '../../i18n'
import type { PresentationPreference } from '../../services/presentationPreference'
import { getColorPlacement } from './placement'
import type { ColorPlacement } from './placement'
import { inspectHex, realMatchFor } from './realMatchFixtures'
import type { PhotoColorMatch, PhotoMatchCategory } from './types'
import placementSource from './placement.ts?raw'

const CATEGORIES: PhotoMatchCategory[] = ['near-face', 'neutral-base', 'related', 'away-from-face', 'outside']
const PRESENTATIONS: PresentationPreference[] = ['women', 'men']

// Tier, area and pairing meaning per category, independent of presentation (brief §7–§11).
const MEANING: Record<PhotoMatchCategory, { rows: [string, string[]][]; pairing: string }> = {
  'near-face': { rows: [['best', ['near-face']], ['good', ['larger-pieces', 'accents']]], pairing: 'around' },
  'neutral-base': { rows: [['best', ['base']], ['good', ['near-face']]], pairing: 'around' },
  related: { rows: [['good', ['layers']], ['care', ['near-face']]], pairing: 'near-face' },
  'away-from-face': { rows: [['easiest', ['below-face', 'accents']], ['care', ['near-face']]], pairing: 'near-face' },
  outside: { rows: [['easiest', ['accents', 'below-face']], ['care', ['near-face']]], pairing: 'near-face' },
}

const meaningOf = (placement: ColorPlacement) => ({ rows: placement.rows.map((row) => [row.tier, row.areas]), pairing: placement.pairing })
const place = (category: PhotoMatchCategory, presentation: PresentationPreference) => getColorPlacement({ category }, presentation)

describe('placement model: five categories', () => {
  it.each(CATEGORIES)('%s maps to its placement tiers, areas and pairing advice', (category) => {
    for (const presentation of PRESENTATIONS) {
      const placement = place(category, presentation)
      expect(placement.category).toBe(category)
      expect(meaningOf(placement)).toEqual(MEANING[category])
      placement.rows.forEach((row) => expect(row.examples.length).toBeGreaterThanOrEqual(2))
      placement.rows.forEach((row) => expect(row.examples.length).toBeLessThanOrEqual(4))
    }
  })

  it('near-face and neutral-base carry no "use with care" row; weaker categories never lose a usable placement', () => {
    for (const category of ['near-face', 'neutral-base'] as const) expect(place(category, 'women').rows.map((row) => row.tier)).not.toContain('care')
    for (const category of ['related', 'away-from-face', 'outside'] as const) {
      const tiers = place(category, 'women').rows.map((row) => row.tier)
      expect(tiers.some((tier) => tier !== 'care')).toBe(true)
      expect(place(category, 'women').pairing).toBe('near-face')
    }
  })

  it('a neutral is not downgraded: it is "best" as a base and still works near the face', () => {
    const placement = place('neutral-base', 'men')
    expect(placement.rows[0]).toMatchObject({ tier: 'best', areas: ['base'] })
    expect(placement.rows[1]).toMatchObject({ tier: 'good', areas: ['near-face'] })
  })

  it('is deterministic and returns fresh arrays that cannot corrupt the table', () => {
    for (const category of CATEGORIES) {
      for (const presentation of PRESENTATIONS) {
        const first = place(category, presentation)
        first.rows[0].examples.push('dress')
        first.rows[0].areas.length = 0
        expect(place(category, presentation)).toEqual(place(category, presentation))
        expect(place(category, presentation).rows[0].areas.length).toBeGreaterThan(0)
      }
    }
  })

  it('has no score, percentage, confidence or rank anywhere in its output', () => {
    for (const category of CATEGORIES) {
      for (const presentation of PRESENTATIONS) {
        const json = JSON.stringify(place(category, presentation))
        expect(json).not.toMatch(/score|percent|confidence|rank|probab|%/i)
        expect(json).not.toMatch(/\d/)
      }
    }
  })

  it('rejects an unknown category instead of guessing', () => {
    expect(() => getColorPlacement({ category: 'shirt' as PhotoMatchCategory }, 'women')).toThrow(RangeError)
  })
})

describe('placement model: no garment or object detection', () => {
  it('reads nothing from the match except its category', () => {
    const matched = inspectHex(realMatchFor('warm-autumn', 'away-from-face')!.sample.hex, 'warm-autumn')
    const read = new Set<PropertyKey>()
    const spy = new Proxy(matched.match, { get: (target, key, receiver) => { read.add(key); return Reflect.get(target, key, receiver) } })
    getColorPlacement(spy, 'women')
    expect([...read]).toEqual(['category'])
  })

  it('takes exactly (match, presentation): extra "detection" data cannot change the answer', () => {
    expect(getColorPlacement.length).toBe(2)
    for (const category of CATEGORIES) {
      const plain = place(category, 'women')
      const withDetection = { category, garment: 'shirt', label: 'bag', boundingBox: [0, 0, 10, 10], mask: new Uint8Array(4), confidence: .99 }
      expect(getColorPlacement(withDetection as Pick<PhotoColorMatch, 'category'>, 'women')).toEqual(plain)
    }
  })

  it('the same colour gets the same guidance whatever it was photographed on', () => {
    // A garment, a bag or a swatch of one colour are the same match, so the same placement.
    const hex = realMatchFor('soft-summer', 'related')!.sample.hex
    const onShirt = inspectHex(hex, 'soft-summer').match
    const onBag = inspectHex(hex, 'soft-summer').match
    expect(getColorPlacement(onShirt, 'men')).toEqual(getColorPlacement(onBag, 'men'))
  })

  it('source has no detection, segmentation, ML or network code', () => {
    const code = placementSource.replace(/\/\/.*$/gm, '')
    for (const forbidden of ['bbox', 'boundingBox', 'mask', 'segment', 'detect', 'classif', 'confidence', 'tensorflow', 'onnx', 'model\\.', 'fetch', 'XMLHttpRequest', 'localStorage', 'score', 'ImageData', 'PixelSource']) {
      expect(code, forbidden).not.toMatch(new RegExp(forbidden, 'i'))
    }
    const imports = [...placementSource.matchAll(/from '([^']+)'/g)].map((found) => found[1])
    expect(imports).toEqual(['../personalColor/styleGuide', '../../services/presentationPreference', './types'])
    expect(placementSource).toMatch(/import type \{ GarmentNounKey \}/)
    expect(placementSource).toMatch(/import type \{ PresentationPreference \}/)
  })
})

describe('placement model: presentation changes examples only', () => {
  it.each(CATEGORIES)('%s: Women and Men share tiers, areas and pairing; only examples differ', (category) => {
    const women = place(category, 'women')
    const men = place(category, 'men')
    expect(meaningOf(women)).toEqual(meaningOf(men))
    expect(women.rows.map((row) => row.examples)).not.toEqual(men.rows.map((row) => row.examples))
  })

  it('Men never get dress, skirt or blouse examples; Women do get them', () => {
    const menExamples = CATEGORIES.flatMap((category) => place(category, 'men').rows.flatMap((row) => row.examples))
    const womenExamples = CATEGORIES.flatMap((category) => place(category, 'women').rows.flatMap((row) => row.examples))
    for (const key of ['dress', 'skirt', 'blouse'] as const) {
      expect(menExamples).not.toContain(key)
      expect(womenExamples).toContain(key)
    }
    for (const key of ['tshirt', 'polo', 'belt'] as const) expect(menExamples).toContain(key)
  })

  it('every example has an EN and TH garment label from the shared style-guide vocabulary', () => {
    for (const category of CATEGORIES) {
      for (const presentation of PRESENTATIONS) {
        for (const example of place(category, presentation).rows.flatMap((row) => row.examples)) {
          expect(en.styleExamples.garments[example]?.trim()).toBeTruthy()
          expect(th.styleExamples.garments[example]).toMatch(/[ก-๙]/)
        }
      }
    }
  })
})

describe('placement guidance for all 12 subtypes, from real photo matches', () => {
  it('every subtype reaches every category with an existing palette colour', () => {
    for (const subtype of subtypeOrder) {
      for (const category of CATEGORIES) expect(realMatchFor(subtype, category), `${subtype} ${category}`).not.toBeNull()
    }
  })

  it.each(subtypeOrder)('%s: every category renders with names, pairings and labels in EN and TH', (subtype) => {
    for (const category of CATEGORIES) {
      const { match } = realMatchFor(subtype, category)!
      expect(match.category).toBe(category)
      expect(match.subtype).toBe(subtype)
      const placement = getColorPlacement(match, 'women')
      for (const [language, locale] of [['en', en], ['th', th]] as const) {
        const copy = locale.photoChecker
        const shared = locale.colorResult
        const names = [match.nearest.color, ...match.pairWith, ...(match.resembles ? [match.resembles.color] : [])].map((color) => colorDisplayName(language, color))
        names.forEach((name) => expect(name.trim(), `${subtype} ${category} ${language}`).toBeTruthy())
        expect(match.pairWith.length).toBeGreaterThan(0)
        const labels = [copy.categories[category], shared.groups[match.nearest.group], shared.pairing[placement.pairing].heading, shared.pairing[placement.pairing].body,
          ...placement.rows.flatMap((row) => [shared.tiers[row.tier], ...row.areas.map((area) => shared.areas[area]), ...row.examples.map((example) => locale.styleExamples.garments[example])]),
          ...match.direction.map((direction) => copy.directions[direction]),
          copy.descriptors.value[match.descriptors.value], copy.descriptors.clarity[match.descriptors.clarity], copy.caveat]
        labels.forEach((label) => expect(typeof label === 'string' && label.trim().length > 0, `${subtype} ${category} ${language}`).toBe(true))
      }
    }
  })

  it('the weak categories always have pairings to move nearer the face', () => {
    for (const subtype of subtypeOrder) {
      for (const category of ['related', 'away-from-face', 'outside'] as const) {
        const { match } = realMatchFor(subtype, category)!
        expect(getColorPlacement(match, 'men').pairing).toBe('near-face')
        expect(match.pairWith.length).toBeGreaterThanOrEqual(1)
      }
    }
  })
})
