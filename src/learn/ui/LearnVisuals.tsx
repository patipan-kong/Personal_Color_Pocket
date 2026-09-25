import type { ReactNode } from 'react'
import type { PaletteColor, Subtype } from '../../domain/personalColor/types'
import type { Language } from '../../i18n'
import { dimensionBandOrder, dimensionExamples, dimensionOrder, paletteColorById, seasonGroups, subtypeGuide } from '..'
import type { DimensionPosition, LearnCopy, LearnProfile, LearnVisualKind, OutfitFormula } from '..'
import { FlatLay } from './LearnArt'
import { LightingGuide, LuckyFlow, PalettePlacement, PlacementShift } from './LearnGuides'
import type { GuideProps } from './LearnGuides'

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
// A Thai type name is one word made of two (ซอฟต์ + ซัมเมอร์), and the browser's Thai line breaking can split
// it mid-syllable in a narrow card. Keep each part whole, so the only place left to wrap is between them
// (Slice 5). No <wbr> or extra character: the text and the accessible name stay exactly the name.
// English names, which have a space, render as they are.
export function TypeName({ name, season }: { name: string; season: string }) {
  const at = name.length - season.length
  if (at <= 0 || !name.endsWith(season) || name[at - 1] === ' ') return <>{name}</>
  return <><span className="learn-nobreak">{name.slice(0, at)}</span><span className="learn-nobreak">{season}</span></>
}

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
                <TypeName name={guide.copy.name} season={guide.seasonName} />{mine && <span className="learn-sr-only">, </span>}
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
  return <FlatLay top={formula.nearFace} bottom={formula.base} bag={formula.accent} />
}

type VisualProps = GuideProps & { onOpenType: (subtype: Subtype) => void }

// With a result, the user's type is marked on each scale (the type's position, not their answers).
function DimensionsFigure({ learn, language, profile }: VisualProps) {
  const guide = profile ? subtypeGuide(profile.subtype, language) : null
  return <figure className="learn-figure">
    <DimensionScales learn={learn} positions={guide?.position ?? null} examples
      legend={guide && <><YourTypeMarker learn={learn} /> {guide.copy.name}</>} />
    {guide && <figcaption className="learn-note">{learn.typeDetail.positionNote}</figcaption>}
  </figure>
}

// Registry visual kind → drawing, for every kind: a topic gets its drawing only from its registry
// `visual`, never from its id. Season strips and palette swatches have no topic drawing (the palette
// swatches are drawn by the type page itself), so those topics read as text.
const topicVisuals: Readonly<Record<LearnVisualKind, ((props: VisualProps) => ReactNode) | null>> = {
  'season-strips': null,
  'dimension-scales': DimensionsFigure,
  'subtype-grid': TypeGrid,
  'palette-swatches': null,
  'garment-placement': PalettePlacement,
  'placement-shift': PlacementShift,
  'lighting-comparison': LightingGuide,
  'lucky-flow': LuckyFlow,
}

export function TopicVisual({ kind, ...props }: VisualProps & { kind: LearnVisualKind | null }) {
  const Visual = kind ? topicVisuals[kind] : null
  return Visual ? <Visual {...props} /> : null
}
