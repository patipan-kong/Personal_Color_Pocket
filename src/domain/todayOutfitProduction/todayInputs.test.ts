import { describe, expect, it } from 'vitest'
import type { WardrobeRecordV1 } from '../wardrobe/wardrobe'
import { chooseOutfitSource, createTodayOutfitInputState, getWardrobeCoverage, syncAutomaticOutfitSource } from './todayInputs'

const item = (id: string, garmentType: WardrobeRecordV1['garmentType']): WardrobeRecordV1 => ({
  id,
  garmentType,
  color: { hex: '#112233' },
  formality: 'casual',
})

describe('production Today outfit inputs', () => {
  it.each([
    ['separates', [item('top', 't-shirt'), item('bottom', 'trousers'), item('shoes', 'sneakers')], true],
    ['one-piece', [item('dress', 'dress'), item('shoes', 'heels')], true],
    ['top and shoes only', [item('top', 'shirt'), item('shoes', 'loafers')], false],
    ['bottom and shoes only', [item('bottom', 'skirt'), item('shoes', 'flats')], false],
    ['one-piece without shoes', [item('dress', 'dress')], false],
    ['outerwear only', [item('coat', 'coat')], false],
    ['empty wardrobe', [], false],
  ] as const)('computes %s coverage deterministically', (_name, items, ready) => {
    expect(getWardrobeCoverage(items).ready).toBe(ready)
  })

  it('never requires outerwear for readiness', () => {
    const coverage = getWardrobeCoverage([item('top', 'shirt'), item('bottom', 'trousers'), item('shoes', 'loafers')])
    expect(coverage).toMatchObject({ ready: true, hasSeparatesBase: true, hasOnePieceBase: false, missing: [] })
  })

  it('defaults to wardrobe only when ready and never overrides a user choice', () => {
    const empty = getWardrobeCoverage([])
    const ready = getWardrobeCoverage([item('dress', 'dress'), item('shoes', 'heels')])
    expect(createTodayOutfitInputState(empty)).toMatchObject({ occasion: 'casual', source: 'inspiration', sourceSelection: 'automatic' })
    expect(createTodayOutfitInputState(ready).source).toBe('wardrobe')
    expect(syncAutomaticOutfitSource(createTodayOutfitInputState(empty), ready).source).toBe('wardrobe')

    const chosen = chooseOutfitSource(createTodayOutfitInputState(empty), 'inspiration')
    expect(syncAutomaticOutfitSource(chosen, ready)).toBe(chosen)
  })
})
