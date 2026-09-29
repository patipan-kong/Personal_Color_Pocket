import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GEMINI_IMAGE_ASPECT_RATIO, GEMINI_IMAGE_SIZE, runGeminiImageProvider } from './geminiImageProvider.js'

beforeEach(() => { process.env.GEMINI_API_KEY = 'test-only'; vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { delete process.env.GEMINI_API_KEY; vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('shared Gemini image transport', () => {
  it('uses the exact protobuf REST enum values for production Lite', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }] } }] }), { status: 200 }))
    const result = await runGeminiImageProvider({ prompt: 'server-owned prompt', model: 'gemini-3.1-flash-lite-image', signal: new AbortController().signal, diagnosticLabel: 'test' })
    expect(result).toMatchObject({ ok: true, mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,AAAA' })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite-image:generateContent')
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body).toEqual({
      contents: [{ parts: [{ text: 'server-owned prompt' }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        responseFormat: { image: { aspectRatio: 'ASPECT_RATIO_ONE_BY_ONE', imageSize: 'IMAGE_SIZE_ONE_K' } },
      },
    })
    expect(body.generationConfig.responseFormat.image.aspectRatio).toBe(GEMINI_IMAGE_ASPECT_RATIO)
    expect(body.generationConfig.responseFormat.image.imageSize).toBe(GEMINI_IMAGE_SIZE)
    expect(body.generationConfig.responseFormat.image.aspectRatio).not.toBe('1:1')
    expect(body.generationConfig.responseFormat.image.imageSize).not.toBe('1K')
  })

  it('rejects unsupported MIME and malformed base64 without exposing provider data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/svg+xml', data: 'AAAA' } }] } }] }), { status: 200 }))
    await expect(runGeminiImageProvider({ prompt: 'safe', model: 'model', signal: new AbortController().signal, diagnosticLabel: 'test' })).resolves.toMatchObject({ ok: false, error: { kind: 'malformed-response' } })
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'not base64!' } }] } }] }), { status: 200 }))
    await expect(runGeminiImageProvider({ prompt: 'safe', model: 'model', signal: new AbortController().signal, diagnosticLabel: 'test' })).resolves.toMatchObject({ ok: false, error: { kind: 'malformed-response' } })
  })
})
