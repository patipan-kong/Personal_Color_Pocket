import { createServer as createHttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createServer as createViteServer } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import type { OutfitPreviewInput } from '../../src/domain/todayOutfitProduction/previewContract.js'
import { requestOutfitPreview } from '../../src/services/outfitPreview.js'
import { aiColorLabDevServer } from '../devServer.js'
import type { OutfitPreviewProvider, PreviewTraceEvent } from './outfitPreviewHandler.js'

const input: OutfitPreviewInput = {
  version: 1,
  mode: 'flat-lay',
  outfit: {
    kind: 'one-piece',
    onePiece: { garmentType: 'dress', color: { hex: '#B93A43' } },
    outerwear: null,
    shoes: { garmentType: 'sneakers', color: { hex: '#111111' } },
  },
}

const success = { ok: true as const, mimeType: 'image/png' as const, imageDataUrl: 'data:image/png;base64,AAAA' }
const successResult = { mimeType: success.mimeType, imageDataUrl: success.imageDataUrl }

interface Harness {
  readonly url: string
  readonly events: PreviewTraceEvent[]
  close(): Promise<void>
}

async function startHarness(provider: OutfitPreviewProvider, timeoutMs: number): Promise<Harness> {
  const events: PreviewTraceEvent[] = []
  const vite = await createViteServer({
    configFile: false,
    appType: 'custom',
    plugins: [aiColorLabDevServer({ outfitPreview: { provider, timeoutMs, trace: (event) => events.push(event) } })],
    server: { middlewareMode: true },
  })
  const server = createHttpServer(vite.middlewares)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${address.port}`,
    events,
    close: async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
      await vite.close()
    },
  }
}

async function withHarnessFetch<T>(url: string, operation: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = ((inputValue: RequestInfo | URL, init?: RequestInit) => {
    const inputUrl = typeof inputValue === 'string' && inputValue.startsWith('/') ? `${url}${inputValue}` : inputValue
    return originalFetch(inputUrl, init)
  }) as typeof fetch
  try {
    return await operation()
  } finally {
    globalThis.fetch = originalFetch
  }
}

afterEach(() => { delete process.env.GEMINI_API_KEY })

describe('actual Vite Preview route integration', () => {
  it('completes the real HTTP route and client service with an injected immediate provider', async () => {
    process.env.GEMINI_API_KEY = 'integration-test-key'
    const provider: OutfitPreviewProvider = async (_input, signal) => {
      expect(signal.aborted).toBe(false)
      return success
    }
    const harness = await startHarness(provider, 200)
    try {
      const response = await fetch(`${harness.url}/api/today-outfit/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(2_000),
      })
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ ok: true, result: successResult })
      expect(await withHarnessFetch(harness.url, () => requestOutfitPreview(input))).toEqual({ ok: true, result: successResult })
      await new Promise<void>((resolve) => setImmediate(resolve))
      expect(harness.events.map((event) => event.name)).toEqual(expect.arrayContaining([
        'route-accepted', 'handler-entered', 'deadline-created', 'provider-invocation-started',
        'race-settled', 'send-json-started', 'response-finished', 'response-closed',
      ]))
      expect(harness.events.some((event) => event.name === 'deadline-fired')).toBe(false)
    } finally {
      await harness.close()
    }
  })

  it('settles the real HTTP route and client service at a short real-timer test deadline', async () => {
    process.env.GEMINI_API_KEY = 'integration-test-key'
    let providerStarted = false
    let abortObserved = false
    const provider: OutfitPreviewProvider = (_input, signal) => {
      providerStarted = true
      return new Promise(() => {
        signal.addEventListener('abort', () => { abortObserved = true }, { once: true })
      })
    }
    const harness = await startHarness(provider, 75)
    try {
      const startedAt = performance.now()
      const response = await fetch(`${harness.url}/api/today-outfit/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(2_000),
      })
      const elapsedMs = performance.now() - startedAt
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ ok: false, error: { kind: 'timeout', message: 'The preview took too long.' } })
      expect(await withHarnessFetch(harness.url, () => requestOutfitPreview(input))).toEqual({ ok: false, error: { kind: 'timeout', message: 'The preview took too long.' } })
      await new Promise<void>((resolve) => setImmediate(resolve))
      expect(providerStarted).toBe(true)
      expect(abortObserved).toBe(true)
      expect(elapsedMs).toBeGreaterThanOrEqual(50)
      expect(elapsedMs).toBeLessThan(1_000)
      const names = harness.events.map((event) => event.name)
      expect(names).toEqual(expect.arrayContaining([
        'route-accepted', 'handler-entered', 'deadline-created', 'provider-invocation-started',
        'deadline-fired', 'abort-requested', 'race-settled', 'send-json-started',
        'response-finished', 'response-closed',
      ]))
      expect(names.indexOf('abort-requested')).toBeLessThan(names.indexOf('deadline-fired'))
      expect(names.indexOf('race-settled')).toBeGreaterThan(names.indexOf('deadline-fired'))
      expect(names.indexOf('send-json-started')).toBeGreaterThan(names.indexOf('race-settled'))
    } finally {
      await harness.close()
    }
  })
})
