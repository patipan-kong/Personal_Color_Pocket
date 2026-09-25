import type { AiProviderId, AiProviderOutcome } from '../domain/aiColorLab/contract'
import { AI_PROVIDER_IDS } from '../domain/aiColorLab/contract'

// V2.0 AI Color Lab (Slice 0, plan §7-8, §17-31): each provider card's own lifecycle, entirely
// independent of the other three. Pure reducer, unit-testable directly (mirrors
// photoChecker/photoPanelState.ts's pattern: every async completion carries the runId of the
// request that started it, so a late result from a superseded run can never overwrite a newer
// one -- plan §31 Case G).

export type ProviderCardState =
  | { status: 'idle' }
  | { status: 'loading'; runId: number }
  | { status: 'success'; runId: number; outcome: Extract<AiProviderOutcome, { ok: true }> }
  | { status: 'error'; runId: number; outcome: Extract<AiProviderOutcome, { ok: false }> }

export type AiLabProvidersState = Record<AiProviderId, ProviderCardState>

export const initialProvidersState: AiLabProvidersState = {
  gemini: { status: 'idle' },
  openai: { status: 'idle' },
  groq: { status: 'idle' },
  deepseek: { status: 'idle' },
}

export type AiLabAction =
  | { type: 'started'; provider: AiProviderId; runId: number }
  | { type: 'completed'; provider: AiProviderId; runId: number; outcome: AiProviderOutcome }
  | { type: 'reset' } // a new photo or sample point starts a genuinely new analysis (plan §31 Case G)

export function aiLabProvidersReducer(state: AiLabProvidersState, action: AiLabAction): AiLabProvidersState {
  switch (action.type) {
    case 'reset':
      return initialProvidersState
    case 'started':
      // A retry or a fresh Run All always overwrites this ONE provider's card immediately (a
      // provider still loading must not block a retry of itself); other providers are untouched.
      return { ...state, [action.provider]: { status: 'loading', runId: action.runId } }
    case 'completed': {
      const current = state[action.provider]
      // Ignore completions for a runId this provider's card is no longer waiting on: either a
      // newer run already superseded it (plan §31 Case G), or it was never asked to load.
      if (current.status !== 'loading' || current.runId !== action.runId) return state
      return {
        ...state,
        [action.provider]: action.outcome.ok
          ? { status: 'success', runId: action.runId, outcome: action.outcome }
          : { status: 'error', runId: action.runId, outcome: action.outcome },
      }
    }
  }
}

// Providers whose error is meaningfully retryable (every kind actually -- even "internal" or
// "network" may succeed a second time; only a genuinely missing key rarely will, but retry stays
// offered there too since the PO may add the key and reload -- plan §8: "Do not make Retry All
// the only recovery mechanism").
export function isRetryable(state: ProviderCardState): boolean {
  return state.status === 'error'
}

export const ALL_PROVIDERS = AI_PROVIDER_IDS
