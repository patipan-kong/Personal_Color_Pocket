import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getLuckyColorForDate, luckyWeekdayForDate } from '../domain/luckyColor/luckyColor'
import { LUCKY_GOALS } from '../domain/luckyColor/types'
import type { LuckyColorRule, LuckyGoal, LuckyWeekday } from '../domain/luckyColor/types'
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

const localDayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
// setTimeout is only a hint (sleep, throttling, clock changes), so the clock is re-read at least hourly.
const MAX_CLOCK_WAIT = 60 * 60 * 1000

// The device-local day, as one stable Date per calendar day. One timer re-reads the clock just after
// local midnight; returning to the app re-reads it too. A re-read on the same day changes nothing, so
// focus events never re-render the board, and the selected goals and profile are untouched by a rollover.
function useLocalToday(clock: DailyClock) {
  const clockRef = useRef(clock)
  useEffect(() => { clockRef.current = clock })
  const [today, setToday] = useState<Date | null>(() => readToday(clock))
  const refresh = useCallback(() => {
    const next = readToday(clockRef.current)
    setToday((current) => current && next && localDayKey(current) === localDayKey(next) ? current : next)
    return next
  }, [])
  useEffect(() => {
    let timer: number | undefined
    const schedule = (now: Date | null) => {
      window.clearTimeout(timer)
      // Just after the next local midnight; an unreadable clock is simply read again later.
      const wait = now ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 50 : MAX_CLOCK_WAIT
      timer = window.setTimeout(tick, Math.min(MAX_CLOCK_WAIT, Math.max(1_000, wait)))
    }
    const tick = () => schedule(refresh())
    const onVisibility = () => { if (document.visibilityState !== 'hidden') tick() }
    schedule(readToday(clockRef.current))
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])
  return [today, refresh] as const
}

function validSubtype(result: PersonalColorResult | null): Subtype | undefined {
  return result && subtypeOrder.includes(result.subtype) ? result.subtype : undefined
}

function goalLabels(goals: readonly LuckyGoal[], copy: LocaleCopy): string {
  return goals.map((goal) => copy.daily.goals[goal]).join(copy.daily.goalSeparator)
}

// The exact V1.2 shade name only: the lucky family is already named in today's colours above.
function pieceColorName(piece: OutfitBoardPiece, copy: LocaleCopy): string {
  const { fill } = piece
  if (fill.kind === 'exact') return fill.name[copy.language]
  if (fill.kind === 'family-token') return copy.daily.familyLabels[fill.family]
  return copy.daily.semanticColors[fill.token]
}

// Left/right move one button, up/down one row of the 2 × 2 goal grid.
const GRID_MOVES: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }

// Composition slot for CSS; the DOM keeps the recommendation's reading order whatever the layout.
const boardArea = (piece: OutfitBoardPiece) => piece.role === 'accessory' ? `acc${piece.slot ?? 1}` : piece.role

// A source opens in a new tab, which screen readers are told; the visible text stays the source name.
function SourceLink({ href, name, newTab }: { href: string; name: string; newTab: string }) {
  return <a href={href} target="_blank" rel="noreferrer">{name}<span className="daily-sr-only"> {newTab}</span></a>
}

function TodayColors({ board, copy }: { board: OutfitBoardModel; copy: LocaleCopy }) {
  return <section className="daily-result" aria-labelledby="daily-result-heading">
    <h2 id="daily-result-heading" className="daily-kicker">{copy.daily.resultEyebrow(board.claims.length)}</h2>
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
        data-board-area={boardArea(piece)}
        data-piece-key={piece.key}
        data-color-kind={piece.fill.kind === 'exact' ? 'palette' : 'semantic'}
        data-fill-kind={piece.fill.kind}
        data-tone={boardFillTone(piece.fill)}
        data-lucky-family={piece.luckyFamily ?? undefined}
      >
        {piece.lucky && <span className="daily-garment-glow" aria-hidden="true" />}
        <div className="daily-garment-figure">
          <GarmentArt role={piece.role} color={boardFillColor(piece.fill)} />
          {piece.lucky && <span className="daily-garment-mark" aria-hidden="true">✦</span>}
        </div>
        <div className="daily-garment-caption">
          <h3>{copy.daily.pieceLabels[piece.role]}</h3>
          <p className="daily-piece-color">{pieceColorName(piece, copy)}</p>
          {piece.lucky
            ? <p className="daily-lucky-badge"><span className="daily-lucky-glyph" aria-hidden="true">✦ </span>{`${copy.daily.luckyBadge}${copy.daily.goalSeparator.replace(/^ /, ' ')}${goalLabels(piece.goals, copy)}`}</p>
            : <p className="daily-supporting-label">{piece.support === 'personal-color' ? copy.daily.personalSupport : copy.daily.neutralSupport}</p>}
        </div>
      </li>)}
    </ul>
    <OutfitNotes board={board} copy={copy} subtype={subtype} onQuiz={onQuiz} />
  </section>
}

type DailyState =
  | { readonly status: 'ready'; readonly weekday: LuckyWeekday; readonly board: OutfitBoardModel }
  | { readonly status: 'date-error' | 'result-error' }

// One resolved recommendation feeds the summary, the board and the notes. A date the domain rejects
// is reported as a date problem; a recommendation the board contract rejects is reported as such.
// Neither is ever replaced by a guessed weekday or a fabricated outfit.
function resolveDaily(today: Date | null, goals: readonly LuckyGoal[], subtype: Subtype | undefined): DailyState {
  let weekday: LuckyWeekday
  let rules: LuckyColorRule[]
  try {
    if (!today) return { status: 'date-error' }
    weekday = luckyWeekdayForDate(today)
    rules = goals.map((goal) => getLuckyColorForDate(today, goal))
  } catch { return { status: 'date-error' } }
  try {
    return { status: 'ready', weekday, board: buildOutfitBoardModel(recommendLuckyGoalsOutfit({ rules, subtype })) }
  } catch (error) {
    if (import.meta.env.DEV) console.error(error)
    return { status: 'result-error' }
  }
}

export function DailyView({ copy, result, onQuiz, clock = deviceClock }: { copy: LocaleCopy; result: PersonalColorResult | null; onQuiz: () => void; clock?: DailyClock }) {
  const [goals, setGoals] = useState<LuckyGoal[]>(loadDailyLuckyColorGoals)
  const [today, refreshToday] = useLocalToday(clock)
  const subtype = validSubtype(result)
  const daily = useMemo(() => resolveDaily(today, goals, subtype), [today, goals, subtype])
  // Best effort: a blocked or full storage leaves the in-memory selection working for this session.
  useEffect(() => { saveDailyLuckyColorGoals(goals) }, [goals])
  const chooseGoal = (next: LuckyGoal) => {
    setGoals((current) => {
      if (current.includes(next)) return current.length === 1 ? current : current.filter((goal) => goal !== next)
      if (current.length < 2) return [...current, next]
      return [current[1], next]
    })
  }
  const moveGoal = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    // Arrows follow the visible 2 × 2 grid; Tab still visits every button in order.
    const change = GRID_MOVES[event.key]
    if (!change) return
    event.preventDefault()
    const next = LUCKY_GOALS[(index + change + LUCKY_GOALS.length) % LUCKY_GOALS.length]
    document.querySelector<HTMLButtonElement>(`[data-daily-goal="${next}"]`)?.focus()
  }

  if (daily.status !== 'ready') return <main className="daily-page page-enter">
    <section className="daily-error content-card" role="alert">
      <h1>{copy.daily.title}</h1>
      <p>{daily.status === 'date-error' ? copy.daily.dateError : copy.daily.resultError}</p>
      {daily.status === 'date-error' && <button type="button" className="text-button" onClick={refreshToday}>{copy.daily.retry}</button>}
    </section>
  </main>
  const { board, weekday } = daily

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
    <details className="daily-sources"><summary>{copy.daily.aboutHeading}</summary><p>{copy.daily.aboutBody}</p><p>{copy.daily.sourcesLabel}: <SourceLink href="https://www.thairath.co.th/horoscope/belief/2897832" name={copy.daily.sourceNames.thaiRath} newTab={copy.daily.newTab} /> {copy.daily.sourceJoin} <SourceLink href="https://www.ktc.co.th/article/shopping/fashion/birthday-auspicious-color-timetable" name={copy.daily.sourceNames.ktc} newTab={copy.daily.newTab} />{copy.daily.sourceEnd}</p></details>
  </main>
}
