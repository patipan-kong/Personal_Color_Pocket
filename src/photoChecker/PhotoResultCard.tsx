import { ColorResultGuidance, ColorResultSummary } from '../colorChecker/ColorResultCard'
import type { SampleAdvisory } from '../domain/photoColor/aiNormalization'
import { assessPhotoMeasurement } from '../domain/photoColor/measurementQuality'
import type { Language, LocaleCopy } from '../i18n'
import type { PresentationPreference } from '../services/presentationPreference'
import type { AiPhotoFallbackState } from './aiFallbackState'
import { toPhotoAiResultView, toPhotoResultView } from './photoResult'
import type { PhotoSelection } from './photoPanelState'

// The result area beside / below the photo. Only the short summary (colour name, HEX, verdict,
// category and any warning) is a live region, so moving the marker or tapping again announces one line
// instead of the whole card. The result itself is the shared Color Checker card (Slice 5d).
//
// `advisory` (Slice 0.4) is optional and not currently wired to anything: production does not call
// the AI analysis API today, so no caller of PhotoFeedback passes it and it defaults to null, which
// yields the exact same view as before this slice. It exists so a later slice can attach a real
// deriveSampleAdvisory() result without another render-layer change.

// V2.0 Slice 0.5D (plan §C-Q, §W): the explicit "Ask AI to analyze" action and its terminal
// outcomes. `prominent` only changes presentation (plan §D): it never decides whether AI runs.
// The button itself stays enabled (not swapped for a different element) while loading, so focus
// never moves, and its own label carries the loading text -- deliberately NOT a second
// role="status"/aria-live region: the card keeps exactly one live region (.photo-summary), the
// same accessibility contract the rest of this component already holds (see PhotoCheckerPanel.test.tsx
// "only the short summary is a live region"). Every note here is plain reading-order text, like
// the deterministic card's own warnings/info/caveat.
function PhotoAiAction({ copy, state, prominent, onRun }: {
  copy: LocaleCopy['photoChecker']
  state: AiPhotoFallbackState
  prominent: boolean
  onRun: () => void
}) {
  const loading = state.status === 'loading'
  return <div className={`photo-ai-action${prominent ? ' photo-ai-action-prominent' : ''}`}>
    <button type="button" className="primary-button compact photo-ai-button" onClick={onRun} disabled={loading} aria-busy={loading}>
      {loading ? copy.ai.actionLoading : copy.ai.action}
    </button>
    <p className="photo-ai-privacy">{copy.ai.privacyNote}</p>
    {state.status === 'no-replacement' && <p className="photo-ai-note">
      {state.reason === 'uncertain' ? copy.ai.uncertain : state.reason === 'target-mismatch' ? copy.ai.targetMismatch : copy.ai.unusable}
    </p>}
    {(state.status === 'error' || state.status === 'unresolved') && <p className="photo-ai-note">{copy.ai.failure}</p>}
  </div>
}

export function PhotoFeedback({ copy, resultCopy, garments, language, presentation, selection, advisory = null, ai = { status: 'idle' }, onRunAi = () => {} }: {
  copy: LocaleCopy['photoChecker']
  resultCopy: LocaleCopy['colorResult']
  garments: LocaleCopy['styleExamples']['garments']
  language: Language
  presentation: PresentationPreference
  selection: PhotoSelection | null
  advisory?: SampleAdvisory | null
  // V2.0 Slice 0.5D: optional so every existing caller (AI Lab-free tests, other callers not yet
  // updated) keeps working unchanged -- production's PhotoCheckerPanel always passes both.
  ai?: AiPhotoFallbackState
  onRunAi?: () => void
}) {
  const inspection = selection?.inspection
  const matched = inspection?.kind === 'matched' ? inspection : null
  const deterministicView = matched ? toPhotoResultView(matched, copy, language, presentation, advisory) : null
  // plan §I: only a 'selected' AI result ever replaces the deterministic view; every other AI
  // status (loading, no-replacement, unresolved, error, idle) leaves it exactly as it was.
  const view = ai.status === 'selected' ? toPhotoAiResultView(ai.resolution.result, copy, language, presentation) : deterministicView
  return <div className="photo-feedback">
    <div className="photo-summary" role="status">
      {!selection && <p className="photo-instruction">{copy.instruction}</p>}
      {selection && !inspection && <p className="photo-instruction">{copy.pending}</p>}
      {inspection?.kind === 'unavailable' && <p className="photo-unavailable">{copy.unavailable[inspection.reason]}</p>}
      {view && <ColorResultSummary copy={resultCopy} language={language} view={view} />}
    </div>
    {/* plan §B-D: manually accessible whenever there is a deterministic sample to enhance, whether
        or not it has a measurement warning -- only its visual prominence changes. */}
    {matched && <PhotoAiAction copy={copy} state={ai} prominent={assessPhotoMeasurement(matched.sample).issues.length > 0} onRun={onRunAi} />}
    {/* Keyed by the checked point, so a new check replaces the card instead of morphing it. */}
    {view && matched && <ColorResultGuidance key={`${matched.point.x},${matched.point.y}`} copy={resultCopy} garments={garments} language={language} view={view} />}
  </div>
}
