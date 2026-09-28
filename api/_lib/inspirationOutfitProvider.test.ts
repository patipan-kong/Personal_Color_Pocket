import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InspirationOutfitRequest } from '../../src/domain/todayOutfitProduction/inspirationContract.js'
import { GARMENT_TYPES } from '../../src/domain/wardrobe/taxonomy.js'
import { BASIC_WARDROBE_COLORS } from '../../src/domain/wardrobe/colors.js'
import { TODAY_OUTFIT_PROVIDER, runInspirationOutfitProvider } from './inspirationOutfitProvider.js'

const request: InspirationOutfitRequest = { version: 1, subtype: null, occasion: 'casual', allowedGarmentTypes: GARMENT_TYPES, canonicalColorIds: [], genericColorIds: BASIC_WARDROBE_COLORS.map((color) => color.id), luckyPreferences: [] }
const valid = { outfit: { kind: 'separates', top: { garmentType: 't-shirt', color: { kind: 'generic', colorId: 'beige' } }, bottom: { garmentType: 'jeans', color: { kind: 'generic', colorId: 'navy' } }, outerwear: null, shoes: { garmentType: 'sneakers', color: { kind: 'generic', colorId: 'white' } } } }

beforeEach(() => { process.env.GROQ_API_KEY = 'test-secret' })
afterEach(() => { delete process.env.GROQ_API_KEY; vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('production Inspiration provider', () => {
  it('reuses the one production provider choice and asks for identity-only structured output', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(valid) } }] }), { status: 200 }))
    await expect(runInspirationOutfitProvider(request, new AbortController().signal)).resolves.toEqual({ ok: true, result: valid })
    const init = fetchMock.mock.calls[0][1]!
    const outbound = JSON.parse(init.body as string)
    expect(outbound.model).toBe(TODAY_OUTFIT_PROVIDER.model)
    expect(outbound.response_format).toEqual({ type: 'json_object' })
    expect(JSON.stringify(outbound)).not.toMatch(/wardrobeId|customName|localStorage|photo|quiz|test-secret/i)
  })

  it('rejects arbitrary colors and never returns the provider envelope', async () => {
    const invalid = structuredClone(valid)
    invalid.outfit.top.color = { kind: 'generic', colorId: 'invented' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(invalid) } }] }), { status: 200 }))
    const outcome = await runInspirationOutfitProvider(request, new AbortController().signal)
    expect(outcome).toMatchObject({ ok: false, error: { kind: 'malformed-response' }, issues: expect.any(Array) })
    expect(JSON.stringify(outcome)).not.toContain('choices')
  })

  it('normalizes provider errors without another provider fallback or leaking details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ secret: 'provider detail' }), { status: 429 }))
    const outcome = await runInspirationOutfitProvider(request, new AbortController().signal)
    expect(outcome).toEqual({ ok: false, error: { kind: 'rate-limited', message: 'The recommendation service is busy.', httpStatus: 429 } })
    expect(JSON.stringify(outcome)).not.toContain('provider detail')
  })
})
