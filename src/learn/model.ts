import { getPalette } from '../domain/personalColor/palettes'
import { seasonDefinitions, subtypeOrder } from '../domain/personalColor/seasons'
import type { DimensionKey, MetalRecommendation, PaletteColor, PersonalColorPalette, PersonalColorResult, Season, Subtype } from '../domain/personalColor/types'
import { colorDisplayName, getCopy, metalDisplayNote } from '../i18n'
import type { Language, SubtypeCopy } from '../i18n'
import { learnTranslations } from './content'
import { generalOutfitExample } from './examples'
import { learnTopicOrder } from './registry'
import type { DimensionBand, DimensionEnd, LearnCopy, LearnTopicId, PaletteColorGroupKey, PaletteColorId } from './types'

// Pure presentation derivations for Learn. Everything here is read from seasons.ts, palettes.ts and
// LocaleCopy at call time: Learn keeps no copy of subtype targets or palette colours. It never
// classifies: no quiz, scoring or nearest-subtype logic is imported.

// The four dimensions in their canonical order (the order of the target vectors).
export const dimensionOrder = Object.keys(seasonDefinitions[subtypeOrder[0]].target) as DimensionKey[]

// Plan §15 thresholds, frozen: strong-low, lean-low (both inclusive), middle, lean-high (both exclusive), strong-high.
export function dimensionBand(t: number): DimensionBand {
  if (!(t >= 0 && t <= 1)) throw new RangeError(`Dimension value out of range: ${t}`)
  if (t <= .2) return 'strong-low'
  if (t <= .4) return 'lean-low'
  if (t < .6) return 'middle'
  if (t < .8) return 'lean-high'
  return 'strong-high'
}

// The five bands in scale order, from the 0 end to the 1 end: a scale draws a band at its index here.
export const dimensionBandOrder: readonly DimensionBand[] = ['strong-low', 'lean-low', 'middle', 'lean-high', 'strong-high']

export function bandEnd(band: DimensionBand): DimensionEnd | null {
  return band === 'middle' ? null : band.endsWith('low') ? 'low' : 'high'
}

export function seasonOf(subtype: Subtype): Season {
  return seasonDefinitions[subtype].season
}

export interface SeasonGroup {
  season: Season
  subtypes: readonly Subtype[]
  // Plan §13: the first Best colour of each of its types. Not a season palette.
  sample: readonly PaletteColor[]
}

// Seasons in first-appearance order of the canonical subtype list, each with its three types.
export function seasonGroups(): SeasonGroup[] {
  const seasons = [...new Set(subtypeOrder.map(seasonOf))]
  return seasons.map((season) => {
    const subtypes = subtypeOrder.filter((subtype) => seasonOf(subtype) === season)
    return { season, subtypes, sample: subtypes.map((subtype) => getPalette(subtype).best[0]) }
  })
}

// The qualities every type in a season shares: a dimension counts only when all its types' targets
// sit on the same side of the middle. Season summaries in Learn copy must agree with this.
export function seasonTraits(season: Season): Partial<Record<DimensionKey, DimensionEnd>> {
  const targets = subtypeOrder.filter((subtype) => seasonOf(subtype) === season).map((subtype) => seasonDefinitions[subtype].target)
  const traits: Partial<Record<DimensionKey, DimensionEnd>> = {}
  for (const dimension of dimensionOrder) {
    if (targets.every((target) => target[dimension] < .5)) traits[dimension] = 'low'
    else if (targets.every((target) => target[dimension] > .5)) traits[dimension] = 'high'
  }
  return traits
}

// The quality a type is named for (Light, Deep, Warm, Cool, Clear, Soft): the dimension where its
// target is farthest from the middle.
export function namingQuality(subtype: Subtype): { dimension: DimensionKey; end: DimensionEnd } {
  const target = seasonDefinitions[subtype].target
  const dimension = dimensionOrder.reduce((best, key) => Math.abs(target[key] - .5) > Math.abs(target[best] - .5) ? key : best)
  return { dimension, end: target[dimension] < .5 ? 'low' : 'high' }
}

export function getLearnCopy(language: Language): LearnCopy {
  return learnTranslations[language]
}

export function paletteColorById(id: PaletteColorId | string): PaletteColor | undefined {
  const subtype = subtypeOrder.find((candidate) => id.startsWith(`${candidate}-`))
  if (!subtype) return undefined
  const palette = getPalette(subtype)
  return [...palette.best, ...palette.neutrals, ...palette.accents, ...palette.harder].find((color) => color.id === id)
}

export interface DimensionPosition {
  dimension: DimensionKey
  name: string
  band: DimensionBand
  label: string
}

export interface SwatchGroup {
  group: PaletteColorGroupKey
  title: string
  description: string
  colors: readonly PaletteColor[] // the palette's own array
  names: readonly string[]
}

export interface OutfitFormula {
  nearFace: PaletteColor
  base: PaletteColor
  accent: PaletteColor
}

export interface SubtypeGuide {
  subtype: Subtype
  season: Season
  language: Language
  copy: SubtypeCopy // LocaleCopy.subtypes[subtype] itself
  seasonName: string
  position: readonly DimensionPosition[]
  naming: { dimension: DimensionKey; end: DimensionEnd }
  palette: PersonalColorPalette // getPalette(subtype) itself
  groups: readonly SwatchGroup[]
  moreConsideredTips: readonly string[] // LocaleCopy.palette.harderTips itself
  metals: { title: string; description: string; items: readonly MetalRecommendation[]; names: readonly string[]; notes: readonly string[] }
  formula: OutfitFormula
}

const swatchGroupOrder: readonly PaletteColorGroupKey[] = ['best', 'neutrals', 'accents', 'harder']

// Plan §14: a Best colour near the face, a Neutral as the base, an Accent in a small piece — the first
// colour of each group.
export function outfitFormula(subtype: Subtype): OutfitFormula {
  const palette = getPalette(subtype)
  return { nearFace: palette.best[0], base: palette.neutrals[0], accent: palette.accents[0] }
}

// Everything the one subtype-detail template needs, for any of the 12 canonical types.
export function subtypeGuide(subtype: Subtype, language: Language): SubtypeGuide {
  const appCopy = getCopy(language)
  const learn = getLearnCopy(language)
  const palette = getPalette(subtype)
  const target = seasonDefinitions[subtype].target
  const season = seasonOf(subtype)
  return {
    subtype,
    season,
    language,
    copy: appCopy.subtypes[subtype],
    seasonName: learn.seasons[season].name,
    position: dimensionOrder.map((dimension) => {
      const band = dimensionBand(target[dimension])
      return { dimension, name: learn.dimensions[dimension].name, band, label: learn.dimensions[dimension].bands[band] }
    }),
    naming: namingQuality(subtype),
    palette,
    groups: swatchGroupOrder.map((group) => ({
      group,
      title: appCopy.palette.sections[group].title,
      description: appCopy.palette.sections[group].description,
      colors: palette[group],
      names: palette[group].map((color) => colorDisplayName(language, color)),
    })),
    moreConsideredTips: appCopy.palette.harderTips,
    metals: {
      title: appCopy.palette.sections.metals.title,
      description: appCopy.palette.sections.metals.description,
      items: palette.metals,
      names: palette.metals.map((metal) => colorDisplayName(language, metal)),
      notes: palette.metals.map((metal) => metalDisplayNote(language, metal)),
    },
    formula: outfitFormula(subtype),
  }
}

// ---- Personalisation contract ----
// Learn never reads storage. The app passes its current result (already validated when loaded by
// services/persistence.ts); Learn only refuses to render a subtype it does not know.

export interface LearnProfile {
  subtype: Subtype
  season: Season
}

// A subtype requested from outside Learn (e.g. the Result screen's link): a canonical id or null. Learn
// never guesses a replacement for an unknown id.
export function learnSubtype(value: unknown): Subtype | null {
  return subtypeOrder.find((subtype) => subtype === value) ?? null
}

// A topic requested from outside Learn (the Palette and Checker links, Slice 4): a registered P0 topic
// id or null. Anything else — a P1 idea, an old id, arbitrary text — opens the Learn home.
export function learnTopic(value: unknown): LearnTopicId | null {
  return learnTopicOrder.find((topic) => topic === value) ?? null
}

// Slice 4: a few canonical English metal notes speak to the reader ("echoes your natural warmth"), which
// is right on the reader's own type. On any other type the same note is shown about the type instead,
// by swapping only the second-person possessive for the localized "this type's". The canonical note is
// never changed, and a note without that possessive (all the Thai ones) is returned as it is.
const secondPersonPossessive: Record<Language, RegExp> = { en: /\byour\b/gi, th: /ของคุณ/g }

export function typeOrientedNote(note: string, language: Language): string {
  const replacement = getLearnCopy(language).typeDetail.thisTypes
  return note.replace(secondPersonPossessive[language], (match) => /^[A-Z]/.test(match) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement)
}

export function learnProfileFrom(result: Pick<PersonalColorResult, 'subtype'> | null | undefined): LearnProfile | null {
  if (!result || !subtypeOrder.includes(result.subtype)) return null
  return { subtype: result.subtype, season: seasonOf(result.subtype) }
}

export interface OutfitExample extends OutfitFormula {
  moreConsidered: PaletteColor
  // Slice 4: the finishing-detail metal, the palette's first metal.
  metal: MetalRecommendation
  // The type whose palette the colours come from, so the page can say whose colours they are.
  subtype: Subtype
  personal: boolean
}

// wear.palette / wear.harder: the user's own colours, or one fixed general example without a result.
export function outfitExample(profile: LearnProfile | null): OutfitExample {
  if (profile) {
    const palette = getPalette(profile.subtype)
    return { ...outfitFormula(profile.subtype), moreConsidered: palette.harder[0], metal: palette.metals[0], subtype: profile.subtype, personal: true }
  }
  const resolve = (id: PaletteColorId) => paletteColorById(id)!
  // The general example is one type's colours (examples.ts); its metal is that same type's first metal.
  const subtype = subtypeOrder.find((candidate) => generalOutfitExample.nearFace.startsWith(`${candidate}-`))!
  return {
    nearFace: resolve(generalOutfitExample.nearFace),
    base: resolve(generalOutfitExample.base),
    accent: resolve(generalOutfitExample.accent),
    moreConsidered: resolve(generalOutfitExample.moreConsidered),
    metal: getPalette(subtype).metals[0],
    subtype,
    personal: false,
  }
}
