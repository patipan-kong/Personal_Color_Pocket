import { AI_CANDIDATES } from '../domain/aiColorLab/contract'
import type { AiLabCandidatesState, PoReview } from './aiLabState'
import { estimateCostUsd } from './pricing'

// V2.0 Slice 0.2 (plan §14): the Flash vs Flash-Lite sub-experiment made especially easy to
// inspect, side by side, for the SAME run. Answers no question itself ("does Flash-Lite retain
// enough quality...?" is the PO's to answer, plan §14: "Do not assume the answer") -- it only
// lays the two candidates' own results, cost, and PO review next to each other.
function reviewText(review: PoReview | undefined): string {
  if (!review) return 'Not reviewed'
  const parts = [review.target && `target: ${review.target}`, review.color && `color: ${review.color}`, review.lighting && `lighting: ${review.lighting}`].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'Not reviewed'
}

export function FlashLiteComparison({ cards, reviews }: { cards: AiLabCandidatesState; reviews: Record<string, PoReview> }) {
  const flash = cards['gemini-flash']
  const lite = cards['gemini-flash-lite']

  const row = (label: string, render: (state: AiLabCandidatesState['gemini-flash']) => string) =>
    <tr key={label}><th scope="row">{label}</th><td>{render(flash)}</td><td>{render(lite)}</td></tr>

  const targetOf = (state: AiLabCandidatesState['gemini-flash']) => state.status === 'success' ? `${state.outcome.result.targetAssessment.objectType} (${state.outcome.result.targetAssessment.targetMatched === true ? 'matched' : state.outcome.result.targetAssessment.targetMatched === false ? 'not matched' : 'uncertain'})` : state.status
  const dimensionOf = (field: 'temperature' | 'value' | 'chroma') => (state: AiLabCandidatesState['gemini-flash']) => state.status === 'success' ? state.outcome.result[field] : state.status
  const lightingOf = (state: AiLabCandidatesState['gemini-flash']) => state.status === 'success' ? `${state.outcome.result.lighting.cast}, ${state.outcome.result.lighting.severity} severity` : state.status
  const latencyOf = (state: AiLabCandidatesState['gemini-flash']) => (state.status === 'success' || state.status === 'error') ? `${(state.outcome.latencyMs / 1000).toFixed(2)} s` : '—'
  const usageOf = (state: AiLabCandidatesState['gemini-flash']) => (state.status === 'success' && state.outcome.usage) ? `${state.outcome.usage.inputTokens ?? '—'} in / ${state.outcome.usage.outputTokens ?? '—'} out` : 'not reported'
  const costOf = (candidateId: 'gemini-flash' | 'gemini-flash-lite') => (state: AiLabCandidatesState['gemini-flash']) => {
    if (state.status !== 'success') return '—'
    const cost = estimateCostUsd(candidateId, state.outcome.usage)
    return cost === null ? 'Cost unavailable' : `$${cost.toFixed(5)} (estimated)`
  }
  const reviewOf = (candidateId: 'gemini-flash' | 'gemini-flash-lite') => (state: AiLabCandidatesState['gemini-flash']) =>
    state.status === 'success' ? reviewText(reviews[`${candidateId}:${state.runId}`]) : '—'

  return <table className="ai-lab-flash-lite-table">
    <caption>Gemini Flash vs Flash-Lite (same run)</caption>
    <thead><tr><th scope="col" /><th scope="col">{AI_CANDIDATES['gemini-flash'].label}</th><th scope="col">{AI_CANDIDATES['gemini-flash-lite'].label}</th></tr></thead>
    <tbody>
      {row('Target', targetOf)}
      {row('Temperature', dimensionOf('temperature'))}
      {row('Value', dimensionOf('value'))}
      {row('Chroma', dimensionOf('chroma'))}
      {row('Lighting', lightingOf)}
      {row('Latency', latencyOf)}
      {row('Usage', usageOf)}
      <tr><th scope="row">Est. cost</th><td>{costOf('gemini-flash')(flash)}</td><td>{costOf('gemini-flash-lite')(lite)}</td></tr>
      <tr><th scope="row">PO review</th><td>{reviewOf('gemini-flash')(flash)}</td><td>{reviewOf('gemini-flash-lite')(lite)}</td></tr>
    </tbody>
  </table>
}
