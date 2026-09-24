import { describe, expect, it } from 'vitest'
import { getPalette } from '../domain/personalColor/palettes'
import { seasonDefinitions, subtypeOrder } from '../domain/personalColor/seasons'
import type { DimensionKey, Season, Subtype } from '../domain/personalColor/types'
import { colorDisplayName, getCopy, metalDisplayNote } from '../i18n'
import type { Language } from '../i18n'
import { dimensionExamples, generalOutfitExample } from './examples'
import {
  bandEnd, dimensionBand, dimensionOrder, getLearnCopy, learnProfileFrom, namingQuality, outfitExample,
  paletteColorById, seasonGroups, seasonTraits, subtypeGuide,
} from './model'
import type { DimensionEnd, PaletteColorId } from './types'

// V1.4 Slice 1: Learn's derived subtype model. Every expectation is computed from the canonical
// seasons.ts / palettes.ts data, never from a copied table of targets or colours.

const languages: Language[] = ['en', 'th']
const subtypeOf = (id: string) => subtypeOrder.find((subtype) => id.startsWith(`${subtype}-`))!

describe('B. subtype integrity', () => {
  it('reuses exactly the 12 canonical subtypes, in canonical order, grouped into their seasons', () => {
    expect(subtypeOrder).toHaveLength(12)
    const groups = seasonGroups()
    expect(groups.map((group) => group.season)).toEqual(['spring', 'summer', 'autumn', 'winter'])
    expect(groups.flatMap((group) => group.subtypes)).toEqual(subtypeOrder)
    for (const group of groups) {
      expect(group.subtypes).toHaveLength(3)
      for (const subtype of group.subtypes) expect(seasonDefinitions[subtype].season).toBe(group.season)
    }
  })

  it('reads the four dimensions in canonical target order', () => {
    expect(dimensionOrder).toEqual(['temperature', 'value', 'chroma', 'contrast'])
    for (const subtype of subtypeOrder) expect(Object.keys(seasonDefinitions[subtype].target)).toEqual(dimensionOrder)
  })

  it.each(subtypeOrder.flatMap((subtype) => languages.map((language) => [subtype, language] as const)))('%s resolves in %s with its canonical season, app copy and bands', (subtype, language) => {
    const guide = subtypeGuide(subtype, language)
    const learn = getLearnCopy(language)
    expect(guide.subtype).toBe(subtype)
    expect(guide.season).toBe(seasonDefinitions[subtype].season)
    expect(guide.seasonName).toBe(learn.seasons[guide.season].name)
    expect(guide.copy).toBe(getCopy(language).subtypes[subtype])
    expect(guide.position.map((position) => position.dimension)).toEqual(dimensionOrder)
    for (const position of guide.position) {
      const band = dimensionBand(seasonDefinitions[subtype].target[position.dimension])
      expect(position.band).toBe(band)
      expect(position.label).toBe(learn.dimensions[position.dimension].bands[band])
      expect(position.name).toBe(learn.dimensions[position.dimension].name)
    }
  })
})

describe('I. dimension bands (plan §15 thresholds)', () => {
  it.each([
    [0, 'strong-low'], [.2, 'strong-low'], [.2000001, 'lean-low'], [.4, 'lean-low'], [.4000001, 'middle'],
    [.5, 'middle'], [.5999999, 'middle'], [.6, 'lean-high'], [.7999999, 'lean-high'], [.8, 'strong-high'], [1, 'strong-high'],
  ] as const)('%d → %s', (t, band) => expect(dimensionBand(t)).toBe(band))

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])('rejects %d rather than guessing a band', (t) => {
    expect(() => dimensionBand(t)).toThrow(RangeError)
  })

  it('matches the plan’s worked examples', () => {
    const band = (subtype: Subtype, dimension: DimensionKey) => subtypeGuide(subtype, 'en').position.find((position) => position.dimension === dimension)!.label
    expect(band('clear-spring', 'temperature')).toBe('Leans warm')
    expect(band('clear-winter', 'temperature')).toBe('Leans cool')
    expect(band('soft-summer', 'chroma')).toBe('Strongly soft')
  })

  it('names the side of the scale a band sits on', () => {
    expect(bandEnd('strong-low')).toBe('low')
    expect(bandEnd('lean-low')).toBe('low')
    expect(bandEnd('middle')).toBeNull()
    expect(bandEnd('lean-high')).toBe('high')
    expect(bandEnd('strong-high')).toBe('high')
  })
})

describe('season and naming derivations', () => {
  it('derives each season’s shared qualities from its three types’ targets', () => {
    const expected: Record<Season, Partial<Record<DimensionKey, DimensionEnd>>> = {
      spring: { temperature: 'high', value: 'high', chroma: 'high' },
      summer: { temperature: 'low', value: 'high', chroma: 'low', contrast: 'low' },
      autumn: { temperature: 'high', value: 'low', chroma: 'low' },
      winter: { temperature: 'low', value: 'low', chroma: 'high', contrast: 'high' },
    }
    for (const season of Object.keys(expected) as Season[]) expect(seasonTraits(season)).toEqual(expected[season])
  })

  it('each type is named for the dimension where its target is most extreme', () => {
    const qualities: Record<string, [DimensionKey, DimensionEnd]> = {
      Light: ['value', 'high'], Deep: ['value', 'low'], Warm: ['temperature', 'high'],
      Cool: ['temperature', 'low'], Clear: ['chroma', 'high'], Soft: ['chroma', 'low'],
    }
    for (const subtype of subtypeOrder) {
      const [dimension, end] = qualities[getCopy('en').subtypes[subtype].name.split(' ')[0]]
      expect(namingQuality(subtype)).toEqual({ dimension, end })
    }
  })

  it('the season sample is the first Best colour of each of its types (not a season palette)', () => {
    for (const group of seasonGroups()) group.sample.forEach((color, index) => expect(color).toBe(getPalette(group.subtypes[index]).best[0]))
  })
})

describe('C. palette integrity: every group is the canonical palette itself', () => {
  it.each(subtypeOrder.flatMap((subtype) => languages.map((language) => [subtype, language] as const)))('%s (%s)', (subtype, language) => {
    const guide = subtypeGuide(subtype, language)
    const palette = getPalette(subtype)
    const copy = getCopy(language)
    expect(guide.palette).toBe(palette)
    expect(guide.groups.map((group) => group.group)).toEqual(['best', 'neutrals', 'accents', 'harder'])
    for (const group of guide.groups) {
      expect(group.colors).toBe(palette[group.group])
      expect(group.title).toBe(copy.palette.sections[group.group].title)
      expect(group.description).toBe(copy.palette.sections[group.group].description)
      expect(group.names).toEqual(palette[group.group].map((color) => colorDisplayName(language, color)))
    }
    expect(guide.metals.items).toBe(palette.metals)
    expect(guide.metals.title).toBe(copy.palette.sections.metals.title)
    expect(guide.metals.names).toEqual(palette.metals.map((metal) => colorDisplayName(language, metal)))
    expect(guide.metals.notes).toEqual(palette.metals.map((metal) => metalDisplayNote(language, metal)))
    expect(guide.moreConsideredTips).toBe(copy.palette.harderTips)
    expect(guide.formula.nearFace).toBe(palette.best[0])
    expect(guide.formula.base).toBe(palette.neutrals[0])
    expect(guide.formula.accent).toBe(palette.accents[0])
  })

  it('resolves palette ids to the canonical colour objects, and nothing else', () => {
    for (const subtype of subtypeOrder) {
      const palette = getPalette(subtype)
      for (const color of [...palette.best, ...palette.neutrals, ...palette.accents, ...palette.harder]) expect(paletteColorById(color.id)).toBe(color)
    }
    for (const id of ['bogus', 'soft-summer-best-99', 'soft-summer-metal-1', 'constructor', '']) expect(paletteColorById(id)).toBeUndefined()
  })

  it('every dimension example exists and comes from a type at that end of the scale', () => {
    for (const dimension of dimensionOrder) {
      for (const end of ['low', 'high'] as const) {
        const ids = dimensionExamples[dimension][end]
        expect(ids.length).toBeGreaterThan(0)
        for (const id of ids) {
          expect(paletteColorById(id)).toBeDefined()
          expect(bandEnd(dimensionBand(seasonDefinitions[subtypeOf(id)].target[dimension]))).toBe(end)
        }
      }
    }
  })

  it('the general outfit example is one type’s colours in their proper groups', () => {
    const ids = Object.values(generalOutfitExample) as PaletteColorId[]
    const subtype = subtypeOf(ids[0])
    expect(ids.every((id) => subtypeOf(id) === subtype)).toBe(true)
    const palette = getPalette(subtype)
    expect(palette.best).toContain(paletteColorById(generalOutfitExample.nearFace))
    expect(palette.neutrals).toContain(paletteColorById(generalOutfitExample.base))
    expect(palette.accents).toContain(paletteColorById(generalOutfitExample.accent))
    // Only a listed harder colour may be shown as More Considered.
    expect(palette.harder).toContain(paletteColorById(generalOutfitExample.moreConsidered))
  })
})

describe('P. personalisation contract', () => {
  it('no result means the general Learn experience', () => {
    expect(learnProfileFrom(null)).toBeNull()
    expect(learnProfileFrom(undefined)).toBeNull()
    const example = outfitExample(null)
    expect(example.personal).toBe(false)
    expect(example.nearFace).toBe(paletteColorById(generalOutfitExample.nearFace))
    expect(example.moreConsidered).toBe(paletteColorById(generalOutfitExample.moreConsidered))
  })

  it.each(subtypeOrder)('a %s result maps to that type, its canonical season and its own palette', (subtype) => {
    // The season comes from seasons.ts, not from the result object.
    const profile = learnProfileFrom({ subtype, season: 'winter' } as never)
    expect(profile).toEqual({ subtype, season: seasonDefinitions[subtype].season })
    const example = outfitExample(profile)
    const palette = getPalette(subtype)
    expect(example).toEqual({ nearFace: palette.best[0], base: palette.neutrals[0], accent: palette.accents[0], moreConsidered: palette.harder[0], personal: true })
    expect(example.moreConsidered).toBe(palette.harder[0])
  })

  it.each(['bogus', '', 'constructor', '__proto__', 'Soft-Summer'])('never renders an unknown subtype (%j)', (subtype) => {
    expect(learnProfileFrom({ subtype } as never)).toBeNull()
  })
})
