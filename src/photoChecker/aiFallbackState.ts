import type { AiErrorInfo } from '../domain/aiColorLab/contract'
import type { AiPaletteSelectionResult } from '../domain/aiColorLab/paletteContract'
import type { AiFallbackResolution } from '../domain/photoColor/aiFallback'

// V2.0 Slice 0.5D (plan §H-Q): the production, explicit-invocation-only AI fallback's own state,
// separate from PaletteSelectionCardState (aiLab/paletteSelectionState.ts) -- that one is AI
// Lab's validation/review harness (history, PO review, run records); this one is only what the
// real Photo Checker UI needs to show one button and one terminal outcome at a time. Staleness
// (plan §H, §M: a stale response must never overwrite a newer context) is handled by the caller
// via a request-id ref, mirroring photoPanelState.ts's own `request` pattern -- kept out of this
// state on purpose, so a reducer test never needs to fake an id.

export type AiPhotoFallbackState =
  | { status: 'idle' }
  | { status: 'loading' }
  // plan §I: the only state that ever carries a replacement result, resolved through the
  // unmodified Slice 0.5B/0.5C path (colorId -> canonical palette entry -> category -> getSuitability()).
  | { status: 'selected'; resolution: Extract<AiFallbackResolution, { ok: true }> }
  // plan §N-P: 'uncertain' | 'target-mismatch' | 'unusable' -- AI answered, but declined a pick.
  // Never a replacement result; the deterministic result, if any, stays exactly as it was.
  | { status: 'no-replacement'; reason: Exclude<AiPaletteSelectionResult['status'], 'selected'> }
  // Defensive only: the response validator (api/_lib/validatePaletteSelection.ts) only ever
  // accepts a colorId drawn from the request's own palette, so this should never happen in
  // practice -- handled, not assumed impossible (mirrors aiPaletteFallback.ts's 'unresolved').
  | { status: 'unresolved' }
  // plan §Q: provider/network/timeout/malformed-response failure. Transport failure, not a model
  // semantic state -- deliberately a different status than 'no-replacement'.
  | { status: 'error'; error: AiErrorInfo }

export const initialAiPhotoFallbackState: AiPhotoFallbackState = { status: 'idle' }

export type AiPhotoFallbackAction =
  | { type: 'run' }
  | { type: 'selected'; resolution: Extract<AiFallbackResolution, { ok: true }> }
  | { type: 'no-replacement'; reason: Exclude<AiPaletteSelectionResult['status'], 'selected'> }
  | { type: 'unresolved' }
  | { type: 'error'; error: AiErrorInfo }
  // plan §M: photo, point or subtype changed -- any previous AI result/status is invalidated.
  | { type: 'reset' }

export function aiPhotoFallbackReducer(state: AiPhotoFallbackState, action: AiPhotoFallbackAction): AiPhotoFallbackState {
  switch (action.type) {
    case 'run': return { status: 'loading' }
    case 'selected': return { status: 'selected', resolution: action.resolution }
    case 'no-replacement': return { status: 'no-replacement', reason: action.reason }
    case 'unresolved': return { status: 'unresolved' }
    case 'error': return { status: 'error', error: action.error }
    case 'reset': return { status: 'idle' }
  }
}
