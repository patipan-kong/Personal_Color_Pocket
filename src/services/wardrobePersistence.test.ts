import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPalette } from '../domain/personalColor/palettes'
import type { WardrobeRecordV1 } from '../domain/wardrobe/wardrobe'
import {
  MAX_WARDROBE_ITEMS,
  WARDROBE_STORAGE_KEY,
  loadWardrobe,
  saveWardrobe,
} from './wardrobePersistence'

const item = (id = 'wardrobe-shirt-1'): WardrobeRecordV1 => ({
  id,
  garmentType: 'shirt',
  color: { hex: '#314C5A' },
  formality: 'smart-casual',
})

describe('wardrobe persistence', () => {
  beforeEach(() => localStorage.clear())

  it('loads absent storage as an empty available wardrobe', () => {
    expect(loadWardrobe()).toEqual({ status: 'loaded', items: [], repaired: false, skippedItemCount: 0, repairs: [] })
  })

  it('round-trips a valid versioned collection', () => {
    expect(saveWardrobe([item()])).toEqual({ ok: true, items: [item()] })
    expect(JSON.parse(localStorage.getItem(WARDROBE_STORAGE_KEY)!)).toEqual({ version: 1, items: [item()] })
    expect(loadWardrobe()).toEqual({ status: 'loaded', items: [item()], repaired: false, skippedItemCount: 0, repairs: [] })
  })

  it('distinguishes malformed JSON, invalid envelopes, and unsupported future versions', () => {
    localStorage.setItem(WARDROBE_STORAGE_KEY, '{bad')
    expect(loadWardrobe()).toEqual({ status: 'corrupt', items: [], reason: 'malformed-json' })
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify({ version: 1, items: 'nope' }))
    expect(loadWardrobe()).toEqual({ status: 'corrupt', items: [], reason: 'invalid-envelope' })
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify({ version: 2, futureShape: true }))
    expect(loadWardrobe()).toEqual({ status: 'unsupported-version', items: [], version: 2 })
  })

  it('keeps valid records in a mixed collection and normalizes recoverable records', () => {
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify({ version: 1, items: [
      item('valid-first'),
      { ...item('normalized'), color: { hex: 'fff' } },
      { ...item('broken'), color: { hex: 'not-a-color' } },
    ] }))
    expect(loadWardrobe()).toEqual({
      status: 'loaded',
      items: [item('valid-first'), { ...item('normalized'), color: { hex: '#FFFFFF' } }],
      repaired: true,
      skippedItemCount: 1,
      repairs: ['normalized-hex'],
    })
  })

  it('downgrades stale canonical identity without deleting the garment', () => {
    const canonical = getPalette('warm-spring').best[0]
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify({ version: 1, items: [
      { ...item(), color: { hex: '#FFFFFF', canonicalColorId: canonical.id } },
    ] }))
    expect(loadWardrobe()).toMatchObject({
      status: 'loaded',
      items: [{ ...item(), color: { hex: '#FFFFFF' } }],
      repaired: true,
      repairs: ['dropped-stale-canonical-color'],
    })
  })

  it('rejects duplicate IDs deterministically by keeping the first valid occurrence', () => {
    const first = item('same-id')
    const second = { ...item('same-id'), garmentType: 'blazer' as const }
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify({ version: 1, items: [first, second] }))
    expect(loadWardrobe()).toMatchObject({ status: 'loaded', items: [first], repaired: true, skippedItemCount: 1 })
    expect(saveWardrobe([first, second])).toEqual({ ok: false, reason: 'duplicate-ids' })
  })

  it('bounds the collection above the expected 100-item use case', () => {
    const maximum = Array.from({ length: MAX_WARDROBE_ITEMS }, (_, index) => item(`item-${index}`))
    const oversized = [...maximum, item('one-too-many')]
    expect(saveWardrobe(maximum).ok).toBe(true)
    expect(saveWardrobe(oversized)).toEqual({ ok: false, reason: 'collection-too-large' })
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify({ version: 1, items: oversized }))
    expect(loadWardrobe()).toMatchObject({ status: 'loaded', items: maximum, repaired: true, skippedItemCount: 1 })
  })

  it('makes storage read and write failures non-fatal and explicit', () => {
    const readFailure = { getItem: () => { throw new DOMException('blocked', 'SecurityError') } }
    const writeFailure = { setItem: () => { throw new DOMException('full', 'QuotaExceededError') } }
    expect(loadWardrobe(readFailure)).toEqual({ status: 'unavailable', items: [], reason: 'storage-read-failed' })
    expect(saveWardrobe([item()], writeFailure)).toEqual({ ok: false, reason: 'storage-write-failed' })
  })

  it('never rewrites storage merely because load repaired or skipped data', () => {
    const raw = JSON.stringify({ version: 1, items: [{ ...item(), color: { hex: 'fff' } }, { bad: true }] })
    const storage = { getItem: vi.fn(() => raw), setItem: vi.fn() }
    expect(loadWardrobe(storage)).toMatchObject({ status: 'loaded', repaired: true, skippedItemCount: 1 })
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('does not parse or overwrite an unknown future version during load', () => {
    const raw = JSON.stringify({ version: 99, futureShape: { records: [item()] } })
    const storage = { getItem: vi.fn(() => raw), setItem: vi.fn() }
    expect(loadWardrobe(storage)).toEqual({ status: 'unsupported-version', items: [], version: 99 })
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('does not write when explicit save validation fails', () => {
    const storage = { setItem: vi.fn() }
    expect(saveWardrobe([{ ...item(), color: { hex: '#12' } }], storage)).toEqual({ ok: false, reason: 'invalid-records' })
    expect(storage.setItem).not.toHaveBeenCalled()
  })
})
