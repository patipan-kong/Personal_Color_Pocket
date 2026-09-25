import { AI_CANDIDATE_IDS, AI_CANDIDATES } from '../domain/aiColorLab/contract'
import type { AiLabCandidatesState } from './aiLabState'

// V2.0 Slice 0.2 (plan §16): a compact, DESCRIPTIVE-only comparison of the four candidates'
// color-dimension calls for the CURRENT run. Agreement between candidates is not a quality
// signal -- all of them can agree and all of them can still be wrong (plan §16: "Agreement can
// mean all models are wrong"). This table never colors/highlights agreement as if it were
// correctness.
function cellFor(state: AiLabCandidatesState[keyof AiLabCandidatesState], field: 'temperature' | 'value' | 'chroma'): string {
  if (state.status === 'success') return state.outcome.result[field]
  if (state.status === 'loading') return '…'
  if (state.status === 'error') return 'error'
  return '—'
}

function castCellFor(state: AiLabCandidatesState[keyof AiLabCandidatesState]): string {
  if (state.status === 'success') return state.outcome.result.lighting.cast
  if (state.status === 'loading') return '…'
  if (state.status === 'error') return 'error'
  return '—'
}

export function ColorDimensionTable({ cards }: { cards: AiLabCandidatesState }) {
  const rows: { label: string; get: (state: AiLabCandidatesState[keyof AiLabCandidatesState]) => string }[] = [
    { label: 'Temperature', get: (state) => cellFor(state, 'temperature') },
    { label: 'Value', get: (state) => cellFor(state, 'value') },
    { label: 'Chroma', get: (state) => cellFor(state, 'chroma') },
    { label: 'Lighting cast', get: castCellFor },
  ]
  return <table className="ai-lab-dimension-table">
    <caption>Color dimension comparison (descriptive only — agreement is not correctness)</caption>
    <thead>
      <tr>
        <th scope="col">Dimension</th>
        {AI_CANDIDATE_IDS.map((candidateId) => <th scope="col" key={candidateId}>{AI_CANDIDATES[candidateId].label}</th>)}
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => <tr key={row.label}>
        <th scope="row">{row.label}</th>
        {AI_CANDIDATE_IDS.map((candidateId) => <td key={candidateId}>{row.get(cards[candidateId])}</td>)}
      </tr>)}
    </tbody>
  </table>
}
