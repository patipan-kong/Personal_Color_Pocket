import { useEffect, useRef, useState } from 'react'
import type { PersonalColorResult, Subtype } from '../../domain/personalColor/types'
import type { Language, LocaleCopy } from '../../i18n'
import { getLearnCopy, learnProfileFrom, learnSubtype } from '..'
import type { LearnTopicId } from '..'
import { LearnHome } from './LearnHome'
import { LearnTopicPage } from './LearnReader'
import { LearnTypePage } from './LearnType'

// V1.4 Slices 2–3: the Learn shell. The app has no router, so Learn keeps its own small page state
// and a visible in-app Back. Everything shown is derived from the props on every render: the profile
// comes from the app's current result, never from storage.

// Where the app may open Learn (Slice 3): its home, or one type's page (the Result screen's link).
export type LearnEntry = { kind: 'home' } | { kind: 'type'; subtype: Subtype }

// `your-type` follows the app's result (the home hero's link); `type` is one type chosen by id (the
// 12-type overview, or an app entry) and stays on that type whatever the result becomes.
export type LearnPage =
  | { kind: 'home' }
  | { kind: 'topic'; topic: LearnTopicId }
  | { kind: 'your-type' }
  | { kind: 'type'; subtype: Subtype }

// A page to return to on Back: the IA is at most home → topic → type, so this trail stays that short.
interface ReturnPoint { page: LearnPage; scrollY: number; from: string }

const pageKey = (page: LearnPage) => page.kind === 'topic' ? `topic:${page.topic}` : page.kind === 'type' ? `type:${page.subtype}` : page.kind

// An unknown subtype opens the Learn home: Learn never guesses a replacement type.
function entryPage(entry: LearnEntry | undefined): LearnPage {
  const subtype = entry?.kind === 'type' ? learnSubtype(entry.subtype) : null
  return subtype ? { kind: 'type', subtype } : { kind: 'home' }
}

export function LearnView({ copy, language, result, entry, onQuiz, onPalette }: {
  copy: LocaleCopy
  language: Language
  result: PersonalColorResult | null
  entry?: LearnEntry
  onQuiz: () => void
  onPalette: () => void
}) {
  const learn = getLearnCopy(language)
  const profile = learnProfileFrom(result)
  const [nav, setNav] = useState<{ page: LearnPage; trail: readonly ReturnPoint[]; restore: ReturnPoint | null }>(() => ({ page: entryPage(entry), trail: [], restore: null }))
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)
  // "Your type" exists only with a profile: without one it falls back to home. A chosen type needs none.
  const current: LearnPage = nav.page.kind === 'your-type' && !profile ? { kind: 'home' } : nav.page
  const parent = current.kind === 'home' ? null : nav.trail.at(-1)?.page ?? null
  const backLabel = parent?.kind === 'topic' ? `${learn.reader.backTo} ${learn.topics[parent.topic].title}` : learn.reader.back

  const open = (next: LearnPage, from: string) => {
    const point = { page: current, scrollY: window.scrollY, from }
    setNav((state) => ({ page: next, trail: current.kind === 'home' ? [point] : [...state.trail, point], restore: null }))
  }
  const back = () => setNav((state) => {
    const point = state.trail.at(-1) ?? null
    return { page: point?.page ?? { kind: 'home' }, trail: state.trail.slice(0, -1), restore: point }
  })
  const openType = (subtype: Subtype) => open({ kind: 'type', subtype }, `type-${subtype}`)

  const key = pageKey(current)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      // Opening Learn home from the app is handled by the app's own view change (top of page, focus
      // kept). Opening straight at a type moves focus to its title, since the link that opened it is gone.
      if (current.kind !== 'home') headingRef.current?.focus({ preventScroll: true })
      return
    }
    // Back returns to where the reader was on the parent page, focused on what they opened.
    const point = nav.restore
    window.scrollTo({ top: point?.scrollY ?? 0, behavior: 'instant' })
    const origin = point && document.querySelector<HTMLButtonElement>(`[data-learn-open="${point.from}"]`)
    if (origin) origin.focus({ preventScroll: true })
    else headingRef.current?.focus({ preventScroll: true })
    // Page changes only; a language or profile change re-renders in place without moving focus.
  }, [key])

  return <main key={key} className="learn-page page-enter" data-learn-page={current.kind === 'your-type' ? 'type' : current.kind} data-learn-mode={profile ? 'profile' : 'general'}>
    {current.kind === 'home' && <LearnHome learn={learn} language={language} profile={profile} headingRef={headingRef} onOpen={open} onQuiz={onQuiz} />}
    {current.kind === 'topic' && <LearnTopicPage copy={copy} learn={learn} language={language} profile={profile} topic={current.topic} backLabel={backLabel} headingRef={headingRef} onBack={back} onOpenType={openType} />}
    {(current.kind === 'type' || current.kind === 'your-type') && <LearnTypePage
      copy={copy} learn={learn} language={language} profile={profile}
      subtype={current.kind === 'type' ? current.subtype : profile!.subtype}
      backLabel={backLabel} headingRef={headingRef} onBack={back} onPalette={onPalette} onQuiz={onQuiz} />}
  </main>
}
