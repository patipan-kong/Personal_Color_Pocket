import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiColorAnalysisRequest } from '../../../src/domain/aiColorLab/contract'

const REQUEST: AiColorAnalysisRequest = {
  imageDataUrl: 'data:image/jpeg;base64,AAAA',
  sample: { hex: '#C08080', rgb: { r: 192, g: 128, b: 128 }, oklabL: 0.6, colorName: null, flags: [] },
  subtype: null,
}

const VALID_JSON = JSON.stringify({
  targetAssessment: { objectType: 'shirt', objectDescription: 'cream shirt worn by the man on the left', targetMatched: true },
  perceivedColorName: 'Dusty Rose', colorFamily: 'pink', temperature: 'warm', value: 'medium', chroma: 'muted',
  lighting: { condition: 'soft', cast: 'neutral', severity: 'low' },
  sampleAssessment: { usable: true, issue: 'none' },
  suitability: 'workable', confidence: 'medium', reasoning: 'test',
})

// One case per active bake-off CANDIDATE (Slice 0.2 plan §4): module path, the model id this
// candidate is called with, the env var it needs, and how its response envelope carries the
// model's text (so a single table-driven suite can exercise every adapter's SHARED
// error-handling paths -- classifyHttpStatus, malformed JSON, network throw -- without
// duplicating the same assertions by hand). Gemini Flash and Gemini Flash-Lite deliberately
// share `mod` (the same adapter module) with two different `model` ids -- proving one adapter
// genuinely serves two independent candidates (plan §22 B). DeepSeek was removed in Slice 0.1
// (docs/V2_AI_COLOR_LAB.md §15) after its adapter failed structured-output validation live.
const CASES = [
  { name: 'openai', mod: () => import('./openai'), model: 'gpt-5-mini', env: 'OPENAI_API_KEY', okBody: { choices: [{ message: { content: VALID_JSON } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } } },
  { name: 'groq', mod: () => import('./groq'), model: 'qwen/qwen3.8-27b', env: 'GROQ_API_KEY', okBody: { choices: [{ message: { content: VALID_JSON } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } } },
  { name: 'gemini-flash', mod: () => import('./gemini'), model: 'gemini-3.5-flash', env: 'GEMINI_API_KEY', okBody: { candidates: [{ content: { parts: [{ text: VALID_JSON }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } } },
  { name: 'gemini-flash-lite', mod: () => import('./gemini'), model: 'gemini-3.5-flash-lite', env: 'GEMINI_API_KEY', okBody: { candidates: [{ content: { parts: [{ text: VALID_JSON }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } } },
] as const

const originalEnv = { ...process.env }
beforeEach(() => {
  for (const { env } of CASES) process.env[env] = 'test-key'
})
afterEach(() => {
  process.env = { ...originalEnv }
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe.each(CASES)('$name adapter', ({ mod, model, okBody }) => {
  it('returns a valid normalized result on a healthy 200 response, tagged with the candidate\'s own model id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(okBody), { status: 200 })))
    const { runProvider } = await mod()
    const outcome = await runProvider(REQUEST, new AbortController().signal, model)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.result.model).toBe(model)
      expect(outcome.result.perceivedColorName).toBe('Dusty Rose')
      expect(outcome.result.targetAssessment).toEqual({ objectType: 'shirt', objectDescription: 'cream shirt worn by the man on the left', targetMatched: true })
      expect(outcome.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 })
    }
  })

  it('maps HTTP 401 to an auth error, isolated from other providers (plan §6, §20)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 })))
    const { runProvider } = await mod()
    const outcome = await runProvider(REQUEST, new AbortController().signal, model)
    expect(outcome).toEqual({ ok: false, error: { kind: 'auth', httpStatus: 401, message: expect.any(String) } })
  })

  it('maps HTTP 429 to rate-limited', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('slow down', { status: 429 })))
    const { runProvider } = await mod()
    const outcome = await runProvider(REQUEST, new AbortController().signal, model)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.kind).toBe('rate-limited')
  })

  it('maps HTTP 500 to provider-error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))
    const { runProvider } = await mod()
    const outcome = await runProvider(REQUEST, new AbortController().signal, model)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.kind).toBe('provider-error')
  })

  it('fails as malformed-response (not a crash) when the model text is not valid JSON, and never leaks the raw text (plan §15, §16)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'I refuse to answer in JSON today.' } }],
      candidates: [{ content: { parts: [{ text: 'I refuse to answer in JSON today.' } ] } }],
    }), { status: 200 })))
    const { runProvider } = await mod()
    const outcome = await runProvider(REQUEST, new AbortController().signal, model)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('malformed-response')
      expect(outcome.error.message).not.toContain('I refuse to answer')
    }
  })

  it('fails as malformed-response when the JSON is valid but does not match the contract (e.g. an invalid enum member)', async () => {
    const invalidEnum = JSON.stringify({ ...JSON.parse(VALID_JSON), temperature: 'toasty' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: invalidEnum } }],
      candidates: [{ content: { parts: [{ text: invalidEnum }] } }],
    }), { status: 200 })))
    const { runProvider } = await mod()
    const outcome = await runProvider(REQUEST, new AbortController().signal, model)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.kind).toBe('malformed-response')
  })

  // Slice 0.1 grounding audit (plan §22 G): a malformed targetAssessment fails safely, isolated
  // to this one provider's own outcome, exactly like any other invalid field -- never a crash,
  // never silently coerced to a valid-looking result.
  it('fails as malformed-response when targetAssessment.targetMatched is not a valid member', async () => {
    const invalidTarget = JSON.stringify({ ...JSON.parse(VALID_JSON), targetAssessment: { objectType: 'shirt', objectDescription: 'x', targetMatched: 'yes' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: invalidTarget } }],
      candidates: [{ content: { parts: [{ text: invalidTarget }] } }],
    }), { status: 200 })))
    const { runProvider } = await mod()
    const outcome = await runProvider(REQUEST, new AbortController().signal, model)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.kind).toBe('malformed-response')
  })

  it('fails as malformed-response when targetAssessment is missing entirely', async () => {
    const { targetAssessment: _targetAssessment, ...withoutTarget } = JSON.parse(VALID_JSON)
    const text = JSON.stringify(withoutTarget)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: text } }],
      candidates: [{ content: { parts: [{ text }] } }],
    }), { status: 200 })))
    const { runProvider } = await mod()
    const outcome = await runProvider(REQUEST, new AbortController().signal, model)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.kind).toBe('malformed-response')
  })
})
