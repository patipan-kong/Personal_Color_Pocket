import { describe, expect, it } from 'vitest'
import { AI_CANDIDATE_IDS } from '../domain/aiColorLab/contract'
import { CANDIDATE_PRICING, estimateCostUsd } from './pricing'

// V2.0 Slice 0.2 (plan §13, §22 M): cost estimation must never fabricate a number when usage is
// unavailable -- it must return null (rendered as "Cost unavailable" by the UI) instead.
describe('estimateCostUsd', () => {
  it('returns null when usage is null (never fabricates a cost)', () => {
    expect(estimateCostUsd('openai', null)).toBeNull()
  })

  it('returns null when inputTokens is missing, even if outputTokens is present', () => {
    expect(estimateCostUsd('openai', { inputTokens: null, outputTokens: 100, totalTokens: 100 })).toBeNull()
  })

  it('returns null when outputTokens is missing, even if inputTokens is present', () => {
    expect(estimateCostUsd('openai', { inputTokens: 100, outputTokens: null, totalTokens: 100 })).toBeNull()
  })

  it('computes a reliable estimate from real per-1M pricing when both token counts are present', () => {
    // openai: $0.25/1M in, $2.00/1M out
    const cost = estimateCostUsd('openai', { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 })
    expect(cost).toBeCloseTo(0.25 + 2.00, 10)
  })

  it('every active candidate has a recorded pricing source and as-of date (plan §13: "Record the pricing source/date")', () => {
    for (const candidateId of AI_CANDIDATE_IDS) {
      const pricing = CANDIDATE_PRICING[candidateId]
      expect(pricing.source).toMatch(/^https:\/\//)
      expect(pricing.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(pricing.inputPerMillionUsd).toBeGreaterThan(0)
      expect(pricing.outputPerMillionUsd).toBeGreaterThan(0)
    }
  })

  it('Gemini Flash-Lite is priced lower than Gemini Flash on both dimensions (plan §14 premise)', () => {
    expect(CANDIDATE_PRICING['gemini-flash-lite'].inputPerMillionUsd).toBeLessThan(CANDIDATE_PRICING['gemini-flash'].inputPerMillionUsd)
    expect(CANDIDATE_PRICING['gemini-flash-lite'].outputPerMillionUsd).toBeLessThan(CANDIDATE_PRICING['gemini-flash'].outputPerMillionUsd)
  })
})
