import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiColorAnalysisRequest } from '../../src/domain/aiColorLab/contract'
import { buildCanonicalPrompt, CANONICAL_INSTRUCTION } from './prompt'

const REQUEST: AiColorAnalysisRequest = {
  imageDataUrl: 'data:image/jpeg;base64,AAAA',
  sample: { hex: '#C08080', rgb: { r: 192, g: 128, b: 128 }, oklabL: 0.6, colorName: 'Dusty Rose', flags: [] },
  subtype: { subtype: 'warm-autumn', season: 'autumn', label: 'Warm Autumn' },
}

describe('buildCanonicalPrompt', () => {
  it('embeds the ONE canonical instruction verbatim (plan §28: adapters must not author competing wording)', () => {
    expect(buildCanonicalPrompt(REQUEST)).toContain(CANONICAL_INSTRUCTION)
  })

  it('includes the deterministic measurement as context, not as the question', () => {
    const prompt = buildCanonicalPrompt(REQUEST)
    expect(prompt).toContain('#C08080')
    expect(prompt).toContain('Dusty Rose')
  })

  it('includes the subtype context when a saved profile exists', () => {
    expect(buildCanonicalPrompt(REQUEST)).toContain('Warm Autumn')
  })

  it('asks for "uncertain" suitability instead of inventing a profile when none is saved (plan §27)', () => {
    const prompt = buildCanonicalPrompt({ ...REQUEST, subtype: null })
    expect(prompt).toMatch(/no saved Personal Color subtype/i)
    expect(prompt).not.toContain('Warm Autumn')
  })

  it('never claims to recover the garment\'s true physical color (plan §12)', () => {
    expect(CANONICAL_INSTRUCTION.toLowerCase()).toContain('not claim')
  })
})

// Real parity audit (plan §28: "Tests should make prompt parity reasonably auditable"): for
// each provider, capture the exact text it sends the provider and assert it is byte-for-byte
// buildCanonicalPrompt(REQUEST) -- not just "some file imports the shared builder."
describe('every adapter sends the exact canonical prompt text (parity)', () => {
  const expected = buildCanonicalPrompt(REQUEST)
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test'
    process.env.GROQ_API_KEY = 'test'
    process.env.DEEPSEEK_API_KEY = 'test'
    process.env.GEMINI_API_KEY = 'test'
  })
  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('openai', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const { runProvider } = await import('./providers/openai')
    await runProvider(REQUEST, new AbortController().signal)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.messages[0].content[0].text).toBe(expected)
  })

  it('groq', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const { runProvider } = await import('./providers/groq')
    await runProvider(REQUEST, new AbortController().signal)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.messages[0].content[0].text).toBe(expected)
  })

  it('deepseek', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const { runProvider } = await import('./providers/deepseek')
    await runProvider(REQUEST, new AbortController().signal)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.messages[0].content[0].text).toBe(expected)
  })

  it('gemini', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const { runProvider } = await import('./providers/gemini')
    await runProvider(REQUEST, new AbortController().signal)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.contents[0].parts[0].text).toBe(expected)
  })
})
