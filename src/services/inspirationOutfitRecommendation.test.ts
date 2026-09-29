import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildInspirationOutfitRequest } from '../domain/todayOutfitProduction/inspirationRequest'
import { requestInspirationOutfitRecommendation } from './inspirationOutfitRecommendation'

const request = buildInspirationOutfitRequest({ date: new Date(2026, 8, 21), goals: [], subtype: 'warm-spring', gender: 'men', occasion: 'casual' })
const outfit = (shoes: string) => ({
  outfit: {
    kind: 'separates',
    top: { garmentType: 'polo', color: { kind: 'generic', colorId: 'red' } },
    bottom: { garmentType: 'shorts', color: { kind: 'generic', colorId: 'beige' } },
    outerwear: null,
    shoes: { garmentType: shoes, color: { kind: 'generic', colorId: 'brown' } },
  },
})

afterEach(() => vi.restoreAllMocks())

describe('Inspiration client boundary and gender', () => {
  it('sends the selected gender and rejects a men-profile result containing high heels', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, result: outfit('heels') }), { status: 200 }))
    const outcome = await requestInspirationOutfitRecommendation(request)
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).gender).toBe('men')
    expect(outcome.ok).toBe(false)
  })

  it('accepts a unisex result for the same profile', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, result: outfit('loafers') }), { status: 200 }))
    expect((await requestInspirationOutfitRecommendation(request)).ok).toBe(true)
  })
})
