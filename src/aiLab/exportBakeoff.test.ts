import { describe, expect, it } from 'vitest'
import type { AiProviderOutcome } from '../domain/aiColorLab/contract'
import type { BakeoffRunRecord, PoReview } from './aiLabState'
import { reviewKey } from './aiLabState'
import { buildBakeoffExport } from './exportBakeoff'

const IMAGE_BYTES = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAABAAEDASIAAhEBAxEB'

const outcome: Extract<AiProviderOutcome, { ok: true }> = {
  ok: true, latencyMs: 900,
  usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
  raw: { candidates: [{ content: { parts: [{ text: '{}' }] } }], echoedRequestImage: IMAGE_BYTES, apiKeyUsed: 'sk-super-secret-should-never-leak' },
  result: {
    provider: 'gemini', model: 'gemini-3.5-flash',
    targetAssessment: { objectType: 'shirt', objectDescription: 'cream shirt', targetMatched: true },
    perceivedColorName: 'Cream', colorFamily: 'neutral', temperature: 'warm', value: 'light', chroma: 'muted',
    lighting: { condition: 'soft', cast: 'neutral', severity: 'low' },
    sampleAssessment: { usable: true, issue: 'none' }, suitability: 'workable', confidence: 'medium', reasoning: 'x',
  },
}

const history: BakeoffRunRecord[] = [{ candidateId: 'gemini-flash', runId: 1, timestamp: 1_700_000_000_000, outcome }]
const reviews: Record<string, PoReview> = { [reviewKey('gemini-flash', 1)]: { target: 'correct', color: 'good', lighting: 'good', note: 'looked right' } }

// V2.0 Slice 0.2 (plan §19, §22 N, §23): the export must never carry photo bytes, base64, or key
// material -- even when a mocked `raw` provider envelope (which this module deliberately never
// includes) contains something that looks like one, proving the export is built from an explicit
// allowlist rather than a spread of the full outcome.
describe('buildBakeoffExport', () => {
  it('contains no imageDataUrl, no raw provider envelope, and no base64/key-shaped strings anywhere in the serialized output', () => {
    const exported = buildBakeoffExport(history, reviews)
    const serialized = JSON.stringify(exported)
    expect(serialized).not.toContain('imageDataUrl')
    expect(serialized).not.toContain('raw')
    expect(serialized).not.toContain(IMAGE_BYTES)
    expect(serialized).not.toContain('data:image')
    expect(serialized).not.toContain('sk-super-secret-should-never-leak')
    expect(serialized).not.toContain('echoedRequestImage')
    expect(serialized).not.toContain('apiKeyUsed')
  })

  it('still carries the normalized result, latency, usage, estimated cost, and PO review for each run', () => {
    const exported = buildBakeoffExport(history, reviews)
    expect(exported.runs).toHaveLength(1)
    const run = exported.runs[0]
    expect(run.candidateId).toBe('gemini-flash')
    expect(run.provider).toBe('gemini')
    expect(run.model).toBe('gemini-3.5-flash')
    expect(run.ok).toBe(true)
    expect(run.result).toEqual(outcome.result)
    expect(run.latencyMs).toBe(900)
    expect(run.usage).toEqual(outcome.usage)
    expect(run.estimatedCostUsd).toBeGreaterThan(0)
    expect(run.review).toEqual({ target: 'correct', color: 'good', lighting: 'good', note: 'looked right' })
  })

  it('reports review as null for a run the PO never reviewed', () => {
    const exported = buildBakeoffExport(history, {})
    expect(exported.runs[0].review).toBeNull()
  })

  it('reports a failed run\'s error and null result/usage/cost, never fabricating success data', () => {
    const failedHistory: BakeoffRunRecord[] = [{
      candidateId: 'groq', runId: 2, timestamp: 1_700_000_001_000,
      outcome: { ok: false, latencyMs: 500, error: { kind: 'timeout', httpStatus: null, message: 'The request timed out.' } },
    }]
    const exported = buildBakeoffExport(failedHistory, {})
    const run = exported.runs[0]
    expect(run.ok).toBe(false)
    expect(run.result).toBeNull()
    expect(run.usage).toBeNull()
    expect(run.estimatedCostUsd).toBeNull()
    expect(run.error).toEqual({ kind: 'timeout', httpStatus: null, message: 'The request timed out.' })
  })
})
