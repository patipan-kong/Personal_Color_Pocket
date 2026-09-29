import type { OwnedOutfitRequest, OwnedRecommendationResult } from './contract.js'
import type { InspirationOutfitRequest, InspirationRecommendationResult } from './inspirationContract.js'

export type ProductionTodayOutfitResult =
  | { readonly mode: 'owned'; readonly request: OwnedOutfitRequest; readonly result: OwnedRecommendationResult }
  | { readonly mode: 'inspiration'; readonly request: InspirationOutfitRequest; readonly result: InspirationRecommendationResult }
