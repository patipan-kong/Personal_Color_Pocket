import type { OwnedRecommendationResult } from './contract.js'
import type { InspirationRecommendationResult } from './inspirationContract.js'

export type ProductionTodayOutfitResult =
  | { readonly mode: 'owned'; readonly result: OwnedRecommendationResult }
  | { readonly mode: 'inspiration'; readonly result: InspirationRecommendationResult }
