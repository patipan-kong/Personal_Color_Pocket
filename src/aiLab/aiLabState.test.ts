import { describe, expect, it } from 'vitest'
import type { AiErrorKind, AiProviderOutcome } from '../domain/aiColorLab/contract'
import { aiLabBakeoffReducer, EMPTY_REVIEW, initialBakeoffState, initialCandidatesState, reviewKey } from './aiLabState'

const success = (latencyMs = 100): Extract<AiProviderOutcome, { ok: true }> => ({
  ok: true,
  latencyMs,
  usage: null,
  raw: {},
  result: {
    provider: 'gemini', model: 'test-model',
    targetAssessment: { objectType: 'shirt', objectDescription: 'test garment', targetMatched: true },
    perceivedColorName: 'Dusty Rose', colorFamily: 'pink',
    temperature: 'warm', value: 'medium', chroma: 'muted',
    lighting: { condition: 'soft daylight', cast: 'neutral', severity: 'low' },
    sampleAssessment: { usable: true, issue: 'none' },
    suitability: 'workable', confidence: 'medium', reasoning: 'test',
  },
})
const failure = (kind: AiErrorKind = 'provider-error'): Extract<AiProviderOutcome, { ok: false }> => ({
  ok: false, latencyMs: 50, error: { kind, httpStatus: 500, message: 'boom' },
})

describe('aiLabBakeoffReducer: card lifecycle (Slice 0, extended Slice 0.2 to four candidates)', () => {
  it('starts idle for every candidate (Gemini Flash, Gemini Flash-Lite, OpenAI, Groq)', () => {
    expect(initialCandidatesState['gemini-flash']).toEqual({ status: 'idle' })
    expect(initialCandidatesState['gemini-flash-lite']).toEqual({ status: 'idle' })
    expect(initialCandidatesState.openai).toEqual({ status: 'idle' })
    expect(initialCandidatesState.groq).toEqual({ status: 'idle' })
    expect(Object.keys(initialCandidatesState).sort()).toEqual(['gemini-flash', 'gemini-flash-lite', 'groq', 'openai'])
    expect(initialBakeoffState.cards).toEqual(initialCandidatesState)
    expect(initialBakeoffState.history).toEqual([])
    expect(initialBakeoffState.reviews).toEqual({})
  })

  it('started moves only that candidate to loading, leaving the others untouched', () => {
    const state = aiLabBakeoffReducer(initialBakeoffState, { type: 'started', candidateId: 'gemini-flash', runId: 1 })
    expect(state.cards['gemini-flash']).toEqual({ status: 'loading', runId: 1 })
    expect(state.cards['gemini-flash-lite']).toEqual({ status: 'idle' })
    expect(state.cards.openai).toEqual({ status: 'idle' })
    expect(state.cards.groq).toEqual({ status: 'idle' })
  })

  it('completed applies a matching runId as success and records it in history', () => {
    const loading = aiLabBakeoffReducer(initialBakeoffState, { type: 'started', candidateId: 'gemini-flash', runId: 1 })
    const outcome = success()
    const done = aiLabBakeoffReducer(loading, { type: 'completed', candidateId: 'gemini-flash', runId: 1, outcome })
    expect(done.cards['gemini-flash']).toEqual({ status: 'success', runId: 1, outcome })
    expect(done.history).toEqual([{ candidateId: 'gemini-flash', runId: 1, timestamp: expect.any(Number), outcome }])
  })

  it('completed applies a matching runId as error and records it in history', () => {
    const loading = aiLabBakeoffReducer(initialBakeoffState, { type: 'started', candidateId: 'groq', runId: 1 })
    const outcome = failure('rate-limited')
    const done = aiLabBakeoffReducer(loading, { type: 'completed', candidateId: 'groq', runId: 1, outcome })
    expect(done.cards.groq).toEqual({ status: 'error', runId: 1, outcome })
    expect(done.history).toEqual([{ candidateId: 'groq', runId: 1, timestamp: expect.any(Number), outcome }])
  })

  it('ignores a completion whose runId does not match the current loading runId (stale response, plan §22 I) -- neither the card nor history is touched', () => {
    const firstRun = aiLabBakeoffReducer(initialBakeoffState, { type: 'started', candidateId: 'gemini-flash', runId: 1 })
    const secondRun = aiLabBakeoffReducer(firstRun, { type: 'started', candidateId: 'gemini-flash', runId: 2 })
    const staleCompletion = aiLabBakeoffReducer(secondRun, { type: 'completed', candidateId: 'gemini-flash', runId: 1, outcome: success() })
    expect(staleCompletion.cards['gemini-flash']).toEqual({ status: 'loading', runId: 2 })
    expect(staleCompletion.history).toEqual([])
  })

  it('ignores a completion for a candidate that is not currently loading', () => {
    const state = aiLabBakeoffReducer(initialBakeoffState, { type: 'completed', candidateId: 'openai', runId: 1, outcome: success() })
    expect(state).toEqual(initialBakeoffState)
  })

  it('a success on one candidate is untouched when another candidate later fails (plan §7)', () => {
    let state = aiLabBakeoffReducer(initialBakeoffState, { type: 'started', candidateId: 'gemini-flash', runId: 1 })
    state = aiLabBakeoffReducer(state, { type: 'completed', candidateId: 'gemini-flash', runId: 1, outcome: success() })
    state = aiLabBakeoffReducer(state, { type: 'started', candidateId: 'groq', runId: 2 })
    state = aiLabBakeoffReducer(state, { type: 'completed', candidateId: 'groq', runId: 2, outcome: failure('provider-error') })
    expect(state.cards['gemini-flash'].status).toBe('success')
    expect(state.cards.groq.status).toBe('error')
  })

  it('one Gemini candidate failing does not affect the other, even though they share a provider/key (plan §20, §22 E)', () => {
    let state = aiLabBakeoffReducer(initialBakeoffState, { type: 'started', candidateId: 'gemini-flash', runId: 1 })
    state = aiLabBakeoffReducer(state, { type: 'started', candidateId: 'gemini-flash-lite', runId: 2 })
    state = aiLabBakeoffReducer(state, { type: 'completed', candidateId: 'gemini-flash-lite', runId: 2, outcome: failure('rate-limited') })
    expect(state.cards['gemini-flash']).toEqual({ status: 'loading', runId: 1 })
    expect(state.cards['gemini-flash-lite'].status).toBe('error')
    state = aiLabBakeoffReducer(state, { type: 'completed', candidateId: 'gemini-flash', runId: 1, outcome: success() })
    expect(state.cards['gemini-flash'].status).toBe('success')
    expect(state.cards['gemini-flash-lite'].status).toBe('error')
  })

  it('retrying one candidate does not touch the others (plan §8)', () => {
    let state = aiLabBakeoffReducer(initialBakeoffState, { type: 'started', candidateId: 'gemini-flash', runId: 1 })
    state = aiLabBakeoffReducer(state, { type: 'completed', candidateId: 'gemini-flash', runId: 1, outcome: success() })
    const beforeRetry = state
    state = aiLabBakeoffReducer(state, { type: 'started', candidateId: 'groq', runId: 2 })
    expect(state.cards['gemini-flash']).toEqual(beforeRetry.cards['gemini-flash'])
    expect(state.cards.openai).toEqual(beforeRetry.cards.openai)
  })

  it('reset clears every card back to idle but preserves session history and reviews (plan §11, §19)', () => {
    let state = aiLabBakeoffReducer(initialBakeoffState, { type: 'started', candidateId: 'gemini-flash', runId: 1 })
    state = aiLabBakeoffReducer(state, { type: 'completed', candidateId: 'gemini-flash', runId: 1, outcome: success() })
    state = aiLabBakeoffReducer(state, { type: 'review', candidateId: 'gemini-flash', runId: 1, review: { ...EMPTY_REVIEW, target: 'correct' } })
    const historyBefore = state.history
    const reviewsBefore = state.reviews
    state = aiLabBakeoffReducer(state, { type: 'reset' })
    expect(state.cards).toEqual(initialCandidatesState)
    expect(state.history).toBe(historyBefore)
    expect(state.reviews).toBe(reviewsBefore)
  })
})

describe('aiLabBakeoffReducer: PO review (plan §9-10, §22 J)', () => {
  it('review state is associated with the exact candidate + runId, not just the candidate', () => {
    let state = aiLabBakeoffReducer(initialBakeoffState, { type: 'started', candidateId: 'gemini-flash', runId: 1 })
    state = aiLabBakeoffReducer(state, { type: 'completed', candidateId: 'gemini-flash', runId: 1, outcome: success() })
    state = aiLabBakeoffReducer(state, { type: 'review', candidateId: 'gemini-flash', runId: 1, review: { target: 'correct', color: 'good', lighting: 'acceptable', note: 'looks right' } })
    expect(state.reviews[reviewKey('gemini-flash', 1)]).toEqual({ target: 'correct', color: 'good', lighting: 'acceptable', note: 'looks right' })

    // A retry (new runId) starts a fresh, unreviewed run -- the OLD run's review stays exactly
    // as recorded, keyed to its own runId, never overwritten by the new run.
    state = aiLabBakeoffReducer(state, { type: 'started', candidateId: 'gemini-flash', runId: 2 })
    state = aiLabBakeoffReducer(state, { type: 'completed', candidateId: 'gemini-flash', runId: 2, outcome: success() })
    expect(state.reviews[reviewKey('gemini-flash', 1)]).toEqual({ target: 'correct', color: 'good', lighting: 'acceptable', note: 'looks right' })
    expect(state.reviews[reviewKey('gemini-flash', 2)]).toBeUndefined()
  })

  it('reviewing one candidate does not affect another candidate\'s review, even for the same runId', () => {
    let state = aiLabBakeoffReducer(initialBakeoffState, { type: 'started', candidateId: 'gemini-flash', runId: 1 })
    state = aiLabBakeoffReducer(state, { type: 'completed', candidateId: 'gemini-flash', runId: 1, outcome: success() })
    state = aiLabBakeoffReducer(state, { type: 'started', candidateId: 'gemini-flash-lite', runId: 1 })
    state = aiLabBakeoffReducer(state, { type: 'completed', candidateId: 'gemini-flash-lite', runId: 1, outcome: success() })
    state = aiLabBakeoffReducer(state, { type: 'review', candidateId: 'gemini-flash', runId: 1, review: { ...EMPTY_REVIEW, target: 'correct' } })
    expect(state.reviews[reviewKey('gemini-flash', 1)]?.target).toBe('correct')
    expect(state.reviews[reviewKey('gemini-flash-lite', 1)]).toBeUndefined()
  })
})
