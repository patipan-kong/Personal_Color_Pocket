import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiColorAnalysisRequest } from '../../src/domain/aiColorLab/contract'
import { buildCanonicalPrompt, CANONICAL_INSTRUCTION, RESPONSE_JSON_SHAPE } from './prompt'

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

  // Slice 0.1 grounding audit (plan §22 C, §17): the prompt must make the selected target
  // authoritative and explicit, not just imply it via "the marked region."
  it('makes the selected target explicit and authoritative (plan §7, §17)', () => {
    const lower = CANONICAL_INSTRUCTION.toLowerCase()
    expect(lower).toContain('marker')
    expect(lower).toContain('authoritative')
    expect(lower).toContain('do not switch to another')
  })

  it('asks the model not to report the marker graphic\'s own color as the garment color (plan §9)', () => {
    expect(CANONICAL_INSTRUCTION.toLowerCase()).toContain('marker ring or dot')
  })

  it('response shape includes targetAssessment ahead of the color fields (plan §12)', () => {
    expect(RESPONSE_JSON_SHAPE).toContain('targetAssessment')
    expect(RESPONSE_JSON_SHAPE.indexOf('targetAssessment')).toBeLessThan(RESPONSE_JSON_SHAPE.indexOf('perceivedColorName'))
  })
})

// Real parity audit (plan §28, §22 D: "Tests should make prompt parity reasonably auditable" /
// "all three request adapters receive equivalent grounding context"): for each of the three
// active providers, capture the exact text AND image it sends and assert both are byte-for-byte
// identical to buildCanonicalPrompt(REQUEST) / REQUEST.imageDataUrl -- not just "some file
// imports the shared builder." DeepSeek was removed in Slice 0.1 (docs/V2_AI_COLOR_LAB.md §15).
describe('every active adapter sends the exact canonical prompt text and image (parity, plan §22 D)', () => {
  const expected = buildCanonicalPrompt(REQUEST)
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test'
    process.env.GROQ_API_KEY = 'test'
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
    expect(body.messages[0].content[1].image_url.url).toBe(REQUEST.imageDataUrl)
  })

  it('groq', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const { runProvider } = await import('./providers/groq')
    await runProvider(REQUEST, new AbortController().signal)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.messages[0].content[0].text).toBe(expected)
    expect(body.messages[0].content[1].image_url.url).toBe(REQUEST.imageDataUrl)
  })

  it('gemini', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const { runProvider } = await import('./providers/gemini')
    await runProvider(REQUEST, new AbortController().signal)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string)
    expect(body.contents[0].parts[0].text).toBe(expected)
    // Gemini's transport splits the data URL into mimeType + base64 (dataUrlParts); the base64
    // payload itself must still be the exact same bytes every other provider received.
    expect(body.contents[0].parts[1].inline_data.data).toBe(REQUEST.imageDataUrl.split(',')[1])
  })
})
