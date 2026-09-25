import { describe, expect, it } from 'vitest'
import type { AiErrorKind, AiProviderOutcome } from '../domain/aiColorLab/contract'
import { aiLabProvidersReducer, initialProvidersState } from './aiLabState'

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

describe('aiLabProvidersReducer', () => {
  it('starts idle for every provider (Gemini, OpenAI, Groq -- DeepSeek removed in Slice 0.1)', () => {
    expect(initialProvidersState.gemini).toEqual({ status: 'idle' })
    expect(initialProvidersState.openai).toEqual({ status: 'idle' })
    expect(initialProvidersState.groq).toEqual({ status: 'idle' })
    expect(Object.keys(initialProvidersState).sort()).toEqual(['gemini', 'groq', 'openai'])
  })

  it('started moves only that provider to loading, leaving the other two untouched', () => {
    const state = aiLabProvidersReducer(initialProvidersState, { type: 'started', provider: 'gemini', runId: 1 })
    expect(state.gemini).toEqual({ status: 'loading', runId: 1 })
    expect(state.openai).toEqual({ status: 'idle' })
    expect(state.groq).toEqual({ status: 'idle' })
  })

  it('completed applies a matching runId as success', () => {
    const loading = aiLabProvidersReducer(initialProvidersState, { type: 'started', provider: 'gemini', runId: 1 })
    const outcome = success()
    const done = aiLabProvidersReducer(loading, { type: 'completed', provider: 'gemini', runId: 1, outcome })
    expect(done.gemini).toEqual({ status: 'success', runId: 1, outcome })
  })

  it('completed applies a matching runId as error', () => {
    const loading = aiLabProvidersReducer(initialProvidersState, { type: 'started', provider: 'groq', runId: 1 })
    const outcome = failure('rate-limited')
    const done = aiLabProvidersReducer(loading, { type: 'completed', provider: 'groq', runId: 1, outcome })
    expect(done.groq).toEqual({ status: 'error', runId: 1, outcome })
  })

  it('ignores a completion whose runId does not match the current loading runId (stale response, plan Case G)', () => {
    const firstRun = aiLabProvidersReducer(initialProvidersState, { type: 'started', provider: 'gemini', runId: 1 })
    const secondRun = aiLabProvidersReducer(firstRun, { type: 'started', provider: 'gemini', runId: 2 })
    const staleCompletion = aiLabProvidersReducer(secondRun, { type: 'completed', provider: 'gemini', runId: 1, outcome: success() })
    expect(staleCompletion.gemini).toEqual({ status: 'loading', runId: 2 })
  })

  it('ignores a completion for a provider that is not currently loading', () => {
    const state = aiLabProvidersReducer(initialProvidersState, { type: 'completed', provider: 'openai', runId: 1, outcome: success() })
    expect(state).toEqual(initialProvidersState)
  })

  it('a success on one provider is untouched when another provider later fails (plan §7)', () => {
    let state = aiLabProvidersReducer(initialProvidersState, { type: 'started', provider: 'gemini', runId: 1 })
    state = aiLabProvidersReducer(state, { type: 'completed', provider: 'gemini', runId: 1, outcome: success() })
    state = aiLabProvidersReducer(state, { type: 'started', provider: 'groq', runId: 2 })
    state = aiLabProvidersReducer(state, { type: 'completed', provider: 'groq', runId: 2, outcome: failure('provider-error') })
    expect(state.gemini.status).toBe('success')
    expect(state.groq.status).toBe('error')
  })

  it('retrying one provider does not touch the others (plan §8)', () => {
    let state = aiLabProvidersReducer(initialProvidersState, { type: 'started', provider: 'gemini', runId: 1 })
    state = aiLabProvidersReducer(state, { type: 'completed', provider: 'gemini', runId: 1, outcome: success() })
    const beforeRetry = state
    state = aiLabProvidersReducer(state, { type: 'started', provider: 'groq', runId: 2 })
    expect(state.gemini).toEqual(beforeRetry.gemini)
    expect(state.openai).toEqual(beforeRetry.openai)
  })

  it('reset clears every provider back to idle', () => {
    let state = aiLabProvidersReducer(initialProvidersState, { type: 'started', provider: 'gemini', runId: 1 })
    state = aiLabProvidersReducer(state, { type: 'completed', provider: 'gemini', runId: 1, outcome: success() })
    state = aiLabProvidersReducer(state, { type: 'reset' })
    expect(state).toEqual(initialProvidersState)
  })
})
