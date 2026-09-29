import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recommendDeterministicOutfit } from '../domain/todayOutfit/baseline'
import { OUTFIT_BAKEOFF_CASES } from '../domain/todayOutfit/cases'
import { TodayOutfitImageLab } from './TodayOutfitImageLab'

const input = OUTFIT_BAKEOFF_CASES[0]
const recommendation = recommendDeterministicOutfit(input)
if (recommendation.status !== 'success') throw new Error('fixture must succeed')

const success = (candidate: 'gemini-image-lite' | 'gemini-image-standard') => ({
  status: 'success', candidate, provider: 'gemini', model: candidate === 'gemini-image-lite' ? 'gemini-3.1-flash-lite-image' : 'gemini-3.1-flash-image',
  mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,AAAA', latencyMs: candidate === 'gemini-image-lite' ? 1200 : 3800, usage: null,
})

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
  const candidate = url.endsWith('gemini-image-standard') ? 'gemini-image-standard' : 'gemini-image-lite'
  return Promise.resolve(new Response(JSON.stringify(success(candidate)), { status: 200 }))
})))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const renderLab = () => render(<TodayOutfitImageLab caseId={input.id} input={input} recommendation={recommendation} sourceLabel="test result" />)

describe('Today Outfit Image Lab workflow', () => {
  it('never generates automatically and candidate switches do not trigger calls', async () => {
    renderLab()
    expect(fetch).not.toHaveBeenCalled()
    await userEvent.setup().selectOptions(screen.getByLabelText('Image candidate'), 'gemini-image-standard')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('an explicit click sends exactly one derived structured request and renders the image', async () => {
    renderLab()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Generate outfit preview' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(fetch).toHaveBeenCalledWith('/api/ai-outfit-image/gemini-image-lite', expect.objectContaining({ method: 'POST' }))
    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body))
    expect(body).toMatchObject({ visualizationMode: 'flat-lay', candidate: 'gemini-image-lite', selectedItems: { top: { category: 'top' }, bottom: { category: 'bottom' }, outerwear: null, shoes: { category: 'shoes' } } })
    expect(body).not.toHaveProperty('prompt')
    expect(await screen.findByRole('img', { name: /Gemini Image Lite/ })).toHaveAttribute('src', 'data:image/png;base64,AAAA')
  })

  it('shows a loading state while generation is pending', async () => {
    let resolveResponse!: (value: Response) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { resolveResponse = resolve }))
    renderLab()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Generate outfit preview' }))
    expect(screen.getByRole('button', { name: 'Generating preview…' })).toBeDisabled()
    resolveResponse(new Response(JSON.stringify(success('gemini-image-lite')), { status: 200 }))
    expect(await screen.findByRole('img')).toBeInTheDocument()
  })

  it('keeps Lite and Standard results side by side with independent review controls', async () => {
    renderLab()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Generate outfit preview' }))
    await screen.findByRole('img', { name: /Lite/ })
    await user.selectOptions(screen.getByLabelText('Image candidate'), 'gemini-image-standard')
    await user.click(screen.getByRole('button', { name: 'Generate outfit preview' }))
    const comparison = await screen.findByRole('region', { name: 'Image candidate previews' })
    expect(within(comparison).getAllByRole('img')).toHaveLength(2)
    expect(within(comparison).getByText('gemini-3.1-flash-lite-image')).toBeInTheDocument()
    expect(within(comparison).getByText('gemini-3.1-flash-image')).toBeInTheDocument()
    expect(within(comparison).getAllByLabelText('Color fidelity')).toHaveLength(2)
    expect(screen.queryByText(/overall score|winner|accuracy percentage/i)).toBeNull()
  })
})
