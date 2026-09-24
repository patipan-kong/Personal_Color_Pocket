import type { DimensionKey, PersonalColorPalette, Season, Subtype } from '../domain/personalColor/types'
import type { Language } from '../i18n'
import type { AppCopyRef } from './appCopy'
import type { LearnClaimId } from './sources'

// V1.4 Learn content contracts (Slice 1). Content is data only: no React, no CSS, no colour values.
// Colours are referenced by palette id and resolved from palettes.ts; wording that already exists on
// an app screen is referenced by key (AppCopyRef) instead of being copied.

export type LearnGroupId = 'basics' | 'wear' | 'app'

// P0 topics only. P1 topics (everyday neutrals, same name/different shade, nearby types) are not here.
export type LearnTopicId =
  | 'basics.what-is' | 'basics.dimensions' | 'types.overview'
  | 'wear.palette' | 'wear.harder'
  | 'app.color-checker' | 'app.lucky'

// What a later slice may draw for a topic. Intent only: no layout, coordinates or styles.
export type LearnVisualKind =
  | 'season-strips'       // a few swatches per season
  | 'dimension-scales'    // four scales with a type marker, always with a text band
  | 'subtype-grid'        // 4 seasons x 3 types
  | 'palette-swatches'    // one type's palette groups
  | 'garment-placement'   // top / bottom / accessory flat-lay
  | 'placement-shift'     // the same More Considered colour near the face, then lower and smaller (Slice 4)
  | 'lighting-comparison' // one swatch under warm, cool and shaded light, labelled as an illustration
  | 'lucky-flow'          // lucky family → shade → placement, as a concept (Slice 4)

// How a topic changes when the user has a result. Every topic still reads completely without one.
export type LearnPersonalization =
  | 'none'
  | 'type-markers' // the user's type position on the four scales
  | 'type-badge'   // "Your type" on the user's card
  | 'own-colors'   // examples from the user's own palette
  | 'checker-link' // a direct link to the checker, which needs a result

// The palette groups, keyed exactly as PersonalColorPalette and LocaleCopy.palette.sections.
export type PaletteGroupKey = keyof PersonalColorPalette
export type PaletteColorGroupKey = Exclude<PaletteGroupKey, 'metals'>

// A palette colour id as built by palettes.ts: `${subtype}-${category}-${n}`. Tests prove each one exists.
export type PaletteColorId = `${Subtype}-${'best' | 'neutral' | 'accent' | 'harder'}-${number}`

export type LearnBlock =
  // Learn-authored prose. Every authored statement names the claim it makes (sources.ts).
  | { kind: 'text'; text: string; claim: LearnClaimId }
  | { kind: 'list'; items: readonly string[]; claim: LearnClaimId }
  // Existing screen wording, rendered from LocaleCopy so there is one source of truth.
  | { kind: 'app-copy'; ref: AppCopyRef }
  // A palette group's existing title and description (LocaleCopy.palette.sections), with swatches.
  | { kind: 'palette-group'; group: PaletteGroupKey }

export interface LearnTopicCopy {
  title: string
  rowAnswer: string              // the one line on the Learn home
  answer: string                 // Level 1, visible at once
  why: readonly LearnBlock[]     // Level 2, visible below
  more: readonly LearnBlock[]    // Level 3, collapsed by default; may be empty
  takeaway: string               // one "Try this" line
}

export type DimensionBand = 'strong-low' | 'lean-low' | 'middle' | 'lean-high' | 'strong-high'
export type DimensionEnd = 'low' | 'high'

export interface LearnCopy {
  language: Language
  home: {
    title: string
    lede: string
    startHere: string
    groups: Record<LearnGroupId, string>
    profileHero: { eyebrow: string; cta: string }
    generalHero: { title: string; body: string; cta: string }
  }
  // Labels of the generic topic reader and the Learn shell (Slice 2).
  reader: { back: string; backTo: string; why: string; more: string; takeaway: string }
  topics: Record<LearnTopicId, LearnTopicCopy>
  // One line per season. Seasons are groupings of the 12 types: there are no season palettes.
  seasons: Record<Season, { name: string; summary: string }>
  // `low`/`high` name the 0 and 1 ends of each canonical dimension (e.g. temperature 0 = cool).
  dimensions: Record<DimensionKey, { name: string; ends: Record<DimensionEnd, string>; bands: Record<DimensionBand, string> }>
  // Shared labels for the one subtype-detail template. Subtype names and summaries come from LocaleCopy.
  typeDetail: {
    intro: string
    // Slice 3: the label that frames a type's three existing characteristic words as colour qualities,
    // and the one-line hint above the 12-type grid.
    qualitiesLabel: string
    gridHint: string
    seasonLabel: string
    positionHeading: string
    positionNote: string
    formulaHeading: string
    formula: { nearFace: string; base: string; accent: string }
    yourType: string
    quizCta: string
    examplesCta: string
    // Slice 4: how a type is referred to when the page is not the reader's own type ("this type's").
    thisTypes: string
  }
  // Slice 4: the labels of the practical visuals. The lesson is carried by these words; the drawings
  // beside them are decorative.
  visuals: {
    illustration: string
    yourColors: string
    exampleColors: string
    placement: { nearFace: string; belowFace: string; metal: string; moreConsidered: string }
    shift: { nearFace: string; moved: string; same: string }
    // `manual` and `photo` describe the Checker's two modes; the mode names are the Checker's own.
    lighting: { manual: string; photo: string; garment: string; warm: string; cool: string; shade: string; context: string; note: string }
    lucky: { family: string; familyBody: string; shade: string; shadeBody: string; place: string; placeBody: string; note: string }
  }
}
