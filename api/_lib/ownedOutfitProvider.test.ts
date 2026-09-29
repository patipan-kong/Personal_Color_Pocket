import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OwnedOutfitRequest } from '../../src/domain/todayOutfitProduction/contract.js'
import { OWNED_OUTFIT_PROVIDER, runOwnedOutfitProvider } from './ownedOutfitProvider.js'

const request: OwnedOutfitRequest = {
  version: 1, language: 'en', subtype: null, occasion: 'casual', luckyPreferences: [],
  wardrobe: [
    { id: 'top', slot: 'top', garmentType: 't-shirt', hex: '#112233', formality: 'casual', personalColorCompatibility: null, luckyFamilyMatches: [] },
    { id: 'bottom', slot: 'bottom', garmentType: 'jeans', hex: '#334455', formality: 'casual', personalColorCompatibility: null, luckyFamilyMatches: [] },
    { id: 'shoes', slot: 'shoes', garmentType: 'sneakers', hex: '#FFFFFF', formality: 'casual', personalColorCompatibility: null, luckyFamilyMatches: [] },
  ],
}
const valid = { selection: { kind: 'separates', topId: 'top', bottomId: 'bottom', outerwearId: null, shoesId: 'shoes' }, reasoning: { occasion: 'A casual combination.', personalColor: null, luckyColor: null } }

beforeEach(() => { process.env.GROQ_API_KEY = 'test-secret' })
afterEach(() => { delete process.env.GROQ_API_KEY; vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('production owned-outfit provider', () => {
  it('uses one configured Groq/Qwen adapter and sends only the production structured request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(valid) } }] }), { status: 200 }))
    await expect(runOwnedOutfitProvider(request, new AbortController().signal)).resolves.toEqual({ ok: true, result: valid })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions')
    const init = fetchMock.mock.calls[0][1]!
    const outbound = JSON.parse(init.body as string)
    expect(outbound.model).toBe(OWNED_OUTFIT_PROVIDER.model)
    expect(outbound.response_format).toEqual({ type: 'json_object' })
    expect(outbound.messages).toHaveLength(1)
    expect(JSON.stringify(outbound)).not.toMatch(/customName|localStorage|image|photo|quiz|test-secret/i)
  })

  it('strictly rejects invented IDs instead of returning a raw provider envelope', async () => {
    const invented = { ...valid, selection: { ...valid.selection, shoesId: 'invented' } }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(invented) } }] }), { status: 200 }))
    const outcome = await runOwnedOutfitProvider(request, new AbortController().signal)
    expect(outcome).toMatchObject({ ok: false, error: { kind: 'malformed-response' }, issues: expect.any(Array) })
    expect(JSON.stringify(outcome)).not.toContain('choices')
  })

  it('normalizes provider errors without automatic fallback or leaking the response body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ secret: 'provider detail' }), { status: 429 }))
    const outcome = await runOwnedOutfitProvider(request, new AbortController().signal)
    expect(outcome).toEqual({ ok: false, error: { kind: 'rate-limited', message: 'The recommendation service is busy.', httpStatus: 429 } })
    expect(JSON.stringify(outcome)).not.toContain('provider detail')
  })
})
