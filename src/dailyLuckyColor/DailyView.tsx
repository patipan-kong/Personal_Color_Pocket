import { useEffect, useMemo, useState } from 'react'
import { getLuckyColorForDate, luckyWeekdayForDate } from '../domain/luckyColor/luckyColor'
import { LUCKY_GOALS } from '../domain/luckyColor/types'
import type { LuckyGoal } from '../domain/luckyColor/types'
import { recommendLuckyGoalsOutfit } from '../domain/luckyColor/outfit'
import { subtypeOrder } from '../domain/personalColor/seasons'
import type { PersonalColorResult, Subtype } from '../domain/personalColor/types'
import type { LocaleCopy } from '../i18n'
import { loadDailyLuckyColorGoals, saveDailyLuckyColorGoals } from '../services/dailyLuckyColorGoal'
import { GarmentArt } from './GarmentArt'
import { boardFillColor, boardFillTone, buildOutfitBoardModel } from './outfitBoard'
import type { OutfitBoardModel, OutfitBoardPiece } from './outfitBoard'

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

function goalLabels(goals: readonly LuckyGoal[], copy: LocaleCopy): string {
  return goals.map((goal) => copy.daily.goals[goal]).join(copy.daily.goalSeparator)
}

function pieceColorName(piece: OutfitBoardPiece, copy: LocaleCopy): string {
  const { fill } = piece
  if (fill.kind === 'exact') {
    const shade = fill.name[copy.language]
    const family = piece.luckyFamily ? copy.daily.familyLabels[piece.luckyFamily] : null
    // Family, then the exact shade; said once when the V1.2 name is simply the family name.
    return family && family !== shade ? `${family}${copy.daily.goalSeparator}${shade}` : shade
  }
  if (fill.kind === 'family-token') return copy.daily.familyLabels[fill.family]
  return copy.daily.semanticColors[fill.token]
}

// Grid areas place accessories beside the top; the DOM keeps the recommendation's reading order.
const boardArea = (piece: OutfitBoardPiece) => piece.role === 'accessory' ? `acc${piece.slot ?? 1}` : piece.role

function TodayColors({ board, copy }: { board: OutfitBoardModel; copy: LocaleCopy }) {
  return <section className="daily-result" aria-labelledby="daily-result-heading">
    <h2 id="daily-result-heading" className="daily-kicker">{copy.daily.resultEyebrow}</h2>
    <div className="daily-family-list" data-lucky-claim-count={board.claims.length}>
      {board.claims.map((claim) => {
        const exact = claim.exactColor
        return <article className="daily-family-claim" data-lucky-family={claim.luckyFamily} data-exact={exact ? 'true' : 'false'} key={claim.luckyFamily}>
          <i className={`daily-family-dot${exact ? '' : ' is-broad'}`} style={{ background: exact ? exact.hex : boardFillColor({ kind: 'family-token', family: claim.luckyFamily }) }} aria-hidden="true" />
          <div className="daily-family-text">
            <div className="daily-family-heading"><h3>{copy.daily.familyLabels[claim.luckyFamily]}</h3><p className="daily-goal-provenance">{goalLabels(claim.goals, copy)}</p></div>
            {exact
              ? <p className="daily-shade"><span>{copy.daily.personalizedShade}</span> <strong>{exact.name[copy.language]}</strong></p>
              : <p className="daily-shade is-broad">{copy.daily.familyLabel}</p>}
          </div>
        </article>
      })}
    </div>
  </section>
}

// Why each lucky colour sits where it does, then how Personal Color shaped it (or how to get that).
function OutfitNotes({ board, copy, subtype, onQuiz }: { board: OutfitBoardModel; copy: LocaleCopy; subtype?: Subtype; onQuiz: () => void }) {
  return <div className="daily-notes">
    {board.claims.map((claim) => claim.placement !== 'top' && <p className="daily-placement-note" key={claim.luckyFamily}><strong>{copy.daily.familyLabels[claim.luckyFamily]}</strong> {copy.daily.placementNotes[claim.placement]}</p>)}
    {subtype
      ? <div className="daily-story"><p className="daily-story-steps"><span>{copy.daily.storyFamily}</span> <span>{copy.daily.storyShade}</span></p><p className="daily-profile">{copy.daily.personalizedFor(copy.subtypes[subtype].name)}</p></div>
      : <div className="daily-general"><p>{copy.daily.generalNote}</p><button type="button" className="text-button" onClick={onQuiz}>{copy.daily.quizCta}</button></div>}
  </div>
}

function OutfitBoard({ board, copy, subtype, onQuiz }: { board: OutfitBoardModel; copy: LocaleCopy; subtype?: Subtype; onQuiz: () => void }) {
  // Remounting on a new outfit replays the one-off settle animation; nothing animates continuously.
  const signature = board.pieces.map((piece) => `${piece.key}:${boardFillColor(piece.fill)}`).join('|')
  return <section className="daily-outfit" aria-labelledby="daily-outfit-heading">
    <div className="daily-section-heading"><p className="section-number">{copy.daily.outfitEyebrow}</p><h2 id="daily-outfit-heading">{copy.daily.outfitHeading}</h2></div>
    <ul className="daily-board" aria-label={copy.daily.boardLabel} data-accessory-count={board.accessoryCount} key={signature}>
      {board.pieces.map((piece) => <li
        key={piece.key}
        className={`daily-piece is-${piece.role} ${piece.lucky ? 'is-lucky' : 'is-support'}`}
        style={{ gridArea: boardArea(piece) }}
        data-piece-key={piece.key}
        data-color-kind={piece.fill.kind === 'exact' ? 'palette' : 'semantic'}
        data-fill-kind={piece.fill.kind}
        data-tone={boardFillTone(piece.fill)}
        data-lucky-family={piece.luckyFamily ?? undefined}
      >
        <div className="daily-garment-art"><div className="daily-garment-figure">
          <GarmentArt role={piece.role} color={boardFillColor(piece.fill)} />
          {piece.lucky && <span className="daily-garment-mark" aria-hidden="true">✦</span>}
        </div></div>
        <div className="daily-garment-caption">
          <h3>{copy.daily.pieceLabels[piece.role]}</h3>
          <p className="daily-piece-color">{pieceColorName(piece, copy)}</p>
          {piece.lucky
            ? <p className="daily-lucky-badge"><span aria-hidden="true">✦ </span>{`${copy.daily.luckyBadge}${copy.daily.goalSeparator}${goalLabels(piece.goals, copy)}`}</p>
            : <p className="daily-supporting-label">{piece.support === 'personal-color' ? copy.daily.personalSupport : copy.daily.neutralSupport}</p>}
        </div>
      </li>)}
    </ul>
    <OutfitNotes board={board} copy={copy} subtype={subtype} onQuiz={onQuiz} />
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

  const board = useMemo(() => {
    if (!today) return null
    try {
      const rules = goals.map((goal) => getLuckyColorForDate(today, goal))
      return buildOutfitBoardModel(recommendLuckyGoalsOutfit({ rules, subtype }))
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

  if (!today || !weekday || !board) return <main className="daily-page page-enter"><section className="daily-error content-card" role="alert"><h1>{copy.daily.title}</h1><p>{copy.daily.dateError}</p></section></main>

  return <main className="daily-page page-enter" data-daily-mode={board.mode}>
    <header className="daily-hero">
      <p className="eyebrow daily-weekday">{copy.daily.today} · {copy.daily.weekdays[weekday]}</p>
      <h1>{copy.daily.title}</h1>
    </header>
    <div className="daily-layout">
      <div className="daily-intro">
        <section className="daily-goals" aria-labelledby="daily-goal-heading">
          <div className="daily-goals-head"><h2 id="daily-goal-heading">{copy.daily.goalPrompt}</h2><p className="daily-goal-limit">{copy.daily.goalLimit}</p></div>
          <div role="group" aria-label={copy.daily.goalPrompt} className="daily-goal-grid">
            {LUCKY_GOALS.map((item, index) => <button key={item} type="button" aria-pressed={goals.includes(item)} data-daily-goal={item} className={goals.includes(item) ? 'selected' : ''} onClick={() => chooseGoal(item)} onKeyDown={(event) => moveGoal(event, index)}><span className="daily-goal-label">{copy.daily.goals[item]}</span><span className="daily-goal-check" aria-hidden="true">✓</span></button>)}
          </div>
        </section>
        <TodayColors board={board} copy={copy} />
      </div>
      <OutfitBoard board={board} copy={copy} subtype={subtype} onQuiz={onQuiz} />
    </div>
    <p className="daily-framing">{copy.daily.framing}</p>
    <details className="daily-sources"><summary>{copy.daily.aboutHeading}</summary><p>{copy.daily.aboutBody}</p><p>{copy.daily.sourcesLabel}: <a href="https://www.thairath.co.th/horoscope/belief/2897832" target="_blank" rel="noreferrer">Thai Rath</a> {copy.daily.sourceJoin} <a href="https://www.ktc.co.th/article/shopping/fashion/birthday-auspicious-color-timetable" target="_blank" rel="noreferrer">KTC</a>.</p></details>
  </main>
}
