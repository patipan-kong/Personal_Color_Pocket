import { describe, expect, it } from 'vitest'
import { validatePaletteSelectionOutput } from './validatePaletteSelection'

const IDS = new Set(['warm-spring-best-1', 'warm-spring-neutral-1'])

const VALID_SELECTED = {
  status: 'selected',
  colorId: 'warm-spring-best-1',
  target: { objectType: 'shirt', objectDescription: 'cream short-sleeve shirt' },
  reasoning: 'Looks closest to this warm coral swatch.',
}

describe('validatePaletteSelectionOutput', () => {
  it('accepts a fully valid "selected" payload', () => {
    expect(validatePaletteSelectionOutput(VALID_SELECTED, IDS)).toEqual(VALID_SELECTED)
  })

  it('accepts a valid "uncertain" payload with no target', () => {
    const payload = { status: 'uncertain', colorId: null, target: null, reasoning: 'No candidate is a defensible match.' }
    expect(validatePaletteSelectionOutput(payload, IDS)).toEqual({ status: 'uncertain', target: null, reasoning: payload.reasoning })
  })

  it('accepts "target-mismatch" and "unusable" with an omitted (not just null) colorId/target', () => {
    expect(validatePaletteSelectionOutput({ status: 'target-mismatch', reasoning: 'Marker is on skin, not fabric.' }, IDS))
      .toEqual({ status: 'target-mismatch', target: null, reasoning: 'Marker is on skin, not fabric.' })
    expect(validatePaletteSelectionOutput({ status: 'unusable', reasoning: 'Frame is essentially black.' }, IDS))
      .toEqual({ status: 'unusable', target: null, reasoning: 'Frame is essentially black.' })
  })

  it('rejects a non-object, missing status, or invalid status', () => {
    expect(validatePaletteSelectionOutput('nonsense', IDS)).toBeNull()
    expect(validatePaletteSelectionOutput(null, IDS)).toBeNull()
    const { status: _status, ...missingStatus } = VALID_SELECTED
    expect(validatePaletteSelectionOutput(missingStatus, IDS)).toBeNull()
    expect(validatePaletteSelectionOutput({ ...VALID_SELECTED, status: 'maybe' }, IDS)).toBeNull()
  })

  it('rejects an invented colorId not present in this request\'s own palette', () => {
    expect(validatePaletteSelectionOutput({ ...VALID_SELECTED, colorId: 'not-a-real-id' }, IDS)).toBeNull()
  })

  it('rejects a colorId that IS a real palette id, but not one this specific request offered', () => {
    const narrowIds = new Set(['warm-spring-neutral-1']) // deliberately excludes warm-spring-best-1
    expect(validatePaletteSelectionOutput(VALID_SELECTED, narrowIds)).toBeNull()
  })

  it('rejects "selected" with a missing colorId', () => {
    const { colorId: _colorId, ...noColorId } = VALID_SELECTED
    expect(validatePaletteSelectionOutput(noColorId, IDS)).toBeNull()
  })

  it('rejects "selected" with no target (identification without an identified object is not trusted)', () => {
    expect(validatePaletteSelectionOutput({ ...VALID_SELECTED, target: null }, IDS)).toBeNull()
  })

  it('rejects a non-"selected" status that carries a colorId', () => {
    expect(validatePaletteSelectionOutput({ status: 'uncertain', colorId: 'warm-spring-best-1', target: null, reasoning: 'x' }, IDS)).toBeNull()
    expect(validatePaletteSelectionOutput({ status: 'unusable', colorId: 'warm-spring-best-1', reasoning: 'x' }, IDS)).toBeNull()
  })

  it('rejects a missing or empty reasoning field', () => {
    const { reasoning: _reasoning, ...noReasoning } = VALID_SELECTED
    expect(validatePaletteSelectionOutput(noReasoning, IDS)).toBeNull()
    expect(validatePaletteSelectionOutput({ ...VALID_SELECTED, reasoning: '   ' }, IDS)).toBeNull()
  })

  it('rejects a malformed target object', () => {
    expect(validatePaletteSelectionOutput({ ...VALID_SELECTED, target: { objectType: 'shirt' } }, IDS)).toBeNull()
    expect(validatePaletteSelectionOutput({ ...VALID_SELECTED, target: 'a shirt' }, IDS)).toBeNull()
  })

  it('rejects an oversized reasoning field rather than truncating it', () => {
    expect(validatePaletteSelectionOutput({ ...VALID_SELECTED, reasoning: 'x'.repeat(5000) }, IDS)).toBeNull()
  })
})
