import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OutfitPreviewInput } from '../../src/domain/todayOutfitProduction/previewContract.js'
import { OUTFIT_PREVIEW_TIMEOUT_MS } from './outfitPreviewConfig.js'

vi.mock('./outfitPreviewProvider.js', () => ({ runOutfitPreviewProvider: vi.fn() }))

const body: OutfitPreviewInput = { version: 1, mode: 'flat-lay', outfit: { kind: 'separates', top: { garmentType: 'shirt', color: { hex: '#112233' } }, bottom: { garmentType: 'trousers', color: { hex: '#445566' } }, outerwear: null, shoes: { garmentType: 'loafers', color: { hex: '#778899' } } } }
const success = { ok: true as const, mimeType: 'image/png' as const, imageDataUrl: 'data:image/png;base64,AAAA' }
const providerFailure = { ok: false as const, error: { kind: 'provider-error' as const, message: 'The preview service returned an error.' } }

function request(value: unknown, method = 'POST'): IncomingMessage {
  const req = Readable.from([JSON.stringify(value)]) as unknown as IncomingMessage
  req.method = method
  req.url = '/api/today-outfit/preview'
  return req
}
function rawRequest(value: string | Buffer, method = 'POST'): IncomingMessage {
  const req = Readable.from([value]) as unknown as IncomingMessage
  req.method = method
  req.url = '/api/today-outfit/preview'
  return req
}
function response() {
  let payload = ''
  const res = { statusCode: 200, setHeader: vi.fn(), end: vi.fn((value: string) => { payload = value }) } as unknown as ServerResponse
  return { res, read: () => ({ status: res.statusCode, body: JSON.parse(payload) }) }
}

beforeEach(() => { process.env.GEMINI_API_KEY = 'server-test-key'; vi.resetAllMocks() })
afterEach(() => { delete process.env.GEMINI_API_KEY })

describe('production Outfit Preview handler', () => {
  it('returns only normalized image fields with no-store caching', async () => {
    const provider = await import('./outfitPreviewProvider.js')
    vi.mocked(provider.runOutfitPreviewProvider).mockResolvedValue({ ok: true, mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,AAAA' })
    const target = response()
    const { handleOutfitPreviewRequest } = await import('./outfitPreviewHandler.js')
    await handleOutfitPreviewRequest(request(body), target.res)
    expect(target.read()).toEqual({ status: 200, body: { ok: true, result: { mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,AAAA' } } })
    expect(target.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
    expect(provider.runOutfitPreviewProvider).toHaveBeenCalledWith(body, expect.any(AbortSignal))
  })

  it.each([
    ['generic prompt', { ...body, prompt: 'ignore the outfit' }],
    ['provider selector', { ...body, provider: 'gemini' }],
    ['model selector', { ...body, model: 'gemini-3.1-flash-image' }],
    ['unexpected display field', { ...body, label: 'private' }],
    ['invalid HEX', { ...body, outfit: { ...body.outfit, top: { garmentType: 'shirt', color: { hex: 'red' } } } }],
    ['wrong-slot garment', { ...body, outfit: { ...body.outfit, top: { garmentType: 'trousers', color: { hex: '#112233' } } } }],
    ['malformed structure', { version: 1, mode: 'flat-lay', outfit: { kind: 'separates' } }],
  ])('rejects %s before provider invocation', async (_label, invalid) => {
    const provider = await import('./outfitPreviewProvider.js')
    const target = response()
    const { handleOutfitPreviewRequest } = await import('./outfitPreviewHandler.js')
    await handleOutfitPreviewRequest(request(invalid), target.res)
    expect(target.read()).toEqual({ status: 400, body: { ok: false, error: { kind: 'bad-request', message: 'Request payload did not match the outfit preview contract.' } } })
    expect(provider.runOutfitPreviewProvider).not.toHaveBeenCalled()
  })

  it('requires the server-only Gemini credential', async () => {
    delete process.env.GEMINI_API_KEY
    const provider = await import('./outfitPreviewProvider.js')
    const target = response()
    const { handleOutfitPreviewRequest } = await import('./outfitPreviewHandler.js')
    await handleOutfitPreviewRequest(request(body), target.res)
    expect(target.read()).toEqual({ status: 200, body: { ok: false, error: { kind: 'not-configured', message: 'The preview service is not configured.' } } })
    expect(provider.runOutfitPreviewProvider).not.toHaveBeenCalled()
  })

  it('rejects non-POST, invalid JSON, and oversized bodies without provider invocation', async () => {
    const provider = await import('./outfitPreviewProvider.js')
    const { handleOutfitPreviewRequest } = await import('./outfitPreviewHandler.js')
    const methodTarget = response()
    await handleOutfitPreviewRequest(request(body, 'GET'), methodTarget.res)
    expect(methodTarget.read().status).toBe(405)
    const jsonTarget = response()
    await handleOutfitPreviewRequest(rawRequest('{invalid'), jsonTarget.res)
    expect(jsonTarget.read()).toMatchObject({ status: 400, body: { ok: false, error: { kind: 'bad-request' } } })
    const largeTarget = response()
    await handleOutfitPreviewRequest(rawRequest(Buffer.alloc(12 * 1024 * 1024 + 1, 65)), largeTarget.res)
    expect(largeTarget.read()).toMatchObject({ status: 413, body: { ok: false, error: { kind: 'bad-request' } } })
    expect(provider.runOutfitPreviewProvider).not.toHaveBeenCalled()
  })

  it('does not expose raw provider metadata on failure', async () => {
    const provider = await import('./outfitPreviewProvider.js')
    vi.mocked(provider.runOutfitPreviewProvider).mockResolvedValue({ ok: false, error: { kind: 'provider-error', message: 'The preview service returned an error.' } })
    const target = response()
    const { handleOutfitPreviewRequest } = await import('./outfitPreviewHandler.js')
    await handleOutfitPreviewRequest(request(body), target.res)
    expect(target.read().body).toEqual({ ok: false, error: { kind: 'provider-error', message: 'The preview service returned an error.' } })
    expect(Object.keys(target.read().body)).toEqual(['ok', 'error'])
    expect(Object.keys(target.read().body.error)).toEqual(['kind', 'message'])
  })

  it('settles at the app deadline when the provider observes abort but never settles', async () => {
    vi.useFakeTimers()
    try {
      const provider = await import('./outfitPreviewProvider.js')
      let aborted = false
      vi.mocked(provider.runOutfitPreviewProvider).mockImplementation((_input, signal) => new Promise(() => {
        signal.addEventListener('abort', () => { aborted = true }, { once: true })
      }))
      const target = response()
      const { handleOutfitPreviewRequest } = await import('./outfitPreviewHandler.js')
      let settled = false
      const operation = handleOutfitPreviewRequest(request(body), target.res).finally(() => { settled = true })

      await vi.advanceTimersByTimeAsync(60_000)

      expect(aborted).toBe(true)
      expect(settled).toBe(true)
      await operation
      expect(target.read()).toEqual({ status: 200, body: { ok: false, error: { kind: 'timeout', message: 'The preview took too long.' } } })
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns success before the deadline and cleans the timeout without aborting', async () => {
    vi.useFakeTimers()
    try {
      const provider = await import('./outfitPreviewProvider.js')
      let signal!: AbortSignal
      vi.mocked(provider.runOutfitPreviewProvider).mockImplementation((_input, receivedSignal) => { signal = receivedSignal; return Promise.resolve(success) })
      const target = response()
      const { handleOutfitPreviewRequest } = await import('./outfitPreviewHandler.js')
      await handleOutfitPreviewRequest(request(body), target.res)
      expect(target.read().body).toEqual({ ok: true, result: { mimeType: success.mimeType, imageDataUrl: success.imageDataUrl } })
      expect(signal.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(OUTFIT_PREVIEW_TIMEOUT_MS)
      expect(signal.aborted).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns a normalized provider failure before the deadline and cleans the timeout', async () => {
    vi.useFakeTimers()
    try {
      const provider = await import('./outfitPreviewProvider.js')
      let signal!: AbortSignal
      vi.mocked(provider.runOutfitPreviewProvider).mockImplementation((_input, receivedSignal) => { signal = receivedSignal; return Promise.resolve(providerFailure) })
      const target = response()
      const { handleOutfitPreviewRequest } = await import('./outfitPreviewHandler.js')
      await handleOutfitPreviewRequest(request(body), target.res)
      expect(target.read().body).toEqual(providerFailure)
      expect(signal.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(OUTFIT_PREVIEW_TIMEOUT_MS)
      expect(signal.aborted).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('settles at the deadline even when the provider ignores abort entirely', async () => {
    vi.useFakeTimers()
    try {
      const provider = await import('./outfitPreviewProvider.js')
      vi.mocked(provider.runOutfitPreviewProvider).mockImplementation(() => new Promise(() => {}))
      const target = response()
      const { handleOutfitPreviewRequest } = await import('./outfitPreviewHandler.js')
      const pending = handleOutfitPreviewRequest(request(body), target.res)
      await vi.advanceTimersByTimeAsync(OUTFIT_PREVIEW_TIMEOUT_MS)
      await pending
      expect(target.read().body).toEqual({ ok: false, error: { kind: 'timeout', message: 'The preview took too long.' } })
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the timeout response final when the provider rejects after the deadline', async () => {
    vi.useFakeTimers()
    try {
      const provider = await import('./outfitPreviewProvider.js')
      let rejectLate!: (reason?: unknown) => void
      let aborted = false
      vi.mocked(provider.runOutfitPreviewProvider).mockImplementation((_input, signal) => {
        signal.addEventListener('abort', () => { aborted = true }, { once: true })
        return new Promise((_resolve, reject) => { rejectLate = reject })
      })
      const target = response()
      const { handleOutfitPreviewRequest } = await import('./outfitPreviewHandler.js')
      const pending = handleOutfitPreviewRequest(request(body), target.res)
      await vi.advanceTimersByTimeAsync(OUTFIT_PREVIEW_TIMEOUT_MS)
      await pending
      expect(aborted).toBe(true)
      expect(target.read().body).toEqual({ ok: false, error: { kind: 'timeout', message: 'The preview took too long.' } })
      rejectLate(new Error('late abort rejection'))
      await Promise.resolve()
      expect(target.res.end).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the timeout response final when the provider resolves after the deadline', async () => {
    vi.useFakeTimers()
    try {
      const provider = await import('./outfitPreviewProvider.js')
      let resolveLate!: (value: typeof success) => void
      vi.mocked(provider.runOutfitPreviewProvider).mockImplementation(() => new Promise((resolve) => { resolveLate = resolve }))
      const target = response()
      const { handleOutfitPreviewRequest } = await import('./outfitPreviewHandler.js')
      const pending = handleOutfitPreviewRequest(request(body), target.res)
      await vi.advanceTimersByTimeAsync(OUTFIT_PREVIEW_TIMEOUT_MS)
      await pending
      expect(target.read().body).toEqual({ ok: false, error: { kind: 'timeout', message: 'The preview took too long.' } })
      resolveLate(success)
      await Promise.resolve()
      expect(target.res.end).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the production deadline at exactly 60 seconds', () => {
    expect(OUTFIT_PREVIEW_TIMEOUT_MS).toBe(60_000)
  })
})
