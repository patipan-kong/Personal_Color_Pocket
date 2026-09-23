import { useId } from 'react'
import { readableTextColor } from '../domain/personalColor/colorUtils'
import type { PaletteColor } from '../domain/personalColor/types'
import { getColorPlacement } from '../domain/photoColor/placement'
import type { PhotoPointMatched } from '../domain/photoColor/types'
import { colorDisplayName } from '../i18n'
import type { Language, LocaleCopy } from '../i18n'
import type { PresentationPreference } from '../services/presentationPreference'
import type { PhotoSelection } from './photoPanelState'

type PhotoCopy = LocaleCopy['photoChecker']

// The result area beside / below the photo. Only the short summary (colour, HEX, category and
// any warning) is a live region, so moving the marker or tapping again announces one line
// instead of the whole card.
export function PhotoFeedback({ copy, garments, language, presentation, selection }: {
  copy: PhotoCopy
  garments: LocaleCopy['styleExamples']['garments']
  language: Language
  presentation: PresentationPreference
  selection: PhotoSelection | null
}) {
  const inspection = selection?.inspection
  const matched = inspection?.kind === 'matched' ? inspection : null
  return <div className="photo-feedback">
    <div className="photo-summary" role="status">
      {!selection && <p className="photo-instruction">{copy.instruction}</p>}
      {selection && !inspection && <p className="photo-instruction">{copy.pending}</p>}
      {inspection?.kind === 'unavailable' && <p className="photo-unavailable">{copy.unavailable[inspection.reason]}</p>}
      {matched && <SampleSummary copy={copy} matched={matched} />}
    </div>
    {/* Keyed by the checked point, so a new check replaces the card instead of morphing it. */}
    {matched && <PhotoGuidance key={`${matched.point.x},${matched.point.y}`} copy={copy} garments={garments} language={language} presentation={presentation} matched={matched} />}
  </div>
}

function SampleSummary({ copy, matched }: { copy: PhotoCopy; matched: PhotoPointMatched }) {
  const { hex } = matched.sample
  const { category, warnings } = matched.match
  return <div className="photo-sample">
    <span className="photo-swatch" style={{ background: hex, color: readableTextColor(hex) }} aria-hidden="true" />
    <div>
      <small>{copy.sampleLabel}</small>
      <strong className="photo-hex">{hex}</strong>
      <p className={`rating photo-category photo-category-${category}`}>{copy.categories[category]}</p>
      {/* Announced with the summary; shown visually further down the card. */}
      {warnings.length > 0 && <span className="photo-sr-only">{warnings.map((flag) => copy.warnings[flag]).join(' ')}</span>}
    </div>
  </div>
}

function PhotoGuidance({ copy, garments, language, presentation, matched }: {
  copy: PhotoCopy
  garments: LocaleCopy['styleExamples']['garments']
  language: Language
  presentation: PresentationPreference
  matched: PhotoPointMatched
}) {
  const { match } = matched
  const placement = getColorPlacement(match, presentation)
  const placementId = useId()
  const pairingId = useId()
  const nearestName = colorDisplayName(language, match.nearest.color)
  const pairing = copy.pairing[placement.pairing]
  return <div className="photo-guidance">
    <p className="photo-reference">
      <span>{copy.nearestLabel}</span>
      <PaletteChip color={match.nearest.color} language={language} />
      <small>{copy.groups[match.nearest.group]}</small>
    </p>
    {match.resembles && <p className="photo-resembles">
      <i style={{ background: match.resembles.color.hex }} aria-hidden="true" />
      {copy.resembles(colorDisplayName(language, match.resembles.color))}
    </p>}

    <section className="photo-placement" aria-labelledby={placementId}>
      <h2 id={placementId}>{copy.placementHeading}</h2>
      <ul>
        {placement.rows.map((row) => <li key={row.tier} className={`photo-place photo-place-${row.tier}`}>
          <strong>{copy.tiers[row.tier]}</strong>
          <span>{row.areas.map((area) => copy.areas[area]).join(' · ')}</span>
          <small>{row.examples.map((example) => garments[example]).join(' · ')}</small>
        </li>)}
      </ul>
    </section>

    {match.pairWith.length > 0 && <section className="photo-pairing" aria-labelledby={pairingId}>
      <h2 id={pairingId}>{pairing.heading}</h2>
      <p>{pairing.body}</p>
      <div className="photo-pairs">{match.pairWith.map((color) => <PaletteChip key={color.id} color={color} language={language} />)}</div>
    </section>}

    <p className="photo-details">
      {match.direction.length > 0 && <span>{copy.direction(nearestName, match.direction.map((direction) => copy.directions[direction]))}</span>}
      <span>{copy.descriptorsLabel}: {copy.descriptors.value[match.descriptors.value]} · {copy.descriptors.clarity[match.descriptors.clarity]}</span>
    </p>

    {/* Advisory only: the category and guidance above stay. Announced via the summary. */}
    {match.warnings.length > 0 && <ul className="photo-warnings" aria-hidden="true">
      {match.warnings.map((flag) => <li key={flag}>{copy.warnings[flag]}</li>)}
    </ul>}
    <p className="photo-caveat">{copy.caveat}</p>
  </div>
}

// Same look as the palette's colour chips: swatch + display name, HEX in the tooltip only.
function PaletteChip({ color, language }: { color: PaletteColor; language: Language }) {
  const name = colorDisplayName(language, color)
  return <span className="color-chip" title={`${name} ${color.hex}`}>
    <i style={{ background: color.hex }} aria-hidden="true" />{name}
  </span>
}
