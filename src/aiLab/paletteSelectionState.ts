import type { AiPaletteApiOutcome } from '../domain/aiColorLab/paletteContract'

// V2.0 Slice 0.5C (plan §J): the canonical-palette-selection experimental mode's own lifecycle,
// entirely separate from aiLabState.ts's four-candidate bakeoff reducer -- this task has exactly
// one candidate (Gemini Flash-Lite, plan §L), so a much smaller reducer suffices. Mirrors
// aiLabState.ts's runId-keyed staleness pattern (a late completion from a superseded run can
// never overwrite a newer one) and its "PO review is the ground truth, never inferred" philosophy.

export type PaletteSelectionCardState =
  | { status: 'idle' }
  | { status: 'loading'; runId: number }
  | { status: 'success'; runId: number; outcome: Extract<AiPaletteApiOutcome, { ok: true }> }
  | { status: 'error'; runId: number; outcome: Extract<AiPaletteApiOutcome, { ok: false }> }

export const initialPaletteSelectionCard: PaletteSelectionCardState = { status: 'idle' }

// Same review shape/philosophy as aiLabState.ts's PoReview, but this task has no separate
// "lighting" judgment column -- the palette-selection result has no lighting field at all
// (plan §T classifies `lighting` as free-form-only).
export interface PaletteReview {
  target: 'correct' | 'wrong' | 'unsure' | null
  color: 'good' | 'acceptable' | 'wrong' | null
  note: string
}

export const EMPTY_PALETTE_REVIEW: PaletteReview = { target: null, color: null, note: '' }

export interface PaletteRunRecord {
  runId: number
  timestamp: number
  outcome: AiPaletteApiOutcome
}

export interface PaletteSelectionState {
  card: PaletteSelectionCardState
  history: PaletteRunRecord[]
  reviews: Record<number, PaletteReview>
}

export const initialPaletteSelectionState: PaletteSelectionState = { card: initialPaletteSelectionCard, history: [], reviews: {} }

export type PaletteSelectionAction =
  | { type: 'started'; runId: number }
  | { type: 'completed'; runId: number; outcome: AiPaletteApiOutcome }
  | { type: 'review'; runId: number; review: PaletteReview }
  | { type: 'reset' } // a new photo or sample point (plan §J): card resets to idle; history/reviews persist for the session

export function paletteSelectionReducer(state: PaletteSelectionState, action: PaletteSelectionAction): PaletteSelectionState {
  switch (action.type) {
    case 'reset':
      return { ...state, card: initialPaletteSelectionCard }
    case 'started':
      return { ...state, card: { status: 'loading', runId: action.runId } }
    case 'completed': {
      if (state.card.status !== 'loading' || state.card.runId !== action.runId) return state // stale completion, dropped everywhere
      const nextCard: PaletteSelectionCardState = action.outcome.ok
        ? { status: 'success', runId: action.runId, outcome: action.outcome }
        : { status: 'error', runId: action.runId, outcome: action.outcome }
      const record: PaletteRunRecord = { runId: action.runId, timestamp: Date.now(), outcome: action.outcome }
      return { ...state, card: nextCard, history: [...state.history, record] }
    }
    case 'review':
      return { ...state, reviews: { ...state.reviews, [action.runId]: action.review } }
  }
}
