import type { RefObject } from 'react'
import type { PaletteColor } from '../../domain/personalColor/types'
import type { Language } from '../../i18n'
import { learnGroups, learnHomeFeatured, learnTopics, outfitExample, seasonGroups, subtypeGuide } from '..'
import type { LearnCopy, LearnProfile, LearnTopicId, PaletteColorGroupKey } from '..'
import type { LearnPage } from './LearnView'
import { Swatches } from './LearnVisuals'

// The Learn home (plan §11): a compact hero, at most two featured topics, then the remaining topics
// as rows under their group. Order, grouping and featuring all come from the Slice 1 registry.

// A featured card's small visual, derived from what the topic already references: its palette groups
// (the user's own colours, or the fixed general example), or the season samples. Decorative only.
function featureSwatches(learn: LearnCopy, language: Language, topic: LearnTopicId, profile: LearnProfile | null): readonly PaletteColor[] {
  const groups = learn.topics[topic].why.flatMap((block) => block.kind === 'palette-group' && block.group !== 'metals' ? [block.group] : [])
  if (groups.length > 0) {
    if (profile) {
      const guide = subtypeGuide(profile.subtype, language)
      const colors = (group: PaletteColorGroupKey) => guide.groups.find((entry) => entry.group === group)!.colors
      return groups.length === 1 ? colors(groups[0]).slice(0, 4) : groups.map((group) => colors(group)[0])
    }
    const example = outfitExample(null)
    const byGroup: Record<PaletteColorGroupKey, PaletteColor> = { best: example.nearFace, neutrals: example.base, accents: example.accent, harder: example.moreConsidered }
    return groups.map((group) => byGroup[group])
  }
  const seasons = seasonGroups()
  if (learnTopics[topic].visual === 'subtype-grid') return seasons.flatMap((season) => season.sample)
  if (learnTopics[topic].visual === 'season-strips') return seasons.map((season) => season.sample[0])
  return []
}

export function LearnHome({ learn, language, profile, headingRef, onOpen, onQuiz }: {
  learn: LearnCopy
  language: Language
  profile: LearnProfile | null
  headingRef: RefObject<HTMLHeadingElement | null>
  onOpen: (page: LearnPage, from: string) => void
  onQuiz: () => void
}) {
  const featured = profile ? learnHomeFeatured.withProfile : learnHomeFeatured.withoutProfile
  const guide = profile ? subtypeGuide(profile.subtype, language) : null
  const openTopic = (topic: LearnTopicId) => onOpen({ kind: 'topic', topic }, topic)

  return <>
    <header className="learn-head">
      <h1 ref={headingRef} tabIndex={-1}>{learn.home.title}</h1>
      <p className="learn-lede">{learn.home.lede}</p>
    </header>

    {guide
      ? <section className="learn-hero is-profile" aria-labelledby="learn-hero-title" data-learn-subtype={guide.subtype}>
        <Swatches colors={guide.groups.find((entry) => entry.group === 'best')!.colors.slice(0, 5)} className="learn-hero-swatches" />
        <p className="learn-kicker">{learn.home.profileHero.eyebrow} · {guide.seasonName}</p>
        <h2 id="learn-hero-title">{guide.copy.name}</h2>
        {guide.copy.secondaryName && <p className="learn-hero-secondary" lang="en">{guide.copy.secondaryName}</p>}
        <p className="learn-hero-summary">{guide.copy.summary}</p>
        <button type="button" className="primary-button compact" data-learn-open="type" onClick={() => onOpen({ kind: 'your-type' }, 'type')}>{learn.home.profileHero.cta} <span aria-hidden="true">→</span></button>
      </section>
      : <section className="learn-hero is-general" aria-labelledby="learn-hero-title">
        <Swatches colors={seasonGroups().flatMap((season) => season.sample)} className="learn-hero-swatches is-seasons" />
        <h2 id="learn-hero-title">{learn.home.generalHero.title}</h2>
        <p className="learn-hero-summary">{learn.home.generalHero.body}</p>
        <button type="button" className="text-button learn-quiz-link" onClick={onQuiz}>{learn.home.generalHero.cta} <span aria-hidden="true">→</span></button>
      </section>}

    <section className="learn-start" aria-labelledby="learn-start-title">
      <h2 id="learn-start-title" className="learn-section-label">{learn.home.startHere}</h2>
      <div className="learn-featured">
        {featured.map((topic) => {
          const swatches = featureSwatches(learn, language, topic, profile)
          return <article className="learn-feature" key={topic} data-learn-topic={topic}>
            {swatches.length > 0 && <Swatches colors={swatches} className={`learn-feature-art ${swatches.length > 6 ? 'is-grid' : ''}`} />}
            <p className="learn-kicker">{learn.home.groups[learnTopics[topic].group]}</p>
            <h3><button type="button" className="learn-open" data-learn-open={topic} onClick={() => openTopic(topic)}>{learn.topics[topic].title}</button></h3>
            <p>{learn.topics[topic].rowAnswer}</p>
            <span className="learn-arrow" aria-hidden="true">→</span>
          </article>
        })}
      </div>
    </section>

    {learnGroups.map((group) => {
      const rows = group.topics.filter((topic) => !featured.includes(topic))
      if (rows.length === 0) return null
      return <section className="learn-group" key={group.id} aria-labelledby={`learn-group-${group.id}`}>
        <h2 id={`learn-group-${group.id}`} className="learn-section-label">{learn.home.groups[group.id]}</h2>
        <ul className="learn-rows">
          {rows.map((topic) => <li className="learn-row" key={topic} data-learn-topic={topic}>
            <div>
              <h3><button type="button" className="learn-open" data-learn-open={topic} onClick={() => openTopic(topic)}>{learn.topics[topic].title}</button></h3>
              <p>{learn.topics[topic].rowAnswer}</p>
            </div>
            <span className="learn-arrow" aria-hidden="true">→</span>
          </li>)}
        </ul>
      </section>
    })}
  </>
}
