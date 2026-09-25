import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_CANDIDATE_IDS } from '../domain/aiColorLab/contract'
import type { AiCandidateId, AiErrorKind, AiProviderOutcome } from '../domain/aiColorLab/contract'
import { hexToRgb } from '../domain/personalColor/colorUtils'
import type { PixelSource } from '../domain/photoColor/types'
import { openPhoto } from '../services/photoImage'
import { AiColorLabView } from './AiColorLabView'

// Plan §31 (Slice 0) + §21-22 (Slice 0.1) + §22 (Slice 0.2): deterministic mocked tests proving
// candidate isolation and the Model Bake-off contract. The pipeline is mocked only at the same
// boundaries PhotoCheckerPanel.test.tsx mocks (openPhoto for the undecodable-in-jsdom image
// pipeline, canvas for rendering) -- every domain/aiLab function under test runs for real.
vi.mock('../services/photoImage', async (importOriginal) => ({ ...await importOriginal<object>(), openPhoto: vi.fn() }))

const openPhotoMock = vi.mocked(openPhoto)

const HEADING: Record<AiCandidateId, string> = {
  'gemini-flash': 'Gemini Flash',
  'gemini-flash-lite': 'Gemini Flash-Lite',
  openai: 'OpenAI',
  groq: 'Groq',
}

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

function success(candidateId: AiCandidateId, perceivedColorName: string): AiProviderOutcome {
  return {
    ok: true, latencyMs: 1200, usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 }, raw: {},
    result: {
      provider: candidateId.startsWith('gemini') ? 'gemini' : (candidateId as 'openai' | 'groq'), model: 'test-model',
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
let responders: Partial<Record<AiCandidateId, Responder[]>>
let fetchSpy: ReturnType<typeof vi.fn>

function queueResponse(candidateId: AiCandidateId, responder: Responder) {
  (responders[candidateId] ??= []).push(responder)
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
    const match = /\/api\/ai-color\/([a-z-]+)/.exec(String(url))
    const candidateId = match?.[1] as AiCandidateId
    const queue = responders[candidateId]
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
const card = (heading: string) => screen.getByRole('heading', { name: heading }).closest('article')!
// The success color name is echoed both in the visible summary AND inside the collapsed debug
// JSON <pre> -- scope to the summary line specifically so assertions aren't ambiguous. Same for
// the error title: RTL's `exact: false` is also case-INSENSITIVE, so "ERROR" would otherwise
// also match the word "error" inside an error MESSAGE (e.g. "test message for provider-error").
const cardColorText = (heading: string) => card(heading).querySelector('.ai-lab-color')?.textContent ?? ''
const cardErrorTitle = (heading: string) => card(heading).querySelector('.ai-lab-error-title')?.textContent ?? ''
const cardTargetText = (heading: string) => card(heading).querySelector('.ai-lab-target')?.textContent ?? ''

async function openReady(image: PixelSource) {
  openPhotoMock.mockResolvedValueOnce(image)
  await userEvent.setup({ delay: null }).upload(screen.getByLabelText(/Choose photo|Change photo/), photoFile())
  await act(async () => {})
}

function selectCenter() {
  fireEvent.keyDown(stage(), { key: 'Enter' })
}

async function runAll() {
  await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Run all candidates' }))
}

function queueAllSuccess(suffix = '') {
  for (const candidateId of AI_CANDIDATE_IDS) queueResponse(candidateId, () => success(candidateId, `${candidateId}-color${suffix}`))
}

describe('AiColorLabView candidate isolation (plan §31, §20; extended Slice 0.2 plan §22)', () => {
  it('Case A: all four candidates succeed independently', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueAllSuccess()
    await runAll()
    await waitFor(() => expect(cardColorText(HEADING['gemini-flash'])).toContain('gemini-flash-color'))
    for (const candidateId of AI_CANDIDATE_IDS) expect(cardColorText(HEADING[candidateId])).toContain(`${candidateId}-color`)
  })

  it('Case B: three succeed, one returns HTTP 500 -- the three successes stay rendered, the failing one shows an independent failure', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueResponse('gemini-flash', () => success('gemini-flash', 'flash-color'))
    queueResponse('gemini-flash-lite', () => success('gemini-flash-lite', 'lite-color'))
    queueResponse('openai', () => success('openai', 'openai-color'))
    queueResponse('groq', () => failure('provider-error', 500))
    await runAll()
    await waitFor(() => expect(cardColorText(HEADING['gemini-flash'])).toContain('flash-color'))
    expect(cardColorText(HEADING['gemini-flash-lite'])).toContain('lite-color')
    expect(cardColorText(HEADING.openai)).toContain('openai-color')
    expect(cardErrorTitle(HEADING.groq)).toContain('ERROR')
    expect(cardErrorTitle(HEADING.groq)).toContain('HTTP 500')
  })

  it('Case E: one Gemini candidate fails while the other Gemini candidate succeeds, even though they share a provider/key (plan §22 E)', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueResponse('gemini-flash', () => success('gemini-flash', 'flash-color'))
    queueResponse('gemini-flash-lite', () => failure('rate-limited', 429))
    queueResponse('openai', () => success('openai', 'openai-color'))
    queueResponse('groq', () => success('groq', 'groq-color'))
    await runAll()
    await waitFor(() => expect(cardColorText(HEADING['gemini-flash'])).toContain('flash-color'))
    expect(cardErrorTitle(HEADING['gemini-flash-lite'])).toContain('ERROR')
  })

  it('Case F: a still-loading candidate does not block already-completed cards from rendering (plan §22 F)', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    const slow = deferred<AiProviderOutcome>()
    queueResponse('gemini-flash', () => success('gemini-flash', 'flash-color'))
    queueResponse('gemini-flash-lite', () => success('gemini-flash-lite', 'lite-color'))
    queueResponse('openai', () => slow.promise)
    queueResponse('groq', () => success('groq', 'groq-color'))
    await runAll()

    await waitFor(() => expect(cardColorText(HEADING['gemini-flash'])).toContain('flash-color'))
    expect(cardColorText(HEADING.groq)).toContain('groq-color')
    expect(within(card(HEADING.openai)).getByText('Analyzing', { exact: false })).toBeInTheDocument()

    await act(async () => { slow.resolve(success('openai', 'openai-color-late')) })
    await waitFor(() => expect(cardColorText(HEADING.openai)).toContain('openai-color-late'))
  })

  it('Case H: retrying one failed candidate only calls that candidate again, leaving successful cards unchanged', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueResponse('gemini-flash', () => success('gemini-flash', 'flash-color'))
    queueResponse('gemini-flash-lite', () => success('gemini-flash-lite', 'lite-color'))
    queueResponse('openai', () => success('openai', 'openai-color'))
    queueResponse('groq', () => failure('provider-error', 500))
    await runAll()
    await waitFor(() => expect(cardErrorTitle(HEADING.groq)).toContain('ERROR'))
    const callsBeforeRetry = fetchSpy.mock.calls.length

    queueResponse('groq', () => success('groq', 'groq-color-after-retry'))
    await userEvent.setup({ delay: null }).click(within(card(HEADING.groq)).getByRole('button', { name: /Retry Groq/ }))
    await waitFor(() => expect(cardColorText(HEADING.groq)).toContain('groq-color-after-retry'))

    // Exactly one new fetch call (Groq's retry) -- the other three candidates were not re-called.
    expect(fetchSpy.mock.calls.length).toBe(callsBeforeRetry + 1)
    expect(cardColorText(HEADING['gemini-flash'])).toContain('flash-color')
    expect(cardColorText(HEADING.openai)).toContain('openai-color')
  })

  it('Case I: Run All again with a new sample point -- a stale response from the previous run cannot overwrite the new one', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()

    const stalePromise = deferred<AiProviderOutcome>()
    queueResponse('gemini-flash', () => stalePromise.promise)
    queueResponse('gemini-flash-lite', () => success('gemini-flash-lite', 'lite-run-1'))
    queueResponse('openai', () => success('openai', 'openai-run-1'))
    queueResponse('groq', () => success('groq', 'groq-run-1'))
    await runAll()
    await waitFor(() => expect(cardColorText(HEADING.openai)).toContain('openai-run-1'))
    expect(within(card(HEADING['gemini-flash'])).getByText('Analyzing', { exact: false })).toBeInTheDocument()

    // A new sample point starts a genuinely new analysis: every card resets, including the
    // still-loading Gemini Flash one.
    fireEvent.keyDown(stage(), { key: 'ArrowRight' })
    fireEvent.keyDown(stage(), { key: 'Enter' })
    await waitFor(() => expect(within(card(HEADING['gemini-flash'])).getByText('Not run yet.')).toBeInTheDocument())

    queueAllSuccess('-run-2')
    await runAll()
    await waitFor(() => expect(cardColorText(HEADING['gemini-flash'])).toContain('gemini-flash-color-run-2'))

    // The run-1 Gemini Flash promise finally settles late; it must not overwrite run 2's result.
    await act(async () => { stalePromise.resolve(success('gemini-flash', 'gemini-flash-run-1-STALE')) })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cardColorText(HEADING['gemini-flash'])).toContain('gemini-flash-color-run-2')
    expect(cardColorText(HEADING['gemini-flash'])).not.toContain('STALE')
  })
})

describe('candidate architecture (Slice 0.2 plan §4)', () => {
  it('exactly four candidates are active, in this exact order: Gemini Flash, Gemini Flash-Lite, OpenAI, Groq', () => {
    expect(AI_CANDIDATE_IDS).toEqual(['gemini-flash', 'gemini-flash-lite', 'openai', 'groq'])
  })

  it('no DeepSeek card renders, and every expected candidate card renders', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    expect(screen.queryByRole('heading', { name: 'DeepSeek' })).toBeNull()
    for (const heading of Object.values(HEADING)) expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('Run All makes exactly four candidate requests, and none of them is DeepSeek (plan §22 A)', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueAllSuccess()
    await runAll()
    await waitFor(() => expect(cardColorText(HEADING['gemini-flash'])).toContain('gemini-flash-color'))

    expect(fetchSpy.mock.calls.length).toBe(4)
    const calledUrls = fetchSpy.mock.calls.map((call) => String(call[0]))
    expect(calledUrls.some((url) => url.includes('deepseek'))).toBe(false)
    expect(calledUrls.sort()).toEqual(['/api/ai-color/gemini-flash', '/api/ai-color/gemini-flash-lite', '/api/ai-color/groq', '/api/ai-color/openai'])
  })

  it('Gemini Flash and Gemini Flash-Lite receive byte-identical image data and identical semantic input (plan §22 C, D)', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueAllSuccess()
    await runAll()
    await waitFor(() => expect(cardColorText(HEADING['gemini-flash'])).toContain('gemini-flash-color'))

    const bodyFor = (candidateId: AiCandidateId) => {
      // Exact match, not `.includes` -- "/api/ai-color/gemini-flash" is itself a substring of
      // "/api/ai-color/gemini-flash-lite", which would otherwise match the wrong candidate.
      const call = fetchSpy.mock.calls.find((entry) => String(entry[0]) === `/api/ai-color/${candidateId}`)
      return JSON.parse(call![1].body as string)
    }
    const flashBody = bodyFor('gemini-flash')
    const liteBody = bodyFor('gemini-flash-lite')
    expect(flashBody.imageDataUrl).toBe(liteBody.imageDataUrl)
    expect(flashBody.sample).toEqual(liteBody.sample)
    expect(flashBody.subtype).toEqual(liteBody.subtype)
  })
})

describe('target grounding UI (plan §14, Slice 0.1)', () => {
  it('a successful card shows the target object, description, and match before the color fields', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueAllSuccess()
    await runAll()
    await waitFor(() => expect(cardColorText(HEADING['gemini-flash'])).toContain('gemini-flash-color'))

    const targetText = cardTargetText(HEADING['gemini-flash'])
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

describe('PO review controls (Slice 0.2 plan §9-10)', () => {
  it('lets the PO set target/color/lighting verdicts and a note on a successful card, independently per candidate', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueAllSuccess()
    await runAll()
    await waitFor(() => expect(cardColorText(HEADING['gemini-flash'])).toContain('gemini-flash-color'))

    const flashCard = card(HEADING['gemini-flash'])
    const user = userEvent.setup({ delay: null })
    await user.selectOptions(within(flashCard).getByLabelText('Target'), 'correct')
    await user.selectOptions(within(flashCard).getByLabelText('Color'), 'good')
    await user.selectOptions(within(flashCard).getByLabelText('Lighting'), 'acceptable')
    await user.type(within(flashCard).getByLabelText('Note'), 'nice and clean')

    expect(within(flashCard).getByLabelText('Target')).toHaveValue('correct')
    // Another candidate's card is untouched by reviewing this one (plan §22 J: review is
    // associated with the exact candidate + run).
    const openaiCard = card(HEADING.openai)
    expect(within(openaiCard).getByLabelText('Target')).toHaveValue('')
  })
})

describe('session bake-off summary (Slice 0.2 plan §11)', () => {
  it('does not render before any run has completed', async () => {
    render(<AiColorLabView />)
    expect(screen.queryByText('Session bake-off summary')).toBeNull()
  })

  it('accumulates counts across multiple runs and never shows an automatic winner (plan §11, §25)', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueAllSuccess()
    await runAll()
    await waitFor(() => expect(cardColorText(HEADING['gemini-flash'])).toContain('gemini-flash-color'))

    fireEvent.keyDown(stage(), { key: 'ArrowRight' })
    fireEvent.keyDown(stage(), { key: 'Enter' })
    await waitFor(() => expect(within(card(HEADING['gemini-flash'])).getByText('Not run yet.')).toBeInTheDocument())
    queueAllSuccess('-run-2')
    await runAll()
    await waitFor(() => expect(cardColorText(HEADING['gemini-flash'])).toContain('gemini-flash-color-run-2'))

    const summary = screen.getByText('Session bake-off summary').closest('section')!
    // Two accepted runs for Gemini Flash across two different sample points/photos in this
    // session (plan §11: session summary spans the whole manual bake-off, not just one photo).
    const flashRow = within(summary).getByRole('row', { name: /Gemini Flash(?!-Lite)/ })
    expect(within(flashRow).getAllByRole('cell')[0]).toHaveTextContent('2')
    expect(screen.queryByText(/winner/i)).toBeNull()
  })

  it('offers a JSON export that does not fail when clicked', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueAllSuccess()
    await runAll()
    await waitFor(() => expect(cardColorText(HEADING['gemini-flash'])).toContain('gemini-flash-color'))

    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Export results (JSON)' }))
    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
  })
})

describe('color dimension comparison and Flash vs Flash-Lite tables (Slice 0.2 plan §14, §16)', () => {
  it('renders a dimension comparison row and a dedicated Flash vs Flash-Lite table once candidates have run', async () => {
    render(<AiColorLabView />)
    await openReady(solid(120, 90, '#C08080'))
    selectCenter()
    queueAllSuccess()
    await runAll()
    await waitFor(() => expect(cardColorText(HEADING['gemini-flash'])).toContain('gemini-flash-color'))

    expect(screen.getByText('Color dimension comparison (descriptive only — agreement is not correctness)')).toBeInTheDocument()
    expect(screen.getByText('Gemini Flash vs Flash-Lite (same run)')).toBeInTheDocument()
  })
})
