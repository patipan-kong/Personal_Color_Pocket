import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OutfitPreviewInput } from '../../src/domain/todayOutfitProduction/previewContract.js'

vi.mock('./geminiImageProvider.js', () => ({ runGeminiImageProvider: vi.fn() }))

const input: OutfitPreviewInput = { version: 1, mode: 'flat-lay', outfit: { kind: 'one-piece', onePiece: { garmentType: 'dress', color: { hex: '#112233' } }, outerwear: null, shoes: { garmentType: 'heels', color: { hex: '#FFFFFF' } } } }
afterEach(() => vi.resetAllMocks())

describe('production Outfit Preview provider', () => {
  it('uses only the fixed production Lite model and returns no provider metadata', async () => {
    const transport = await import('./geminiImageProvider.js')
    vi.mocked(transport.runGeminiImageProvider).mockResolvedValue({ ok: true, mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,AAAA', usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } })
    const { runOutfitPreviewProvider } = await import('./outfitPreviewProvider.js')
    const result = await runOutfitPreviewProvider(input, new AbortController().signal)
    expect(result).toEqual({ ok: true, mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,AAAA' })
    expect(transport.runGeminiImageProvider).toHaveBeenCalledOnce()
    expect(vi.mocked(transport.runGeminiImageProvider).mock.calls[0][0]).toMatchObject({ model: 'gemini-3.1-flash-lite-image', diagnosticLabel: 'Today Outfit Preview' })
  })

  it('normalizes transport failure without a fallback call', async () => {
    const transport = await import('./geminiImageProvider.js')
    vi.mocked(transport.runGeminiImageProvider).mockResolvedValue({ ok: false, error: { kind: 'rate-limited', httpStatus: 429, message: 'provider detail' } })
    const { runOutfitPreviewProvider } = await import('./outfitPreviewProvider.js')
    await expect(runOutfitPreviewProvider(input, new AbortController().signal)).resolves.toEqual({ ok: false, error: { kind: 'rate-limited', message: 'The preview service is busy.' } })
    expect(transport.runGeminiImageProvider).toHaveBeenCalledOnce()
  })
})
