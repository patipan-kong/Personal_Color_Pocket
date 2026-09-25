import { getSuitability } from '../domain/photoColor/suitability'
import type { DeterministicBaseline } from './aiLabDeterministic'

// V2.0 AI Color Lab (Slice 0, plan §13): the deterministic result, shown above the AI cards.
// Every value here comes straight from the existing production engine (getSuitability,
// samplePhotoRegion, matchPhotoColor, describeColor via aiLabDeterministic.ts) -- nothing is
// computed or adjusted here.
export function DeterministicBaselineCard({ baseline, subtypeLabel }: { baseline: DeterministicBaseline | null; subtypeLabel: string | null }) {
  if (!baseline) return <p className="ai-lab-hint">Tap the photo (or focus it and press Enter) to sample a point.</p>
  if (baseline.sample.kind === 'unavailable') {
    return <p className="ai-lab-error-message" role="alert">Sample unavailable: {baseline.sample.reason}.</p>
  }
  const { sample } = baseline
  return <section className="ai-lab-baseline">
    <h2>Deterministic baseline</h2>
    <p className="ai-lab-color"><span className="ai-lab-swatch" style={{ background: sample.hex }} aria-hidden="true" />{sample.hex}{baseline.colorName && <small> · {baseline.colorName.en}</small>}</p>
    <dl className="ai-lab-fields">
      <div><dt>RGB</dt><dd>{sample.rgb.r}, {sample.rgb.g}, {sample.rgb.b}</dd></div>
      <div><dt>OKLab</dt><dd>L {sample.oklab.l.toFixed(3)} · a {sample.oklab.a.toFixed(3)} · b {sample.oklab.b.toFixed(3)}</dd></div>
      <div><dt>Sample flags</dt><dd>{sample.diagnostics.flags.length > 0 ? sample.diagnostics.flags.join(', ') : 'none'}</dd></div>
      <div><dt>Verdict{subtypeLabel ? ` (${subtypeLabel})` : ''}</dt><dd>{baseline.match ? getSuitability(baseline.match.category) : 'No saved profile — suitability unavailable'}</dd></div>
    </dl>
  </section>
}
