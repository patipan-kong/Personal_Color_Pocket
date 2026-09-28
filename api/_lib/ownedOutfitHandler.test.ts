import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OwnedOutfitRequest } from '../../src/domain/todayOutfitProduction/contract.js'

vi.mock('./ownedOutfitProvider', () => ({ runOwnedOutfitProvider: vi.fn() }))

const body: OwnedOutfitRequest = {
  version: 1, language: 'en', subtype: null, occasion: 'casual', luckyPreferences: [],
  wardrobe: [
    { id: 'top', slot: 'top', garmentType: 't-shirt', hex: '#112233', formality: 'casual', personalColorCompatibility: null, luckyFamilyMatches: [] },
    { id: 'bottom', slot: 'bottom', garmentType: 'jeans', hex: '#334455', formality: 'casual', personalColorCompatibility: null, luckyFamilyMatches: [] },
    { id: 'shoes', slot: 'shoes', garmentType: 'sneakers', hex: '#FFFFFF', formality: 'casual', personalColorCompatibility: null, luckyFamilyMatches: [] },
  ],
}
const result = { selection: { kind: 'separates' as const, topId: 'top', bottomId: 'bottom', outerwearId: null, shoesId: 'shoes' }, reasoning: { occasion: 'Casual.', personalColor: null, luckyColor: null } }

function request(value: unknown): IncomingMessage {
  const req = Readable.from([JSON.stringify(value)]) as unknown as IncomingMessage
  req.method = 'POST'
  req.url = '/api/today-outfit/wardrobe'
  return req
}
function response() {
  let payload = ''
  const res = { statusCode: 200, setHeader: vi.fn(), end: vi.fn((value: string) => { payload = value }) } as unknown as ServerResponse
  return { res, read: () => ({ status: res.statusCode, body: JSON.parse(payload) }) }
}

beforeEach(() => { process.env.GROQ_API_KEY = 'test-key'; vi.resetAllMocks() })
afterEach(() => { delete process.env.GROQ_API_KEY })

describe('production owned-outfit handler', () => {
  it('returns only the validated production result, never provider/model/raw metadata', async () => {
    const provider = await import('./ownedOutfitProvider')
    vi.mocked(provider.runOwnedOutfitProvider).mockResolvedValue({ ok: true, result })
    const target = response()
    const { handleOwnedOutfitRequest } = await import('./ownedOutfitHandler')
    await handleOwnedOutfitRequest(request(body), target.res)
    expect(target.read()).toEqual({ status: 200, body: { ok: true, result } })
  })

  it('rejects invalid production requests before any provider call', async () => {
    const provider = await import('./ownedOutfitProvider')
    const target = response()
    const { handleOwnedOutfitRequest } = await import('./ownedOutfitHandler')
    await handleOwnedOutfitRequest(request({ ...body, customName: 'private' }), target.res)
    expect(target.read()).toMatchObject({ status: 400, body: { ok: false, error: { kind: 'bad-request' } } })
    expect(provider.runOwnedOutfitProvider).not.toHaveBeenCalled()
  })

  it('does not call the provider when the server-only credential is absent', async () => {
    delete process.env.GROQ_API_KEY
    const provider = await import('./ownedOutfitProvider')
    const target = response()
    const { handleOwnedOutfitRequest } = await import('./ownedOutfitHandler')
    await handleOwnedOutfitRequest(request(body), target.res)
    expect(target.read().body).toEqual({ ok: false, error: { kind: 'not-configured', message: 'The recommendation service is not configured.' } })
    expect(provider.runOwnedOutfitProvider).not.toHaveBeenCalled()
  })
})
