import { useEffect, useId, useReducer, useRef } from 'react'
import type { ChangeEvent } from 'react'
// V2.0 Slice 0.5D (plan §X): reuses AI Lab's own validated palette-selection adapter and request
// builder unchanged -- "the same validated production contract/adapter", not a duplicate. The
// `aiLab` folder name is historical (Slice 0.5C); this call itself is fully explicit-invocation
// only (never triggered automatically) and is exercised from both AI Lab and here.
import { buildPaletteSelectionRequest } from '../aiLab/buildPaletteRequest'
import { callPaletteSelection } from '../aiLab/aiPaletteApi'
import type { Subtype } from '../domain/personalColor/types'
import { inspectPhotoPoint, inspectPhotoTap } from '../domain/photoColor/inspect'
import { resolvePaletteSelectionResult } from '../domain/photoColor/aiPaletteFallback'
import type { DisplayTap } from '../domain/photoColor/types'
import type { Language, LocaleCopy } from '../i18n'
import { openPhoto, PhotoImageError } from '../services/photoImage'
import type { PresentationPreference } from '../services/presentationPreference'
import { aiPhotoFallbackReducer, initialAiPhotoFallbackState } from './aiFallbackState'
import { PhotoFeedback } from './PhotoResultCard'
import { PhotoSurface } from './PhotoSurface'
import type { SurfaceKeyIntent } from './PhotoSurface'
import { imageCenter, initialPhotoPanelState, nudgePoint, photoPanelReducer, PREPARING_NOTICE_DELAY_MS } from './photoPanelState'

// V1.2 Photo Checker panel (Slice 5a): choose a local photo, prepare it with openPhoto, show it,
// and inspect a tapped or keyboard-chosen spot against the user's saved subtype. Slice 5b adds
// the placement guidance card; Slice 5d renders it with the shared Color Checker result.
// Nothing here is persisted or sent anywhere; closing the panel drops the photo. The
// presentation preference only changes example garments in the card.
export function PhotoCheckerPanel({ copy, resultCopy, garments, language, presentation, subtype }: {
  copy: LocaleCopy['photoChecker']
  resultCopy: LocaleCopy['colorResult']
  garments: LocaleCopy['styleExamples']['garments']
  language: Language
  presentation: PresentationPreference
  subtype: Subtype
}) {
  const [state, dispatch] = useReducer(photoPanelReducer, initialPhotoPanelState)
  // Identity of the latest selection. Only completions carrying this id may dispatch, because an
  // in-progress browser decode can still finish after its AbortSignal fired.
  const latestRequest = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const slowTimer = useRef<number | undefined>(undefined)
  const hintId = useId()

  // V2.0 Slice 0.5D: the explicit, user-invoked AI fallback. Entirely separate from the reducer
  // above -- it never runs on its own, only from runAi() below, and its own request id is bumped
  // independently so a stale AI response can never overwrite a newer point/photo/subtype (plan §H, §M).
  const [aiState, dispatchAi] = useReducer(aiPhotoFallbackReducer, initialAiPhotoFallbackState)
  const aiRequest = useRef(0)
  const aiController = useRef<AbortController | null>(null)
  const selection = state.status === 'ready' ? state.selection : null

  const cancelPending = () => {
    controller.current?.abort()
    controller.current = null
    window.clearTimeout(slowTimer.current)
  }

  // Unmount (including switching back to Manual): abort, stop the timer, invalidate late results.
  useEffect(() => () => { cancelPending(); latestRequest.current += 1; aiController.current?.abort(); aiController.current = null; aiRequest.current += 1 }, [])

  // plan §M: a new photo, a new/moved point, or a subtype change all invalidate any AI result in
  // flight or already shown. `selection` is a fresh object every time 'inspected'/'moved' fires
  // (photoPanelReducer.ts), and null again on a new photo -- so its identity alone is enough to
  // detect every case the plan lists, without separately tracking which one changed.
  useEffect(() => {
    aiController.current?.abort()
    aiController.current = null
    aiRequest.current += 1
    dispatchAi({ type: 'reset' })
  }, [selection, subtype])

  const runAi = () => {
    if (!selection || selection.inspection?.kind !== 'matched' || state.status !== 'ready') return
    if (aiState.status === 'loading') return // plan §H: no duplicate request while one is in flight
    aiController.current?.abort()
    const requestId = ++aiRequest.current
    const nextController = new AbortController()
    aiController.current = nextController
    dispatchAi({ type: 'run' })
    const request = buildPaletteSelectionRequest(state.image, selection.point, selection.inspection.radius, subtype)
    callPaletteSelection(request, nextController.signal).then((outcome) => {
      if (requestId !== aiRequest.current) return // superseded by a context change or a newer run
      aiController.current = null
      if (!outcome.ok) { dispatchAi({ type: 'error', error: outcome.error }); return }
      const resolved = resolvePaletteSelectionResult(outcome.result, subtype)
      if (resolved.kind === 'result') dispatchAi({ type: 'selected', resolution: resolved.resolution })
      else if (resolved.kind === 'unresolved') dispatchAi({ type: 'unresolved' })
      else dispatchAi({ type: 'no-replacement', reason: resolved.status })
    })
  }

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    // Reset so choosing the same photo again fires `change` again.
    input.value = ''
    if (!file) return
    cancelPending()
    const request = ++latestRequest.current
    const next = new AbortController()
    controller.current = next
    dispatch({ type: 'select', request })
    slowTimer.current = window.setTimeout(() => dispatch({ type: 'slow', request }), PREPARING_NOTICE_DELAY_MS)
    openPhoto(file, { signal: next.signal }).then(
      (image) => { if (request === latestRequest.current) dispatch({ type: 'prepared', request, image }) },
      (error: unknown) => {
        if (request !== latestRequest.current) return
        dispatch({ type: 'failed', request, code: error instanceof PhotoImageError ? error.code : 'decode-failed' })
      },
    ).finally(() => {
      if (request !== latestRequest.current) return
      window.clearTimeout(slowTimer.current)
      controller.current = null
    })
  }

  const tap = (displayTap: DisplayTap) => {
    if (state.status !== 'ready') return
    dispatch({ type: 'inspected', request: state.request, inspection: inspectPhotoTap(state.image, displayTap, subtype) })
  }

  const key = (intent: SurfaceKeyIntent) => {
    if (state.status !== 'ready') return
    const { image, request, selection } = state
    if (intent.type === 'check') {
      // Enter / Space evaluates the marker, placing it at the photo's center if there is none yet.
      const point = selection?.point ?? imageCenter(image)
      dispatch({ type: 'inspected', request, inspection: inspectPhotoPoint(image, point, subtype) })
    } else {
      // The first arrow press places the marker at the center; later presses move it.
      const point = selection ? nudgePoint(selection.point, intent.key, intent.big, image) : imageCenter(image)
      dispatch({ type: 'moved', request, point })
    }
  }

  const ready = state.status === 'ready'
  return <section className="checker-workspace photo-checker" aria-busy={state.status === 'preparing'}>
    <div className="photo-picker-row">
      <label className="photo-picker primary-button compact">
        <input type="file" accept="image/*" onChange={choose} />
        <span>{ready ? copy.change : copy.choose}</span>
      </label>
      <p className="photo-privacy">{copy.privacy}</p>
      <p className="photo-tip">{copy.captureTip}</p>
    </div>
    {state.status === 'preparing' && <div className="photo-placeholder">
      {/* Inserted empty, filled after the delay, so only a slow preparation is announced. */}
      <p role="status">{state.slow ? copy.preparing : ''}</p>
    </div>}
    {state.status === 'error' && <p className="photo-error" role="alert">{copy.errors[state.code]}</p>}
    {ready && <div className="photo-layout">
      <div className="photo-view">
        <PhotoSurface
          key={state.request}
          image={state.image}
          marker={state.selection?.point ?? null}
          label={copy.surfaceLabel}
          describedBy={hintId}
          onTap={tap}
          onKey={key}
          onPaintFailed={() => dispatch({ type: 'failed', request: state.request, code: 'canvas-failed' })}
        />
        <p id={hintId} className="photo-hint">{copy.keyboardHint}</p>
      </div>
      <PhotoFeedback copy={copy} resultCopy={resultCopy} garments={garments} language={language} presentation={presentation} selection={state.selection} ai={aiState} onRunAi={runAi} />
    </div>}
  </section>
}
