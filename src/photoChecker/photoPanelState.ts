import { sampleRadiusFor } from '../domain/photoColor/coordinates'
import type { ImagePoint, PhotoPointInspection, PhotoTapInspection, PixelSource } from '../domain/photoColor/types'
import type { PhotoImageErrorCode } from '../services/photoImage'

// V1.2 Photo Checker panel state (Slice 5a). Pure and deterministic: every transition is a
// reducer action, and every async completion carries the id of the selection that started it,
// so a late result from an older photo can never replace the current one.

export type PhotoPanelErrorCode = Exclude<PhotoImageErrorCode, 'aborted'>

// The marker and what is known about it. `inspection` is null while the marker has been moved
// by keyboard but not evaluated yet, so a result is never shown for a point it was not taken at.
export interface PhotoSelection {
  point: ImagePoint
  inspection: PhotoPointInspection | null
}

export type PhotoPanelState =
  | { status: 'idle' }
  // `slow` turns on after PREPARING_NOTICE_DELAY_MS, so fast photos never flash a message.
  | { status: 'preparing'; request: number; slow: boolean }
  | { status: 'ready'; request: number; image: PixelSource; selection: PhotoSelection | null }
  | { status: 'error'; request: number; code: PhotoPanelErrorCode }

export type PhotoPanelAction =
  | { type: 'select'; request: number }
  | { type: 'slow'; request: number }
  | { type: 'prepared'; request: number; image: PixelSource }
  | { type: 'failed'; request: number; code: PhotoImageErrorCode }
  | { type: 'inspected'; request: number; inspection: PhotoTapInspection }
  | { type: 'moved'; request: number; point: ImagePoint }

export const PREPARING_NOTICE_DELAY_MS = 150
// Keyboard step in WORKING-IMAGE px, independent of the preview size: one sample radius per
// press (neighbouring samples overlap by half), five radii with Shift. For a 1600 px photo that
// is 24 px (1.5% of the long edge) and 120 px.
export const KEYBOARD_BIG_STEP_FACTOR = 5

export const initialPhotoPanelState: PhotoPanelState = { status: 'idle' }

const current = (state: PhotoPanelState, request: number) => state.status !== 'idle' && state.request === request

export function photoPanelReducer(state: PhotoPanelState, action: PhotoPanelAction): PhotoPanelState {
  switch (action.type) {
    case 'select':
      // A new photo always starts clean: the previous image, marker and result are dropped.
      return { status: 'preparing', request: action.request, slow: false }
    case 'slow':
      return state.status === 'preparing' && state.request === action.request ? { ...state, slow: true } : state
    case 'prepared':
      return state.status === 'preparing' && state.request === action.request
        ? { status: 'ready', request: action.request, image: action.image, selection: null }
        : state
    case 'failed':
      // `aborted` is the expected end of a superseded selection, never a user-facing error.
      if (action.code === 'aborted' || !current(state, action.request)) return state
      if (state.status !== 'preparing' && state.status !== 'ready') return state
      return { status: 'error', request: action.request, code: action.code }
    case 'inspected':
      if (state.status !== 'ready' || state.request !== action.request) return state
      // A tap in the letterbox keeps the previous marker and result.
      if (action.inspection.kind === 'outside-displayed-image') return state
      return { ...state, selection: { point: action.inspection.point, inspection: action.inspection } }
    case 'moved':
      if (state.status !== 'ready' || state.request !== action.request) return state
      return { ...state, selection: { point: action.point, inspection: null } }
  }
}

export const imageCenter = ({ width, height }: PixelSource): ImagePoint => ({ x: width / 2, y: height / 2 })

export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

// Moves a keyboard marker in working-image px, clamped to the closed image rectangle.
export function nudgePoint(point: ImagePoint, key: ArrowKey, big: boolean, image: PixelSource): ImagePoint {
  const step = sampleRadiusFor(image) * (big ? KEYBOARD_BIG_STEP_FACTOR : 1)
  const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0
  const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0
  return {
    x: Math.min(image.width, Math.max(0, point.x + dx)),
    y: Math.min(image.height, Math.max(0, point.y + dy)),
  }
}
