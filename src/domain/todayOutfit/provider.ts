import type { AiErrorInfo, AiUsage } from '../ai/providerCatalog'
import type { OutfitRecommendation } from './contract'

export type OutfitProviderOutcome =
  | { readonly ok: true; readonly result: OutfitRecommendation; readonly latencyMs: number; readonly usage: AiUsage | null; readonly validation: { readonly valid: true; readonly issues: readonly [] } }
  | { readonly ok: false; readonly error: AiErrorInfo; readonly latencyMs: number; readonly validation?: { readonly valid: false; readonly issues: readonly string[] } }
