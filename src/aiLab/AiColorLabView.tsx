import { useEffect, useId, useMemo, useReducer, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { AI_CANDIDATE_IDS } from '../domain/aiColorLab/contract'
import type { AiCandidateId, AiColorSubtypeContext } from '../domain/aiColorLab/contract'
import { displayToImage } from '../domain/photoColor/coordinates'
import type { DisplayTap } from '../domain/photoColor/types'
import { getCopy } from '../i18n'
import { PhotoSurface } from '../photoChecker/PhotoSurface'
import type { SurfaceKeyIntent } from '../photoChecker/PhotoSurface'
import { imageCenter, nudgePoint } from '../photoChecker/photoPanelState'
import { loadState } from '../services/persistence'
import { openPhoto, PhotoImageError } from '../services/photoImage'
import './aiLab.css'
import { computeDeterministicBaseline } from './aiLabDeterministic'
import { AI_LAB_PREPARING_NOTICE_DELAY_MS, aiLabPhotoReducer, initialAiLabPhotoState } from './aiLabPhotoState'
import { aiLabBakeoffReducer, EMPTY_REVIEW, initialBakeoffState, reviewKey } from './aiLabState'
import type { PoReview } from './aiLabState'
import { callAiColorCandidate } from './aiColorLabApi'
import { callPaletteSelection } from './aiPaletteApi'
import { buildAiColorRequest } from './buildRequest'
import { buildPaletteSelectionRequest } from './buildPaletteRequest'
import { ColorDimensionTable } from './ColorDimensionTable'
import { DeterministicBaselineCard } from './DeterministicBaselineCard'
import { downloadPaletteValidationExport } from './exportPaletteValidation'
import { FlashLiteComparison } from './FlashLiteComparison'
import { EMPTY_PALETTE_REVIEW, initialPaletteSelectionState, paletteSelectionReducer } from './paletteSelectionState'
import { PaletteSelectionCard } from './PaletteSelectionCard'
import { ProviderCard } from './ProviderCard'
import { SessionSummary } from './SessionSummary'

// V2.0 AI Color Lab (Slice 0; extended Slice 0.2 into a Model Bake-off, plan §7). A standalone,
// developer-only screen -- reached only via ?debug=ai in a dev build (see App.tsx), never part
// of normal navigation (plan §22-23). It reuses the existing local photo pipeline and
// deterministic engine unchanged, and talks to the four bake-off candidates only through
// /api/ai-color/<candidateId> (aiColorLabApi.ts) -- it never imports a provider SDK or sees a
// credential (plan §29).
export function AiColorLabView() {
  const [photoState, dispatchPhoto] = useReducer(aiLabPhotoReducer, initialAiLabPhotoState)
  const [bakeoff, dispatchBakeoff] = useReducer(aiLabBakeoffReducer, initialBakeoffState)
  const [paletteSelection, dispatchPalette] = useReducer(paletteSelectionReducer, initialPaletteSelectionState)
  const latestRequest = useRef(0)
  const photoController = useRef<AbortController | null>(null)
  const slowTimer = useRef<number | undefined>(undefined)
  const runCounter = useRef(0)
  const candidateControllers = useRef<Partial<Record<AiCandidateId, AbortController>>>({})
  const paletteController = useRef<AbortController | null>(null)
  const hintId = useId()

  // Read-only reuse of the saved profile, if any (plan §27). Never written to, never faked.
  const savedResult = useMemo(() => loadState().result, [])
  const subtypeContext = useMemo<AiColorSubtypeContext | null>(() => {
    if (!savedResult) return null
    const label = getCopy('en').subtypes[savedResult.subtype].name
    return { subtype: savedResult.subtype, season: savedResult.season, label }
  }, [savedResult])

  const cancelPendingPhoto = () => {
    photoController.current?.abort()
    photoController.current = null
    window.clearTimeout(slowTimer.current)
  }
  const abortAllCandidates = () => {
    for (const candidateId of Object.keys(candidateControllers.current) as AiCandidateId[]) candidateControllers.current[candidateId]?.abort()
    candidateControllers.current = {}
  }
  // A new photo or a new sample point starts a genuinely new analysis: cancel whatever is
  // in flight and clear every card back to idle, so no stale card can survive into it
  // (plan §22 I). The session's accumulated bake-off history/reviews are untouched by this --
  // they intentionally span every photo run in the session (plan §11, §19). Slice 0.5C's palette-
  // selection card resets on the same trigger, for the same reason (plan §J).
  const startFreshAnalysis = () => {
    abortAllCandidates()
    dispatchBakeoff({ type: 'reset' })
    paletteController.current?.abort()
    paletteController.current = null
    dispatchPalette({ type: 'reset' })
  }

  useEffect(() => () => { cancelPendingPhoto(); abortAllCandidates(); paletteController.current?.abort(); latestRequest.current += 1 }, [])

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    cancelPendingPhoto()
    startFreshAnalysis()
    const request = ++latestRequest.current
    const next = new AbortController()
    photoController.current = next
    dispatchPhoto({ type: 'select', request })
    slowTimer.current = window.setTimeout(() => dispatchPhoto({ type: 'slow', request }), AI_LAB_PREPARING_NOTICE_DELAY_MS)
    openPhoto(file, { signal: next.signal }).then(
      (image) => { if (request === latestRequest.current) dispatchPhoto({ type: 'prepared', request, image }) },
      (error: unknown) => {
        if (request !== latestRequest.current) return
        dispatchPhoto({ type: 'failed', request, code: error instanceof PhotoImageError ? error.code : 'decode-failed' })
      },
    ).finally(() => {
      if (request !== latestRequest.current) return
      window.clearTimeout(slowTimer.current)
      photoController.current = null
    })
  }

  const tap = (displayTap: DisplayTap) => {
    if (photoState.status !== 'ready') return
    const mapped = displayToImage(displayTap.point, displayTap.imageRect, photoState.image)
    if (mapped.kind === 'outside-displayed-image') return
    startFreshAnalysis()
    dispatchPhoto({ type: 'point', request: photoState.request, point: mapped.point })
  }

  const key = (intent: SurfaceKeyIntent) => {
    if (photoState.status !== 'ready') return
    const { image, request, point } = photoState
    const next = intent.type === 'check'
      ? (point ?? imageCenter(image))
      : (point ? nudgePoint(point, intent.key, intent.big, image) : imageCenter(image))
    startFreshAnalysis()
    dispatchPhoto({ type: 'point', request, point: next })
  }

  const image = photoState.status === 'ready' ? photoState.image : null
  const point = photoState.status === 'ready' ? photoState.point : null
  const baseline = useMemo(
    () => (image && point ? computeDeterministicBaseline(image, point, subtypeContext?.subtype ?? null) : null),
    [image, point, subtypeContext],
  )
  const request = useMemo(
    () => (image && baseline ? buildAiColorRequest(image, baseline, subtypeContext) : null),
    [image, baseline, subtypeContext],
  )

  const runCandidate = (candidateId: AiCandidateId) => {
    if (!request) return
    candidateControllers.current[candidateId]?.abort()
    const controller = new AbortController()
    candidateControllers.current[candidateId] = controller
    const id = ++runCounter.current
    dispatchBakeoff({ type: 'started', candidateId, runId: id })
    void callAiColorCandidate(candidateId, request, controller.signal).then((outcome) => {
      dispatchBakeoff({ type: 'completed', candidateId, runId: id, outcome })
    })
  }
  // Independent, parallel execution for every candidate, including both Gemini candidates that
  // share one key/account -- never serialized just because two candidates share a provider (plan
  // §21: "Do not serialize all providers merely because Gemini has two models"). Each adapter
  // call is its own isolated request; a 429 on one candidate is reported on that one card only
  // (classifyHttpStatus -> 'rate-limited', shown with a manual Retry -- plan §21: "Do not add
  // automatic repeated retries that can burn credits").
  const runAll = () => { for (const candidateId of AI_CANDIDATE_IDS) runCandidate(candidateId) }

  // V2.0 Slice 0.5C (plan §J): the canonical-palette-selection task, entirely independent of the
  // four free-form bake-off candidates above -- its own request shape (buildPaletteRequest.ts,
  // Strategy A: no deterministic sample sent), its own endpoint (aiPaletteApi.ts), its own runId
  // space so a stale completion can never be confused with a bake-off card's.
  const runPaletteSelection = () => {
    if (!image || !point || !baseline || baseline.sample.kind !== 'color' || !subtypeContext) return
    paletteController.current?.abort()
    const controller = new AbortController()
    paletteController.current = controller
    const id = ++runCounter.current
    dispatchPalette({ type: 'started', runId: id })
    const paletteRequest = buildPaletteSelectionRequest(image, point, baseline.radius, subtypeContext.subtype)
    void callPaletteSelection(paletteRequest, controller.signal).then((outcome) => {
      dispatchPalette({ type: 'completed', runId: id, outcome })
    })
  }

  return <main className="ai-lab-page">
    <p className="ai-lab-badge">Dev only — AI Color Lab · Model Bake-off</p>
    <h1>AI Color Lab</h1>
    <p>Compares the deterministic Photo Color Checker against four AI vision model candidates (three providers — Gemini exposes two: Flash and Flash-Lite) on the same photo and sample point. Not a production feature.</p>
    <p className="ai-lab-privacy">Unlike the Photo Color Checker (which stays entirely on this device), running AI analysis here sends the selected photo to the AI candidate(s) you choose to run, over the network, for this comparison only. Nothing is uploaded until you press Run.</p>

    <div className="ai-lab-picker-row">
      <label className="ai-lab-picker-label">
        <input type="file" accept="image/*" onChange={choose} />
        <span>{photoState.status === 'ready' ? 'Change photo' : 'Choose photo'}</span>
      </label>
      {subtypeContext ? <span className="ai-lab-hint">Saved profile: {subtypeContext.label}</span> : <span className="ai-lab-hint">No saved profile — suitability will be uncertain.</span>}
    </div>

    {photoState.status === 'preparing' && photoState.slow && <p role="status">Preparing photo…</p>}
    {photoState.status === 'error' && <p className="ai-lab-error-message" role="alert">Could not open photo ({photoState.code}).</p>}

    {photoState.status === 'ready' && <div className="ai-lab-layout">
      <div>
        <div className="ai-lab-stage-wrap">
          <PhotoSurface
            key={photoState.request}
            image={photoState.image}
            marker={photoState.point}
            label="Photo sample area"
            describedBy={hintId}
            onTap={tap}
            onKey={key}
            onPaintFailed={() => dispatchPhoto({ type: 'failed', request: photoState.request, code: 'canvas-failed' })}
          />
        </div>
        <p id={hintId} className="ai-lab-hint">Tap the photo, or focus it and use arrow keys then Enter, to choose a sample point.</p>
        <DeterministicBaselineCard baseline={baseline} subtypeLabel={subtypeContext?.label ?? null} />
      </div>
      <div>
        <div className="ai-lab-run-row">
          <button type="button" className="primary-button compact" onClick={runAll} disabled={!request}>Run all candidates</button>
          {!request && <span className="ai-lab-hint">Select a sample point first.</span>}
        </div>
        {request && <details className="ai-lab-input-preview">
          <summary>AI input preview</summary>
          <p className="ai-lab-hint">The exact image sent to every candidate, target marker included. Byte-identical for Gemini Flash and Gemini Flash-Lite (plan §5).</p>
          <img src={request.imageDataUrl} alt="AI input preview: photo with the target marker as sent to every candidate" />
        </details>}
        {bakeoff.cards['gemini-flash'].status !== 'idle' && <ColorDimensionTable cards={bakeoff.cards} />}
        <div className="ai-lab-cards">
          {AI_CANDIDATE_IDS.map((candidateId) => {
            const state = bakeoff.cards[candidateId]
            const review = state.status === 'success' ? (bakeoff.reviews[reviewKey(candidateId, state.runId)] ?? EMPTY_REVIEW) : EMPTY_REVIEW
            const onReviewChange = (next: PoReview) => {
              if (state.status !== 'success') return
              dispatchBakeoff({ type: 'review', candidateId, runId: state.runId, review: next })
            }
            return <ProviderCard key={candidateId} candidateId={candidateId} state={state} review={review} onRetry={() => runCandidate(candidateId)} onReviewChange={onReviewChange} />
          })}
        </div>
        {bakeoff.cards['gemini-flash'].status !== 'idle' && <FlashLiteComparison cards={bakeoff.cards} reviews={bakeoff.reviews} />}

        <PaletteSelectionCard
          state={paletteSelection.card}
          subtype={subtypeContext?.subtype ?? null}
          onRun={runPaletteSelection}
          onRetry={runPaletteSelection}
          review={paletteSelection.card.status === 'success' ? (paletteSelection.reviews[paletteSelection.card.runId] ?? EMPTY_PALETTE_REVIEW) : EMPTY_PALETTE_REVIEW}
          onReviewChange={(next) => {
            if (paletteSelection.card.status !== 'success') return
            dispatchPalette({ type: 'review', runId: paletteSelection.card.runId, review: next })
          }}
        />
        {paletteSelection.history.length > 0 && (
          <button
            type="button"
            className="compact"
            onClick={() => downloadPaletteValidationExport(paletteSelection.history, paletteSelection.reviews, subtypeContext?.subtype ?? null, baseline)}
          >
            Export palette-selection validation ({paletteSelection.history.length} run{paletteSelection.history.length === 1 ? '' : 's'})
          </button>
        )}
      </div>
    </div>}

    <SessionSummary history={bakeoff.history} reviews={bakeoff.reviews} />
  </main>
}
