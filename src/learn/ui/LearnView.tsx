import { useEffect, useRef, useState } from 'react'
import type { PersonalColorResult } from '../../domain/personalColor/types'
import type { Language, LocaleCopy } from '../../i18n'
import { getLearnCopy, learnProfileFrom } from '..'
import type { LearnTopicId } from '..'
import { LearnHome } from './LearnHome'
import { LearnTopicPage, LearnTypePage } from './LearnReader'

// V1.4 Slice 2: the Learn shell. The app has no router, so Learn keeps its own small page state
// (home, one topic, or the user's type) and a visible in-app Back. Everything shown is derived from
// the props on every render: the profile comes from the app's current result, never from storage.

export type LearnPage = { kind: 'home' } | { kind: 'topic'; topic: LearnTopicId } | { kind: 'type' }

export function LearnView({ copy, language, result, onQuiz, onPalette }: {
  copy: LocaleCopy
  language: Language
  result: PersonalColorResult | null
  onQuiz: () => void
  onPalette: () => void
}) {
  const learn = getLearnCopy(language)
  const profile = learnProfileFrom(result)
  const [page, setPage] = useState<LearnPage>({ kind: 'home' })
  // Where the reader was on the home page, so Back returns there instead of to the top.
  const homeReturn = useRef<{ scrollY: number; from: string } | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)
  // The type page exists only for the user's own type: without a profile it falls back to home.
  const current: LearnPage = page.kind === 'type' && !profile ? { kind: 'home' } : page

  const open = (next: LearnPage, from: string) => {
    homeReturn.current = { scrollY: window.scrollY, from }
    setPage(next)
  }
  const back = () => setPage({ kind: 'home' })

  useEffect(() => {
    // Opening Learn from the app is handled by the app's own view change (top of page, focus kept).
    if (firstRender.current) { firstRender.current = false; return }
    if (current.kind === 'home') {
      const target = homeReturn.current
      window.scrollTo({ top: target?.scrollY ?? 0, behavior: 'instant' })
      const row = target && document.querySelector<HTMLButtonElement>(`[data-learn-open="${target.from}"]`)
      if (row) row.focus({ preventScroll: true })
      else headingRef.current?.focus({ preventScroll: true })
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' })
      headingRef.current?.focus({ preventScroll: true })
    }
    // Page changes only; a language or profile change re-renders in place without moving focus.
  }, [current.kind, current.kind === 'topic' ? current.topic : null])

  return <main key={current.kind === 'topic' ? current.topic : current.kind} className="learn-page page-enter" data-learn-page={current.kind} data-learn-mode={profile ? 'profile' : 'general'}>
    {current.kind === 'home' && <LearnHome learn={learn} language={language} profile={profile} headingRef={headingRef} onOpen={open} onQuiz={onQuiz} />}
    {current.kind === 'topic' && <LearnTopicPage copy={copy} learn={learn} language={language} profile={profile} topic={current.topic} headingRef={headingRef} onBack={back} />}
    {current.kind === 'type' && profile && <LearnTypePage copy={copy} learn={learn} language={language} profile={profile} headingRef={headingRef} onBack={back} onPalette={onPalette} />}
  </main>
}
