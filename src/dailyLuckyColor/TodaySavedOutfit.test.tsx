import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCopy } from '../i18n'
import { loadSavedOutfits, SAVED_OUTFITS_STORAGE_KEY } from '../services/savedOutfitPersistence'
import { persistSavedOutfitPreviewImage } from '../services/savedOutfitImages'
import { requestOwnedOutfitRecommendation } from '../services/ownedOutfitRecommendation'
import { requestOutfitPreview } from '../services/outfitPreview'
import { saveWardrobe } from '../services/wardrobePersistence'
import { DailyView } from './DailyView'

vi.mock('../services/ownedOutfitRecommendation', () => ({ requestOwnedOutfitRecommendation: vi.fn() }))
vi.mock('../services/inspirationOutfitRecommendation', () => ({ requestInspirationOutfitRecommendation: vi.fn() }))
vi.mock('../services/outfitPreview', () => ({ requestOutfitPreview: vi.fn() }))
vi.mock('../services/savedOutfitImages', () => ({
  persistSavedOutfitPreviewImage: vi.fn(),
  loadSavedOutfitPreviewImage: vi.fn(),
  deleteSavedOutfitPreviewImage: vi.fn(),
}))

const monday = new Date(2026, 8, 21, 10)
const image = 'data:image/png;base64,aGVsbG8='
const recommendation = {
  selection: { kind: 'separates' as const, topId: 'top', bottomId: 'bottom', outerwearId: null, shoesId: 'shoes' },
  reasoning: { occasion: 'safe', personalColor: null, luckyColor: null },
}

function seedWardrobe() {
  saveWardrobe([
    { id: 'top', garmentType: 't-shirt', color: { hex: '#112233' }, formality: 'casual' },
    { id: 'bottom', garmentType: 'jeans', color: { hex: '#334455' }, formality: 'casual' },
    { id: 'shoes', garmentType: 'sneakers', color: { hex: '#FFFFFF' }, formality: 'casual' },
  ])
}

const today = (language: 'en' | 'th' = 'en') => <DailyView copy={getCopy(language)} result={null} onQuiz={vi.fn()} clock={() => monday} />

async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: "Create Today's Look ✨" }))
  await screen.findByRole('heading', { name: 'Wear this today' })
}

describe('Today Look save and persisted Preview flow', () => {
  beforeEach(() => {
    localStorage.clear()
    seedWardrobe()
    vi.mocked(requestOwnedOutfitRecommendation).mockReset().mockResolvedValue({ ok: true, result: recommendation })
    vi.mocked(requestOutfitPreview).mockReset().mockResolvedValue({ ok: true, result: { mimeType: 'image/png', imageDataUrl: image } })
    vi.mocked(persistSavedOutfitPreviewImage).mockReset().mockImplementation(async (id) => ({ ok: true, image: { id, mimeType: 'image/png', blob: new Blob(['hello'], { type: 'image/png' }), createdAt: Date.now() } }))
  })
  afterEach(cleanup)

  it('saves a structured Look without a Preview and never requests or stores an image', async () => {
    const user = userEvent.setup()
    render(today())
    await generate(user)
    await user.click(screen.getByRole('button', { name: 'Save This Look' }))
    const saved = loadSavedOutfits()
    expect(saved.status).toBe('loaded')
    expect(saved.status === 'loaded' && saved.outfits).toHaveLength(1)
    expect(saved.status === 'loaded' && saved.outfits[0].previewImageId).toBeUndefined()
    expect(requestOutfitPreview).not.toHaveBeenCalled()
    expect(persistSavedOutfitPreviewImage).not.toHaveBeenCalled()
  })

  it('copies an existing Preview into IndexedDB without another provider call or base64 in localStorage', async () => {
    const user = userEvent.setup()
    render(today())
    await generate(user)
    await user.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    await screen.findByRole('img')
    expect(requestOutfitPreview).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Save This Look' }))
    expect(persistSavedOutfitPreviewImage).toHaveBeenCalledOnce()
    expect(requestOutfitPreview).toHaveBeenCalledOnce()
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledOnce()
    const saved = loadSavedOutfits()
    expect(saved.status === 'loaded' && saved.outfits[0].previewImageId).toMatch(/^preview-saved-/)
    expect(localStorage.getItem(SAVED_OUTFITS_STORAGE_KEY)).not.toMatch(/data:image|base64|aGVsbG8=/i)
  })

  it('keeps the structured Saved Outfit when IndexedDB image storage fails', async () => {
    vi.mocked(persistSavedOutfitPreviewImage).mockResolvedValue({ ok: false })
    const user = userEvent.setup()
    render(today())
    await generate(user)
    await user.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    await screen.findByRole('img')
    await user.click(screen.getByRole('button', { name: 'Save This Look' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Look saved, but the preview image couldn't be stored")
    const saved = loadSavedOutfits()
    expect(saved.status === 'loaded' && saved.outfits).toHaveLength(1)
    expect(saved.status === 'loaded' && saved.outfits[0].previewImageId).toBeUndefined()
  })

  it('supports Save first, then an explicit Preview attachment later', async () => {
    const user = userEvent.setup()
    render(today())
    await generate(user)
    await user.click(screen.getByRole('button', { name: 'Save This Look' }))
    await user.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    await screen.findByRole('img')
    expect(persistSavedOutfitPreviewImage).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Save Preview to Saved Outfit' }))
    expect(persistSavedOutfitPreviewImage).toHaveBeenCalledOnce()
    expect(requestOutfitPreview).toHaveBeenCalledOnce()
    const saved = loadSavedOutfits()
    expect(saved.status === 'loaded' && saved.outfits[0].previewImageId).toMatch(/^preview-saved-/)
  })

  it('a Today context reset clears the Look but preserves its Saved Outfit and image reference', async () => {
    const user = userEvent.setup()
    render(today())
    await generate(user)
    await user.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    await screen.findByRole('img')
    await user.click(screen.getByRole('button', { name: 'Save This Look' }))
    await user.click(screen.getByRole('button', { name: 'Work' }))
    expect(screen.queryByRole('heading', { name: 'Wear this today' })).not.toBeInTheDocument()
    const saved = loadSavedOutfits()
    expect(saved.status === 'loaded' && saved.outfits).toHaveLength(1)
    expect(saved.status === 'loaded' && saved.outfits[0].previewImageId).toBeTruthy()
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledOnce()
    expect(requestOutfitPreview).toHaveBeenCalledOnce()
  })

  it('locale changes preserve the Saved link and make zero additional calls', async () => {
    const user = userEvent.setup()
    const view = render(today())
    await generate(user)
    await user.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    await screen.findByRole('img')
    await user.click(screen.getByRole('button', { name: 'Save This Look' }))
    view.rerender(today('th'))
    expect(screen.getByRole('button', { name: 'เก็บภาพไว้กับลุคนี้แล้ว' })).toBeDisabled()
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledOnce()
    expect(requestOutfitPreview).toHaveBeenCalledOnce()
    expect(persistSavedOutfitPreviewImage).toHaveBeenCalledOnce()
  })

  it('StrictMode does not duplicate Saved Outfit image records', async () => {
    const user = userEvent.setup()
    render(<StrictMode>{today()}</StrictMode>)
    await generate(user)
    await user.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    await screen.findByRole('img')
    await user.click(screen.getByRole('button', { name: 'Save This Look' }))
    expect(persistSavedOutfitPreviewImage).toHaveBeenCalledOnce()
    const saved = loadSavedOutfits()
    expect(saved.status === 'loaded' && saved.outfits).toHaveLength(1)
  })
})
