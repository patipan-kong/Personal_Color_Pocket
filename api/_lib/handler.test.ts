import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Isolate handler.ts from real network calls: only its own orchestration (key check, timeout,
// crash containment, request validation, envelope shape) is under test here. Provider-specific
// request/response shaping is covered separately in each api/_lib/providers/*.test.ts and the
// prompt-parity test.
vi.mock('./providers/gemini', () => ({ runProvider: vi.fn() }))
vi.mock('./providers/openai', () => ({ runProvider: vi.fn() }))
vi.mock('./providers/groq', () => ({ runProvider: vi.fn() }))
vi.mock('./providers/deepseek', () => ({ runProvider: vi.fn() }))

const VALID_BODY = {
  imageDataUrl: 'data:image/jpeg;base64,AAAA',
  sample: { hex: '#C08080', rgb: { r: 192, g: 128, b: 128 }, oklabL: 0.6, colorName: null, flags: [] },
  subtype: null,
}

function fakeRequest(body: unknown, method = 'POST'): IncomingMessage {
  const req = Readable.from([JSON.stringify(body)]) as unknown as Readable & { method: string; url: string }
  req.method = method
  req.url = '/api/ai-color/gemini'
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
  delete process.env.OPENAI_API_KEY
  vi.resetAllMocks()
})
afterEach(() => { process.env = { ...originalEnv } })

describe('handleAiColorRequest', () => {
  it('returns not-configured without calling the adapter when the key is missing (plan §20)', async () => {
    delete process.env.GEMINI_API_KEY
    const { handleAiColorRequest } = await import('./handler')
    const gemini = await import('./providers/gemini')
    const { res, read } = fakeResponse()
    await handleAiColorRequest('gemini', fakeRequest(VALID_BODY), res)
    const { statusCode, body } = read()
    expect(statusCode).toBe(200)
    expect(body).toEqual({ ok: false, latencyMs: expect.any(Number), error: { kind: 'not-configured', httpStatus: null, message: expect.any(String) } })
    expect(gemini.runProvider).not.toHaveBeenCalled()
  })

  it('passes through a successful adapter outcome with latency attached', async () => {
    const { handleAiColorRequest } = await import('./handler')
    const gemini = await import('./providers/gemini')
    vi.mocked(gemini.runProvider).mockResolvedValue({
      ok: true, usage: null, raw: {},
      result: { provider: 'gemini', model: 'gemini-3.5-flash', perceivedColorName: 'x', colorFamily: 'x', temperature: 'warm', value: 'medium', chroma: 'medium', lighting: { condition: 'x', cast: 'neutral', severity: 'low' }, sampleAssessment: { usable: true, issue: 'none' }, suitability: 'workable', confidence: 'medium', reasoning: 'x' },
    })
    const { res, read } = fakeResponse()
    await handleAiColorRequest('gemini', fakeRequest(VALID_BODY), res)
    const { statusCode, body } = read()
    expect(statusCode).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.result.provider).toBe('gemini')
    expect(typeof body.latencyMs).toBe('number')
  })

  it('contains a thrown adapter exception as an internal error, never leaking its message (plan §16, §20)', async () => {
    const { handleAiColorRequest } = await import('./handler')
    const gemini = await import('./providers/gemini')
    vi.mocked(gemini.runProvider).mockRejectedValue(new Error('leaky stack trace with secret sauce'))
    const { res, read } = fakeResponse()
    await handleAiColorRequest('gemini', fakeRequest(VALID_BODY), res)
    const { statusCode, body } = read()
    expect(statusCode).toBe(200)
    expect(body.ok).toBe(false)
    expect(body.error.kind).toBe('internal')
    expect(JSON.stringify(body)).not.toContain('secret sauce')
  })

  it('reports a timeout when the adapter never settles within the bound, without hanging the request', async () => {
    vi.useFakeTimers()
    const { handleAiColorRequest } = await import('./handler')
    const gemini = await import('./providers/gemini')
    // Mirrors what a real adapter's `fetch(..., { signal })` does: reject once the signal
    // handler.ts passed in (the timeout-bound one) fires. The real fetch call itself is out of
    // scope for this handler-level test.
    vi.mocked(gemini.runProvider).mockImplementation((_request, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const { res, read } = fakeResponse()
    const pending = handleAiColorRequest('gemini', fakeRequest(VALID_BODY), res)
    await vi.advanceTimersByTimeAsync(40_000)
    await pending
    const { body } = read()
    expect(body.ok).toBe(false)
    expect(body.error.kind).toBe('timeout')
    vi.useRealTimers()
  })

  it('rejects a malformed request body as bad-request without touching any adapter', async () => {
    const { handleAiColorRequest } = await import('./handler')
    const gemini = await import('./providers/gemini')
    const { res, read } = fakeResponse()
    await handleAiColorRequest('gemini', fakeRequest({ nonsense: true }), res)
    const { statusCode, body } = read()
    expect(statusCode).toBe(400)
    expect(body.error.kind).toBe('bad-request')
    expect(gemini.runProvider).not.toHaveBeenCalled()
  })

  it('rejects a non-POST method', async () => {
    const { handleAiColorRequest } = await import('./handler')
    const { res, read } = fakeResponse()
    await handleAiColorRequest('gemini', fakeRequest(VALID_BODY, 'GET'), res)
    expect(read().statusCode).toBe(405)
  })
})
