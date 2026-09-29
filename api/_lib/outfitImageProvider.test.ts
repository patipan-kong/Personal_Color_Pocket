import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recommendDeterministicOutfit } from '../../src/domain/todayOutfit/baseline'
import { OUTFIT_BAKEOFF_CASES } from '../../src/domain/todayOutfit/cases'
import { deriveTodayOutfitImageRequest } from '../../src/domain/todayOutfitImage/contract'
import { buildOutfitImagePrompt } from './outfitImagePrompt'
import { runOutfitImageProvider } from './outfitImageProvider'

const input = OUTFIT_BAKEOFF_CASES[0]
const recommendation = recommendDeterministicOutfit(input)
if (recommendation.status !== 'success') throw new Error('fixture must succeed')
const request = deriveTodayOutfitImageRequest(input, recommendation, 'gemini-image-lite')

beforeEach(() => { process.env.GEMINI_API_KEY = 'test-only'; vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { delete process.env.GEMINI_API_KEY; vi.restoreAllMocks(); vi.unstubAllGlobals() })

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const run = (model = 'gemini-3.1-flash-lite-image') => runOutfitImageProvider(request, new AbortController().signal, model)

describe('Gemini Today Outfit image adapter', () => {
  it.each([
    'gemini-3.1-flash-lite-image',
    'gemini-3.1-flash-image',
  ])('uses protobuf REST enum values for image response format with %s', async (model) => {
    vi.mocked(fetch).mockResolvedValue(response({ candidates: [{ content: { parts: [{ text: 'Done' }, { inlineData: { mimeType: 'image/png', data: 'AAAA' } }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 } }))
    await expect(run(model)).resolves.toEqual({ ok: true, mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,AAAA', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } })
    const call = vi.mocked(fetch).mock.calls[0]
    expect(call[0]).toBe(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`)
    expect(call[1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': 'test-only' },
    })
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({
      contents: [{ parts: [{ text: buildOutfitImagePrompt(request) }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        responseFormat: { image: { aspectRatio: 'ASPECT_RATIO_ONE_BY_ONE', imageSize: 'IMAGE_SIZE_ONE_K' } },
      },
    })
  })

  it.each([
    ['missing image', { candidates: [{ content: { parts: [] } }] }],
    ['text-only response', { candidates: [{ content: { parts: [{ text: 'No image' }] } }] }],
    ['unsupported MIME', { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/svg+xml', data: 'AAAA' } }] } }] }],
    ['malformed response', { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: '***' } }] } }] }],
  ])('normalizes a %s as malformed-response', async (_label, body) => {
    vi.mocked(fetch).mockResolvedValue(response(body))
    const result = await run()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('malformed-response')
  })

  it('logs only sanitized provider diagnostics while returning a normalized HTTP error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(fetch).mockResolvedValue(response({
      error: {
        code: 400,
        status: 'INVALID_ARGUMENT',
        message: 'Invalid image generation configuration for test-only.',
        details: [{
          '@type': 'type.googleapis.com/google.rpc.BadRequest',
          fieldViolations: [{ field: 'generation_config.response_format.image.image_size', description: 'Unsupported value.' }],
          authorization: 'must-not-be-logged',
          inlineData: { data: 'AAAA' },
        }],
        secretProviderEnvelope: true,
      },
      generatedImage: 'AAAA',
    }, 400))

    await expect(run()).resolves.toEqual({ ok: false, error: { kind: 'bad-request', httpStatus: 400, message: 'The provider rejected the request.' } })
    expect(log).toHaveBeenCalledWith('[Today Outfit Image Lab] Gemini provider request failed', {
      model: 'gemini-3.1-flash-lite-image',
      httpStatus: 400,
      providerCode: 400,
      providerStatus: 'INVALID_ARGUMENT',
      providerMessage: 'Invalid image generation configuration for [REDACTED].',
      providerDetails: [{
        type: 'type.googleapis.com/google.rpc.BadRequest',
        fieldViolations: [{ field: 'generation_config.response_format.image.image_size', description: 'Unsupported value.' }],
      }],
    })
    expect(JSON.stringify(log.mock.calls)).not.toContain('must-not-be-logged')
    expect(JSON.stringify(log.mock.calls)).not.toContain('AAAA')
    expect(JSON.stringify(log.mock.calls)).not.toContain('test-only')
  })
})
