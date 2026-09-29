import { afterEach, describe, expect, it, vi } from 'vitest'
import { OUTFIT_BAKEOFF_CASES } from '../../../src/domain/todayOutfit/cases.js'

const OUTPUT = JSON.stringify({ status: 'success', selectedItemIds: { topId: 'cream-tee', bottomId: 'khaki-chinos', outerwearId: null, shoesId: 'white-sneakers' }, alternative: null, reasoning: 'A coherent casual outfit.', personalColorNotes: 'Cream works well near the face.', confidence: 'medium' })

afterEach(() => { vi.restoreAllMocks(); delete process.env.GEMINI_API_KEY; delete process.env.OPENAI_API_KEY; delete process.env.GROQ_API_KEY })

describe('text-only outfit provider adapters', () => {
  it.each([
    ['gemini', () => import('./gemini.js'), 'gemini-3.5-flash-lite', 'GEMINI_API_KEY', { candidates: [{ content: { parts: [{ text: OUTPUT }] } }] }],
    ['openai', () => import('./openai.js'), 'gpt-5-mini', 'OPENAI_API_KEY', { choices: [{ message: { content: OUTPUT } }] }],
    ['groq', () => import('./groq.js'), 'qwen/qwen3.8-27b', 'GROQ_API_KEY', { choices: [{ message: { content: OUTPUT } }] }],
  ])('%s validates the same provider-independent result and sends no image', async (_name, load, model, env, body) => {
    process.env[env] = 'test-secret'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
    const module = await load()
    const result = await module.runOutfitProvider(OUTFIT_BAKEOFF_CASES[0], new AbortController().signal, model)
    expect(result.ok).toBe(true)
    const request = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(JSON.stringify(request)).not.toMatch(/image_url|inline_data|base64/)
  })

  it('rejects a provider response that invents an item ID', async () => {
    process.env.OPENAI_API_KEY = 'test-secret'
    const invalid = OUTPUT.replace('white-sneakers', 'invented-shoes')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: invalid } }] }), { status: 200 }))
    const { runOutfitProvider } = await import('./openai.js')
    const result = await runOutfitProvider(OUTFIT_BAKEOFF_CASES[0], new AbortController().signal, 'gpt-5-mini')
    expect(result).toMatchObject({ ok: false, error: { kind: 'malformed-response' }, validation: { valid: false } })
  })
})
