// V1.4 Learn: the public surface for the Learn UI (Slice 2 onwards). Slice 1 has no UI, so nothing in
// the app imports this yet.
export type * from './types'
export type { AppCopyRef } from './appCopy'
export type { LearnClaimId, LearnSourceId, SourceRef, TruthKind } from './sources'
export type { DimensionPosition, LearnProfile, OutfitExample, OutfitFormula, SeasonGroup, SubtypeGuide, SwatchGroup } from './model'
export { resolveAppCopy } from './appCopy'
export { learnClaims, learnSources } from './sources'
export { learnGroups, learnHomeFeatured, learnTopicOrder, learnTopics, typeDetailSections, typeDetailVisuals } from './registry'
export { dimensionExamples, generalOutfitExample } from './examples'
export {
  bandEnd, dimensionBand, dimensionOrder, getLearnCopy, learnProfileFrom, namingQuality, outfitExample,
  outfitFormula, paletteColorById, seasonGroups, seasonOf, seasonTraits, subtypeGuide,
} from './model'
