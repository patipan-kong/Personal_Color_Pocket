import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OutfitPreviewInput } from '../domain/todayOutfitProduction/previewContract'
import { requestOutfitPreview } from './outfitPreview'

const input: OutfitPreviewInput = { version: 1, mode: 'flat-lay', outfit: { kind: 'one-piece', onePiece: { garmentType: 'dress', color: { hex: '#112233' } }, outerwear: null, shoes: { garmentType: 'heels', color: { hex: '#FFFFFF' } } } }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Outfit Preview browser transport', () => {
  it('posts only the validated contract to the fixed production endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,AAAA' } }), { status: 200 })))
    await expect(requestOutfitPreview(input)).resolves.toEqual({ ok: true, result: { mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,AAAA' } })
    expect(fetch).toHaveBeenCalledWith('/api/today-outfit/preview', expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }))
  })

  it.each([
    ['raw provider metadata', { ok: true, result: { mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,AAAA' }, model: 'secret' }],
    ['unsupported MIME', { ok: true, result: { mimeType: 'image/svg+xml', imageDataUrl: 'data:image/svg+xml;base64,AAAA' } }],
    ['malformed base64', { ok: true, result: { mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,not data!' } }],
    ['raw failure details', { ok: false, error: { kind: 'provider-error', message: 'safe', raw: 'private' } }],
  ])('fails safely for %s', async (_label, payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })))
    await expect(requestOutfitPreview(input)).resolves.toEqual({ ok: false, error: { kind: 'network', message: 'The preview service is unavailable.' } })
  })

  it('rejects invalid input without making a request', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(requestOutfitPreview({ ...input, prompt: 'arbitrary' } as unknown as OutfitPreviewInput)).resolves.toMatchObject({ ok: false, error: { kind: 'bad-request' } })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('preserves caller abort semantics and normalizes an abort rejection safely', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })))
    const pending = requestOutfitPreview(input, controller.signal)
    controller.abort()
    await expect(pending).resolves.toEqual({ ok: false, error: { kind: 'network', message: 'The preview service is unavailable.' } })
  })
})
