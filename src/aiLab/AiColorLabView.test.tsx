import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_PROVIDER_IDS } from '../domain/aiColorLab/contract'
import type { AiErrorKind, AiProviderId, AiProviderOutcome } from '../domain/aiColorLab/contract'
import { hexToRgb } from '../domain/personalColor/colorUtils'
import type { PixelSource } from '../domain/photoColor/types'
import { openPhoto } from '../services/photoImage'
import { AiColorLabView } from './AiColorLabView'

// Plan §31 (Slice 0) + §21-22 (Slice 0.1): deterministic mocked tests proving provider isolation
// and the DeepSeek removal / grounding contract. The pipeline is mocked only at the same
// boundaries PhotoCheckerPanel.test.tsx mocks (openPhoto for the undecodable-in-jsdom image
// pipeline, canvas for rendering) -- every domain/aiLab function under test runs for real.
vi.mock('../services/photoImage', async (importOriginal) => ({ ...await importOriginal<object>(), openPhoto: vi.fn() }))

const openPhotoMock = vi.mocked(openPhoto)

function solid(width: number, height: number, hex: string): PixelSource {
  const { r, g, b } = hexToRgb(hex)!
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < data.length; index += 4) data.set([r, g, b, 255], index)
  return { width, height, data }
}

class FakeImageData {
  constructor(readonly data: Uint8ClampedArray, readonly width: number, readonly height: number) {}
}
const observers: { observed: Element[]; callback: () => void; observe: (element: Element) => void; disconnect: () => void }[] = []
class FakeResizeObserver {
  observed: Element[] = []
  constructor(readonly callback: () => void) { observers.push(this) }
  observe(element: Element) { this.observed.push(element) }
  disconnect() { this.observed = [] }
}

const photoFile = () => new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((onResolve) => { resolve = onResolve })
  return { promise, resolve }
}

function success(provider: AiProviderId, perceivedColorName: string): AiProviderOutcome {
  return {
    ok: true, latencyMs: 1200, usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 }, raw: {},
    result: {
      provider, model: 'test-model',
      targetAssessment: { objectType: 'shirt', objectDescription: 'cream shirt worn by the man on the left', targetMatched: true },
      perceivedColorName, colorFamily: 'pink', temperature: 'warm', value: 'medium', chroma: 'muted',
      lighting: { condition: 'soft daylight', cast: 'neutral', severity: 'low' },
      sampleAssessment: { usable: true, issue: 'none' }, suitability: 'workable', confidence: 'medium', reasoning: 'Looks like a muted warm pink.',
    },
  }
}
function failure(kind: AiErrorKind, httpStatus: number | null = null): AiProviderOutcome {
  return { ok: false, latencyMs: 800, error: { kind, httpStatus, message: `test message for ${kind}` } }
}

type Responder = () => AiProviderOutcome | Promise<AiProviderOutcome>
let responders: Partial<Record<AiProviderId, Responder[]>>
let fetchSpy: ReturnType<typeof vi.fn>

function queueResponse(provider: AiProviderId, responder: Responder) {
  (responders[provider] ??= []).push(responder)
}

beforeEach(() => {
  responders = {}
  observers.length = 0
  vi.stubGlobal('ImageData', FakeImageData)
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  // Slice 0.1: encodeAnnotatedImageForAiLab also calls beginPath/arc/stroke/fill to burn the
  // target marker onto the AI-only image copy (imageEncode.ts) -- stubbed here the same way
  // putImageData/toDataURL already were, since jsdom's canvas has no real 2D context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    putImageData: vi.fn(), getImageData: vi.fn(), drawImage: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
  }) as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA')
  fetchSpy = vi.fn(async (url: string | URL) => {
    const match = /\/api\/ai-color\/(\w+)/.exec(String(url))
    const provider = match?.[1] as AiProviderId
    const queue = responders[provider]
    const responder = queue?.shift()
    const outcome = responder ? await responder() : failure('provider-error')
    return new Response(JSON.stringify(outcome), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchSpy)
  openPhotoMock.mockReset()
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const stage = () => document.querySelector<HTMLElement>('.photo-stage')!
const card = (name: string) => screen.getByRole('heading', { name }).closest('article')!
// The success color name is echoed both in the visible summary AND inside the collapsed debug
// JSON <pre> -- scope to the summary line specifically so assertions aren't ambiguous. Same for
// the error title: RTL's `exact: false` is also case-INSENSITIVE, so "ERROR" would otherwise
// also match the word "error" inside an error MESSAGE (e.g. "test message for provider-error").
const cardColorText = (name: string) => card(name).querySelector('.ai-lab-color')?.textContent ?? ''
const cardErrorTitle = (name: string) => card(name).querySelector('.ai-lab-error-title')?.textContent ?? ''
const cardTargetText = (name: string) => card(name).querySelector('.ai-lab-target')?.textContent ?? ''

async function openReady(image: PixelSource) {
  openPhotoMock.mockResolvedValueOnce(image)
  await userEvent.setup({ delay: null }).upload(screen.getByLabelText(/Choose photo|Change photo/), photoFile())
  await act(async () => {})
}

function selectCenter() {
  fireEvent.keyDown(stage(), { key: 'Enter' })
}

async function runAll() {
  await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Run all providers' }))
}

describe('AiColorLabView provider isolation (plan §31, §20)', () => {
  it('Case A: all three active providers succeed independently', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    for (const provider of ['gemini', 'openai', 'groq'] as const) queueResponse(provider, () => success(provider, `${provider}-color`))
    await runAll()
    await waitFor(() => expect(cardColorText('Gemini')).toContain('gemini-color'))
    for (const [name, provider] of [['Gemini', 'gemini'], ['OpenAI', 'openai'], ['Groq', 'groq']] as const) {
      expect(cardColorText(name)).toContain(`${provider}-color`)
    }
  })

  it('Case B: Gemini and OpenAI succeed, Groq returns HTTP 500 -- the two successes stay rendered, Groq shows an independent failure', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueResponse('gemini', () => success('gemini', 'gemini-color'))
    queueResponse('openai', () => success('openai', 'openai-color'))
    queueResponse('groq', () => failure('provider-error', 500))
    await runAll()
    await waitFor(() => expect(cardColorText('Gemini')).toContain('gemini-color'))
    expect(cardColorText('OpenAI')).toContain('openai-color')
    expect(cardErrorTitle('Groq')).toContain('ERROR')
    expect(cardErrorTitle('Groq')).toContain('HTTP 500')
  })

  it('Case C: one provider returns malformed JSON -- only that provider fails', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueResponse('gemini', () => failure('malformed-response'))
    queueResponse('openai', () => success('openai', 'openai-color'))
    queueResponse('groq', () => success('groq', 'groq-color'))
    await runAll()
    await waitFor(() => expect(cardErrorTitle('Gemini')).toContain('ERROR'))
    expect(cardColorText('OpenAI')).toContain('openai-color')
    expect(cardColorText('Groq')).toContain('groq-color')
  })

  it('Case D: one API key is missing -- that provider shows NOT CONFIGURED, others still run', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueResponse('gemini', () => failure('not-configured'))
    queueResponse('openai', () => success('openai', 'openai-color'))
    queueResponse('groq', () => success('groq', 'groq-color'))
    await runAll()
    await waitFor(() => expect(cardErrorTitle('Gemini')).toContain('NOT CONFIGURED'))
    expect(cardColorText('OpenAI')).toContain('openai-color')
  })

  it('Case E: retrying one failed provider only calls that provider again, leaving successful cards unchanged', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueResponse('gemini', () => success('gemini', 'gemini-color'))
    queueResponse('openai', () => success('openai', 'openai-color'))
    queueResponse('groq', () => failure('provider-error', 500))
    await runAll()
    await waitFor(() => expect(cardErrorTitle('Groq')).toContain('ERROR'))
    const callsBeforeRetry = fetchSpy.mock.calls.length

    queueResponse('groq', () => success('groq', 'groq-color-after-retry'))
    await userEvent.setup({ delay: null }).click(within(card('Groq')).getByRole('button', { name: /Retry Groq/ }))
    await waitFor(() => expect(cardColorText('Groq')).toContain('groq-color-after-retry'))

    // Exactly one new fetch call (Groq's retry) -- the other two providers were not re-called.
    expect(fetchSpy.mock.calls.length).toBe(callsBeforeRetry + 1)
    expect(cardColorText('Gemini')).toContain('gemini-color')
    expect(cardColorText('OpenAI')).toContain('openai-color')
  })

  it('Case F: a still-loading provider does not block already-completed cards from rendering', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    const slow = deferred<AiProviderOutcome>()
    queueResponse('gemini', () => success('gemini', 'gemini-color'))
    queueResponse('openai', () => slow.promise)
    queueResponse('groq', () => success('groq', 'groq-color'))
    await runAll()

    await waitFor(() => expect(cardColorText('Gemini')).toContain('gemini-color'))
    expect(cardColorText('Groq')).toContain('groq-color')
    expect(within(card('OpenAI')).getByText('Analyzing', { exact: false })).toBeInTheDocument()

    await act(async () => { slow.resolve(success('openai', 'openai-color-late')) })
    await waitFor(() => expect(cardColorText('OpenAI')).toContain('openai-color-late'))
  })

  it('Case G: Run All again with a new sample point -- a stale response from the previous run cannot overwrite the new one', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()

    const stalePromise = deferred<AiProviderOutcome>()
    queueResponse('gemini', () => stalePromise.promise)
    queueResponse('openai', () => success('openai', 'openai-run-1'))
    queueResponse('groq', () => success('groq', 'groq-run-1'))
    await runAll()
    await waitFor(() => expect(cardColorText('OpenAI')).toContain('openai-run-1'))
    expect(within(card('Gemini')).getByText('Analyzing', { exact: false })).toBeInTheDocument()

    // A new sample point starts a genuinely new analysis: every card resets, including the
    // still-loading Gemini one.
    fireEvent.keyDown(stage(), { key: 'ArrowRight' })
    fireEvent.keyDown(stage(), { key: 'Enter' })
    await waitFor(() => expect(within(card('Gemini')).getByText('Not run yet.')).toBeInTheDocument())

    queueResponse('gemini', () => success('gemini', 'gemini-run-2'))
    queueResponse('openai', () => success('openai', 'openai-run-2'))
    queueResponse('groq', () => success('groq', 'groq-run-2'))
    await runAll()
    await waitFor(() => expect(cardColorText('Gemini')).toContain('gemini-run-2'))

    // The run-1 Gemini promise finally settles late; it must not overwrite run 2's result.
    await act(async () => { stalePromise.resolve(success('gemini', 'gemini-run-1-STALE')) })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cardColorText('Gemini')).toContain('gemini-run-2')
    expect(cardColorText('Gemini')).not.toContain('gemini-run-1-STALE')
  })
})

describe('DeepSeek removal (plan §21, Slice 0.1)', () => {
  it('only three providers are active, in this exact order', () => {
    expect(AI_PROVIDER_IDS).toEqual(['gemini', 'openai', 'groq'])
  })

  it('no DeepSeek card renders', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    expect(screen.queryByRole('heading', { name: 'DeepSeek' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Gemini' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'OpenAI' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Groq' })).toBeInTheDocument()
  })

  it('Run All makes exactly three provider requests, and none of them is DeepSeek', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueResponse('gemini', () => success('gemini', 'gemini-color'))
    queueResponse('openai', () => success('openai', 'openai-color'))
    queueResponse('groq', () => success('groq', 'groq-color'))
    await runAll()
    await waitFor(() => expect(cardColorText('Gemini')).toContain('gemini-color'))

    expect(fetchSpy.mock.calls.length).toBe(3)
    const calledUrls = fetchSpy.mock.calls.map((call) => String(call[0]))
    expect(calledUrls.some((url) => url.includes('deepseek'))).toBe(false)
    expect(calledUrls.sort()).toEqual(['/api/ai-color/gemini', '/api/ai-color/groq', '/api/ai-color/openai'])
  })
})

describe('target grounding UI (plan §14, Slice 0.1)', () => {
  it('a successful card shows the target object, description, and match before the color fields', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueResponse('gemini', () => success('gemini', 'gemini-color'))
    queueResponse('openai', () => success('openai', 'openai-color'))
    queueResponse('groq', () => success('groq', 'groq-color'))
    await runAll()
    await waitFor(() => expect(cardColorText('Gemini')).toContain('gemini-color'))

    const targetText = cardTargetText('Gemini')
    expect(targetText).toContain('shirt')
    expect(targetText).toContain('cream shirt worn by the man on the left')
    expect(targetText).toContain('Yes')
  })

  it('renders a collapsed "AI input preview" once a sample point is selected', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    expect(screen.getByText('AI input preview')).toBeInTheDocument()
    const preview = screen.getByAltText(/AI input preview/i) as HTMLImageElement
    expect(preview.src).toContain('data:image/jpeg;base64,AAAA')
  })
})
