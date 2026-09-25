import type { AiPaletteApiOutcome } from '../domain/aiColorLab/paletteContract'
import type { Subtype } from '../domain/personalColor/types'
import { resolvePaletteSelectionResult } from '../domain/photoColor/aiPaletteFallback'
import type { PaletteReview, PaletteSelectionCardState } from './paletteSelectionState'

// V2.0 Slice 0.5C (plan §J): the smallest experimental UI to exercise the canonical-palette-
// selection contract from the existing ?debug=ai AI Lab, so the PO can compare it against the
// deterministic baseline and the free-form bake-off cards already on this page. Reuses the same
// ai-lab-* CSS classes as ProviderCard.tsx -- no new styling surface for this experimental mode.

function ErrorBody({ outcome, onRetry }: { outcome: Extract<AiPaletteApiOutcome, { ok: false }>; onRetry: () => void }) {
  const { kind, httpStatus, message } = outcome.error
  const title = kind === 'not-configured' ? 'NOT CONFIGURED' : kind === 'unsupported' ? 'UNSUPPORTED' : 'ERROR'
  return <>
    <p className="ai-lab-error-title">{title}{httpStatus ? ` — HTTP ${httpStatus}` : ''}</p>
    <p className="ai-lab-error-message">{message}</p>
    <p className="ai-lab-latency">{(outcome.latencyMs / 1000).toFixed(1)} s</p>
    {kind !== 'unsupported' && <button type="button" onClick={onRetry}>Retry</button>}
  </>
}

// Mirrors ProviderCard.tsx's PoReviewControls (plan §M: "target correct? / selected color good /
// acceptable / wrong? / notes"), with no "lighting" column -- this result has no lighting field.
function PaletteReviewControls({ review, onChange }: { review: PaletteReview; onChange: (next: PaletteReview) => void }) {
  return <fieldset className="ai-lab-review">
    <legend>PO review</legend>
    <label>Target
      <select value={review.target ?? ''} onChange={(event) => onChange({ ...review, target: (event.target.value || null) as PaletteReview['target'] })}>
        <option value="">—</option>
        <option value="correct">Correct</option>
        <option value="wrong">Wrong</option>
        <option value="unsure">Unsure</option>
      </select>
    </label>
    <label>Color
      <select value={review.color ?? ''} onChange={(event) => onChange({ ...review, color: (event.target.value || null) as PaletteReview['color'] })}>
        <option value="">—</option>
        <option value="good">Good</option>
        <option value="acceptable">Acceptable</option>
        <option value="wrong">Wrong</option>
      </select>
    </label>
    <label className="ai-lab-review-note">Note
      <input type="text" value={review.note} onChange={(event) => onChange({ ...review, note: event.target.value })} placeholder="Optional" />
    </label>
  </fieldset>
}

// The three non-'selected' outcomes and an unresolved 'selected' are all rendered as explicit
// "no replacement result" states (plan §Q) -- never silently blank, and never a fabricated color.
function SuccessBody({ outcome, subtype, review, onReviewChange }: {
  outcome: Extract<AiPaletteApiOutcome, { ok: true }>
  subtype: Subtype
  review: PaletteReview
  onReviewChange: (next: PaletteReview) => void
}) {
  const { result, latencyMs } = outcome
  const resolved = resolvePaletteSelectionResult(result, subtype)
  return <>
    <p className="ai-lab-status">Status: <strong>{result.status}</strong></p>
    {result.target && <p className="ai-lab-target-object"><strong>Target</strong> {result.target.objectType} — {result.target.objectDescription}</p>}
    {resolved.kind === 'result' && <>
      <p className="ai-lab-color">
        <span className="ai-lab-swatch" style={{ background: resolved.resolution.result.color.hex }} aria-hidden="true" />
        {resolved.resolution.result.color.name} <small>({resolved.resolution.result.color.hex})</small>
      </p>
      <dl className="ai-lab-fields">
        <div><dt>Category</dt><dd>{resolved.resolution.result.category}</dd></div>
        <div><dt>Suitability</dt><dd>{resolved.resolution.result.suitability}</dd></div>
      </dl>
      <p className="ai-lab-hint">Category and suitability come from the app's own existing getSuitability() — never from AI (plan §I, §8).</p>
    </>}
    {resolved.kind === 'unresolved' && <p className="ai-lab-error-message" role="alert">AI returned a colorId that did not resolve ({resolved.reason}). This should never happen (the response validator only accepts ids from the request's own palette) — treat as a bug.</p>}
    {resolved.kind === 'no-replacement' && <p className="ai-lab-hint">No replacement result for status "{resolved.status}" — in production this would leave the deterministic result, if any, unchanged (plan §Q).</p>}
    <p className="ai-lab-reasoning">{result.reasoning}</p>
    <PaletteReviewControls review={review} onChange={onReviewChange} />
    <details className="ai-lab-debug">
      <summary>Debug details</summary>
      <dl className="ai-lab-fields">
        <div><dt>Latency</dt><dd>{(latencyMs / 1000).toFixed(2)} s</dd></div>
      </dl>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </details>
  </>
}

export function PaletteSelectionCard({ state, subtype, onRun, onRetry, review, onReviewChange }: {
  state: PaletteSelectionCardState
  subtype: Subtype | null
  onRun: () => void
  onRetry: () => void
  review: PaletteReview
  onReviewChange: (next: PaletteReview) => void
}) {
  return <article className={`ai-lab-card ai-lab-card-${state.status}`} aria-busy={state.status === 'loading'}>
    <header><h3>Canonical palette selection (Gemini Flash-Lite)</h3></header>
    <p className="ai-lab-hint">Experimental Slice 0.5C task: AI selects from this subtype's own canonical palette instead of freely describing a color. Independent of the deterministic sample (Strategy A) — see docs/V2_AI_COLOR_LAB.md §37.</p>
    {!subtype && <p className="ai-lab-error-message" role="alert">No saved profile — this task needs a subtype to build the candidate list.</p>}
    {subtype && state.status === 'idle' && <button type="button" className="primary-button compact" onClick={onRun}>Run canonical palette selection</button>}
    {state.status === 'loading' && <p className="ai-lab-status" role="status">Selecting…</p>}
    {state.status === 'error' && <ErrorBody outcome={state.outcome} onRetry={onRetry} />}
    {state.status === 'success' && subtype && <SuccessBody outcome={state.outcome} subtype={subtype} review={review} onReviewChange={onReviewChange} />}
  </article>
}
