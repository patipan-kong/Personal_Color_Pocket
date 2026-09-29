import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OutfitPreviewInput } from '../domain/todayOutfitProduction/previewContract'
import { getCopy } from '../i18n'
import { requestOutfitPreview } from '../services/outfitPreview'
import { buildOutfitPreviewAlt, OutfitPreview } from './OutfitPreview'
import type { TodayPreviewState } from './OutfitPreview'

vi.mock('../services/outfitPreview', () => ({ requestOutfitPreview: vi.fn() }))

const image = 'data:image/png;base64,aGVsbG8='
const separates: OutfitPreviewInput = {
  version: 1,
  mode: 'flat-lay',
  outfit: {
    kind: 'separates',
    top: { garmentType: 'polo', color: { hex: '#008000' } },
    bottom: { garmentType: 'chinos', color: { hex: '#D8BA91' } },
    outerwear: null,
    shoes: { garmentType: 'loafers', color: { hex: '#8B4513' } },
  },
}

function Harness({ language = 'en', input = separates, fingerprint = 'recommendation-1', source = 'owned' as const }: {
  language?: 'en' | 'th'
  input?: OutfitPreviewInput | null
  fingerprint?: string
  source?: 'owned' | 'inspiration'
}) {
  const [state, setState] = useState<TodayPreviewState>({ status: 'idle' })
  return <OutfitPreview copy={getCopy(language)} source={source} recommendationFingerprint={fingerprint} input={input} state={state} onStateChange={setState} />
}

describe('Today Outfit Preview presentation and session state', () => {
  beforeEach(() => { vi.mocked(requestOutfitPreview).mockReset() })
  afterEach(cleanup)

  it('calls the Preview service only after an explicit click and prevents a duplicate while loading', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof requestOutfitPreview>>) => void
    vi.mocked(requestOutfitPreview).mockImplementation(() => new Promise((done) => { resolve = done }))
    render(<Harness />)
    expect(requestOutfitPreview).not.toHaveBeenCalled()
    const action = screen.getByRole('button', { name: '✨ Preview This Look' })
    fireEvent.click(action)
    fireEvent.click(action)
    expect(requestOutfitPreview).toHaveBeenCalledOnce()
    expect(requestOutfitPreview).toHaveBeenCalledWith(separates, expect.any(AbortSignal))
    expect(screen.getByRole('status')).toHaveTextContent('Creating preview…')
    expect(screen.getByRole('button', { name: 'Creating preview…' })).toBeDisabled()
    resolve({ ok: true, result: { mimeType: 'image/png', imageDataUrl: image } })
    expect(await screen.findByRole('img')).toBeInTheDocument()
  })

  it('keeps one image, renders Owned expectations, and removes regeneration after success', async () => {
    vi.mocked(requestOutfitPreview)
      .mockResolvedValueOnce({ ok: true, result: { mimeType: 'image/png', imageDataUrl: image } })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    expect(await screen.findByRole('img')).toHaveAttribute('src', image)
    expect(screen.getByText(/illustrative preview only/i)).toBeInTheDocument()
    expect(screen.getByText(/details may differ from your actual items/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Generate Another Preview/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(requestOutfitPreview).toHaveBeenCalledTimes(1)
  })

  it('shows a safe failure and makes Retry one explicit additional request', async () => {
    vi.mocked(requestOutfitPreview)
      .mockResolvedValueOnce({ ok: false, error: { kind: 'provider-error', message: 'Gemini HTTP 500 SECRET' } })
      .mockResolvedValueOnce({ ok: true, result: { mimeType: 'image/png', imageDataUrl: image } })
    const user = userEvent.setup()
    const { container } = render(<Harness />)
    await user.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The preview couldn't be created")
    expect(container).not.toHaveTextContent(/Gemini|HTTP 500|SECRET|provider-error/)
    await user.click(screen.getByRole('button', { name: 'Try Preview Again' }))
    expect(await screen.findByRole('img')).toBeInTheDocument()
    expect(requestOutfitPreview).toHaveBeenCalledTimes(2)
  })

  it('fails locally without calling the service when mapping supplied no valid input', async () => {
    const user = userEvent.setup()
    render(<Harness input={null} />)
    await user.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(requestOutfitPreview).not.toHaveBeenCalled()
  })

  it('discards a response after the recommendation fingerprint changes', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof requestOutfitPreview>>) => void
    vi.mocked(requestOutfitPreview).mockImplementation(() => new Promise((done) => { resolve = done }))
    const view = render(<Harness fingerprint="before" />)
    fireEvent.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    view.rerender(<Harness fingerprint="after" />)
    resolve({ ok: true, result: { mimeType: 'image/png', imageDataUrl: image } })
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '✨ Preview This Look' })).toBeInTheDocument()
  })

  it('builds localized structured alt text for separates and one-piece outfits with optional outerwear', () => {
    expect(buildOutfitPreviewAlt(getCopy('en'), separates)).toMatch(/^Outfit preview: .*polo, .*chinos, .*loafers$/i)
    const onePiece: OutfitPreviewInput = {
      version: 1,
      mode: 'flat-lay',
      outfit: {
        kind: 'one-piece',
        onePiece: { garmentType: 'dress', color: { hex: '#884466' } },
        outerwear: { garmentType: 'cardigan', color: { hex: '#FFF0CF' } },
        shoes: { garmentType: 'heels', color: { hex: '#222222' } },
      },
    }
    const thai = buildOutfitPreviewAlt(getCopy('th'), onePiece)
    expect(thai).toMatch(/^ภาพตัวอย่างลุค:/)
    expect(thai).toContain('เดรส')
    expect(thai).toContain('คาร์ดิแกน')
    expect(thai).toContain('รองเท้าส้นสูง')
    expect(thai).not.toContain('#')
    expect(thai).not.toMatch(/ท่อนบน|ท่อนล่าง/)
  })

  it('relocalizes labels and alt text without another image request', async () => {
    vi.mocked(requestOutfitPreview).mockResolvedValue({ ok: true, result: { mimeType: 'image/png', imageDataUrl: image } })
    const user = userEvent.setup()
    const view = render(<Harness />)
    await user.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    const englishAlt = (await screen.findByRole('img')).getAttribute('alt')
    view.rerender(<Harness language="th" />)
    expect(screen.queryByRole('button', { name: '✨ สร้างภาพใหม่' })).not.toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('alt')).not.toBe(englishAlt)
    expect(screen.getByRole('img')).toHaveAttribute('src', image)
    expect(requestOutfitPreview).toHaveBeenCalledOnce()
  })

  it('uses Inspiration expectation copy without implying a new recommendation', async () => {
    vi.mocked(requestOutfitPreview).mockResolvedValue({ ok: true, result: { mimeType: 'image/png', imageDataUrl: image } })
    const user = userEvent.setup()
    render(<Harness source="inspiration" />)
    await user.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    expect(await screen.findByText(/visualizes the look idea selected above/i)).toBeInTheDocument()
  })

  describe('under React StrictMode (development double effect setup/cleanup/setup)', () => {
    const generateName = '✨ Preview This Look'
    const successResponse = { ok: true as const, result: { mimeType: 'image/png' as const, imageDataUrl: image } }
    const timeoutResponse = { ok: false as const, error: { kind: 'timeout' as const, message: 'The preview took too long.' } }
    type Response = Awaited<ReturnType<typeof requestOutfitPreview>>
    const deferred = () => {
      let resolve!: (value: Response) => void
      vi.mocked(requestOutfitPreview).mockImplementation(() => new Promise((done) => { resolve = done }))
      return { resolve: (value: Response) => resolve(value) }
    }

    it('A. settles a successful response instead of staying in loading', async () => {
      vi.mocked(requestOutfitPreview).mockResolvedValue(successResponse)
      render(<StrictMode><Harness /></StrictMode>)
      fireEvent.click(screen.getByRole('button', { name: generateName }))
      expect(await screen.findByRole('img')).toHaveAttribute('src', image)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('B. settles a normalized timeout with the failure alert and an available Retry', async () => {
      vi.mocked(requestOutfitPreview).mockResolvedValue(timeoutResponse)
      render(<StrictMode><Harness /></StrictMode>)
      fireEvent.click(screen.getByRole('button', { name: generateName }))
      expect(await screen.findByRole('alert')).toHaveTextContent("The preview couldn't be created")
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try Preview Again' })).toBeEnabled()
    })

    it('C. a true final unmount still ignores a late success', async () => {
      const request = deferred()
      const view = render(<StrictMode><Harness /></StrictMode>)
      fireEvent.click(screen.getByRole('button', { name: generateName }))
      view.unmount()
      request.resolve(successResponse)
      await Promise.resolve()
      await Promise.resolve()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('D. a true final unmount still ignores a late failure', async () => {
      const request = deferred()
      const view = render(<StrictMode><Harness /></StrictMode>)
      fireEvent.click(screen.getByRole('button', { name: generateName }))
      view.unmount()
      request.resolve(timeoutResponse)
      await Promise.resolve()
      await Promise.resolve()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('E. still discards a stale response after the context changes', async () => {
      const request = deferred()
      const view = render(<StrictMode><Harness fingerprint="before" /></StrictMode>)
      fireEvent.click(screen.getByRole('button', { name: generateName }))
      view.rerender(<StrictMode><Harness fingerprint="after" /></StrictMode>)
      request.resolve(successResponse)
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: generateName })).toBeInTheDocument()
    })

    it('F. prevents a duplicate click while loading, and H. never requests on mount or remount', async () => {
      const request = deferred()
      render(<StrictMode><Harness /></StrictMode>)
      expect(requestOutfitPreview).not.toHaveBeenCalled()
      const action = screen.getByRole('button', { name: generateName })
      fireEvent.click(action)
      fireEvent.click(action)
      expect(requestOutfitPreview).toHaveBeenCalledOnce()
      request.resolve(successResponse)
      expect(await screen.findByRole('img')).toBeInTheDocument()
      expect(requestOutfitPreview).toHaveBeenCalledOnce()
    })

    it('G. keeps the settled image and relocalizes without another request', async () => {
      vi.mocked(requestOutfitPreview).mockResolvedValue(successResponse)
      const view = render(<StrictMode><Harness /></StrictMode>)
      fireEvent.click(screen.getByRole('button', { name: generateName }))
      await screen.findByRole('img')
      view.rerender(<StrictMode><Harness language="th" /></StrictMode>)
      expect(screen.queryByRole('button', { name: '✨ สร้างภาพใหม่' })).not.toBeInTheDocument()
      expect(screen.getByRole('img')).toHaveAttribute('src', image)
      expect(requestOutfitPreview).toHaveBeenCalledOnce()
    })
  })
})
