import { describe, expect, it } from 'vitest'
import { recommendDeterministicOutfit } from '../domain/todayOutfit/baseline'
import { OUTFIT_BAKEOFF_CASES } from '../domain/todayOutfit/cases'
import { deriveTodayOutfitImageRequest, outfitImageSourceKey } from '../domain/todayOutfitImage/contract'
import { buildOutfitImageLabExport, EMPTY_OUTFIT_IMAGE_REVIEW } from './outfitImageExport'

describe('Today Outfit image Lab export', () => {
  it('keeps metadata and PO review but excludes image bytes, keys, and raw provider data', () => {
    const input = OUTFIT_BAKEOFF_CASES[0]
    const recommendation = recommendDeterministicOutfit(input)
    if (recommendation.status !== 'success') throw new Error('fixture must succeed')
    const request = deriveTodayOutfitImageRequest(input, recommendation, 'gemini-image-lite')
    const data = buildOutfitImageLabExport([{
      id: 'image-1', sourceKey: outfitImageSourceKey(request), caseId: input.id, request,
      result: { status: 'success', candidate: request.candidate, provider: 'gemini', model: 'gemini-3.1-flash-lite-image', mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,SECRETBYTES', latencyMs: 1234, usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      review: { ...EMPTY_OUTFIT_IMAGE_REVIEW, visualQuality: 'good', constraintCompliance: 'pass', note: 'Useful.' }, timestamp: '2026-09-27T00:00:00.000Z',
    }])
    expect(data.runs[0]).toMatchObject({ sourceTodayOutfitCaseId: input.id, subtype: input.subtype, visualizationMode: 'flat-lay', normalizedStatus: 'success', image: { mimeType: 'image/png', generated: true }, poReview: { visualQuality: 'good', constraintCompliance: 'pass', note: 'Useful.' } })
    const serialized = JSON.stringify(data)
    expect(serialized).not.toContain('data:image')
    expect(serialized).not.toContain('SECRETBYTES')
    expect(serialized).not.toMatch(/api.?key|rawProvider|rawResponse/i)
  })
})
