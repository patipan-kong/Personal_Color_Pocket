import type { ReactNode } from 'react'
import type { PaletteColor, Subtype } from '../../domain/personalColor/types'
import type { Language } from '../../i18n'
import { dimensionBandOrder, dimensionExamples, dimensionOrder, paletteColorById, seasonGroups, subtypeGuide } from '..'
import type { DimensionPosition, LearnCopy, LearnProfile, LearnVisualKind, OutfitFormula } from '..'

// V1.4 Slice 3: Learn's visuals, drawn with CSS and inline SVG only. Every colour comes from canonical
// palette data (a subtype's palette, or a Slice 1 palette-id example); positions come from the Slice 1
// bands. A topic's visual is chosen by its registry `visual` kind, never by topic id.

// Decorative swatches, next to text that already names what they show: hidden from assistive
// technology. Colour values are only ever style, never text.
export function Swatches({ colors, className = '' }: { colors: readonly PaletteColor[]; className?: string }) {
  return <span className={`learn-swatches ${className}`} aria-hidden="true">
    {colors.map((color) => <i key={color.id} style={{ background: color.hex }} />)}
  </span>
}

// The "Your type" marker: always text (with a decorative star), never colour alone.
export function YourTypeMarker({ learn }: { learn: LearnCopy }) {
  return <span className="learn-your-type"><span aria-hidden="true">✦</span> {learn.typeDetail.yourType}</span>
}

// Four banded scales (plan §15): five equal segments per dimension, from the 0 end (left) to the 1 end
// (right). A type's position is its band's segment plus the band written as text, never a number.
// The segments are categorical, so there is no gradient suggesting a continuous measurement.
export function DimensionScales({ learn, positions, legend, examples = false }: {
  learn: LearnCopy
  positions: readonly DimensionPosition[] | null
  legend?: ReactNode
  examples?: boolean
}) {
  const ends = (ids: readonly string[]) => ids.map((id) => paletteColorById(id)!)
  return <div className="learn-scales" data-learn-visual="dimension-scales">
    {legend && <p className="learn-scale-legend"><span className="learn-scale-key" aria-hidden="true" />{legend}</p>}
    <ul>
      {dimensionOrder.map((dimension) => {
        const copy = learn.dimensions[dimension]
        const position = positions?.find((entry) => entry.dimension === dimension) ?? null
        const index = position ? dimensionBandOrder.indexOf(position.band) : -1
        const example = dimensionExamples[dimension]
        return <li key={dimension} className="learn-scale" data-dimension={dimension} data-band={position?.band}>
          <p className="learn-scale-head"><strong>{copy.name}</strong>{position && <span>{position.label}</span>}</p>
          <div className="learn-scale-row" aria-hidden="true">
            {examples && <Swatches colors={ends(example.low)} className={`learn-scale-end ${example.low.length > 1 ? 'is-stack' : ''}`} />}
            <span className="learn-scale-track">
              {dimensionBandOrder.map((band, segment) => <i key={band} className={segment === index ? 'is-on' : ''} />)}
            </span>
            {examples && <Swatches colors={ends(example.high)} className={`learn-scale-end ${example.high.length > 1 ? 'is-stack' : ''}`} />}
          </div>
          <p className="learn-scale-ends"><span>{copy.ends.low}</span><span>{copy.ends.high}</span></p>
        </li>
      })}
    </ul>
  </div>
}

// The 12 types as four seasons of three (plan §13): the canonical order and names, each type with a
// cue of its own first Best colours. There are no season palettes, and no type is ranked.
export function TypeGrid({ learn, language, profile, onOpenType }: {
  learn: LearnCopy
  language: Language
  profile: LearnProfile | null
  onOpenType: (subtype: Subtype) => void
}) {
  return <div className="learn-type-grid" data-learn-visual="subtype-grid">
    <p className="learn-grid-hint">{learn.typeDetail.gridHint}</p>
    {seasonGroups().map((group) => <section key={group.season} className="learn-season" data-season={group.season} aria-labelledby={`learn-season-${group.season}`}>
      <h2 id={`learn-season-${group.season}`}>{learn.seasons[group.season].name}</h2>
      <p className="learn-season-summary">{learn.seasons[group.season].summary}</p>
      <ul className="learn-season-types">
        {group.subtypes.map((subtype) => {
          const guide = subtypeGuide(subtype, language)
          const mine = profile?.subtype === subtype
          return <li key={subtype} className={`learn-type-card${mine ? ' is-mine' : ''}`} data-learn-subtype={subtype}>
            <Swatches colors={guide.palette.best.slice(0, 4)} className="learn-type-card-art" />
            <h3>
              <button type="button" className="learn-open" data-learn-open={`type-${subtype}`} onClick={() => onOpenType(subtype)}>
                {guide.copy.name}{mine && <span className="learn-sr-only">, </span>}
                {mine && <YourTypeMarker learn={learn} />}
              </button>
            </h3>
            {guide.copy.secondaryName && <p className="learn-type-card-secondary" lang="en">{guide.copy.secondaryName}</p>}
          </li>
        })}
      </ul>
    </section>)}
  </div>
}

// A small neutral flat-lay for the outfit formula: a top (Best, near the face), trousers (a Neutral as
// the base) and a bag (an Accent in a small piece). Decorative: the formula list beside it names each
// piece and colour.
export function OutfitFlatLay({ formula }: { formula: OutfitFormula }) {
  return <svg className="learn-flatlay" viewBox="0 0 200 150" aria-hidden="true" focusable="false">
    <path className="learn-flatlay-piece" style={{ fill: formula.nearFace.hex }} d="M52 12 70 6c3 6 7 8 10 8s7-2 10-8l18 6 18 20-14 10-6-8v36H54V34l-6 8-14-10Z" />
    <path className="learn-flatlay-piece" style={{ fill: formula.base.hex }} d="M56 76h48l4 68H87l-7-44-7 44H52Z" />
    <path className="learn-flatlay-strap" style={{ stroke: formula.accent.hex }} d="M148 94c0-16 24-16 24 0" />
    <rect className="learn-flatlay-piece" style={{ fill: formula.accent.hex }} x="138" y="92" width="44" height="36" rx="7" />
  </svg>
}

// Registry visual kind → drawing. Kinds without an entry (season strips, garment placement, lighting)
// are drawn in Slice 4; until then their topics read as text only.
export function TopicVisual({ kind, learn, language, profile, onOpenType }: {
  kind: LearnVisualKind | null
  learn: LearnCopy
  language: Language
  profile: LearnProfile | null
  onOpenType: (subtype: Subtype) => void
}) {
  if (kind === 'subtype-grid') return <TypeGrid learn={learn} language={language} profile={profile} onOpenType={onOpenType} />
  if (kind === 'dimension-scales') {
    // With a result, the user's type is marked on each scale (the type's position, not their answers).
    const guide = profile ? subtypeGuide(profile.subtype, language) : null
    return <figure className="learn-figure">
      <DimensionScales learn={learn} positions={guide?.position ?? null} examples
        legend={guide && <><YourTypeMarker learn={learn} /> {guide.copy.name}</>} />
      {guide && <figcaption className="learn-note">{learn.typeDetail.positionNote}</figcaption>}
    </figure>
  }
  return null
}
