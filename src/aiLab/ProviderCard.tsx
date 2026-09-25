import type { AiProviderId, AiProviderOutcome } from '../domain/aiColorLab/contract'
import type { ProviderCardState } from './aiLabState'
import { PROVIDER_LABELS, SUITABILITY_LABELS } from './providerLabels'

// V2.0 AI Color Lab (Slice 0, plan §7, §16, §20-21): one provider's own card, independent of
// the other three -- a successful Gemini card renders the same way whether Groq is loading,
// erroring, or has never been asked to run.
function ErrorBody({ outcome, label, onRetry }: { outcome: Extract<AiProviderOutcome, { ok: false }>; label: string; onRetry: () => void }) {
  const { kind, httpStatus, message } = outcome.error
  const title = kind === 'not-configured' ? 'NOT CONFIGURED' : kind === 'unsupported' ? 'UNSUPPORTED' : 'ERROR'
  return <>
    <p className="ai-lab-error-title">{title}{httpStatus ? ` — HTTP ${httpStatus}` : ''}</p>
    <p className="ai-lab-error-message">{message}</p>
    <p className="ai-lab-latency">{(outcome.latencyMs / 1000).toFixed(1)} s</p>
    {/* Retrying a provider with no vision model available would only repeat the same
        UNSUPPORTED result -- every other failure kind stays retryable (plan §8, §21). */}
    {kind !== 'unsupported' && <button type="button" onClick={onRetry}>Retry {label}</button>}
  </>
}

function SuccessBody({ outcome }: { outcome: Extract<AiProviderOutcome, { ok: true }> }) {
  const { result, usage, latencyMs } = outcome
  return <>
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
    <details className="ai-lab-debug">
      <summary>Debug details</summary>
      <dl className="ai-lab-fields">
        <div><dt>Model</dt><dd>{result.model}</dd></div>
        <div><dt>Latency</dt><dd>{(latencyMs / 1000).toFixed(2)} s</dd></div>
        <div><dt>Usage</dt><dd>{usage ? `${usage.inputTokens ?? '—'} in / ${usage.outputTokens ?? '—'} out / ${usage.totalTokens ?? '—'} total` : 'not reported'}</dd></div>
      </dl>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </details>
  </>
}

export function ProviderCard({ provider, state, onRetry }: { provider: AiProviderId; state: ProviderCardState; onRetry: () => void }) {
  const label = PROVIDER_LABELS[provider]
  return <article className={`ai-lab-card ai-lab-card-${state.status}`} aria-busy={state.status === 'loading'}>
    <header><h3>{label}</h3></header>
    {state.status === 'idle' && <p className="ai-lab-status">Not run yet.</p>}
    {state.status === 'loading' && <p className="ai-lab-status" role="status">Analyzing…</p>}
    {state.status === 'error' && <ErrorBody outcome={state.outcome} label={label} onRetry={onRetry} />}
    {state.status === 'success' && <SuccessBody outcome={state.outcome} />}
  </article>
}
