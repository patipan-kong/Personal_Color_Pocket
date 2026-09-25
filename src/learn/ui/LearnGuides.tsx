import type { ReactNode } from 'react'
import type { Language, LocaleCopy } from '../../i18n'
import { lightingExample, outfitExample, paletteColorById, subtypeGuide } from '..'
import type { LearnCopy, LearnProfile, LearnVisualKind, SubtypeGuide } from '..'
import { FlatLay, flatLayView, garmentPath } from './LearnArt'

// V1.4 Slice 4: the practical visuals, one per registry visual kind. Each one teaches a single idea from
// its topic's existing copy and writes the lesson out beside the drawing, so it still reads without
// colour or sight. Colours are canonical: the reader's own palette with a result, or the Slice 1 fixed
// examples without one (named as example colours, never as the reader's type). Nothing here computes
// suitability, reads Daily or looks at a photo.

export interface GuideProps {
  copy: LocaleCopy
  learn: LearnCopy
  language: Language
  profile: LearnProfile | null
}

// The shared frame: the same border, corners, tag and caption treatment for every illustration.
function Illustration({ kind, tag, caption, children }: { kind: LearnVisualKind; tag?: ReactNode; caption?: string; children: ReactNode }) {
  return <figure className={`learn-illus is-${kind}`} data-learn-visual={kind}>
    {tag && <p className="learn-illus-tag">{tag}</p>}
    {children}
    {caption && <figcaption className="learn-illus-caption">{caption}</figcaption>}
  </figure>
}

// A colour's localized name within the palette it came from (never its HEX or id).
function colorName(guide: SubtypeGuide, id: string): string {
  for (const group of guide.groups) {
    const index = group.colors.findIndex((color) => color.id === id)
    if (index >= 0) return group.names[index]
  }
  return guide.metals.names[guide.metals.items.findIndex((metal) => metal.id === id)]
}

// One role in an outfit: a decorative swatch, what the role is, and the colour's name.
function Role({ hex, role, name, considered = false }: { hex: string; role: string; name: string; considered?: boolean }) {
  return <li className={considered ? 'is-considered' : undefined}>
    <i aria-hidden="true" style={{ background: hex }} />
    <span>{role}</span>
    <strong>{name}</strong>
  </li>
}

// Whose colours these are: the reader's own type, or the fixed general example's type, said as such.
function example(learn: LearnCopy, language: Language, profile: LearnProfile | null) {
  const outfit = outfitExample(profile)
  const guide = subtypeGuide(outfit.subtype, language)
  const tag = `${outfit.personal ? learn.visuals.yourColors : learn.visuals.exampleColors} · ${guide.copy.name}`
  return { outfit, guide, tag, name: (id: string) => colorName(guide, id) }
}

// garment-placement (the palette topic): what goes near the face, what goes below it, and how each group is used.
export function PalettePlacement({ learn, language, profile }: GuideProps) {
  const { outfit, tag, name } = example(learn, language, profile)
  const formula = learn.typeDetail.formula
  const placement = learn.visuals.placement
  return <Illustration kind="garment-placement" tag={tag}>
    <div className="learn-illus-body">
      <div className="learn-zones">
        <div className="learn-zone" data-zone="near-face">
          <p className="learn-zone-label">{placement.nearFace}</p>
          <FlatLay view="upper" top={outfit.nearFace} metal={outfit.metal} />
        </div>
        <div className="learn-zone" data-zone="below-face">
          <p className="learn-zone-label">{placement.belowFace}</p>
          <FlatLay view="lower" bottom={outfit.base} bag={outfit.accent} />
        </div>
      </div>
      <ul className="learn-formula learn-roles">
        <Role hex={outfit.nearFace.hex} role={formula.nearFace} name={name(outfit.nearFace.id)} />
        <Role hex={outfit.metal.hex} role={placement.metal} name={name(outfit.metal.id)} />
        <Role hex={outfit.base.hex} role={formula.base} name={name(outfit.base.id)} />
        <Role hex={outfit.accent.hex} role={formula.accent} name={name(outfit.accent.id)} />
        <Role hex={outfit.moreConsidered.hex} role={placement.moreConsidered} name={name(outfit.moreConsidered.id)} considered />
      </ul>
    </div>
  </Illustration>
}

// placement-shift (the More Considered topic): one listed More Considered colour near the face, then the same colour lower and
// smaller with a Best colour on top. Placement changes how it is used, not what group it is in.
export function PlacementShift({ learn, language, profile }: GuideProps) {
  const { outfit, guide, tag, name } = example(learn, language, profile)
  const shift = learn.visuals.shift
  const title = (group: 'best' | 'neutrals' | 'harder') => guide.groups.find((entry) => entry.group === group)!.title
  return <Illustration kind="placement-shift" tag={tag} caption={shift.same}>
    <ol className="learn-shift">
      <li data-outfit="near-face">
        <FlatLay top={outfit.moreConsidered} bottom={outfit.base} />
        <p>{shift.nearFace}</p>
      </li>
      <li data-outfit="moved">
        <FlatLay top={outfit.nearFace} bottom={outfit.base} bag={outfit.moreConsidered} />
        <p>{shift.moved}</p>
      </li>
    </ol>
    <ul className="learn-formula learn-roles">
      <Role hex={outfit.moreConsidered.hex} role={title('harder')} name={name(outfit.moreConsidered.id)} considered />
      <Role hex={outfit.nearFace.hex} role={title('best')} name={name(outfit.nearFace.id)} />
      <Role hex={outfit.base.hex} role={title('neutrals')} name={name(outfit.base.id)} />
    </ul>
  </Illustration>
}

// lighting-comparison (the checker topic): the two modes, then one light, soft shirt as four photos might record it. The shirt's
// own colour is never shown as "the real one": every tile, including the one with strong colours around
// it, carries a shift, because the app only ever has the photo.
const casts = ['warm', 'cool', 'shade', 'context'] as const

export function LightingGuide({ copy, learn }: GuideProps) {
  const garment = paletteColorById(lightingExample)!
  const lighting = learn.visuals.lighting
  const shirt = (x: string, y: string, size: string) => <svg x={x} y={y} width={size} height={size} viewBox={flatLayView.top}>
    <path className="learn-flatlay-piece" style={{ fill: garment.hex }} d={garmentPath.top} />
  </svg>
  return <Illustration kind="lighting-comparison" caption={lighting.note}>
    <ul className="learn-modes">
      <li data-mode="manual">
        <svg className="learn-mode-art" viewBox="0 0 64 48" aria-hidden="true" focusable="false">
          <rect className="learn-flatlay-piece" style={{ fill: garment.hex }} x="6" y="6" width="52" height="36" rx="9" />
          <circle className="learn-mode-ring" cx="44" cy="18" r="6" />
        </svg>
        <p><strong>{copy.photoChecker.modes.manual}</strong> {lighting.manual}</p>
      </li>
      <li data-mode="photo">
        <svg className="learn-mode-art" viewBox="0 0 64 48" aria-hidden="true" focusable="false">
          <rect className="learn-cast-ground" x="6" y="6" width="52" height="36" rx="9" />
          {shirt('14', '6', '36')}
          <circle className="learn-mode-ring" cx="32" cy="28" r="6" />
        </svg>
        <p><strong>{copy.photoChecker.modes.photo}</strong> {lighting.photo}</p>
      </li>
    </ul>
    <p className="learn-illus-tag">{learn.visuals.illustration} · {lighting.garment}</p>
    <ul className="learn-casts">
      {casts.map((cast) => <li key={cast} data-cast={cast}>
        <svg viewBox="0 0 80 60" aria-hidden="true" focusable="false">
          <rect className={`learn-cast-ground${cast === 'context' ? ' is-context' : ''}`} width="80" height="60" rx="9" />
          {shirt('12', '2', '56')}
          <rect className={`learn-cast is-${cast}`} width="80" height="60" rx="9" />
        </svg>
        <span>{lighting[cast]}</span>
      </li>)}
    </ul>
  </Illustration>
}

// lucky-flow (the lucky-colour topic): the tradition gives a family, Personal Color picks the shade and where it goes. A
// concept drawn in illustration tones: no palette, no family data and never today's colour. The family step shows no
// hue of its own, so the example shades that follow never read as "the" lucky family.
const tones = ['1', '2', '3', '4', '5'] as const
const picked = '3'

export function LuckyFlow({ learn }: GuideProps) {
  const lucky = learn.visuals.lucky
  return <Illustration kind="lucky-flow" tag={learn.visuals.illustration} caption={lucky.note}>
    <ol className="learn-flow">
      <li data-step="family">
        {/* Any family, not a particular one (Slice 5): one token split into many hues, ringed as chosen. */}
        <span className="learn-family" aria-hidden="true"><i /></span>
        <p><strong>{lucky.family}</strong> {lucky.familyBody}</p>
      </li>
      <li data-step="shade">
        <span className="learn-tones is-picking" aria-hidden="true">{tones.map((tone) => <i key={tone} className={`is-tone-${tone}${tone === picked ? ' is-picked' : ''}`} />)}</span>
        <p><strong>{lucky.shade}</strong> {lucky.shadeBody}</p>
      </li>
      <li data-step="placement">
        <FlatLay className="learn-flow-art" top="tone" bottom="outline" bag="outline" />
        <p><strong>{lucky.place}</strong> {lucky.placeBody}</p>
      </li>
    </ol>
  </Illustration>
}
