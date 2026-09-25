import { AI_CANDIDATE_IDS, AI_CANDIDATES } from '../domain/aiColorLab/contract'
import type { BakeoffRunRecord, PoReview } from './aiLabState'
import { summarizeSession } from './bakeoffSummary'
import { downloadBakeoffExport } from './exportBakeoff'

// V2.0 Slice 0.2 (plan §11): factual measurements only, across every run in this browser
// session (every photo, every candidate) -- no weighted composite score, no automatic rank, no
// "Winner" label anywhere in this component (plan §11, §25: "The purpose is to expose evidence
// so the PO can decide").
export function SessionSummary({ history, reviews }: { history: BakeoffRunRecord[]; reviews: Record<string, PoReview> }) {
  if (history.length === 0) return null
  const summaries = summarizeSession(AI_CANDIDATE_IDS, history, reviews)

  return <section className="ai-lab-session-summary">
    <h2>Session bake-off summary</h2>
    <p className="ai-lab-hint">Across every run in this browser session (not just the run shown above). Cleared on page reload — nothing is persisted.</p>
    <table>
      <thead>
        <tr>
          <th scope="col">Candidate</th>
          <th scope="col">Runs</th>
          <th scope="col">Successful</th>
          <th scope="col">Failed</th>
          <th scope="col">Target correct</th>
          <th scope="col">Color good/acc./wrong</th>
          <th scope="col">Lighting good/acc./wrong</th>
          <th scope="col">Median latency</th>
          <th scope="col">Usage (in/out/total)</th>
          <th scope="col">Est. cost</th>
        </tr>
      </thead>
      <tbody>
        {summaries.map((summary) => <tr key={summary.candidateId}>
          <th scope="row">{AI_CANDIDATES[summary.candidateId].label}</th>
          <td>{summary.runs}</td>
          <td>{summary.successful}</td>
          <td>{summary.failed}</td>
          <td>{summary.targetCorrect} / {summary.targetWrong} wrong / {summary.targetUnsure} unsure</td>
          <td>{summary.colorGood} / {summary.colorAcceptable} / {summary.colorWrong}</td>
          <td>{summary.lightingGood} / {summary.lightingAcceptable} / {summary.lightingWrong}</td>
          <td>{summary.medianLatencyMs === null ? '—' : `${(summary.medianLatencyMs / 1000).toFixed(2)} s`}</td>
          <td>{summary.usageTotals ? `${summary.usageTotals.inputTokens} / ${summary.usageTotals.outputTokens} / ${summary.usageTotals.totalTokens}` : 'not reported'}</td>
          <td>{summary.estimatedCostUsd === null ? 'Cost unavailable' : `$${summary.estimatedCostUsd.toFixed(5)} (estimated)`}</td>
        </tr>)}
      </tbody>
    </table>
    <button type="button" className="compact" onClick={() => downloadBakeoffExport(history, reviews)}>Export results (JSON)</button>
  </section>
}
