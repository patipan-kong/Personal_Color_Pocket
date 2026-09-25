import { describe, expect, it } from 'vitest'
import { getPalette } from '../domain/personalColor/palettes'
import { resolveAiFallbackSelection } from '../domain/photoColor/aiFallback'
import { aiPhotoFallbackReducer, initialAiPhotoFallbackState } from './aiFallbackState'
import stateSource from './aiFallbackState.ts?raw'

// V2.0 Slice 0.5D: the production AI fallback's own state machine. Pure reducer tests only --
// the network call, staleness-by-request-id and effect wiring live in PhotoCheckerPanel and are
// covered by PhotoCheckerPanel.test.tsx instead.

const SUBTYPE = 'warm-autumn' as const
const colorId = getPalette(SUBTYPE).best[0].id
const resolution = resolveAiFallbackSelection({ subtype: SUBTYPE, colorId })
if (!resolution.ok) throw new Error('fixture setup failed')

describe('aiPhotoFallbackReducer', () => {
  it('starts idle', () => {
    expect(initialAiPhotoFallbackState).toEqual({ status: 'idle' })
  })

  it('run always moves to loading, from any prior state', () => {
    for (const prior of [
      initialAiPhotoFallbackState,
      aiPhotoFallbackReducer(initialAiPhotoFallbackState, { type: 'run' }),
      aiPhotoFallbackReducer(initialAiPhotoFallbackState, { type: 'selected', resolution }),
      aiPhotoFallbackReducer(initialAiPhotoFallbackState, { type: 'error', error: { kind: 'provider-error', message: 'x', httpStatus: 500 } }),
    ]) {
      expect(aiPhotoFallbackReducer(prior, { type: 'run' })).toEqual({ status: 'loading' })
    }
  })

  it('selected carries the resolved fallback result through unchanged', () => {
    const state = aiPhotoFallbackReducer({ status: 'loading' }, { type: 'selected', resolution })
    expect(state).toEqual({ status: 'selected', resolution })
  })

  it.each(['uncertain', 'target-mismatch', 'unusable'] as const)('no-replacement carries the escape-hatch reason (%s), never a color', (reason) => {
    const state = aiPhotoFallbackReducer({ status: 'loading' }, { type: 'no-replacement', reason })
    expect(state).toEqual({ status: 'no-replacement', reason })
    expect(JSON.stringify(state)).not.toMatch(/#[0-9a-f]{6}/i)
  })

  it('unresolved and error are distinct terminal states, neither carrying a color', () => {
    expect(aiPhotoFallbackReducer({ status: 'loading' }, { type: 'unresolved' })).toEqual({ status: 'unresolved' })
    const error = { kind: 'network' as const, message: 'x', httpStatus: null }
    expect(aiPhotoFallbackReducer({ status: 'loading' }, { type: 'error', error })).toEqual({ status: 'error', error })
  })

  it('reset always returns to idle, from every reachable state', () => {
    const states = [
      { status: 'loading' as const },
      { status: 'selected' as const, resolution },
      { status: 'no-replacement' as const, reason: 'uncertain' as const },
      { status: 'unresolved' as const },
      { status: 'error' as const, error: { kind: 'network' as const, message: 'x', httpStatus: null } },
    ]
    for (const state of states) expect(aiPhotoFallbackReducer(state, { type: 'reset' })).toEqual({ status: 'idle' })
  })

  it('has no storage, network or colour-math code of its own -- purely a state shape', () => {
    const code = stateSource.replace(/\/\/.*$/gm, '')
    for (const forbidden of ['localStorage', 'sessionStorage', 'fetch', 'XMLHttpRequest', 'console', 'getPalette', 'matchPhotoColor', 'samplePhotoRegion', 'rgbToOklab']) {
      expect(code, forbidden).not.toMatch(new RegExp(`\\b${forbidden}\\b`))
    }
  })
})
