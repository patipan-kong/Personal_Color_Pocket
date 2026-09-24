// Provenance for Learn. Maintainer-facing only: the UI does not show citations. IDs L1-L12 are the
// register in docs/V1_4_LEARN_RESEARCH.md; nothing here is fetched at runtime.

// Truth kinds from the V1.4 plan (§26):
// A existing domain truth · B existing presentation guidance · C external educational source ·
// D product-authored explanation · E a combination.
export type TruthKind = 'A' | 'B' | 'C' | 'D' | 'E'

export type LearnSourceId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8' | 'L9' | 'L10' | 'L11' | 'L12'

export const learnSources: Readonly<Record<LearnSourceId, string>> = Object.freeze({
  L1: 'Johannes Itten, The Art of Color, 1961',
  L2: 'Carole Jackson, Color Me Beautiful, 1980; colormebeautiful.com',
  L3: 'Mary Spillane & Christine Sherlock, Color Me Beautiful\'s Looking Your Best, 1995',
  L4: 'Sci\\ART 12-season naming, via Chrysalis Colour',
  L5: 'Jung Yun-Seok, quantitative diagnosis model of personal color, J. Convergence for IT, 2021',
  L6: 'MyColoury, Korean vs 16-season colour analysis',
  L7: 'Munsell color system (Britannica; Wikipedia)',
  L8: 'Josef Albers, Interaction of Color, 1963',
  L9: 'Brainard & Hurlbert, Colour Vision: Understanding #TheDress, Current Biology 2015, doi:10.1016/j.cub.2015.05.020',
  L10: 'Cambridge in Colour, White balance tutorial',
  L11: 'Perrett & Sprengelmeyer, Clothing aesthetics, i-Perception 2021, doi:10.1177/20416695211053361',
  L12: 'Wikipedia, Color analysis (art)',
})

// Internal records and app modules a claim may rest on.
export type InternalSourceId =
  | 'domain:seasons'          // src/domain/personalColor/seasons.ts
  | 'domain:palettes'         // src/domain/personalColor/palettes.ts
  | 'domain:placement'        // src/domain/photoColor/placement.ts
  | 'domain:photoColor'       // the V1.2 photo pipeline
  | 'domain:luckyColor'       // the V1.3 lucky-colour domain
  | 'doc:V1.2-slice-5E'       // docs/V1_2_SLICE_5E_REAL_WORLD_SAMPLING_INVESTIGATION.md
  | 'doc:V1.2-slice-5F'       // docs/V1_2_SLICE_5F_PHOTO_LIGHTING_GUIDANCE.md
  | 'doc:V1.3-slice-0'        // docs/V1_3_SLICE_0_DOMAIN_RESEARCH.md
  | 'doc:V1.4-plan'           // docs/V1_4_LEARN_PLAN.md (product-authored decisions)

export type SourceRef = LearnSourceId | InternalSourceId

export interface LearnClaim {
  truth: TruthKind
  sources: readonly SourceRef[]
  summary: string
}

// Every authored Learn text or list block names one of these claims. Tests require each claim to be
// used, and each external (C) or combined (E) claim to cite a register source or an internal record.
export const learnClaims = {
  'app-quiz-estimate': { truth: 'A', sources: ['domain:seasons'], summary: 'The quiz compares answers with 12 types defined on four dimensions.' },
  'evidence-modest': { truth: 'C', sources: ['L11', 'L12', 'L5'], summary: 'Warm/cool clothing-to-skin harmony has some experimental support; no type system is validated.' },
  history: { truth: 'C', sources: ['L1', 'L2', 'L3'], summary: 'Itten, then Color Me Beautiful (four seasons, 1980), later expanded to 12 types.' },
  'systems-differ': { truth: 'C', sources: ['L4', 'L5', 'L6'], summary: 'Systems differ in names and number of types; no exact mapping is claimed.' },
  'color-vocabulary': { truth: 'E', sources: ['L7', 'domain:seasons'], summary: 'Value and chroma as Munsell terms; the four app dimensions.' },
  'bands-not-scores': { truth: 'D', sources: ['doc:V1.4-plan'], summary: 'Type positions are shown as word bands, never numbers.' },
  'season-model': { truth: 'E', sources: ['domain:seasons', 'L2'], summary: 'Season temperature and clarity, derived from the subtype targets.' },
  'type-naming': { truth: 'A', sources: ['domain:seasons'], summary: 'Each type is named for the dimension where its target is most extreme.' },
  placement: { truth: 'E', sources: ['domain:placement', 'doc:V1.4-plan'], summary: 'Near-face and away-from-face garments, from the V1.2 placement vocabulary.' },
  'more-considered-listed-only': { truth: 'E', sources: ['domain:palettes', 'doc:V1.4-plan'], summary: 'Only listed harder colours are More Considered; absence from a palette means nothing.' },
  'photo-records-light': { truth: 'C', sources: ['L9'], summary: 'A photo records light, which depends on the illumination.' },
  'camera-guesses': { truth: 'E', sources: ['L10', 'doc:V1.2-slice-5E'], summary: 'White balance and exposure shift recorded colour.' },
  'context-changes-appearance': { truth: 'C', sources: ['L8'], summary: 'Surrounding colours change how a colour looks.' },
  'photo-guide-only': { truth: 'E', sources: ['domain:photoColor', 'doc:V1.2-slice-5E', 'doc:V1.2-slice-5F'], summary: 'Photo check reads the colour as it appears; it cannot know the garment colour.' },
  'two-goal-composition': { truth: 'E', sources: ['domain:luckyColor', 'doc:V1.3-slice-0'], summary: 'The tradition gives one colour per goal; combining two goals is app behaviour.' },
} as const satisfies Record<string, LearnClaim>

export type LearnClaimId = keyof typeof learnClaims
