import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { getLuckyColorForDate, luckyWeekdayForDate } from '../domain/luckyColor/luckyColor'
import { LUCKY_GOALS } from '../domain/luckyColor/types'
import type { LuckyColorRule, LuckyGoal, LuckyWeekday } from '../domain/luckyColor/types'
import { recommendLuckyGoalsOutfit } from '../domain/luckyColor/outfit'
import { subtypeOrder } from '../domain/personalColor/seasons'
import type { PersonalColorResult, Subtype } from '../domain/personalColor/types'
import { recommendOwnedOutfitFallback } from '../domain/todayOutfitProduction/fallback'
import { buildOwnedOutfitPresentationFacts } from '../domain/todayOutfitProduction/presentation'
import { buildOwnedOutfitRequest, fingerprintOwnedOutfitRequest } from '../domain/todayOutfitProduction/request'
import type { OwnedOutfitRequest, OwnedRecommendationResult } from '../domain/todayOutfitProduction/contract'
import {
  OUTFIT_SOURCES,
  TODAY_OCCASIONS,
  chooseOutfitSource,
  createTodayOutfitInputState,
  getWardrobeCoverage,
  syncAutomaticOutfitSource,
} from '../domain/todayOutfitProduction/todayInputs'
import type { OutfitSource, TodayOccasion, TodayOutfitInputState, WardrobeCoverage } from '../domain/todayOutfitProduction/todayInputs'
import { getRecordWardrobeSlot, getWardrobeDisplayName } from '../domain/wardrobe/wardrobe'
import type { WardrobeRecordV1 } from '../domain/wardrobe/wardrobe'
import type { LocaleCopy } from '../i18n'
import { loadDailyLuckyColorGoals, saveDailyLuckyColorGoals } from '../services/dailyLuckyColorGoal'
import { loadWardrobe } from '../services/wardrobePersistence'
import { requestOwnedOutfitRecommendation } from '../services/ownedOutfitRecommendation'
import { GarmentArt } from './GarmentArt'
import { boardFillColor, boardFillTone, buildOutfitBoardModel } from './outfitBoard'
import type { OutfitBoardModel, OutfitBoardPiece } from './outfitBoard'
import { CanonicalColorLabel } from '../CanonicalColorLabel'

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

function PieceColorName({ piece, copy }: { piece: OutfitBoardPiece; copy: LocaleCopy }) {
  const { fill } = piece
  if (fill.kind === 'exact') return <CanonicalColorLabel color={{ name: fill.paletteName, hex: fill.hex }} language={copy.language} mode="compact" />
  return <>{pieceColorName(piece, copy)}</>
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
              ? <p className="daily-shade"><span>{copy.daily.personalizedShade}</span> <CanonicalColorLabel color={{ name: exact.paletteName, hex: exact.hex }} language={copy.language} mode="compact" /></p>
              : <p className="daily-shade is-broad">{copy.daily.familyLabel}</p>}
          </div>
        </article>
      })}
    </div>
  </section>
}

function wardrobeReadiness(copy: LocaleCopy, coverage: WardrobeCoverage): string {
  if (coverage.itemCount === 0) return copy.daily.sourceWardrobeEmpty
  if (coverage.ready) return copy.daily.sourceWardrobeCount(coverage.itemCount)
  if (coverage.missing.length === 1 && coverage.missing[0] === 'shoes') return copy.daily.sourceWardrobeMissingShoes
  return copy.daily.sourceWardrobeIncomplete
}

function TodayInputs({
  copy,
  goals,
  inputs,
  coverage,
  onGoal,
  onGoalKeyDown,
  onOccasion,
  onSource,
  onWardrobe,
  focusWardrobeAction,
  canBuild,
  buildStatus,
  buildHint,
  onBuild,
}: {
  copy: LocaleCopy
  goals: readonly LuckyGoal[]
  inputs: TodayOutfitInputState
  coverage: WardrobeCoverage
  onGoal: (goal: LuckyGoal) => void
  onGoalKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => void
  onOccasion: (occasion: TodayOccasion) => void
  onSource: (source: OutfitSource) => void
  onWardrobe?: () => void
  focusWardrobeAction?: boolean
  canBuild: boolean
  buildStatus: 'idle' | 'loading'
  buildHint: string
  onBuild: () => void
}) {
  return <div className="today-inputs">
    <section className="daily-goals today-input-section" aria-labelledby="daily-goal-heading">
      <div className="daily-goals-head"><div className="today-input-title"><span aria-hidden="true">1</span><h2 id="daily-goal-heading">{copy.daily.goalPrompt}</h2></div><p id="daily-goal-limit" className="daily-goal-limit">{copy.daily.goalLimit}</p></div>
      <div role="group" aria-label={copy.daily.goalPrompt} aria-describedby="daily-goal-limit" className="daily-goal-grid">
        {LUCKY_GOALS.map((item, index) => <button key={item} type="button" aria-pressed={goals.includes(item)} data-daily-goal={item} className={goals.includes(item) ? 'selected' : ''} onClick={() => onGoal(item)} onKeyDown={(event) => onGoalKeyDown(event, index)}><span className="daily-goal-label">{copy.daily.goals[item]}</span><span className="daily-goal-check" aria-hidden="true">✓</span></button>)}
      </div>
    </section>

    <fieldset className="today-input-section today-occasion">
      <legend><span aria-hidden="true">2</span>{copy.daily.occasionPrompt}</legend>
      <div className="today-occasion-options">
        {TODAY_OCCASIONS.map((occasion) => <label key={occasion} className={inputs.occasion === occasion ? 'selected' : ''}>
          <input type="radio" name="today-occasion" value={occasion} checked={inputs.occasion === occasion} onChange={() => onOccasion(occasion)} />
          <span>{copy.daily.occasions[occasion]}</span>
        </label>)}
      </div>
    </fieldset>

    <fieldset className="today-input-section today-source">
      <legend><span aria-hidden="true">3</span>{copy.daily.sourcePrompt}</legend>
      <div className="today-source-options">
        {OUTFIT_SOURCES.map((source) => {
          const description = source === 'wardrobe' ? wardrobeReadiness(copy, coverage) : copy.daily.sourceInspirationBody
          return <label key={source} className={inputs.source === source ? 'selected' : ''}>
            <input type="radio" name="today-source" value={source} checked={inputs.source === source} onChange={() => onSource(source)} />
            <span className="today-source-copy"><strong>{copy.daily.sourceLabels[source]}</strong><small>{description}</small></span>
            <span className="today-radio-mark" aria-hidden="true" />
          </label>
        })}
      </div>
      {onWardrobe && <button type="button" className="text-button today-manage-wardrobe" data-manage-wardrobe onClick={onWardrobe} autoFocus={focusWardrobeAction}>{copy.daily.manageWardrobe} <span aria-hidden="true">→</span></button>}
    </fieldset>
    <section className="today-build-action" aria-labelledby="today-build-heading">
      <div><p className="today-build-step" aria-hidden="true">4</p><div><h2 id="today-build-heading">{copy.daily.buildHeading}</h2><p>{buildHint}</p></div></div>
      <button type="button" className="primary-button compact" disabled={!canBuild || buildStatus === 'loading'} onClick={onBuild}>{buildStatus === 'loading' ? copy.daily.buildingLook : copy.daily.buildLook}</button>
    </section>
  </div>
}

function EmptyLuckyResult({ copy }: { copy: LocaleCopy }) {
  return <section className="daily-empty-result" aria-labelledby="daily-empty-title">
    <span aria-hidden="true">✦</span>
    <div><p className="daily-kicker">{copy.daily.resultEyebrow(0)}</p><h2 id="daily-empty-title">{copy.daily.emptyLuckyTitle}</h2><p>{copy.daily.emptyLuckyBody}</p></div>
  </section>
}

function selectionIds(result: OwnedRecommendationResult): readonly string[] {
  const selection = result.recommendation.selection
  return selection.kind === 'separates'
    ? [selection.topId, selection.bottomId, ...(selection.outerwearId ? [selection.outerwearId] : []), selection.shoesId]
    : [selection.onePieceId, ...(selection.outerwearId ? [selection.outerwearId] : []), selection.shoesId]
}

function OwnedRecommendation({ copy, request, result, wardrobe }: { copy: LocaleCopy; request: OwnedOutfitRequest; result: OwnedRecommendationResult; wardrobe: readonly WardrobeRecordV1[] }) {
  const selected = selectionIds(result).map((id) => wardrobe.find((item) => item.id === id)).filter((item): item is WardrobeRecordV1 => Boolean(item))
  const presentation = buildOwnedOutfitPresentationFacts(request, result.recommendation)
  const personalColorName = presentation.personalColor
    ? copy.subtypes[presentation.personalColor.subtype].secondaryName || copy.subtypes[presentation.personalColor.subtype].name
    : null
  const luckyFamilies = presentation.luckyColor
    ? (presentation.luckyColor.matchedFamilies.length ? presentation.luckyColor.matchedFamilies : presentation.luckyColor.requestedFamilies).map((family) => copy.daily.familyLabels[family])
    : []
  return <section className="owned-outfit-result" aria-labelledby="owned-outfit-heading">
    <div className="owned-outfit-heading"><div><p className="eyebrow">{copy.daily.recommendationEyebrow}</p><h2 id="owned-outfit-heading">{copy.daily.recommendationHeading}</h2></div><span>{result.source === 'ai' ? copy.daily.recommendationSourceAi : copy.daily.recommendationSourceFallback}</span></div>
    {result.source === 'deterministic-fallback' && <p className="owned-outfit-fallback-note">{copy.daily.fallbackNote}</p>}
    <ul className="owned-outfit-pieces" aria-label={copy.daily.recommendationPieces}>
      {selected.map((item) => <li key={item.id}><i style={{ backgroundColor: item.color.hex }} aria-hidden="true" /><div><small>{copy.wardrobe.slots[getRecordWardrobeSlot(item)]}</small><strong>{getWardrobeDisplayName(item, copy.language)}</strong><span>{item.color.hex}</span></div></li>)}
    </ul>
    <div className="owned-outfit-reasons">
      <p><strong>{copy.daily.occasionReason}</strong>{copy.daily.occasionExplanations[presentation.occasion]}</p>
      {presentation.personalColor && personalColorName && <p><strong>{copy.daily.personalColorReason}</strong>{copy.daily.personalColorExplanations[presentation.personalColor.emphasis](personalColorName)}</p>}
      {presentation.luckyColor && <p><strong>{copy.daily.luckyReason}</strong>{copy.daily.luckyColorExplanation(luckyFamilies, presentation.luckyColor.matchedFamilies.length > 0)}</p>}
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
          <p className="daily-piece-color"><PieceColorName piece={piece} copy={copy} /></p>
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
  | { readonly status: 'empty'; readonly weekday: LuckyWeekday }
  | { readonly status: 'date-error' }
  | { readonly status: 'result-error' }

// One resolved recommendation feeds the summary, the board and the notes. A date the domain rejects
// is reported as a date problem; a recommendation the board contract rejects is reported as such.
// Neither is ever replaced by a guessed weekday or a fabricated outfit.
function resolveDaily(today: Date | null, goals: readonly LuckyGoal[], subtype: Subtype | undefined): DailyState {
  let weekday: LuckyWeekday
  let rules: LuckyColorRule[]
  try {
    if (!today) return { status: 'date-error' }
    weekday = luckyWeekdayForDate(today)
    if (goals.length === 0) return { status: 'empty', weekday }
    rules = goals.map((goal) => getLuckyColorForDate(today, goal))
  } catch { return { status: 'date-error' } }
  try {
    return { status: 'ready', weekday, board: buildOutfitBoardModel(recommendLuckyGoalsOutfit({ rules, subtype })) }
  } catch (error) {
    if (import.meta.env.DEV) console.error(error)
    return { status: 'result-error' }
  }
}

export function DailyView({ copy, result, onQuiz, onWardrobe, inputState, onInputStateChange, focusWardrobeAction, clock = deviceClock }: {
  copy: LocaleCopy
  result: PersonalColorResult | null
  onQuiz: () => void
  onWardrobe?: () => void
  inputState?: TodayOutfitInputState
  onInputStateChange?: Dispatch<SetStateAction<TodayOutfitInputState>>
  focusWardrobeAction?: boolean
  clock?: DailyClock
}) {
  const [goals, setGoals] = useState<LuckyGoal[]>(loadDailyLuckyColorGoals)
  const [today, refreshToday] = useLocalToday(clock)
  const wardrobe = useMemo(() => loadWardrobe(), [])
  const coverage = useMemo(() => getWardrobeCoverage(wardrobe.items), [wardrobe.items])
  const [localInputState, setLocalInputState] = useState<TodayOutfitInputState>(() => createTodayOutfitInputState(coverage))
  const inputs = inputState ?? localInputState
  const setInputs = onInputStateChange ?? setLocalInputState
  const subtype = validSubtype(result)
  const daily = useMemo(() => resolveDaily(today, goals, subtype), [today, goals, subtype])
  const recommendationRequest = useMemo<OwnedOutfitRequest | null>(() => {
    if (!today || inputs.source !== 'wardrobe' || !coverage.ready) return null
    try { return buildOwnedOutfitRequest({ date: today, goals, language: copy.language, subtype, occasion: inputs.occasion, wardrobe: wardrobe.items }) }
    catch { return null }
  }, [copy.language, coverage.ready, goals, inputs.occasion, inputs.source, subtype, today, wardrobe.items])
  const requestFingerprint = recommendationRequest ? fingerprintOwnedOutfitRequest(recommendationRequest) : null
  const [recommendationState, setRecommendationState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'result'; fingerprint: string; result: OwnedRecommendationResult }
    | { status: 'error' }
  >({ status: 'idle' })
  const submitting = useRef(false)
  useEffect(() => { setInputs((current) => syncAutomaticOutfitSource(current, coverage)) }, [coverage.ready, setInputs])
  useEffect(() => {
    setRecommendationState((current) => current.status === 'result' && current.fingerprint !== requestFingerprint ? { status: 'idle' } : current)
  }, [requestFingerprint])
  // Best effort: a blocked or full storage leaves the in-memory selection working for this session.
  useEffect(() => { saveDailyLuckyColorGoals(goals) }, [goals])
  const chooseGoal = (next: LuckyGoal) => {
    setGoals((current) => {
      if (current.includes(next)) return current.filter((goal) => goal !== next)
      if (current.length < 2) return [...current, next]
      return current
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
  const buildLook = async () => {
    if (submitting.current || !recommendationRequest || !requestFingerprint || inputs.source !== 'wardrobe' || !coverage.ready) return
    submitting.current = true
    setRecommendationState({ status: 'loading' })
    try {
      const provider = await requestOwnedOutfitRecommendation(recommendationRequest)
      if (provider.ok) setRecommendationState({ status: 'result', fingerprint: requestFingerprint, result: { source: 'ai', recommendation: provider.result } })
      else {
        const fallback = recommendOwnedOutfitFallback(recommendationRequest)
        setRecommendationState(fallback
          ? { status: 'result', fingerprint: requestFingerprint, result: { source: 'deterministic-fallback', recommendation: fallback } }
          : { status: 'error' })
      }
    } catch {
      const fallback = recommendOwnedOutfitFallback(recommendationRequest)
      setRecommendationState(fallback
        ? { status: 'result', fingerprint: requestFingerprint, result: { source: 'deterministic-fallback', recommendation: fallback } }
        : { status: 'error' })
    } finally { submitting.current = false }
  }

  if (daily.status === 'date-error' || daily.status === 'result-error') return <main className="daily-page page-enter">
    <section className="daily-error content-card" role="alert">
      <h1>{copy.daily.title}</h1>
      <p>{daily.status === 'date-error' ? copy.daily.dateError : copy.daily.resultError}</p>
      {daily.status === 'date-error' && <button type="button" className="text-button" onClick={refreshToday}>{copy.daily.retry}</button>}
    </section>
  </main>
  const weekday = daily.weekday
  const canBuild = inputs.source === 'wardrobe' && coverage.ready && Boolean(recommendationRequest)
  const buildHint = inputs.source === 'inspiration'
    ? copy.daily.inspirationComingSoon
    : coverage.ready
      ? copy.daily.readyToBuild
      : coverage.missing.length === 1 && coverage.missing[0] === 'shoes'
        ? copy.daily.buildMissingShoes
        : copy.daily.buildIncomplete

  return <main className="daily-page page-enter" data-daily-mode={daily.status === 'ready' ? daily.board.mode : 'neutral'}>
    <header className="daily-hero">
      <p className="eyebrow daily-weekday">{copy.daily.today} · {copy.daily.weekdays[weekday]}</p>
      <h1>{copy.daily.title}</h1>
    </header>
    <TodayInputs copy={copy} goals={goals} inputs={inputs} coverage={coverage} onGoal={chooseGoal} onGoalKeyDown={moveGoal} onOccasion={(occasion) => setInputs((current) => ({ ...current, occasion }))} onSource={(source) => setInputs((current) => chooseOutfitSource(current, source))} onWardrobe={onWardrobe} focusWardrobeAction={focusWardrobeAction} canBuild={canBuild} buildStatus={recommendationState.status === 'loading' ? 'loading' : 'idle'} buildHint={buildHint} onBuild={() => void buildLook()} />
    {recommendationState.status === 'error' && <section className="owned-outfit-error" role="alert"><p>{copy.daily.totalFailure}</p><button type="button" className="primary-button compact" onClick={() => void buildLook()}>{copy.daily.retryRecommendation}</button></section>}
    {recommendationState.status === 'result' && recommendationRequest
      ? <><OwnedRecommendation copy={copy} request={recommendationRequest} result={recommendationState.result} wardrobe={wardrobe.items} />{daily.status === 'ready' && <div className="daily-lucky-support"><TodayColors board={daily.board} copy={copy} /></div>}</>
      : daily.status === 'empty'
        ? <EmptyLuckyResult copy={copy} />
        : <div className="daily-layout"><div className="daily-intro"><TodayColors board={daily.board} copy={copy} /></div><OutfitBoard board={daily.board} copy={copy} subtype={subtype} onQuiz={onQuiz} /></div>}
    <p className="daily-framing">{copy.daily.framing}</p>
    <details className="daily-sources"><summary>{copy.daily.aboutHeading}</summary><p>{copy.daily.aboutBody}</p><p>{copy.daily.sourcesLabel}: <SourceLink href="https://www.thairath.co.th/horoscope/belief/2897832" name={copy.daily.sourceNames.thaiRath} newTab={copy.daily.newTab} /> {copy.daily.sourceJoin} <SourceLink href="https://www.ktc.co.th/article/shopping/fashion/birthday-auspicious-color-timetable" name={copy.daily.sourceNames.ktc} newTab={copy.daily.newTab} />{copy.daily.sourceEnd}</p></details>
  </main>
}
