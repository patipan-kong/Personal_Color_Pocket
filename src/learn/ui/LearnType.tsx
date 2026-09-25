import type { ReactNode, RefObject } from 'react'
import type { Subtype } from '../../domain/personalColor/types'
import type { Language, LocaleCopy } from '../../i18n'
import { subtypeGuide, typeDetailSections, typeOrientedNote } from '..'
import type { LearnCopy, LearnProfile, PaletteColorGroupKey, SwatchGroup } from '..'
import { BackButton } from './LearnReader'
import { DimensionScales, OutfitFlatLay, Swatches, TypeName, YourTypeMarker } from './LearnVisuals'

// V1.4 Slice 3: the one subtype template (plan §14). The same code renders all 12 types, in the
// registry's section order, entirely from subtypeGuide(): canonical palette groups and names, bands
// derived from the canonical targets, and existing app wording. Nothing depends on whose type it is
// except the "Your type" marker and which action is offered at the end.

type Section = typeof typeDetailSections[number]

// A palette group as a named list: the swatch is decoration, the visible name is the information, so
// a screen reader hears the group heading and then each colour's name — never a HEX value or an id.
function ColorGroup({ entry, children }: { entry: SwatchGroup; children?: ReactNode }) {
  return <section className={`learn-type-group is-${entry.group}`} data-learn-group={entry.group}>
    <h2>{entry.title}</h2>
    <p className="learn-group-description">{entry.description}</p>
    <ul className="learn-chips">
      {entry.colors.map((color, index) => <li key={color.id}><i aria-hidden="true" style={{ background: color.hex }} /><span>{entry.names[index]}</span></li>)}
    </ul>
    {children}
  </section>
}

export function LearnTypePage({ copy, learn, language, subtype, profile, backLabel, headingRef, onBack, onPalette, onQuiz }: {
  copy: LocaleCopy
  learn: LearnCopy
  language: Language
  subtype: Subtype
  profile: LearnProfile | null
  backLabel: string
  headingRef: RefObject<HTMLHeadingElement | null>
  onBack: () => void
  onPalette: () => void
  onQuiz: () => void
}) {
  const guide = subtypeGuide(subtype, language)
  const detail = learn.typeDetail
  // Only a marker: the palette and advice are identical whoever is looking. The one wording change is
  // that a metal note addressed to "you" speaks about the type when it is not the reader's own (Slice 4).
  const mine = profile?.subtype === subtype
  const group = (key: PaletteColorGroupKey) => guide.groups.find((entry) => entry.group === key)!
  const nameOf = (key: PaletteColorGroupKey, id: string) => {
    const entry = group(key)
    return entry.names[entry.colors.findIndex((color) => color.id === id)]
  }

  const sections: Record<Section, ReactNode> = {
    header: <header className="learn-article-head learn-type-head">
      <Swatches colors={guide.palette.best} className="learn-type-cover" />
      <p className="learn-kicker">{detail.seasonLabel} · {guide.seasonName}</p>
      <h1 ref={headingRef} tabIndex={-1}><TypeName name={guide.copy.name} season={guide.seasonName} /></h1>
      {guide.copy.secondaryName && <p className="learn-hero-secondary" lang="en">{guide.copy.secondaryName}</p>}
      {mine && <p className="learn-type-mine"><YourTypeMarker learn={learn} /></p>}
      {/* The existing characteristic words, labelled as qualities of the colours, not of a person. */}
      <p className="learn-qualities"><span>{detail.qualitiesLabel}</span> {guide.copy.characteristics.join(' · ')}</p>
      <p className="learn-answer">{guide.copy.summary}</p>
    </header>,
    position: <section className="learn-level learn-type-position" aria-labelledby="learn-position">
      <h2 id="learn-position">{detail.positionHeading}</h2>
      <DimensionScales learn={learn} positions={guide.position} />
      <p className="learn-note">{detail.positionNote}</p>
    </section>,
    best: <ColorGroup entry={group('best')} />,
    neutrals: <ColorGroup entry={group('neutrals')} />,
    accents: <ColorGroup entry={group('accents')} />,
    // Only the colours listed here are More Considered, with the app's own "not forbidden" wording.
    harder: <ColorGroup entry={group('harder')}>
      <ul className="learn-list learn-tips">{guide.moreConsideredTips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
    </ColorGroup>,
    metals: <section className="learn-type-group is-metals" data-learn-group="metals">
      <h2>{guide.metals.title}</h2>
      <p className="learn-group-description">{guide.metals.description}</p>
      <ul className="learn-metals">
        {guide.metals.items.map((metal, index) => <li key={metal.id}>
          <i aria-hidden="true" style={{ background: metal.hex }} />
          <span><strong>{guide.metals.names[index]}</strong> {mine ? guide.metals.notes[index] : typeOrientedNote(guide.metals.notes[index], language)}</span>
        </li>)}
      </ul>
    </section>,
    formula: <section className="learn-level learn-type-formula" aria-labelledby="learn-formula">
      <h2 id="learn-formula">{detail.formulaHeading}</h2>
      <div className="learn-outfit">
        <OutfitFlatLay formula={guide.formula} />
        <ul className="learn-formula">
          {([['best', detail.formula.nearFace, guide.formula.nearFace], ['neutrals', detail.formula.base, guide.formula.base], ['accents', detail.formula.accent, guide.formula.accent]] as const).map(([key, label, color]) => <li key={key}>
            <i aria-hidden="true" style={{ background: color.hex }} />
            <span>{label}</span>
            <strong>{nameOf(key, color.id)}</strong>
          </li>)}
        </ul>
      </div>
    </section>,
  }

  return <article className="learn-article learn-type" data-learn-subtype={subtype} data-learn-own={mine ? 'true' : 'false'}>
    <BackButton label={backLabel} onBack={onBack} />
    {typeDetailSections.map((section) => <div key={section} className="learn-type-section" data-section={section}>{sections[section]}</div>)}
    {mine
      ? <button type="button" className="primary-button compact learn-type-cta" onClick={onPalette}>{copy.result.paletteCta} <span aria-hidden="true">→</span></button>
      : !profile && <button type="button" className="text-button learn-quiz-link learn-type-quiz" onClick={onQuiz}>{detail.quizCta} <span aria-hidden="true">→</span></button>}
  </article>
}
