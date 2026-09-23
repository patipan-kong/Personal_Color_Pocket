import { useId } from 'react'
import { readableTextColor } from '../domain/personalColor/colorUtils'
import type { PaletteColor } from '../domain/personalColor/types'
import { suitabilityTone } from '../domain/photoColor/suitability'
import type { Suitability } from '../domain/photoColor/suitability'
import { colorDisplayName } from '../i18n'
import type { Language, LocaleCopy } from '../i18n'
import type { ColorResultView } from './resultView'

type ResultCopy = LocaleCopy['colorResult']
type Garments = LocaleCopy['styleExamples']['garments']

// One small cue per verdict. Decorative only: the verdict text is always there and authoritative.
const VERDICT_MARKS: Record<Suitability, string> = { strong: '✨', good: '✓', conditional: '△', weak: '△', outside: '✕' }

// V1.2 Slice 5d: the one Color Checker result, for Manual and Photo alike. It renders a
// ColorResultView and knows nothing about sampling or scoring.

// Swatch, HEX, verdict and the engine's own label: the part a screen reader hears once per check.
// The caller puts it inside its live region.
export function ColorResultSummary({ copy, view }: { copy: ResultCopy; view: ColorResultView }) {
  const { hex, suitability } = view
  return <div className={`check-result check-tone-${suitabilityTone(suitability)}`}>
    <div className="check-sample">
      <span className="check-swatch" style={{ background: hex, color: readableTextColor(hex) }} aria-hidden="true" />
      <div>
        <small>{view.sampleLabel}</small>
        <strong className="check-hex">{hex}</strong>
      </div>
    </div>
    {/* The answer to "is this colour good for me?", before anything about how to wear it. */}
    <p className={`check-verdict check-verdict-${suitability}`}>
      <span className="check-verdict-mark" aria-hidden="true">{VERDICT_MARKS[suitability]}</span>
      <span>{copy.verdicts[suitability]}</span>
    </p>
    <p className={`rating check-category check-category-${view.category.key}`}>{view.category.label}</p>
    {/* Announced with the summary; shown visually further down the card. */}
    {view.warnings.length > 0 && <span className="check-sr-only">{view.warnings.join(' ')}</span>}
  </div>
}

// Why → action → palette reference → placement → pairing → details → warnings / info → caveat.
export function ColorResultGuidance({ copy, garments, language, view }: { copy: ResultCopy; garments: Garments; language: Language; view: ColorResultView }) {
  const { suitability, placement } = view
  const tone = suitabilityTone(suitability)
  const placementId = useId()
  const pairingId = useId()
  const pairing = copy.pairing[placement.pairing]
  // The first placement row is where the colour is easiest to use; its first examples make the action.
  const pieces = placement.rows[0].examples.slice(0, 3).map((example) => garments[example])
  const firstPair = view.pairWith[0] ? colorDisplayName(language, view.pairWith[0]) : null
  return <div className="check-guidance">
    <div className="check-why">
      <p className="check-reason">{view.why}</p>
      <p className="check-action">{copy.action[suitability](pieces, firstPair)}</p>
    </div>
    {/* Only a positive verdict names the palette group; otherwise the colour is only a comparison. */}
    <p className="check-reference">
      <span>{copy.reference[view.reference.kind]}</span>
      <PaletteChip color={view.reference.color} language={language} />
      {tone !== 'positive' ? <small>{copy.reference.compare}</small> : view.reference.group && <small>{copy.groups[view.reference.group]}</small>}
    </p>
    {view.note && <p className="check-note">
      <i style={{ background: view.note.color.hex }} aria-hidden="true" />
      {view.note.text}
    </p>}

    <section className="check-placement" aria-labelledby={placementId}>
      <h2 id={placementId}>{copy.placementHeading[tone]}</h2>
      <ul>
        {placement.rows.map((row) => <li key={row.tier} className={`check-place check-place-${row.tier}`}>
          <strong>{copy.tiers[row.tier]}</strong>
          <span>{row.areas.map((area) => copy.areas[area]).join(' · ')}</span>
          <small>{row.examples.map((example) => garments[example]).join(' · ')}</small>
        </li>)}
      </ul>
    </section>

    {view.pairWith.length > 0 && <section className="check-pairing" aria-labelledby={pairingId}>
      <h2 id={pairingId}>{pairing.heading}</h2>
      <p>{pairing.body}</p>
      <div className="check-pairs">{view.pairWith.map((color) => <PaletteChip key={color.id} color={color} language={language} />)}</div>
    </section>}

    {view.details.length > 0 && <p className="check-details">{view.details.map((line) => <span key={line}>{line}</span>)}</p>}

    {/* Advisory only: the verdict and guidance above stay. Announced via the summary. */}
    {view.warnings.length > 0 && <ul className="check-warnings" aria-hidden="true">
      {view.warnings.map((warning) => <li key={warning}>{warning}</li>)}
    </ul>}
    {/* Informational, normal reading-order text: not announced with the summary. */}
    {view.info && <p className="check-info">{view.info}</p>}
    {view.caveat && <p className="check-caveat">{view.caveat}</p>}
  </div>
}

// Manual: the whole result, with only the summary as a live region (the same strategy as Photo).
export function ColorResultCard({ copy, garments, language, view }: { copy: ResultCopy; garments: Garments; language: Language; view: ColorResultView }) {
  return <div className="check-card">
    <div className="check-summary" role="status"><ColorResultSummary copy={copy} view={view} /></div>
    {/* Keyed by the colour, so a new check replaces the guidance instead of morphing it. */}
    <ColorResultGuidance key={view.hex} copy={copy} garments={garments} language={language} view={view} />
  </div>
}

// Same look as the palette's colour chips: swatch + display name, HEX in the tooltip only.
function PaletteChip({ color, language }: { color: PaletteColor; language: Language }) {
  const name = colorDisplayName(language, color)
  return <span className="color-chip" title={`${name} ${color.hex}`}>
    <i style={{ background: color.hex }} aria-hidden="true" />{name}
  </span>
}
