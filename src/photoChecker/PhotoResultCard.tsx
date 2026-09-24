import { ColorResultGuidance, ColorResultSummary } from '../colorChecker/ColorResultCard'
import type { Language, LocaleCopy } from '../i18n'
import type { PresentationPreference } from '../services/presentationPreference'
import { toPhotoResultView } from './photoResult'
import type { PhotoSelection } from './photoPanelState'

// The result area beside / below the photo. Only the short summary (colour name, HEX, verdict,
// category and any warning) is a live region, so moving the marker or tapping again announces one line
// instead of the whole card. The result itself is the shared Color Checker card (Slice 5d).
export function PhotoFeedback({ copy, resultCopy, garments, language, presentation, selection }: {
  copy: LocaleCopy['photoChecker']
  resultCopy: LocaleCopy['colorResult']
  garments: LocaleCopy['styleExamples']['garments']
  language: Language
  presentation: PresentationPreference
  selection: PhotoSelection | null
}) {
  const inspection = selection?.inspection
  const matched = inspection?.kind === 'matched' ? inspection : null
  const view = matched ? toPhotoResultView(matched, copy, language, presentation) : null
  return <div className="photo-feedback">
    <div className="photo-summary" role="status">
      {!selection && <p className="photo-instruction">{copy.instruction}</p>}
      {selection && !inspection && <p className="photo-instruction">{copy.pending}</p>}
      {inspection?.kind === 'unavailable' && <p className="photo-unavailable">{copy.unavailable[inspection.reason]}</p>}
      {view && <ColorResultSummary copy={resultCopy} language={language} view={view} />}
    </div>
    {/* Keyed by the checked point, so a new check replaces the card instead of morphing it. */}
    {view && matched && <ColorResultGuidance key={`${matched.point.x},${matched.point.y}`} copy={resultCopy} garments={garments} language={language} view={view} />}
  </div>
}
