import type { RefObject } from 'react'
import type { Subtype } from '../../domain/personalColor/types'
import type { Language, LocaleCopy } from '../../i18n'
import { learnTopics, resolveAppCopy, subtypeGuide } from '..'
import type { LearnBlock, LearnCopy, LearnProfile, LearnTopicId, SubtypeGuide } from '..'
import { Swatches, TopicVisual } from './LearnVisuals'

// The generic Learn reader (Slice 2): every topic renders through the same three levels (plan §10):
// the answer, "Why it works", and a collapsed "More detail". No topic has its own layout here. Slice 3
// adds the topic's visual, chosen by its registry `visual` kind, between the answer and "Why it works".

export function BackButton({ label, onBack }: { label: string; onBack: () => void }) {
  return <button type="button" className="learn-back" onClick={onBack}><span aria-hidden="true">←</span> {label}</button>
}

function Block({ block, copy, guide }: { block: LearnBlock; copy: LocaleCopy; guide: SubtypeGuide | null }) {
  if (block.kind === 'text') return <p>{block.text}</p>
  if (block.kind === 'list') return <ul className="learn-list">{block.items.map((item) => <li key={item}>{item}</li>)}</ul>
  if (block.kind === 'app-copy') {
    const value = resolveAppCopy(copy, block.ref)
    return typeof value === 'string' ? <p>{value}</p> : <ul className="learn-list">{value.map((item) => <li key={item}>{item}</li>)}</ul>
  }
  // A palette group, in the app's own words; with a result, a glimpse of the user's own colours.
  const section = copy.palette.sections[block.group]
  const colors = guide && block.group !== 'metals' ? guide.groups.find((entry) => entry.group === block.group)!.colors.slice(0, 6) : null
  return <div className="learn-palette-group" data-learn-group={block.group}>
    <h3>{section.title}</h3>
    <p>{section.description}</p>
    {colors && <Swatches colors={colors} className="learn-strip" />}
  </div>
}

export function LearnTopicPage({ copy, learn, language, profile, topic, backLabel, headingRef, onBack, onOpenType }: {
  copy: LocaleCopy
  learn: LearnCopy
  language: Language
  profile: LearnProfile | null
  topic: LearnTopicId
  backLabel: string
  headingRef: RefObject<HTMLHeadingElement | null>
  onBack: () => void
  onOpenType: (subtype: Subtype) => void
}) {
  const content = learn.topics[topic]
  const guide = profile ? subtypeGuide(profile.subtype, language) : null
  return <article className="learn-article" data-learn-topic={topic}>
    <BackButton label={backLabel} onBack={onBack} />
    <header className="learn-article-head">
      <p className="learn-kicker">{learn.home.groups[learnTopics[topic].group]}</p>
      <h1 ref={headingRef} tabIndex={-1}>{content.title}</h1>
      <p className="learn-answer">{content.answer}</p>
    </header>
    <TopicVisual kind={learnTopics[topic].visual} copy={copy} learn={learn} language={language} profile={profile} onOpenType={onOpenType} />
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
