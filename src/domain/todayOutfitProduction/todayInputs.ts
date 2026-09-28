import { getRecordWardrobeSlot } from '../wardrobe/wardrobe'
import type { WardrobeRecordV1 } from '../wardrobe/wardrobe'

export const TODAY_OCCASIONS = [
  'casual',
  'work',
  'date',
  'casual-dinner',
  'smart-casual',
  'formal',
  'wedding-guest',
] as const

export type TodayOccasion = typeof TODAY_OCCASIONS[number]
export const DEFAULT_TODAY_OCCASION: TodayOccasion = 'casual'

export const OUTFIT_SOURCES = ['wardrobe', 'inspiration'] as const
export type OutfitSource = typeof OUTFIT_SOURCES[number]
export type OutfitSourceSelection = 'automatic' | 'user'

export type WardrobeCoverageNeed = 'top-or-one-piece' | 'bottom-or-one-piece' | 'shoes'

export interface WardrobeCoverage {
  readonly itemCount: number
  readonly ready: boolean
  readonly hasSeparatesBase: boolean
  readonly hasOnePieceBase: boolean
  readonly missing: readonly WardrobeCoverageNeed[]
}

export interface TodayOutfitInputState {
  readonly occasion: TodayOccasion
  readonly source: OutfitSource
  readonly sourceSelection: OutfitSourceSelection
}

export function getWardrobeCoverage(items: readonly WardrobeRecordV1[]): WardrobeCoverage {
  const slots = new Set(items.map(getRecordWardrobeSlot))
  const hasTop = slots.has('top')
  const hasBottom = slots.has('bottom')
  const hasOnePiece = slots.has('one-piece')
  const hasShoes = slots.has('shoes')
  const hasSeparatesBase = hasTop && hasBottom
  const hasOnePieceBase = hasOnePiece
  const missing: WardrobeCoverageNeed[] = []

  if (!hasOnePiece && !hasTop) missing.push('top-or-one-piece')
  if (!hasOnePiece && !hasBottom) missing.push('bottom-or-one-piece')
  if (!hasShoes) missing.push('shoes')

  return {
    itemCount: items.length,
    ready: hasShoes && (hasSeparatesBase || hasOnePieceBase),
    hasSeparatesBase,
    hasOnePieceBase,
    missing,
  }
}

export function defaultOutfitSource(coverage: WardrobeCoverage): OutfitSource {
  return coverage.ready ? 'wardrobe' : 'inspiration'
}

export function createTodayOutfitInputState(coverage: WardrobeCoverage): TodayOutfitInputState {
  return {
    occasion: DEFAULT_TODAY_OCCASION,
    source: defaultOutfitSource(coverage),
    sourceSelection: 'automatic',
  }
}

export function syncAutomaticOutfitSource(state: TodayOutfitInputState, coverage: WardrobeCoverage): TodayOutfitInputState {
  if (state.sourceSelection === 'user') return state
  const source = defaultOutfitSource(coverage)
  return source === state.source ? state : { ...state, source }
}

export function chooseOutfitSource(state: TodayOutfitInputState, source: OutfitSource): TodayOutfitInputState {
  return { ...state, source, sourceSelection: 'user' }
}
