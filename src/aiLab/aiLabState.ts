import type { AiCandidateId, AiProviderOutcome } from '../domain/aiColorLab/contract'
import { AI_CANDIDATE_IDS } from '../domain/aiColorLab/contract'

// V2.0 AI Color Lab (Slice 0, plan §7-8, §17-31; extended Slice 0.2 plan §4, §8-11, §20-22):
// each candidate card's own lifecycle, entirely independent of the others. Pure reducer,
// unit-testable directly (mirrors photoChecker/photoPanelState.ts's pattern: every async
// completion carries the runId of the request that started it, so a late result from a
// superseded run can never overwrite a newer one -- plan §22 I).
//
// Slice 0.2 additionally tracks a SESSION-LOCAL, in-memory, append-only history of every
// accepted (non-stale) run across every candidate and every photo/sample point run in this
// browser session (plan §11, §19: "session bake-off summary" spans the whole manual 15-20 photo
// bake-off, not just the currently-displayed photo), plus the PO's own review of each run (plan
// §9-10: the PO's judgment is the quality ground truth, never an automatic score). Both are kept
// in the SAME reducer as the per-candidate card state so a single "was this completion accepted
// or stale" check governs card update, history append, and eligibility to review, all at once.

export type CandidateCardState =
  | { status: 'idle' }
  | { status: 'loading'; runId: number }
  | { status: 'success'; runId: number; outcome: Extract<AiProviderOutcome, { ok: true }> }
  | { status: 'error'; runId: number; outcome: Extract<AiProviderOutcome, { ok: false }> }

export type AiLabCandidatesState = Record<AiCandidateId, CandidateCardState>

export const initialCandidatesState: AiLabCandidatesState = {
  'gemini-flash': { status: 'idle' },
  'gemini-flash-lite': { status: 'idle' },
  openai: { status: 'idle' },
  groq: { status: 'idle' },
}

// PO review is the semantic quality ground truth (plan §9-10) -- never inferred from an enum
// match between candidates, never from the AI's own confidence or targetMatched. `null` in any
// field means "not yet reviewed," distinct from any real verdict.
export interface PoReview {
  target: 'correct' | 'wrong' | 'unsure' | null
  color: 'good' | 'acceptable' | 'wrong' | null
  lighting: 'good' | 'acceptable' | 'wrong' | null
  note: string
}

export const EMPTY_REVIEW: PoReview = { target: null, color: null, lighting: null, note: '' }

export interface BakeoffRunRecord {
  candidateId: AiCandidateId
  runId: number
  timestamp: number
  outcome: AiProviderOutcome
}

export function reviewKey(candidateId: AiCandidateId, runId: number): string {
  return `${candidateId}:${runId}`
}

export interface AiLabBakeoffState {
  cards: AiLabCandidatesState
  history: BakeoffRunRecord[]
  reviews: Record<string, PoReview>
}

export const initialBakeoffState: AiLabBakeoffState = {
  cards: initialCandidatesState,
  history: [],
  reviews: {},
}

export type AiLabAction =
  | { type: 'started'; candidateId: AiCandidateId; runId: number }
  | { type: 'completed'; candidateId: AiCandidateId; runId: number; outcome: AiProviderOutcome }
  | { type: 'review'; candidateId: AiCandidateId; runId: number; review: PoReview }
  // A new photo or sample point starts a genuinely new analysis: every card resets to idle (plan
  // §22 I). The session's accumulated history/reviews are NOT cleared -- they are the whole point
  // of the multi-photo bake-off (plan §11, §19) and are only ever lost by leaving the page.
  | { type: 'reset' }

export function aiLabBakeoffReducer(state: AiLabBakeoffState, action: AiLabAction): AiLabBakeoffState {
  switch (action.type) {
    case 'reset':
      return { ...state, cards: initialCandidatesState }
    case 'started':
      // A retry or a fresh Run All always overwrites this ONE candidate's card immediately (a
      // candidate still loading must not block a retry of itself); other candidates are untouched.
      return { ...state, cards: { ...state.cards, [action.candidateId]: { status: 'loading', runId: action.runId } } }
    case 'completed': {
      const current = state.cards[action.candidateId]
      // Ignore completions for a runId this candidate's card is no longer waiting on: either a
      // newer run already superseded it (plan §22 I), or it was never asked to load. A stale
      // completion is dropped everywhere -- it never reaches the card OR the session history.
      if (current.status !== 'loading' || current.runId !== action.runId) return state
      const nextCard: CandidateCardState = action.outcome.ok
        ? { status: 'success', runId: action.runId, outcome: action.outcome }
        : { status: 'error', runId: action.runId, outcome: action.outcome }
      const record: BakeoffRunRecord = { candidateId: action.candidateId, runId: action.runId, timestamp: Date.now(), outcome: action.outcome }
      return { ...state, cards: { ...state.cards, [action.candidateId]: nextCard }, history: [...state.history, record] }
    }
    case 'review':
      return { ...state, reviews: { ...state.reviews, [reviewKey(action.candidateId, action.runId)]: action.review } }
  }
}

// Every candidate's error is meaningfully retryable (even "internal" or "network" may succeed a
// second time; only a genuinely missing key rarely will, but retry stays offered there too since
// the PO may add the key and reload -- plan §8: "Do not make Retry All the only recovery
// mechanism").
export function isRetryable(state: CandidateCardState): boolean {
  return state.status === 'error'
}

export const ALL_CANDIDATES = AI_CANDIDATE_IDS
