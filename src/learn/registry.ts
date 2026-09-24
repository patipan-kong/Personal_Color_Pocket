import type { LearnGroupId, LearnPersonalization, LearnTopicId, LearnVisualKind } from './types'
import type { TruthKind } from './sources'

// The stable, language-independent P0 topic registry. Titles and prose live in content/{en,th}.ts.
// `visual` is what the reader draws for a topic; Slice 4 gave More Considered and Lucky Color their own.

export interface LearnTopicMeta {
  id: LearnTopicId
  group: LearnGroupId
  visual: LearnVisualKind | null
  personalization: LearnPersonalization
  truth: TruthKind
}

// Learn home: one page, three groups, in this order.
export const learnGroups: readonly { id: LearnGroupId; topics: readonly LearnTopicId[] }[] = [
  { id: 'basics', topics: ['basics.what-is', 'basics.dimensions', 'types.overview'] },
  { id: 'wear', topics: ['wear.palette', 'wear.harder'] },
  { id: 'app', topics: ['app.color-checker', 'app.lucky'] },
]

export const learnTopicOrder: readonly LearnTopicId[] = learnGroups.flatMap((group) => group.topics)

export const learnTopics: Readonly<Record<LearnTopicId, LearnTopicMeta>> = {
  'basics.what-is': { id: 'basics.what-is', group: 'basics', visual: 'season-strips', personalization: 'none', truth: 'E' },
  'basics.dimensions': { id: 'basics.dimensions', group: 'basics', visual: 'dimension-scales', personalization: 'type-markers', truth: 'E' },
  'types.overview': { id: 'types.overview', group: 'basics', visual: 'subtype-grid', personalization: 'type-badge', truth: 'E' },
  'wear.palette': { id: 'wear.palette', group: 'wear', visual: 'garment-placement', personalization: 'own-colors', truth: 'E' },
  'wear.harder': { id: 'wear.harder', group: 'wear', visual: 'placement-shift', personalization: 'own-colors', truth: 'E' },
  'app.color-checker': { id: 'app.color-checker', group: 'app', visual: 'lighting-comparison', personalization: 'checker-link', truth: 'E' },
  'app.lucky': { id: 'app.lucky', group: 'app', visual: 'lucky-flow', personalization: 'none', truth: 'E' },
}

// At most two featured cards on the Learn home (plan §11); everything else is a list row.
export const learnHomeFeatured: Readonly<{ withProfile: readonly LearnTopicId[]; withoutProfile: readonly LearnTopicId[] }> = {
  withProfile: ['wear.palette', 'wear.harder'],
  withoutProfile: ['basics.what-is', 'types.overview'],
}

// The one subtype-detail template (plan §14), in display order. P1 "nearby types" is not included.
export const typeDetailSections = ['header', 'position', 'best', 'neutrals', 'accents', 'harder', 'metals', 'formula'] as const
export const typeDetailVisuals: readonly LearnVisualKind[] = ['dimension-scales', 'palette-swatches']
