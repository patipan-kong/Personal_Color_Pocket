import type { RefObject } from 'react'
import type { PaletteColor } from '../../domain/personalColor/types'
import type { Language, LocaleCopy } from '../../i18n'
import { learnTopics, resolveAppCopy, subtypeGuide } from '..'
import type { LearnBlock, LearnCopy, LearnProfile, LearnTopicId, PaletteColorGroupKey, SubtypeGuide } from '..'

// The generic Learn reader (Slice 2): every topic renders through the same three levels (plan §10):
// the answer, "Why it works", and a collapsed "More detail". No topic has its own layout here; the
// dimension scales, type grid, flat-lay and lighting visuals arrive in Slices 3 and 4.

// Swatches are decoration next to text that already names the group, so they are hidden from
// assistive technology. Colour values are only ever style, never text.
export function Swatches({ colors, className = '' }: { colors: readonly PaletteColor[]; className?: string }) {
  return <span className={`learn-swatches ${className}`} aria-hidden="true">
    {colors.map((color) => <i key={color.id} style={{ background: color.hex }} />)}
  </span>
}

function BackButton({ learn, onBack }: { learn: LearnCopy; onBack: () => void }) {
  return <button type="button" className="learn-back" onClick={onBack}><span aria-hidden="true">←</span> {learn.reader.back}</button>
}

const groupColors = (guide: SubtypeGuide, group: PaletteColorGroupKey) => guide.groups.find((entry) => entry.group === group)!

function Block({ block, copy, guide }: { block: LearnBlock; copy: LocaleCopy; guide: SubtypeGuide | null }) {
  if (block.kind === 'text') return <p>{block.text}</p>
  if (block.kind === 'list') return <ul className="learn-list">{block.items.map((item) => <li key={item}>{item}</li>)}</ul>
  if (block.kind === 'app-copy') {
    const value = resolveAppCopy(copy, block.ref)
    return typeof value === 'string' ? <p>{value}</p> : <ul className="learn-list">{value.map((item) => <li key={item}>{item}</li>)}</ul>
  }
  // A palette group, in the app's own words; with a result, a glimpse of the user's own colours.
  const section = copy.palette.sections[block.group]
  const colors = guide && block.group !== 'metals' ? groupColors(guide, block.group).colors.slice(0, 6) : null
  return <div className="learn-palette-group" data-learn-group={block.group}>
    <h3>{section.title}</h3>
    <p>{section.description}</p>
    {colors && <Swatches colors={colors} className="learn-strip" />}
  </div>
}

export function LearnTopicPage({ copy, learn, language, profile, topic, headingRef, onBack }: {
  copy: LocaleCopy
  learn: LearnCopy
  language: Language
  profile: LearnProfile | null
  topic: LearnTopicId
  headingRef: RefObject<HTMLHeadingElement | null>
  onBack: () => void
}) {
  const content = learn.topics[topic]
  const guide = profile ? subtypeGuide(profile.subtype, language) : null
  return <article className="learn-article" data-learn-topic={topic}>
    <BackButton learn={learn} onBack={onBack} />
    <header className="learn-article-head">
      <p className="learn-kicker">{learn.home.groups[learnTopics[topic].group]}</p>
      <h1 ref={headingRef} tabIndex={-1}>{content.title}</h1>
      <p className="learn-answer">{content.answer}</p>
    </header>
    <section className="learn-level" aria-labelledby="learn-why">
      <h2 id="learn-why">{learn.reader.why}</h2>
      {content.why.map((block, index) => <Block key={index} block={block} copy={copy} guide={guide} />)}
    </section>
    {content.more.length > 0 && <details className="learn-more">
      <summary>{learn.reader.more}</summary>
      {content.more.map((block, index) => <Block key={index} block={block} copy={copy} guide={guide} />)}
    </details>}
    <section className="learn-takeaway" aria-labelledby="learn-takeaway">
      <h2 id="learn-takeaway">{learn.reader.takeaway}</h2>
      <p>{content.takeaway}</p>
    </section>
  </article>
}

// A minimal "your type" page, built only from subtypeGuide(): the full data-driven type template
// (scales, every palette group, metals, any of the 12 types) is Slice 3.
export function LearnTypePage({ copy, learn, language, profile, headingRef, onBack, onPalette }: {
  copy: LocaleCopy
  learn: LearnCopy
  language: Language
  profile: LearnProfile
  headingRef: RefObject<HTMLHeadingElement | null>
  onBack: () => void
  onPalette: () => void
}) {
  const guide = subtypeGuide(profile.subtype, language)
  const detail = learn.typeDetail
  const nameOf = (group: PaletteColorGroupKey, color: PaletteColor) => {
    const entry = groupColors(guide, group)
    return entry.names[entry.colors.indexOf(color)]
  }
  const formula = [
    [detail.formula.nearFace, 'best', guide.formula.nearFace],
    [detail.formula.base, 'neutrals', guide.formula.base],
    [detail.formula.accent, 'accents', guide.formula.accent],
  ] as const
  return <article className="learn-article learn-type" data-learn-subtype={guide.subtype}>
    <BackButton learn={learn} onBack={onBack} />
    <header className="learn-article-head">
      <p className="learn-kicker">{detail.yourType} · {guide.seasonName}</p>
      <h1 ref={headingRef} tabIndex={-1}>{guide.copy.name}</h1>
      {guide.copy.secondaryName && <p className="learn-hero-secondary" lang="en">{guide.copy.secondaryName}</p>}
      <p className="learn-answer">{guide.copy.summary}</p>
      <Swatches colors={groupColors(guide, 'best').colors.slice(0, 5)} className="learn-hero-swatches" />
    </header>
    <section className="learn-level" aria-labelledby="learn-position">
      <h2 id="learn-position">{detail.positionHeading}</h2>
      <dl className="learn-positions">
        {guide.position.map((position) => <div key={position.dimension}><dt>{position.name}</dt><dd>{position.label}</dd></div>)}
      </dl>
      <p className="learn-note">{detail.positionNote}</p>
    </section>
    <section className="learn-level" aria-labelledby="learn-formula">
      <h2 id="learn-formula">{detail.formulaHeading}</h2>
      <ul className="learn-formula">
        {formula.map(([label, group, color]) => <li key={group}>
          <i aria-hidden="true" style={{ background: color.hex }} />
          <span>{label}</span>
          <strong>{nameOf(group, color)}</strong>
        </li>)}
      </ul>
    </section>
    <button type="button" className="primary-button compact learn-type-cta" onClick={onPalette}>{copy.result.paletteCta} <span aria-hidden="true">→</span></button>
  </article>
}
