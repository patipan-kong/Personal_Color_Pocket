import { describe, expect, it } from 'vitest'
import type { AiProviderOutcome, AiUsage } from '../domain/aiColorLab/contract'
import type { BakeoffRunRecord, PoReview } from './aiLabState'
import { reviewKey } from './aiLabState'
import { summarizeCandidate } from './bakeoffSummary'

const okOutcome = (latencyMs: number, usage: AiUsage | null = { inputTokens: 100, outputTokens: 50, totalTokens: 150 }): Extract<AiProviderOutcome, { ok: true }> => ({
  ok: true, latencyMs, usage, raw: {},
  result: {
    provider: 'openai', model: 'gpt-5-mini',
    targetAssessment: { objectType: 'shirt', objectDescription: 'x', targetMatched: true },
    perceivedColorName: 'x', colorFamily: 'x', temperature: 'warm', value: 'medium', chroma: 'medium',
    lighting: { condition: 'x', cast: 'neutral', severity: 'low' },
    sampleAssessment: { usable: true, issue: 'none' }, suitability: 'workable', confidence: 'medium', reasoning: 'x',
  },
})
const errOutcome = (latencyMs: number): Extract<AiProviderOutcome, { ok: false }> => ({
  ok: false, latencyMs, error: { kind: 'provider-error', httpStatus: 500, message: 'boom' },
})

function record(runId: number, outcome: AiProviderOutcome): BakeoffRunRecord {
  return { candidateId: 'openai', runId, timestamp: 1_000 + runId, outcome }
}

// V2.0 Slice 0.2 (plan §11, §22 K): factual counting only -- no composite score is computed
// anywhere in this module.
describe('summarizeCandidate', () => {
  it('counts runs/successful/failed correctly', () => {
    const history = [record(1, okOutcome(100)), record(2, okOutcome(200)), record(3, errOutcome(50))]
    const summary = summarizeCandidate('openai', history, {})
    expect(summary.runs).toBe(3)
    expect(summary.successful).toBe(2)
    expect(summary.failed).toBe(1)
  })

  it('only counts runs for the requested candidate, ignoring other candidates\' history', () => {
    const history = [record(1, okOutcome(100)), { candidateId: 'groq' as const, runId: 2, timestamp: 1002, outcome: okOutcome(999) }]
    const summary = summarizeCandidate('openai', history, {})
    expect(summary.runs).toBe(1)
  })

  it('counts PO reviews correctly, keyed by candidate + runId, ignoring unreviewed runs', () => {
    const history = [record(1, okOutcome(100)), record(2, okOutcome(200)), record(3, okOutcome(150))]
    const reviews: Record<string, PoReview> = {
      [reviewKey('openai', 1)]: { target: 'correct', color: 'good', lighting: 'good', note: '' },
      [reviewKey('openai', 2)]: { target: 'wrong', color: 'wrong', lighting: 'acceptable', note: '' },
      // run 3 intentionally has no review
    }
    const summary = summarizeCandidate('openai', history, reviews)
    expect(summary.targetCorrect).toBe(1)
    expect(summary.targetWrong).toBe(1)
    expect(summary.targetUnsure).toBe(0)
    expect(summary.colorGood).toBe(1)
    expect(summary.colorWrong).toBe(1)
    expect(summary.colorAcceptable).toBe(0)
    expect(summary.lightingGood).toBe(1)
    expect(summary.lightingAcceptable).toBe(1)
    expect(summary.lightingWrong).toBe(0)
  })

  it('does not count a review belonging to a different runId of the same candidate (plan §22 J)', () => {
    const history = [record(1, okOutcome(100))]
    const reviews: Record<string, PoReview> = { [reviewKey('openai', 99)]: { target: 'correct', color: 'good', lighting: 'good', note: '' } }
    const summary = summarizeCandidate('openai', history, reviews)
    expect(summary.targetCorrect).toBe(0)
  })

  it('computes median latency across all runs including failures (plan §12: real measured latency)', () => {
    const history = [record(1, okOutcome(100)), record(2, okOutcome(300)), record(3, errOutcome(200))]
    const summary = summarizeCandidate('openai', history, {})
    expect(summary.medianLatencyMs).toBe(200)
  })

  it('returns null median latency when there are no runs', () => {
    expect(summarizeCandidate('openai', [], {}).medianLatencyMs).toBeNull()
  })

  it('sums usage totals across successful runs only, and returns null when no run reported usage', () => {
    const withUsage = [record(1, okOutcome(100, { inputTokens: 10, outputTokens: 5, totalTokens: 15 })), record(2, okOutcome(100, { inputTokens: 20, outputTokens: 10, totalTokens: 30 }))]
    const summary = summarizeCandidate('openai', withUsage, {})
    expect(summary.usageTotals).toEqual({ inputTokens: 30, outputTokens: 15, totalTokens: 45 })

    const withoutUsage = [record(1, okOutcome(100, null))]
    expect(summarizeCandidate('openai', withoutUsage, {}).usageTotals).toBeNull()
  })

  it('sums estimated cost only from runs with reliable usage, never fabricating for runs without it (plan §22 M)', () => {
    const history = [record(1, okOutcome(100, { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 })), record(2, okOutcome(100, null))]
    const summary = summarizeCandidate('openai', history, {})
    // openai pricing: $0.25/1M in + $2.00/1M out = $2.25 for the one run with usage.
    expect(summary.estimatedCostUsd).toBeCloseTo(2.25, 10)
  })

  it('returns null estimated cost when no run has reliable usage', () => {
    const history = [record(1, okOutcome(100, null))]
    expect(summarizeCandidate('openai', history, {}).estimatedCostUsd).toBeNull()
  })
})
