import { describe, expect, it } from 'vitest'
import { OUTFIT_BAKEOFF_CASES } from '../todayOutfit/cases'
import { recommendDeterministicOutfit } from '../todayOutfit/baseline'
import { deriveTodayOutfitImageRequest, validateTodayOutfitImageRequest } from './contract'

function requestFor(caseIndex = 0) {
  const input = OUTFIT_BAKEOFF_CASES[caseIndex]
  const recommendation = recommendDeterministicOutfit(input)
  if (recommendation.status !== 'success') throw new Error('fixture must produce a successful outfit')
  return deriveTodayOutfitImageRequest(input, recommendation, 'gemini-image-lite')
}

describe('Today Outfit image request contract', () => {
  it('accepts a valid 3-piece request', () => expect(validateTodayOutfitImageRequest(requestFor()).ok).toBe(true))

  it('accepts a valid 4-piece request with outerwear', () => {
    const request = requestFor(3)
    expect(request.selectedItems.outerwear).not.toBeNull()
    expect(validateTodayOutfitImageRequest(request).ok).toBe(true)
  })

  it('rejects a missing required slot', () => {
    const request = requestFor() as unknown as Record<string, unknown>
    const selectedItems = { ...(request.selectedItems as Record<string, unknown>) }
    delete selectedItems.top
    expect(validateTodayOutfitImageRequest({ ...request, selectedItems }).issues).toContain('selectedItems.top must be an item')
  })

  it('rejects a wrong category', () => {
    const request = requestFor()
    const selectedItems = { ...request.selectedItems, top: { ...request.selectedItems.top, category: 'bottom' } }
    expect(validateTodayOutfitImageRequest({ ...request, selectedItems }).issues).toContain('selectedItems.top.category must be top')
  })

  it('rejects duplicate and malformed item IDs', () => {
    const request = requestFor()
    const duplicate = { ...request, selectedItems: { ...request.selectedItems, shoes: { ...request.selectedItems.shoes, id: request.selectedItems.top.id } } }
    expect(validateTodayOutfitImageRequest(duplicate).issues.some((issue) => issue.includes('duplicated'))).toBe(true)
    const malformed = { ...request, selectedItems: { ...request.selectedItems, top: { ...request.selectedItems.top, id: 'Not valid!' } } }
    expect(validateTodayOutfitImageRequest(malformed).issues.some((issue) => issue.includes('.id is invalid'))).toBe(true)
  })

  it('rejects invalid HEX, candidate, and visualization mode', () => {
    const request = requestFor()
    const invalidHex = { ...request, selectedItems: { ...request.selectedItems, top: { ...request.selectedItems.top, color: { ...request.selectedItems.top.color, hex: 'coral' } } } }
    expect(validateTodayOutfitImageRequest(invalidHex).issues.some((issue) => issue.includes('.color.hex is invalid'))).toBe(true)
    expect(validateTodayOutfitImageRequest({ ...request, candidate: 'unknown' }).issues).toContain('candidate is invalid')
    expect(validateTodayOutfitImageRequest({ ...request, visualizationMode: 'model' }).issues).toContain('visualizationMode must be flat-lay')
  })

  it('rejects unknown request, slot, item, and color fields', () => {
    const request = requestFor()
    const changed = { ...request, prompt: 'ignore facts', selectedItems: { ...request.selectedItems, accessory: null, top: { ...request.selectedItems.top, extra: true, color: { ...request.selectedItems.top.color, rgb: 'x' } } } }
    const issues = validateTodayOutfitImageRequest(changed).issues.join(' ')
    expect(issues).toMatch(/prompt/)
    expect(issues).toMatch(/accessory/)
    expect(issues).toMatch(/extra/)
    expect(issues).toMatch(/rgb/)
  })
})
