import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mirrors handler.test.ts's isolation approach (plan §V): only paletteHandler.ts's own
// orchestration (key check, timeout, crash containment, request validation, always-200 envelope)
// is under test here. The adapter itself is mocked -- no real network call is made.
vi.mock('./providers/geminiPalette', () => ({ runPaletteSelectionProvider: vi.fn() }))

const VALID_BODY = {
  imageDataUrl: 'data:image/jpeg;base64,AAAA',
  subtype: 'warm-spring',
  palette: [{ colorId: 'warm-spring-best-1', name: 'Warm Coral', hex: '#E9785D' }],
}

function fakeRequest(body: unknown, method = 'POST'): IncomingMessage {
  const req = Readable.from([JSON.stringify(body)]) as unknown as Readable & { method: string; url: string }
  req.method = method
  req.url = '/api/ai-palette/gemini-flash-lite'
  return req as unknown as IncomingMessage
}

function fakeResponse() {
  let statusCode = 200
  let payload = ''
  const res = {
    setHeader: vi.fn(),
    end: vi.fn((body: string) => { payload = body }),
    get statusCode() { return statusCode },
    set statusCode(value: number) { statusCode = value },
  }
  return {
    res: res as unknown as ServerResponse,
    read: () => ({ statusCode, body: JSON.parse(payload) }),
  }
}

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key'
  vi.resetAllMocks()
})
afterEach(() => { process.env = { ...originalEnv } })

describe('handlePaletteSelectionRequest', () => {
  it('returns not-configured without calling the adapter when the key is missing', async () => {
    delete process.env.GEMINI_API_KEY
    const { handlePaletteSelectionRequest } = await import('./paletteHandler')
    const geminiPalette = await import('./providers/geminiPalette')
    const { res, read } = fakeResponse()
    await handlePaletteSelectionRequest(fakeRequest(VALID_BODY), res)
    const { statusCode, body } = read()
    expect(statusCode).toBe(200)
    expect(body).toEqual({ ok: false, latencyMs: expect.any(Number), error: { kind: 'not-configured', httpStatus: null, message: expect.any(String) } })
    expect(geminiPalette.runPaletteSelectionProvider).not.toHaveBeenCalled()
  })

  it('passes through a successful adapter outcome with latency attached', async () => {
    const { handlePaletteSelectionRequest } = await import('./paletteHandler')
    const geminiPalette = await import('./providers/geminiPalette')
    vi.mocked(geminiPalette.runPaletteSelectionProvider).mockResolvedValue({
      ok: true, usage: null, raw: {},
      result: { status: 'selected', colorId: 'warm-spring-best-1', target: { objectType: 'shirt', objectDescription: 'x' }, reasoning: 'x' },
    })
    const { res, read } = fakeResponse()
    await handlePaletteSelectionRequest(fakeRequest(VALID_BODY), res)
    const { statusCode, body } = read()
    expect(statusCode).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.result.status).toBe('selected')
    expect(typeof body.latencyMs).toBe('number')
  })

  it('contains a thrown adapter exception as an internal error, never leaking its message', async () => {
    const { handlePaletteSelectionRequest } = await import('./paletteHandler')
    const geminiPalette = await import('./providers/geminiPalette')
    vi.mocked(geminiPalette.runPaletteSelectionProvider).mockRejectedValue(new Error('leaky stack trace with secret sauce'))
    const { res, read } = fakeResponse()
    await handlePaletteSelectionRequest(fakeRequest(VALID_BODY), res)
    const { body } = read()
    expect(body.ok).toBe(false)
    expect(body.error.kind).toBe('internal')
    expect(JSON.stringify(body)).not.toContain('secret sauce')
  })

  it('reports a timeout when the adapter never settles within the bound, without hanging the request', async () => {
    vi.useFakeTimers()
    const { handlePaletteSelectionRequest } = await import('./paletteHandler')
    const geminiPalette = await import('./providers/geminiPalette')
    vi.mocked(geminiPalette.runPaletteSelectionProvider).mockImplementation((_request, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const { res, read } = fakeResponse()
    const pending = handlePaletteSelectionRequest(fakeRequest(VALID_BODY), res)
    await vi.advanceTimersByTimeAsync(40_000)
    await pending
    const { body } = read()
    expect(body.ok).toBe(false)
    expect(body.error.kind).toBe('timeout')
    vi.useRealTimers()
  })

  it('rejects a malformed request body as bad-request without touching the adapter', async () => {
    const { handlePaletteSelectionRequest } = await import('./paletteHandler')
    const geminiPalette = await import('./providers/geminiPalette')
    const { res, read } = fakeResponse()
    await handlePaletteSelectionRequest(fakeRequest({ nonsense: true }), res)
    const { statusCode, body } = read()
    expect(statusCode).toBe(400)
    expect(body.error.kind).toBe('bad-request')
    expect(geminiPalette.runPaletteSelectionProvider).not.toHaveBeenCalled()
  })

  it('rejects a non-POST method', async () => {
    const { handlePaletteSelectionRequest } = await import('./paletteHandler')
    const { res, read } = fakeResponse()
    await handlePaletteSelectionRequest(fakeRequest(VALID_BODY, 'GET'), res)
    expect(read().statusCode).toBe(405)
  })
})
