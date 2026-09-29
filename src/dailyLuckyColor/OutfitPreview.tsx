import { useEffect, useMemo, useRef } from 'react'
import { describeColor } from '../domain/colorNames/colorNames'
import type { OutfitPreviewInput } from '../domain/todayOutfitProduction/previewContract'
import { getGarmentDefinition } from '../domain/wardrobe/taxonomy'
import type { LocaleCopy } from '../i18n'
import { requestOutfitPreview } from '../services/outfitPreview'

export type TodayPreviewState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly recommendationFingerprint: string; readonly previewFingerprint: string }
  | { readonly status: 'success'; readonly recommendationFingerprint: string; readonly previewFingerprint: string; readonly imageDataUrl: string }
  | { readonly status: 'failure'; readonly recommendationFingerprint: string; readonly previewFingerprint: string }

export const fingerprintOutfitPreviewInput = (input: OutfitPreviewInput): string => JSON.stringify(input)

function previewPieces(input: OutfitPreviewInput) {
  const outfit = input.outfit
  return outfit.kind === 'separates'
    ? [outfit.top, outfit.bottom, ...(outfit.outerwear ? [outfit.outerwear] : []), outfit.shoes]
    : [outfit.onePiece, ...(outfit.outerwear ? [outfit.outerwear] : []), outfit.shoes]
}

export function buildOutfitPreviewAlt(copy: LocaleCopy, input: OutfitPreviewInput): string {
  const pieces = previewPieces(input).map((piece) => {
    const garment = getGarmentDefinition(piece.garmentType).label[copy.language]
    const color = describeColor(piece.color.hex)
    return `${color?.[copy.language] ?? copy.daily.previewUnknownColor} ${garment}`
  })
  return copy.daily.previewAlt(pieces)
}

export function OutfitPreview({ copy, source, recommendationFingerprint, input, state, onStateChange }: {
  copy: LocaleCopy
  source: 'owned' | 'inspiration'
  recommendationFingerprint: string
  input: OutfitPreviewInput | null
  state: TodayPreviewState
  onStateChange: (state: TodayPreviewState) => void
}) {
  const previewFingerprint = useMemo(() => input ? fingerprintOutfitPreviewInput(input) : 'invalid-preview-input', [input])
  const contextKey = `${recommendationFingerprint}\n${previewFingerprint}`
  const latestContextKey = useRef(contextKey)
  latestContextKey.current = contextKey
  const abortRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)
  const submittingRef = useRef(false)
  const mountedRef = useRef(true)
  const belongsToContext = state.status !== 'idle'
    && state.recommendationFingerprint === recommendationFingerprint
    && state.previewFingerprint === previewFingerprint
  const visibleState: TodayPreviewState = belongsToContext ? state : { status: 'idle' }

  useEffect(() => {
    if (state.status !== 'idle' && !belongsToContext) onStateChange({ status: 'idle' })
    generationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    submittingRef.current = false
  }, [contextKey])

  useEffect(() => {
    // React StrictMode (dev) runs setup → cleanup → setup; every setup must re-mark mounted.
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      generationRef.current += 1
      abortRef.current?.abort()
    }
  }, [])

  const generate = async () => {
    if (submittingRef.current) return
    if (!input) {
      onStateChange({ status: 'failure', recommendationFingerprint, previewFingerprint })
      return
    }
    submittingRef.current = true
    const generation = generationRef.current + 1
    generationRef.current = generation
    const submittedContextKey = contextKey
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    onStateChange({ status: 'loading', recommendationFingerprint, previewFingerprint })
    try {
      const response = await requestOutfitPreview(input, controller.signal)
      if (!mountedRef.current || generationRef.current !== generation || latestContextKey.current !== submittedContextKey) return
      onStateChange(response.ok
        ? { status: 'success', recommendationFingerprint, previewFingerprint, imageDataUrl: response.result.imageDataUrl }
        : { status: 'failure', recommendationFingerprint, previewFingerprint })
    } catch {
      if (!mountedRef.current || generationRef.current !== generation || latestContextKey.current !== submittedContextKey) return
      onStateChange({ status: 'failure', recommendationFingerprint, previewFingerprint })
    } finally {
      if (generationRef.current === generation) {
        submittingRef.current = false
        abortRef.current = null
      }
    }
  }

  return <div className="today-preview">
    {visibleState.status === 'idle' && <button type="button" className="secondary-button today-preview-action" onClick={() => void generate()}>{copy.daily.previewCta}</button>}
    {visibleState.status === 'loading' && <div className="today-preview-status" role="status" aria-live="polite"><button type="button" className="secondary-button today-preview-action" disabled><span className="today-preview-spinner" aria-hidden="true" />{copy.daily.previewLoading}</button></div>}
    {visibleState.status === 'success' && <div className="today-preview-result">
      <img src={visibleState.imageDataUrl} alt={input ? buildOutfitPreviewAlt(copy, input) : ''} />
      <p className="today-preview-helper">{copy.daily.previewHelper}</p>
      <p className="today-preview-expectation">{source === 'owned' ? copy.daily.previewOwnedExpectation : copy.daily.previewInspirationExpectation}</p>
    </div>}
    {visibleState.status === 'failure' && <div className="today-preview-failure" role="alert">
      <p>{copy.daily.previewFailure}</p>
      <button type="button" className="secondary-button today-preview-action" onClick={() => void generate()}>{copy.daily.previewRetry}</button>
    </div>}
  </div>
}
