import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TodayOutfitLabView } from './TodayOutfitLabView'

const recommendation = { status: 'success', selectedItemIds: { topId: 'cream-tee', bottomId: 'khaki-chinos', outerwearId: null, shoesId: 'white-sneakers' }, alternative: null, reasoning: 'Relaxed and coherent.', personalColorNotes: 'Cream supports Warm Spring near the face.', confidence: 'medium' }

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, latencyMs: 123, usage: null, validation: { valid: true, issues: [] }, result: recommendation }), { status: 200 }))))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Today Outfit development lab workflow', () => {
  it('makes no automatic AI call, shows the baseline, and runs only the chosen candidate manually', async () => {
    render(<TodayOutfitLabView />)
    expect(screen.getByRole('heading', { name: 'Deterministic baseline' })).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    await userEvent.setup().click(screen.getByRole('button', { name: /Run Gemini Flash-Lite/ }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(fetch).toHaveBeenCalledWith('/api/ai-outfit/gemini-flash-lite', expect.objectContaining({ method: 'POST' }))
    const aiHeading = await screen.findByRole('heading', { name: /Gemini Flash-Lite · 123 ms/ })
    expect(within(aiHeading.closest('section')!).getByText('Relaxed and coherent.')).toBeInTheDocument()
  })
  it('records the separate human review dimensions without collapsing them into a score', async () => {
    render(<TodayOutfitLabView />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Run Gemini Flash-Lite/ }))
    const review = await screen.findByRole('group', { name: 'PO review for this exact run' })
    expect(within(review).getByLabelText('outfit quality')).toBeInTheDocument()
    expect(within(review).getByLabelText('personal color reasoning')).toBeInTheDocument()
    expect(within(review).getByLabelText('occasion fit')).toBeInTheDocument()
    expect(within(review).getByLabelText('Constraint compliance')).toBeInTheDocument()
    expect(screen.queryByText(/accuracy|total score/i)).toBeNull()
  })
  it('keeps the existing text outfit result visible when image generation fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, latencyMs: 123, usage: null, validation: { valid: true, issues: [] }, result: recommendation }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'failure', candidate: 'gemini-image-lite', provider: 'gemini', model: 'gemini-3.1-flash-lite-image', latencyMs: 250, reason: { kind: 'rate-limited', httpStatus: 429, message: 'The provider rate-limited this request.' } }), { status: 200 }))
    render(<TodayOutfitLabView />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Run Gemini Flash-Lite/ }))
    expect(await screen.findByText('Relaxed and coherent.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Generate outfit preview' }))
    expect(await screen.findByText('The provider rate-limited this request.')).toBeInTheDocument()
    expect(screen.getByText('Relaxed and coherent.')).toBeInTheDocument()
  })
})
