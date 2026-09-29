import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InspirationOutfitRequest } from '../../src/domain/todayOutfitProduction/inspirationContract.js'
import { BASIC_WARDROBE_COLORS } from '../../src/domain/wardrobe/colors.js'

vi.mock('./inspirationOutfitProvider', () => ({ runInspirationOutfitProvider: vi.fn() }))

const body: InspirationOutfitRequest = { version: 1, subtype: null, occasion: 'casual', gender: null, canonicalColorIds: [], genericColorIds: BASIC_WARDROBE_COLORS.map((color) => color.id), luckyPreferences: [] }
const result = { outfit: { kind: 'separates' as const, top: { garmentType: 't-shirt' as const, color: { kind: 'generic' as const, colorId: 'beige' as const } }, bottom: { garmentType: 'jeans' as const, color: { kind: 'generic' as const, colorId: 'navy' as const } }, outerwear: null, shoes: { garmentType: 'sneakers' as const, color: { kind: 'generic' as const, colorId: 'white' as const } } } }

function request(value: unknown): IncomingMessage {
  const req = Readable.from([JSON.stringify(value)]) as unknown as IncomingMessage
  req.method = 'POST'; req.url = '/api/today-outfit/inspiration'; return req
}
function response() {
  let payload = ''
  const res = { statusCode: 200, setHeader: vi.fn(), end: vi.fn((value: string) => { payload = value }) } as unknown as ServerResponse
  return { res, read: () => ({ status: res.statusCode, body: JSON.parse(payload) }) }
}

beforeEach(() => { process.env.GROQ_API_KEY = 'test-key'; vi.resetAllMocks() })
afterEach(() => { delete process.env.GROQ_API_KEY })

describe('production Inspiration handler', () => {
  it('returns only normalized recommendation facts', async () => {
    const provider = await import('./inspirationOutfitProvider')
    vi.mocked(provider.runInspirationOutfitProvider).mockResolvedValue({ ok: true, result })
    const target = response()
    const { handleInspirationOutfitRequest } = await import('./inspirationOutfitHandler')
    await handleInspirationOutfitRequest(request(body), target.res)
    expect(target.read()).toEqual({ status: 200, body: { ok: true, result } })
  })

  it('rejects wardrobe/private fields before provider invocation', async () => {
    const provider = await import('./inspirationOutfitProvider')
    const target = response()
    const { handleInspirationOutfitRequest } = await import('./inspirationOutfitHandler')
    await handleInspirationOutfitRequest(request({ ...body, wardrobe: [{ id: 'private-id', customName: 'private' }] }), target.res)
    expect(target.read()).toMatchObject({ status: 400, body: { ok: false, error: { kind: 'bad-request' } } })
    expect(provider.runInspirationOutfitProvider).not.toHaveBeenCalled()
  })

  it('does not call the provider without the server credential', async () => {
    delete process.env.GROQ_API_KEY
    const provider = await import('./inspirationOutfitProvider')
    const target = response()
    const { handleInspirationOutfitRequest } = await import('./inspirationOutfitHandler')
    await handleInspirationOutfitRequest(request(body), target.res)
    expect(target.read().body.error.kind).toBe('not-configured')
    expect(provider.runInspirationOutfitProvider).not.toHaveBeenCalled()
  })
})
