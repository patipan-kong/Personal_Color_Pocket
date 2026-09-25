import type { AiCandidateId, AiUsage } from '../domain/aiColorLab/contract'
import type { BakeoffRunRecord, PoReview } from './aiLabState'
import { reviewKey } from './aiLabState'
import { estimateCostUsd } from './pricing'
import { median, sum } from './stats'

// V2.0 Slice 0.2 (plan §11): compact, FACTUAL per-candidate measurements only -- explicitly no
// weighted composite score, no automatic rank, no "winner" field anywhere in this shape (plan
// §11, §25). The PO reads these numbers and decides; this module only counts and averages.
export interface CandidateSummary {
  candidateId: AiCandidateId
  runs: number
  successful: number
  failed: number
  targetCorrect: number
  targetWrong: number
  targetUnsure: number
  colorGood: number
  colorAcceptable: number
  colorWrong: number
  lightingGood: number
  lightingAcceptable: number
  lightingWrong: number
  medianLatencyMs: number | null
  usageTotals: { inputTokens: number; outputTokens: number; totalTokens: number } | null
  estimatedCostUsd: number | null
}

export function summarizeCandidate(candidateId: AiCandidateId, history: BakeoffRunRecord[], reviews: Record<string, PoReview>): CandidateSummary {
  const runs = history.filter((record) => record.candidateId === candidateId)
  const successful = runs.filter((record) => record.outcome.ok)
  const reviewsForRuns = runs.map((record) => reviews[reviewKey(record.candidateId, record.runId)]).filter((review): review is PoReview => review != null)

  const usages = successful.map((record) => (record.outcome.ok ? record.outcome.usage : null)).filter((usage): usage is AiUsage => usage != null)
  const usageTotals = usages.length > 0
    ? {
      inputTokens: sum(usages.map((usage) => usage.inputTokens ?? 0)),
      outputTokens: sum(usages.map((usage) => usage.outputTokens ?? 0)),
      totalTokens: sum(usages.map((usage) => usage.totalTokens ?? 0)),
    }
    : null

  const costs = successful
    .map((record) => (record.outcome.ok ? estimateCostUsd(candidateId, record.outcome.usage) : null))
    .filter((cost): cost is number => cost != null)

  return {
    candidateId,
    runs: runs.length,
    successful: successful.length,
    failed: runs.length - successful.length,
    targetCorrect: reviewsForRuns.filter((review) => review.target === 'correct').length,
    targetWrong: reviewsForRuns.filter((review) => review.target === 'wrong').length,
    targetUnsure: reviewsForRuns.filter((review) => review.target === 'unsure').length,
    colorGood: reviewsForRuns.filter((review) => review.color === 'good').length,
    colorAcceptable: reviewsForRuns.filter((review) => review.color === 'acceptable').length,
    colorWrong: reviewsForRuns.filter((review) => review.color === 'wrong').length,
    lightingGood: reviewsForRuns.filter((review) => review.lighting === 'good').length,
    lightingAcceptable: reviewsForRuns.filter((review) => review.lighting === 'acceptable').length,
    lightingWrong: reviewsForRuns.filter((review) => review.lighting === 'wrong').length,
    // Every run (success or failure) has a real application-measured latencyMs (plan §12); a
    // failure's latency is still a genuine measurement of that round trip, so it is included.
    medianLatencyMs: median(runs.map((record) => record.outcome.latencyMs)),
    usageTotals,
    estimatedCostUsd: costs.length > 0 ? sum(costs) : null,
  }
}

export function summarizeSession(candidateIds: readonly AiCandidateId[], history: BakeoffRunRecord[], reviews: Record<string, PoReview>): CandidateSummary[] {
  return candidateIds.map((candidateId) => summarizeCandidate(candidateId, history, reviews))
}
