import type { ImagePoint, PixelSource } from '../domain/photoColor/types'
import type { PhotoImageErrorCode } from '../services/photoImage'

// V2.0 AI Color Lab (Slice 0, plan §10): the photo-load/marker state machine, intentionally
// parallel to photoChecker/photoPanelState.ts rather than reusing it directly. The production
// reducer's 'inspected' action stores a PhotoPointInspection (domain/photoColor/inspect.ts),
// which always calls matchPhotoColor() against a concrete Subtype -- correct for the production
// Checker, which is only reachable once a profile exists. The AI Lab is a standalone dev entry
// that must keep working with NO saved profile (plan §27: "Do not create a fake profile"), so
// it keeps only the marker POINT here and derives the deterministic baseline separately
// (aiLabDeterministic.ts), with subtype genuinely optional. Everything else -- photo loading,
// the request-id staleness guard, geometry (imageCenter / nudgePoint, imported unchanged from
// photoPanelState.ts) -- is identical in shape and reused as-is.

export type AiLabPhotoErrorCode = Exclude<PhotoImageErrorCode, 'aborted'>

export type AiLabPhotoState =
  | { status: 'idle' }
  | { status: 'preparing'; request: number; slow: boolean }
  | { status: 'ready'; request: number; image: PixelSource; point: ImagePoint | null }
  | { status: 'error'; request: number; code: AiLabPhotoErrorCode }

export type AiLabPhotoAction =
  | { type: 'select'; request: number }
  | { type: 'slow'; request: number }
  | { type: 'prepared'; request: number; image: PixelSource }
  | { type: 'failed'; request: number; code: PhotoImageErrorCode }
  | { type: 'point'; request: number; point: ImagePoint }

export const initialAiLabPhotoState: AiLabPhotoState = { status: 'idle' }
export const AI_LAB_PREPARING_NOTICE_DELAY_MS = 150

const current = (state: AiLabPhotoState, request: number) => state.status !== 'idle' && state.request === request

export function aiLabPhotoReducer(state: AiLabPhotoState, action: AiLabPhotoAction): AiLabPhotoState {
  switch (action.type) {
    case 'select':
      return { status: 'preparing', request: action.request, slow: false }
    case 'slow':
      return state.status === 'preparing' && state.request === action.request ? { ...state, slow: true } : state
    case 'prepared':
      return state.status === 'preparing' && state.request === action.request
        ? { status: 'ready', request: action.request, image: action.image, point: null }
        : state
    case 'failed':
      if (action.code === 'aborted' || !current(state, action.request)) return state
      if (state.status !== 'preparing' && state.status !== 'ready') return state
      return { status: 'error', request: action.request, code: action.code }
    case 'point':
      if (state.status !== 'ready' || state.request !== action.request) return state
      return { ...state, point: action.point }
  }
}
