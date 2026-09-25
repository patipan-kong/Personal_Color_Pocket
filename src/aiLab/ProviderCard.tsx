import type { AiCandidateId, AiProviderOutcome, NormalizedAiColorResult } from '../domain/aiColorLab/contract'
import { AI_CANDIDATES } from '../domain/aiColorLab/contract'
import type { CandidateCardState, PoReview } from './aiLabState'
import { estimateCostUsd } from './pricing'
import { SUITABILITY_LABELS } from './providerLabels'

// V2.0 AI Color Lab (Slice 0, plan §7, §16, §20-21; extended Slice 0.2 plan §4, §7): one
// candidate's own card, independent of the others -- a successful Gemini Flash card renders the
// same way whether Gemini Flash-Lite is loading, erroring, or has never been asked to run.
function ErrorBody({ outcome, label, onRetry }: { outcome: Extract<AiProviderOutcome, { ok: false }>; label: string; onRetry: () => void }) {
  const { kind, httpStatus, message } = outcome.error
  const title = kind === 'not-configured' ? 'NOT CONFIGURED' : kind === 'unsupported' ? 'UNSUPPORTED' : 'ERROR'
  return <>
    <p className="ai-lab-error-title">{title}{httpStatus ? ` — HTTP ${httpStatus}` : ''}</p>
    <p className="ai-lab-error-message">{message}</p>
    <p className="ai-lab-latency">{(outcome.latencyMs / 1000).toFixed(1)} s</p>
    {/* Retrying a candidate with no vision model available would only repeat the same
        UNSUPPORTED result -- every other failure kind stays retryable (plan §8, §21). */}
    {kind !== 'unsupported' && <button type="button" onClick={onRetry}>Retry {label}</button>}
  </>
}

// Target match is diagnostic, never proof -- a candidate can be confidently wrong (plan §13), so
// objectType/objectDescription are always shown alongside targetMatched, never hidden behind
// just the boolean.
function TargetSection({ targetAssessment }: { targetAssessment: NormalizedAiColorResult['targetAssessment'] }) {
  const matchLabel = targetAssessment.targetMatched === true ? 'Yes' : targetAssessment.targetMatched === false ? 'No' : 'Uncertain'
  return <div className="ai-lab-target">
    <p className="ai-lab-target-object"><strong>Target</strong> {targetAssessment.objectType} — {targetAssessment.objectDescription}</p>
    <p className="ai-lab-target-match"><strong>Target match</strong> {matchLabel}</p>
  </div>
}

// V2.0 Slice 0.2 (plan §9-10): a lightweight PO review control. The PO's own judgment is the
// quality ground truth for the bake-off -- never an automatic score, never inferred from
// provider confidence or targetMatched (plan §9: "Do NOT invent an automatic 'AI quality
// score'"). Every selector starts unset ("—"); an unset review is simply not counted in the
// session summary, never defaulted to a verdict.
function PoReviewControls({ review, onChange }: { review: PoReview; onChange: (next: PoReview) => void }) {
  return <fieldset className="ai-lab-review">
    <legend>PO review</legend>
    <label>Target
      <select value={review.target ?? ''} onChange={(event) => onChange({ ...review, target: (event.target.value || null) as PoReview['target'] })}>
        <option value="">—</option>
        <option value="correct">Correct</option>
        <option value="wrong">Wrong</option>
        <option value="unsure">Unsure</option>
      </select>
    </label>
    <label>Color
      <select value={review.color ?? ''} onChange={(event) => onChange({ ...review, color: (event.target.value || null) as PoReview['color'] })}>
        <option value="">—</option>
        <option value="good">Good</option>
        <option value="acceptable">Acceptable</option>
        <option value="wrong">Wrong</option>
      </select>
    </label>
    <label>Lighting
      <select value={review.lighting ?? ''} onChange={(event) => onChange({ ...review, lighting: (event.target.value || null) as PoReview['lighting'] })}>
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

function SuccessBody({ candidateId, outcome, review, onReviewChange }: {
  candidateId: AiCandidateId
  outcome: Extract<AiProviderOutcome, { ok: true }>
  review: PoReview
  onReviewChange: (next: PoReview) => void
}) {
  const { result, usage, latencyMs } = outcome
  const costUsd = estimateCostUsd(candidateId, usage)
  return <>
    <TargetSection targetAssessment={result.targetAssessment} />
    <p className="ai-lab-color">{result.perceivedColorName} <small>({result.colorFamily})</small></p>
    <dl className="ai-lab-fields">
      <div><dt>Temperature</dt><dd>{result.temperature}</dd></div>
      <div><dt>Value</dt><dd>{result.value}</dd></div>
      <div><dt>Chroma</dt><dd>{result.chroma}</dd></div>
      <div><dt>Lighting</dt><dd>{result.lighting.condition} ({result.lighting.cast}, {result.lighting.severity} severity)</dd></div>
      <div><dt>Sample</dt><dd>{String(result.sampleAssessment.usable)} usable · {result.sampleAssessment.issue}</dd></div>
      <div><dt>Suitability</dt><dd>{SUITABILITY_LABELS[result.suitability]}</dd></div>
      <div><dt>Confidence</dt><dd>{result.confidence}</dd></div>
    </dl>
    <p className="ai-lab-reasoning">{result.reasoning}</p>
    <PoReviewControls review={review} onChange={onReviewChange} />
    <details className="ai-lab-debug">
      <summary>Debug details</summary>
      <dl className="ai-lab-fields">
        <div><dt>Model</dt><dd>{result.model}</dd></div>
        <div><dt>Latency</dt><dd>{(latencyMs / 1000).toFixed(2)} s</dd></div>
        <div><dt>Usage</dt><dd>{usage ? `${usage.inputTokens ?? '—'} in / ${usage.outputTokens ?? '—'} out / ${usage.totalTokens ?? '—'} total` : 'not reported'}</dd></div>
        {/* Estimated/projected only -- plan §13: never implied to be an actual bill. */}
        <div><dt>Est. cost</dt><dd>{costUsd === null ? 'Cost unavailable' : `$${costUsd.toFixed(5)} (estimated)`}</dd></div>
      </dl>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </details>
  </>
}

export function ProviderCard({ candidateId, state, review, onRetry, onReviewChange }: {
  candidateId: AiCandidateId
  state: CandidateCardState
  review: PoReview
  onRetry: () => void
  onReviewChange: (next: PoReview) => void
}) {
  const label = AI_CANDIDATES[candidateId].label
  return <article className={`ai-lab-card ai-lab-card-${state.status}`} aria-busy={state.status === 'loading'}>
    <header><h3>{label}</h3></header>
    {state.status === 'idle' && <p className="ai-lab-status">Not run yet.</p>}
    {state.status === 'loading' && <p className="ai-lab-status" role="status">Analyzing…</p>}
    {state.status === 'error' && <ErrorBody outcome={state.outcome} label={label} onRetry={onRetry} />}
    {state.status === 'success' && <SuccessBody candidateId={candidateId} outcome={state.outcome} review={review} onReviewChange={onReviewChange} />}
  </article>
}
