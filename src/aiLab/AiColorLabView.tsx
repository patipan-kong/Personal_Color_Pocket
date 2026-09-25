import { useEffect, useId, useMemo, useReducer, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { AI_PROVIDER_IDS } from '../domain/aiColorLab/contract'
import type { AiColorSubtypeContext, AiProviderId } from '../domain/aiColorLab/contract'
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
import { aiLabProvidersReducer, initialProvidersState } from './aiLabState'
import { callAiColorProvider } from './aiColorLabApi'
import { buildAiColorRequest } from './buildRequest'
import { DeterministicBaselineCard } from './DeterministicBaselineCard'
import { ProviderCard } from './ProviderCard'

// V2.0 AI Color Lab (Slice 0). A standalone, developer-only screen -- reached only via
// ?debug=ai in a dev build (see App.tsx), never part of normal navigation (plan §22-23). It
// reuses the existing local photo pipeline and deterministic engine unchanged, and talks to the
// four providers only through /api/ai-color/<provider> (aiColorLabApi.ts) -- it never imports a
// provider SDK or sees a credential (plan §29).
export function AiColorLabView() {
  const [photoState, dispatchPhoto] = useReducer(aiLabPhotoReducer, initialAiLabPhotoState)
  const [providers, dispatchProviders] = useReducer(aiLabProvidersReducer, initialProvidersState)
  const latestRequest = useRef(0)
  const photoController = useRef<AbortController | null>(null)
  const slowTimer = useRef<number | undefined>(undefined)
  const runCounter = useRef(0)
  const providerControllers = useRef<Partial<Record<AiProviderId, AbortController>>>({})
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
  const abortAllProviders = () => {
    for (const provider of Object.keys(providerControllers.current) as AiProviderId[]) providerControllers.current[provider]?.abort()
    providerControllers.current = {}
  }
  // A new photo or a new sample point starts a genuinely new analysis: cancel whatever is
  // in flight and clear every card back to idle, so no stale card can survive into it
  // (plan §31 Case G).
  const startFreshAnalysis = () => {
    abortAllProviders()
    dispatchProviders({ type: 'reset' })
  }

  useEffect(() => () => { cancelPendingPhoto(); abortAllProviders(); latestRequest.current += 1 }, [])

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

  const runProvider = (provider: AiProviderId) => {
    if (!request) return
    providerControllers.current[provider]?.abort()
    const controller = new AbortController()
    providerControllers.current[provider] = controller
    const id = ++runCounter.current
    dispatchProviders({ type: 'started', provider, runId: id })
    void callAiColorProvider(provider, request, controller.signal).then((outcome) => {
      dispatchProviders({ type: 'completed', provider, runId: id, outcome })
    })
  }
  const runAll = () => { for (const provider of AI_PROVIDER_IDS) runProvider(provider) }

  return <main className="ai-lab-page">
    <p className="ai-lab-badge">Dev only — AI Color Lab</p>
    <h1>AI Color Lab</h1>
    <p>Compares the deterministic Photo Color Checker against four independent AI vision providers on the same photo and sample point. Not a production feature.</p>
    <p className="ai-lab-privacy">Unlike the Photo Color Checker (which stays entirely on this device), running AI analysis here sends the selected photo to the AI provider(s) you choose to run, over the network, for this comparison only. Nothing is uploaded until you press Run.</p>

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
          <button type="button" className="primary-button compact" onClick={runAll} disabled={!request}>Run all providers</button>
          {!request && <span className="ai-lab-hint">Select a sample point first.</span>}
        </div>
        {request && <details className="ai-lab-input-preview">
          <summary>AI input preview</summary>
          <p className="ai-lab-hint">The exact image sent to every provider, target marker included.</p>
          <img src={request.imageDataUrl} alt="AI input preview: photo with the target marker as sent to every provider" />
        </details>}
        <div className="ai-lab-cards">
          {AI_PROVIDER_IDS.map((provider) => <ProviderCard key={provider} provider={provider} state={providers[provider]} onRetry={() => runProvider(provider)} />)}
        </div>
      </div>
    </div>}
  </main>
}
