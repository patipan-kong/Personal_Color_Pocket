import { describe, expect, it } from 'vitest'
import { describeColor } from '../colorNames/colorNames'
import { checkColor } from '../personalColor/colorMatch'
import { getPalette } from '../personalColor/palettes'
import {
  WARDROBE_CUSTOM_NAME_MAX_LENGTH,
  createWardrobeId,
  getCanonicalWardrobeColor,
  getDefaultWardrobeDisplayName,
  getRecordWardrobeSlot,
  getWardrobeColorDescription,
  getWardrobeCompatibility,
  getWardrobeDisplayName,
  isWardrobeId,
  parseWardrobeRecord,
} from './wardrobe'
import type { WardrobeRecordV1 } from './wardrobe'

const validRecord = (): WardrobeRecordV1 => ({
  id: 'wardrobe-tee-1',
  garmentType: 't-shirt',
  color: { hex: '#E9785D' },
  formality: 'casual',
})

describe('WardrobeRecordV1 validation', () => {
  it('accepts a valid record and emits only the persisted V1 shape', () => {
    expect(parseWardrobeRecord(validRecord())).toEqual({ ok: true, value: validRecord(), repairs: [] })
  })

  it('rejects malformed IDs, unknown garment types, invalid HEX, invalid formality, and malformed colors', () => {
    expect(parseWardrobeRecord({ ...validRecord(), id: '../tee' }).ok).toBe(false)
    expect(parseWardrobeRecord({ ...validRecord(), garmentType: 'cape' }).ok).toBe(false)
    expect(parseWardrobeRecord({ ...validRecord(), color: { hex: '#12' } }).ok).toBe(false)
    expect(parseWardrobeRecord({ ...validRecord(), formality: 'party' }).ok).toBe(false)
    expect(parseWardrobeRecord({ ...validRecord(), color: '#E9785D' }).ok).toBe(false)
    expect(parseWardrobeRecord({ ...validRecord(), slot: 'bottom' }).ok).toBe(false)
  })

  it('normalizes HEX and defensively normalizes an optional custom name', () => {
    expect(parseWardrobeRecord({ ...validRecord(), color: { hex: 'e9785d' }, customName: '  office tee  ' })).toEqual({
      ok: true,
      value: { ...validRecord(), customName: 'office tee' },
      repairs: ['normalized-hex', 'trimmed-custom-name'],
    })
    expect(parseWardrobeRecord({ ...validRecord(), customName: '   ' })).toEqual({
      ok: true,
      value: validRecord(),
      repairs: ['removed-empty-custom-name'],
    })
    expect(parseWardrobeRecord({ ...validRecord(), customName: 'x'.repeat(WARDROBE_CUSTOM_NAME_MAX_LENGTH + 1) }).ok).toBe(false)
    expect(parseWardrobeRecord({ ...validRecord(), customName: 7 }).ok).toBe(false)
  })

  it('accepts canonical identity from any app palette, independent of current subtype', () => {
    const canonical = getPalette('deep-winter').best[0]
    const parsed = parseWardrobeRecord({ ...validRecord(), color: { hex: canonical.hex, canonicalColorId: canonical.id } })
    expect(parsed).toEqual({
      ok: true,
      value: { ...validRecord(), color: { hex: canonical.hex, canonicalColorId: canonical.id } },
      repairs: [],
    })
    expect(getCanonicalWardrobeColor(canonical.id)).toEqual(canonical)
  })

  it.each([
    ['unknown ID', { hex: '#E9785D', canonicalColorId: 'retired-palette-color' }],
    ['ID/HEX mismatch', { hex: '#FFFFFF', canonicalColorId: getPalette('warm-spring').best[0].id }],
  ])('preserves valid HEX and drops only stale canonical identity for %s', (_case, color) => {
    expect(parseWardrobeRecord({ ...validRecord(), color })).toEqual({
      ok: true,
      value: { ...validRecord(), color: { hex: color.hex } },
      repairs: ['dropped-stale-canonical-color'],
    })
  })

  it('rejects malformed optional canonical identity instead of loosely casting it', () => {
    expect(parseWardrobeRecord({ ...validRecord(), color: { hex: '#E9785D', canonicalColorId: 4 } }).ok).toBe(false)
  })

  it('creates browser-safe opaque app IDs without a new dependency', () => {
    const first = createWardrobeId()
    const second = createWardrobeId()
    expect(isWardrobeId(first)).toBe(true)
    expect(first).not.toBe(second)
  })
})

describe('derived wardrobe facts', () => {
  it('derives slot, generic color description, and bilingual default display names without storing them', () => {
    const record = validRecord()
    expect(getRecordWardrobeSlot(record)).toBe('top')
    expect(getWardrobeColorDescription(record)).toEqual(describeColor(record.color.hex))
    expect(getDefaultWardrobeDisplayName(record, 'en')).toBe('Coral T-shirt')
    expect(getDefaultWardrobeDisplayName(record, 'th')).toBe('เสื้อยืดสีส้มคอรัล')
    expect(getWardrobeDisplayName({ ...record, customName: 'My favorite' }, 'th')).toBe('My favorite')
    expect(record).not.toHaveProperty('slot')
    expect(record).not.toHaveProperty('displayName')
  })

  it('delegates compatibility to checkColor and subtype changes never mutate the record', () => {
    const record = Object.freeze({ ...validRecord(), color: Object.freeze({ ...validRecord().color }) })
    const before = JSON.stringify(record)
    expect(getWardrobeCompatibility(record, 'warm-spring')).toEqual(checkColor(record.color.hex, 'warm-spring'))
    expect(getWardrobeCompatibility(record, 'cool-winter')).toEqual(checkColor(record.color.hex, 'cool-winter'))
    expect(JSON.stringify(record)).toBe(before)
  })
})
