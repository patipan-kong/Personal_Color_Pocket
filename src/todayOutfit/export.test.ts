import { describe, expect, it, vi } from 'vitest'
import { OUTFIT_BAKEOFF_CASES } from '../domain/todayOutfit/cases'
import { recommendDeterministicOutfit } from '../domain/todayOutfit/baseline'
import { buildOutfitLabExport, EMPTY_OUTFIT_REVIEW } from './export'

describe('Today Outfit lab export', () => {
  it('exports the explicit analysis shape without secrets or fake cost estimates', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-27T00:00:00Z'))
    const input = OUTFIT_BAKEOFF_CASES[0]
    const baseline = recommendDeterministicOutfit(input)
    const data = buildOutfitLabExport([{ id: 'run-1', caseId: input.id, input, candidateId: 'openai', latencyMs: 40, result: baseline, error: null, validation: { valid: true, issues: [] }, baseline, usage: null, review: { ...EMPTY_OUTFIT_REVIEW }, timestamp: '2026-09-27T00:00:00.000Z' }])
    expect(data.runs[0]).toMatchObject({ caseId: input.id, inputSubtype: input.subtype, candidate: { provider: 'openai', model: 'gpt-5-mini' }, latencyMs: 40, usage: null })
    expect(JSON.stringify(data)).not.toMatch(/api.?key|authorization|estimatedCost/i)
    vi.useRealTimers()
  })
})
