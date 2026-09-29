import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildOwnedOutfitRequest } from '../domain/todayOutfitProduction/request'
import type { ProductionTodayOutfitResult } from '../domain/todayOutfitProduction/result'
import type { WardrobeRecordV1 } from '../domain/wardrobe/wardrobe'
import { getCopy } from '../i18n'
import { deleteSavedOutfitPreviewImage, loadSavedOutfitPreviewImage } from '../services/savedOutfitImages'
import { addSavedOutfit, loadSavedOutfits, setSavedOutfitPreviewImage } from '../services/savedOutfitPersistence'
import { SavedOutfitsView } from './SavedOutfitsView'

vi.mock('../services/savedOutfitImages', () => ({
  loadSavedOutfitPreviewImage: vi.fn(),
  deleteSavedOutfitPreviewImage: vi.fn(),
  persistSavedOutfitPreviewImage: vi.fn(),
}))

const wardrobe: WardrobeRecordV1[] = [
  { id: 'top', garmentType: 't-shirt', color: { hex: '#112233' }, formality: 'casual' },
  { id: 'bottom', garmentType: 'jeans', color: { hex: '#334455' }, formality: 'casual' },
  { id: 'shoes', garmentType: 'sneakers', color: { hex: '#FFFFFF' }, formality: 'casual' },
]

function look(): ProductionTodayOutfitResult {
  const request = buildOwnedOutfitRequest({ date: new Date(2026, 8, 21), goals: [], language: 'en', occasion: 'casual', wardrobe })
  return { mode: 'owned', request, result: { source: 'ai', recommendation: { selection: { kind: 'separates', topId: 'top', bottomId: 'bottom', outerwearId: null, shoesId: 'shoes' }, reasoning: { occasion: 'safe', personalColor: null, luckyColor: null } } } }
}

function addWithImage(now: number) {
  const saved = addSavedOutfit(look(), localStorage, now)
  if (!saved.ok || !saved.outfit) throw new Error('fixture failed')
  const imageId = `preview-${saved.outfit.id}`
  if (!setSavedOutfitPreviewImage(saved.outfit.id, imageId).ok) throw new Error('fixture link failed')
  return { ...saved.outfit, previewImageId: imageId }
}

describe('Saved Outfits display and image lifecycle', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(loadSavedOutfitPreviewImage).mockReset()
    vi.mocked(deleteSavedOutfitPreviewImage).mockReset().mockResolvedValue(true)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:saved-preview'), revokeObjectURL: vi.fn() })
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('renders a persisted Blob after remount with localized app-owned alt text', async () => {
    addWithImage(1_700_000_000_100)
    vi.mocked(loadSavedOutfitPreviewImage).mockResolvedValue({ id: 'preview', mimeType: 'image/png', blob: new Blob(['hello'], { type: 'image/png' }), createdAt: 1 })
    const first = render(<SavedOutfitsView copy={getCopy('en')} onBack={vi.fn()} />)
    expect(await screen.findByRole('img')).toHaveAttribute('src', 'blob:saved-preview')
    expect(screen.getByRole('img')).toHaveAttribute('alt', expect.stringMatching(/^Outfit preview:/))
    first.unmount()

    render(<SavedOutfitsView copy={getCopy('th')} onBack={vi.fn()} />)
    expect(await screen.findByRole('img')).toHaveAttribute('alt', expect.stringMatching(/^ภาพตัวอย่างลุค:/))
    expect(loadSavedOutfitPreviewImage).toHaveBeenCalledTimes(2)
  })

  it('falls back to authoritative garment/color cards when the Blob is missing or corrupt', async () => {
    addWithImage(1_700_000_000_101)
    vi.mocked(loadSavedOutfitPreviewImage).mockResolvedValue(null)
    render(<SavedOutfitsView copy={getCopy('en')} onBack={vi.fn()} />)
    await waitFor(() => expect(loadSavedOutfitPreviewImage).toHaveBeenCalledOnce())
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('T-shirt')).toBeInTheDocument()
    expect(screen.getByText('#112233')).toBeInTheDocument()
  })

  it('deletes only the selected outfit image and leaves another Saved Outfit intact', async () => {
    const first = addWithImage(1_700_000_000_102)
    const second = addWithImage(1_700_000_000_103)
    vi.mocked(loadSavedOutfitPreviewImage).mockResolvedValue(null)
    const user = userEvent.setup()
    render(<SavedOutfitsView copy={getCopy('en')} onBack={vi.fn()} />)
    await user.click(screen.getAllByRole('button', { name: 'Delete Saved Outfit' })[0])
    expect(deleteSavedOutfitPreviewImage).toHaveBeenCalledWith(first.previewImageId)
    expect(deleteSavedOutfitPreviewImage).not.toHaveBeenCalledWith(second.previewImageId)
    const loaded = loadSavedOutfits()
    expect(loaded.status === 'loaded' && loaded.outfits.map((outfit) => outfit.id)).toEqual([second.id])
    expect(screen.getAllByRole('button', { name: 'Delete Saved Outfit' })).toHaveLength(1)
  })

  it('preserves metadata when associated image deletion fails', async () => {
    const saved = addWithImage(1_700_000_000_104)
    vi.mocked(loadSavedOutfitPreviewImage).mockResolvedValue(null)
    vi.mocked(deleteSavedOutfitPreviewImage).mockResolvedValue(false)
    const user = userEvent.setup()
    render(<SavedOutfitsView copy={getCopy('en')} onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Delete Saved Outfit' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't be deleted safely")
    const loaded = loadSavedOutfits()
    expect(loaded.status === 'loaded' && loaded.outfits[0].id).toBe(saved.id)
  })
})
