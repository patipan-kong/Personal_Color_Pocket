// V1.3 Slice 1. This is source-domain knowledge only: broad Thai daily lucky-colour
// families and their provenance. It deliberately has no Personal Color, palette, HEX,
// garment, browser, or persistence concepts.

export const LUCKY_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type LuckyWeekday = typeof LUCKY_WEEKDAYS[number]

export const LUCKY_GOALS = ['work', 'money', 'luck', 'mentor-support'] as const
export type LuckyGoal = typeof LUCKY_GOALS[number]

export const TRADITIONAL_CATEGORIES = ['dech', 'sri', 'mula', 'montri', 'kalakini'] as const
export type TraditionalCategory = typeof TRADITIONAL_CATEGORIES[number]

export const LUCKY_COLOR_FAMILIES = [
  'white', 'yellow', 'pink', 'red', 'green',
  'blue', 'purple', 'orange', 'gray', 'black',
] as const
export type LuckyColorFamily = typeof LUCKY_COLOR_FAMILIES[number]

export interface LuckyColorSource {
  readonly id: string
  readonly title: string
  readonly publisher: string
  readonly url: string
  readonly role: string
}

export interface LuckyColorRule {
  readonly weekday: LuckyWeekday
  readonly traditionalCategory: TraditionalCategory
  // null is reserved for the provenance-only kalakini rules.
  readonly goal: LuckyGoal | null
  readonly colorFamilies: readonly LuckyColorFamily[]
  readonly sourceIds: readonly string[]
  readonly sourceTermsTh: readonly string[]
  readonly notes?: string
}

export interface LuckyColorKnowledgeSet {
  readonly datasetVersion: string
  readonly systemId: 'thai-daily-shirt-color-taksa-7day'
  readonly reviewedAt: string
  readonly sources: readonly LuckyColorSource[]
  readonly rules: readonly LuckyColorRule[]
}
