import { useEffect, useMemo, useState } from 'react'
import { getLuckyColorForDate, luckyWeekdayForDate } from '../domain/luckyColor/luckyColor'
import { LUCKY_GOALS } from '../domain/luckyColor/types'
import type { LuckyGoal } from '../domain/luckyColor/types'
import { recommendLuckyRuleOutfit } from '../domain/luckyColor/outfit'
import type { LuckyOutfitPiece, LuckyOutfitRecommendation } from '../domain/luckyColor/outfit'
import { subtypeOrder } from '../domain/personalColor/seasons'
import type { PersonalColorResult, Subtype } from '../domain/personalColor/types'
import type { LocaleCopy } from '../i18n'
import { loadDailyLuckyColorGoal, saveDailyLuckyColorGoal } from '../services/dailyLuckyColorGoal'
import { LUCKY_FAMILY_DISPLAY_SWATCHES } from './presentation'

export type DailyClock = () => Date
const deviceClock: DailyClock = () => new Date()

function validDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

function readToday(clock: DailyClock): Date | null {
  try {
    const value = clock()
    return validDate(value) ? new Date(value.getTime()) : null
  } catch {
    return null
  }
}

function validSubtype(result: PersonalColorResult | null): Subtype | undefined {
  return result && subtypeOrder.includes(result.subtype) ? result.subtype : undefined
}

function PieceColor({ piece, copy }: { piece: LuckyOutfitPiece; copy: LocaleCopy }) {
  const { color } = piece
  const displayHex = color.kind === 'palette' ? color.hex : color.token === 'lucky-family'
    ? LUCKY_FAMILY_DISPLAY_SWATCHES[color.luckyFamily!]
    : color.token === 'light-neutral' ? '#F1E9DE' : '#817971'
  const name = color.kind === 'palette'
    ? color.name[copy.language]
    : color.token === 'lucky-family' ? copy.daily.familyLabels[color.luckyFamily!] : copy.daily.semanticColors[color.token]
  return <span className="daily-piece-color"><i style={{ background: displayHex }} aria-hidden="true" /><span>{name}</span></span>
}

function OutfitSummary({ recommendation, copy }: { recommendation: LuckyOutfitRecommendation; copy: LocaleCopy }) {
  const luckyPiece = recommendation.pieces.find((piece) => piece.colorRole === 'lucky')
  return <section className="daily-outfit" aria-labelledby="daily-outfit-heading">
    <div className="daily-section-heading"><p className="section-number">{copy.daily.outfitEyebrow}</p><h2 id="daily-outfit-heading">{copy.daily.outfitHeading}</h2></div>
    <div className="daily-piece-list">
      {recommendation.pieces.map((piece) => <article className={`daily-piece ${piece.colorRole === 'lucky' ? 'is-lucky' : ''}`} data-color-kind={piece.color.kind} key={piece.role}>
        <div><h3>{copy.daily.pieceLabels[piece.role]}</h3><PieceColor piece={piece} copy={copy} /></div>
        {piece === luckyPiece
          ? <span className="daily-lucky-badge">✦ {copy.daily.luckyBadge}</span>
          : <span className="daily-supporting-label">{piece.colorRole === 'supporting-personal-color' ? copy.daily.personalSupport : copy.daily.neutralSupport}</span>}
      </article>)}
    </div>
  </section>
}

export function DailyView({ copy, result, onQuiz, clock = deviceClock }: { copy: LocaleCopy; result: PersonalColorResult | null; onQuiz: () => void; clock?: DailyClock }) {
  const [goal, setGoal] = useState<LuckyGoal>(loadDailyLuckyColorGoal)
  const [today, setToday] = useState<Date | null>(() => readToday(clock))
  const subtype = validSubtype(result)

  const refreshToday = () => setToday(readToday(clock))
  useEffect(() => { refreshToday() }, [clock])
  useEffect(() => {
    const refreshOnReturn = () => refreshToday()
    window.addEventListener('focus', refreshOnReturn)
    document.addEventListener('visibilitychange', refreshOnReturn)
    if (!today) return () => {
      window.removeEventListener('focus', refreshOnReturn)
      document.removeEventListener('visibilitychange', refreshOnReturn)
    }
    const nextMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime()
    const timer = window.setTimeout(refreshOnReturn, Math.max(1_000, nextMidnight - today.getTime() + 50))
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refreshOnReturn)
      document.removeEventListener('visibilitychange', refreshOnReturn)
    }
  }, [today, clock])

  const recommendation = useMemo(() => {
    if (!today) return null
    try { return recommendLuckyRuleOutfit(getLuckyColorForDate(today, goal), subtype) } catch { return null }
  }, [today, goal, subtype])
  const weekday = today ? (() => { try { return luckyWeekdayForDate(today) } catch { return null } })() : null
  const chooseGoal = (next: LuckyGoal) => { setGoal(next); saveDailyLuckyColorGoal(next) }
  const moveGoal = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const change = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
    const next = LUCKY_GOALS[(index + change + LUCKY_GOALS.length) % LUCKY_GOALS.length]
    chooseGoal(next)
    document.querySelector<HTMLButtonElement>(`[data-daily-goal="${next}"]`)?.focus()
  }

  if (!today || !weekday || !recommendation) return <main className="daily-page page-enter"><section className="daily-error content-card" role="alert"><h1>{copy.daily.title}</h1><p>{copy.daily.dateError}</p></section></main>

  const selected = recommendation.adaptation?.selectedColor
  return <main className="daily-page page-enter" data-daily-mode={recommendation.mode}>
    <section className="daily-hero">
      <p className="eyebrow">{copy.daily.eyebrow}</p>
      <h1>{copy.daily.title}</h1>
      <p className="daily-weekday">{copy.daily.today} · {copy.daily.weekdays[weekday]}</p>
      <p className="daily-framing">{copy.daily.framing}</p>
    </section>
    <section className="daily-goals" aria-labelledby="daily-goal-heading">
      <h2 id="daily-goal-heading">{copy.daily.goalPrompt}</h2>
      <div role="radiogroup" aria-label={copy.daily.goalPrompt} className="daily-goal-grid">
        {LUCKY_GOALS.map((item, index) => <button key={item} type="button" role="radio" aria-checked={goal === item} data-daily-goal={item} className={goal === item ? 'selected' : ''} onClick={() => chooseGoal(item)} onKeyDown={(event) => moveGoal(event, index)}>{copy.daily.goals[item]}<span aria-hidden="true">✓</span></button>)}
      </div>
    </section>
    <section className="daily-result" aria-labelledby="daily-result-heading">
      <p className="section-number">{copy.daily.resultEyebrow}</p>
      <div className="daily-family-heading"><i style={{ background: LUCKY_FAMILY_DISPLAY_SWATCHES[recommendation.luckyFamily] }} aria-hidden="true" /><div><h2 id="daily-result-heading">{copy.daily.familyLabels[recommendation.luckyFamily]}</h2><p>{copy.daily.familyLabel}</p></div></div>
      {selected && <p className="daily-shade"><span>{copy.daily.personalizedShade}</span><strong>{selected.name[copy.language]}</strong></p>}
      {subtype ? <p className="daily-profile">{copy.daily.personalizedFor(copy.subtypes[subtype].name)}</p> : <div className="daily-general"><p>{copy.daily.generalNote}</p><button type="button" className="text-button" onClick={onQuiz}>{copy.daily.quizCta}</button></div>}
      {recommendation.luckyPlacement !== 'top' && <p className="daily-placement-note">{copy.daily.placementNotes[recommendation.luckyPlacement]}</p>}
    </section>
    <OutfitSummary recommendation={recommendation} copy={copy} />
    <details className="daily-sources"><summary>{copy.daily.aboutHeading}</summary><p>{copy.daily.aboutBody}</p><p>{copy.daily.sourcesLabel}: <a href="https://www.thairath.co.th/horoscope/belief/2897832" target="_blank" rel="noreferrer">Thai Rath</a> {copy.daily.sourceJoin} <a href="https://www.ktc.co.th/article/shopping/fashion/birthday-auspicious-color-timetable" target="_blank" rel="noreferrer">KTC</a>.</p></details>
  </main>
}
