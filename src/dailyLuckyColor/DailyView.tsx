import { useEffect, useMemo, useState } from 'react'
import { getLuckyColorForDate, luckyWeekdayForDate } from '../domain/luckyColor/luckyColor'
import { LUCKY_GOALS } from '../domain/luckyColor/types'
import type { LuckyGoal } from '../domain/luckyColor/types'
import { recommendLuckyGoalsOutfit } from '../domain/luckyColor/outfit'
import type { LuckyGoalsOutfitRecommendation, LuckyOutfitLuckyClaim, LuckyOutfitPiece } from '../domain/luckyColor/outfit'
import { subtypeOrder } from '../domain/personalColor/seasons'
import type { PersonalColorResult, Subtype } from '../domain/personalColor/types'
import type { LocaleCopy } from '../i18n'
import { loadDailyLuckyColorGoals, saveDailyLuckyColorGoals } from '../services/dailyLuckyColorGoal'
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

function goalLabels(claim: LuckyOutfitLuckyClaim | undefined, copy: LocaleCopy): string {
  return claim ? claim.goals.map((goal) => copy.daily.goals[goal]).join(copy.daily.goalSeparator) : ''
}

function claimForPiece(recommendation: LuckyGoalsOutfitRecommendation, piece: LuckyOutfitPiece) {
  return recommendation.luckyClaims.find((claim) => claim.pieceRole === piece.role && claim.pieceSlot === piece.slot)
    ?? recommendation.luckyClaims.find((claim) => claim.pieceRole === piece.role && claim.pieceSlot === undefined && piece.slot === undefined)
}

function PieceColor({ piece, claim, copy }: { piece: LuckyOutfitPiece; claim?: LuckyOutfitLuckyClaim; copy: LocaleCopy }) {
  const { color } = piece
  const displayHex = color.kind === 'palette' ? color.hex : color.token === 'lucky-family'
    ? LUCKY_FAMILY_DISPLAY_SWATCHES[color.luckyFamily!]
    : color.token === 'light-neutral' ? '#F1E9DE' : '#817971'
  const exactName = color.kind === 'palette' ? color.name[copy.language] : null
  const name = color.kind === 'palette'
    ? claim ? `${copy.daily.familyLabels[claim.luckyFamily]}${copy.daily.goalSeparator}${exactName}` : exactName
    : color.token === 'lucky-family' ? copy.daily.familyLabels[color.luckyFamily!] : copy.daily.semanticColors[color.token]
  return <span className="daily-piece-color"><i style={{ background: displayHex }} aria-hidden="true" /><span>{name}</span></span>
}

function OutfitSummary({ recommendation, copy }: { recommendation: LuckyGoalsOutfitRecommendation; copy: LocaleCopy }) {
  return <section className="daily-outfit" aria-labelledby="daily-outfit-heading">
    <div className="daily-section-heading"><p className="section-number">{copy.daily.outfitEyebrow}</p><h2 id="daily-outfit-heading">{copy.daily.outfitHeading}</h2></div>
    <div className="daily-piece-list">
      {recommendation.pieces.map((piece) => {
        const claim = piece.colorRole === 'lucky' ? claimForPiece(recommendation, piece) : undefined
        const badge = claim ? `${copy.daily.luckyBadge}${copy.daily.goalSeparator}${goalLabels(claim, copy)}` : ''
        const key = `${piece.role}-${piece.slot ?? 0}`
        return <article className={`daily-piece ${piece.colorRole === 'lucky' ? 'is-lucky' : ''}`} data-color-kind={piece.color.kind} data-lucky-family={claim?.luckyFamily} key={key}>
          <div><h3>{copy.daily.pieceLabels[piece.role]}</h3><PieceColor piece={piece} claim={claim} copy={copy} /></div>
          {claim
            ? <span className="daily-lucky-badge">✦ {badge}</span>
          : <span className="daily-supporting-label">{piece.colorRole === 'supporting-personal-color' ? copy.daily.personalSupport : copy.daily.neutralSupport}</span>}
        </article>
      })}
    </div>
  </section>
}

export function DailyView({ copy, result, onQuiz, clock = deviceClock }: { copy: LocaleCopy; result: PersonalColorResult | null; onQuiz: () => void; clock?: DailyClock }) {
  const [goals, setGoals] = useState<LuckyGoal[]>(loadDailyLuckyColorGoals)
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
    try {
      const rules = goals.map((goal) => getLuckyColorForDate(today, goal))
      return recommendLuckyGoalsOutfit({ rules, subtype })
    } catch { return null }
  }, [today, goals, subtype])
  const weekday = today ? (() => { try { return luckyWeekdayForDate(today) } catch { return null } })() : null
  useEffect(() => { saveDailyLuckyColorGoals(goals) }, [goals])
  const chooseGoal = (next: LuckyGoal) => {
    setGoals((current) => {
      if (current.includes(next)) return current.length === 1 ? current : current.filter((goal) => goal !== next)
      if (current.length < 2) return [...current, next]
      return [current[1], next]
    })
  }
  const moveGoal = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const change = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
    const next = LUCKY_GOALS[(index + change + LUCKY_GOALS.length) % LUCKY_GOALS.length]
    document.querySelector<HTMLButtonElement>(`[data-daily-goal="${next}"]`)?.focus()
  }

  if (!today || !weekday || !recommendation) return <main className="daily-page page-enter"><section className="daily-error content-card" role="alert"><h1>{copy.daily.title}</h1><p>{copy.daily.dateError}</p></section></main>

  return <main className="daily-page page-enter" data-daily-mode={recommendation.mode}>
    <section className="daily-hero">
      <p className="eyebrow">{copy.daily.eyebrow}</p>
      <h1>{copy.daily.title}</h1>
      <p className="daily-weekday">{copy.daily.today} · {copy.daily.weekdays[weekday]}</p>
      <p className="daily-framing">{copy.daily.framing}</p>
    </section>
    <section className="daily-goals" aria-labelledby="daily-goal-heading">
      <h2 id="daily-goal-heading">{copy.daily.goalPrompt}</h2>
      <p className="daily-goal-limit">{copy.daily.goalLimit}</p>
      <div role="group" aria-label={copy.daily.goalPrompt} className="daily-goal-grid">
        {LUCKY_GOALS.map((item, index) => <button key={item} type="button" aria-pressed={goals.includes(item)} data-daily-goal={item} className={goals.includes(item) ? 'selected' : ''} onClick={() => chooseGoal(item)} onKeyDown={(event) => moveGoal(event, index)}>{copy.daily.goals[item]}<span aria-hidden="true">✓</span></button>)}
      </div>
    </section>
    <section className="daily-result" aria-labelledby="daily-result-heading">
      <p className="section-number">{copy.daily.resultEyebrow}</p>
      <div className="daily-family-list" data-lucky-claim-count={recommendation.luckyClaims.length}>
        {recommendation.luckyClaims.map((claim, index) => {
          const selected = claim.adaptation?.selectedColor
          return <article className="daily-family-claim" data-lucky-family={claim.luckyFamily} key={claim.luckyFamily}>
            <div className="daily-family-heading"><i style={{ background: LUCKY_FAMILY_DISPLAY_SWATCHES[claim.luckyFamily] }} aria-hidden="true" /><div><h2 id={index === 0 ? 'daily-result-heading' : undefined}>{copy.daily.familyLabels[claim.luckyFamily]}</h2><p>{copy.daily.familyLabel}</p></div></div>
            <p className="daily-goal-provenance">{goalLabels(claim, copy)}</p>
            {selected && <p className="daily-shade"><span>{copy.daily.personalizedShade}</span><strong>{selected.name[copy.language]}</strong></p>}
            {claim.placement !== 'top' && <p className="daily-placement-note">{copy.daily.placementNotes[claim.placement]}</p>}
          </article>
        })}
      </div>
      {subtype ? <p className="daily-profile">{copy.daily.personalizedFor(copy.subtypes[subtype].name)}</p> : <div className="daily-general"><p>{copy.daily.generalNote}</p><button type="button" className="text-button" onClick={onQuiz}>{copy.daily.quizCta}</button></div>}
    </section>
    <OutfitSummary recommendation={recommendation} copy={copy} />
    <details className="daily-sources"><summary>{copy.daily.aboutHeading}</summary><p>{copy.daily.aboutBody}</p><p>{copy.daily.sourcesLabel}: <a href="https://www.thairath.co.th/horoscope/belief/2897832" target="_blank" rel="noreferrer">Thai Rath</a> {copy.daily.sourceJoin} <a href="https://www.ktc.co.th/article/shopping/fashion/birthday-auspicious-color-timetable" target="_blank" rel="noreferrer">KTC</a>.</p></details>
  </main>
}
