import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OwnedOutfitRecommendation } from '../domain/todayOutfitProduction/contract'
import type { InspirationOutfitRecommendation } from '../domain/todayOutfitProduction/inspirationContract'
import type { WardrobeRecordV1 } from '../domain/wardrobe/wardrobe'
import { getCopy } from '../i18n'
import { requestInspirationOutfitRecommendation } from '../services/inspirationOutfitRecommendation'
import { requestOwnedOutfitRecommendation } from '../services/ownedOutfitRecommendation'
import { requestOutfitPreview } from '../services/outfitPreview'
import { saveWardrobe } from '../services/wardrobePersistence'
import { DailyView } from './DailyView'

vi.mock('../services/ownedOutfitRecommendation', () => ({ requestOwnedOutfitRecommendation: vi.fn() }))
vi.mock('../services/inspirationOutfitRecommendation', () => ({ requestInspirationOutfitRecommendation: vi.fn() }))
vi.mock('../services/outfitPreview', () => ({ requestOutfitPreview: vi.fn() }))

const monday = new Date(2026, 8, 21, 10)
const item = (id: string, garmentType: WardrobeRecordV1['garmentType'], hex: string, customName: string): WardrobeRecordV1 => ({ id, garmentType, color: { hex }, formality: 'casual', customName })
const wardrobe = [
  item('top-1', 't-shirt', '#112233', 'Top one'), item('top-2', 'polo', '#223344', 'Top two'),
  item('bottom-1', 'jeans', '#334455', 'Bottom one'), item('bottom-2', 'chinos', '#445566', 'Bottom two'),
  item('shoes-1', 'sneakers', '#FFFFFF', 'Shoes one'),
]
const owned = (topId: string, bottomId: string): OwnedOutfitRecommendation => ({
  selection: { kind: 'separates', topId, bottomId, outerwearId: null, shoesId: 'shoes-1' },
  reasoning: { occasion: 'safe', personalColor: null, luckyColor: null },
})
const ownedOne = owned('top-1', 'bottom-1')
const ownedTwo = owned('top-2', 'bottom-1')
const ownedThree = owned('top-1', 'bottom-2')
const inspirationOne: InspirationOutfitRecommendation = { outfit: { kind: 'separates', top: { garmentType: 'shirt', color: { kind: 'generic', colorId: 'beige' } }, bottom: { garmentType: 'chinos', color: { kind: 'generic', colorId: 'navy' } }, outerwear: null, shoes: { garmentType: 'loafers', color: { kind: 'generic', colorId: 'brown' } } } }
const inspirationTwo: InspirationOutfitRecommendation = { outfit: { kind: 'separates', top: { garmentType: 't-shirt', color: { kind: 'generic', colorId: 'white' } }, bottom: { garmentType: 'jeans', color: { kind: 'generic', colorId: 'blue' } }, outerwear: null, shoes: { garmentType: 'sneakers', color: { kind: 'generic', colorId: 'gray' } } } }
const today = (gender: 'men' | 'women' | null = null) => <DailyView copy={getCopy('en')} result={null} gender={gender} onQuiz={vi.fn()} clock={() => monday} />

describe('Today session Look Collection', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(requestOwnedOutfitRecommendation).mockReset()
    vi.mocked(requestInspirationOutfitRecommendation).mockReset()
    vi.mocked(requestOutfitPreview).mockReset()
  })
  afterEach(cleanup)

  it('A–E, N: appends three ordered Looks, sends all prior signatures, caps the collection, and makes no image call', async () => {
    saveWardrobe(wardrobe)
    vi.mocked(requestOwnedOutfitRecommendation)
      .mockResolvedValueOnce({ ok: true, result: ownedOne })
      .mockResolvedValueOnce({ ok: true, result: ownedTwo })
      .mockResolvedValueOnce({ ok: true, result: ownedThree })
    const user = userEvent.setup()
    render(today())

    await user.click(screen.getByRole('button', { name: "Create Today's Look ✨" }))
    expect(await screen.findByText('Look 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '✨ Add Another Look' }))
    expect(await screen.findByText('Look 2')).toBeInTheDocument()
    expect(screen.getByText('Look 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '✨ Add Another Look' }))
    expect(await screen.findByText('Look 3')).toBeInTheDocument()
    expect(document.querySelectorAll('.today-look-card')).toHaveLength(3)

    expect(vi.mocked(requestOwnedOutfitRecommendation).mock.calls[0][0].exclusions).toEqual([])
    expect(vi.mocked(requestOwnedOutfitRecommendation).mock.calls[1][0].exclusions).toEqual([{ kind: 'separates', itemIds: ['top-1', 'bottom-1', 'shoes-1'] }])
    expect(vi.mocked(requestOwnedOutfitRecommendation).mock.calls[2][0].exclusions).toEqual([
      { kind: 'separates', itemIds: ['top-1', 'bottom-1', 'shoes-1'] },
      { kind: 'separates', itemIds: ['top-2', 'bottom-1', 'shoes-1'] },
    ])
    expect(screen.getByRole('button', { name: '✨ Add Another Look' })).toBeDisabled()
    expect(screen.getByText(/change the selections above/i)).toBeInTheDocument()
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledTimes(3)
    expect(requestOutfitPreview).not.toHaveBeenCalled()
  })

  it('F: rejects an exact duplicate provider result and appends a distinct safe fallback', async () => {
    saveWardrobe([wardrobe[0], wardrobe[1], wardrobe[2], wardrobe[4]])
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: true, result: ownedOne })
    const user = userEvent.setup()
    render(today())
    await user.click(screen.getByRole('button', { name: "Create Today's Look ✨" }))
    await user.click(await screen.findByRole('button', { name: '✨ Add Another Look' }))
    expect(await screen.findByText('Look 2')).toBeInTheDocument()
    expect(screen.getByText('Top one')).toBeInTheDocument()
    expect(screen.getByText('Top two')).toBeInTheDocument()
    expect(document.querySelectorAll('.today-look-card')).toHaveLength(2)
  })

  it('G: keeps the existing collection when no different Owned combination exists', async () => {
    saveWardrobe([wardrobe[0], wardrobe[2], wardrobe[4]])
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: true, result: ownedOne })
    const user = userEvent.setup()
    render(today())
    await user.click(screen.getByRole('button', { name: "Create Today's Look ✨" }))
    await user.click(await screen.findByRole('button', { name: '✨ Add Another Look' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't find a different valid combination/i)
    expect(screen.getByText('Look 1')).toBeInTheDocument()
    expect(document.querySelectorAll('.today-look-card')).toHaveLength(1)
  })

  it('H: keeps selected-gender constraints in every appended Inspiration request', async () => {
    vi.mocked(requestInspirationOutfitRecommendation)
      .mockResolvedValueOnce({ ok: true, result: inspirationOne })
      .mockResolvedValueOnce({ ok: true, result: inspirationTwo })
    const user = userEvent.setup()
    const { container } = render(today('men'))
    await user.click(screen.getByRole('button', { name: "Create Today's Look ✨" }))
    await user.click(await screen.findByRole('button', { name: '✨ Add Another Look' }))
    expect(await screen.findByText('Look 2')).toBeInTheDocument()
    expect(vi.mocked(requestInspirationOutfitRecommendation).mock.calls.map(([request]) => request.gender)).toEqual(['men', 'men'])
    expect(vi.mocked(requestInspirationOutfitRecommendation).mock.calls[1][0].exclusions).toHaveLength(1)
    expect(container.querySelector('.today-look-collection')).not.toHaveTextContent(/heels|dress|skirt|blouse|flats/i)
  })

  it('I–L, N: Preview state is independent, survives append, and two successful images coexist without regeneration', async () => {
    saveWardrobe(wardrobe)
    vi.mocked(requestOwnedOutfitRecommendation)
      .mockResolvedValueOnce({ ok: true, result: ownedOne })
      .mockResolvedValueOnce({ ok: true, result: ownedTwo })
    vi.mocked(requestOutfitPreview)
      .mockResolvedValueOnce({ ok: true, result: { mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,b25l' } })
      .mockResolvedValueOnce({ ok: true, result: { mimeType: 'image/png', imageDataUrl: 'data:image/png;base64,dHdv' } })
    const user = userEvent.setup()
    render(today())
    await user.click(screen.getByRole('button', { name: "Create Today's Look ✨" }))
    await user.click(await screen.findByRole('button', { name: '✨ Preview This Look' }))
    expect(await screen.findAllByRole('img')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '✨ Add Another Look' }))
    expect(await screen.findByText('Look 2')).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(requestOutfitPreview).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: '✨ Preview This Look' }))
    expect(await screen.findAllByRole('img')).toHaveLength(2)
    expect(requestOutfitPreview).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: /Generate Another Preview/i })).not.toBeInTheDocument()
  })

  it('O, P: a true context change clears the collection without generation; locale alone preserves it without calls', async () => {
    saveWardrobe(wardrobe)
    vi.mocked(requestOwnedOutfitRecommendation).mockResolvedValue({ ok: true, result: ownedOne })
    const user = userEvent.setup()
    const view = render(today())
    await user.click(screen.getByRole('button', { name: "Create Today's Look ✨" }))
    await screen.findByText('Look 1')
    view.rerender(<DailyView copy={getCopy('th')} result={null} onQuiz={vi.fn()} clock={() => monday} />)
    expect(screen.getByText('ลุคที่ 1')).toBeInTheDocument()
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledOnce()
    expect(requestOutfitPreview).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'การงาน' }))
    expect(screen.queryByText('ลุคที่ 1')).not.toBeInTheDocument()
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledOnce()
  })

  it('Q, R: StrictMode fires nothing by itself and a duplicate click during append makes one request while Look 1 remains', async () => {
    saveWardrobe(wardrobe)
    let resolveSecond!: (value: { ok: true; result: OwnedOutfitRecommendation }) => void
    vi.mocked(requestOwnedOutfitRecommendation)
      .mockResolvedValueOnce({ ok: true, result: ownedOne })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))
    const user = userEvent.setup()
    render(<StrictMode>{today()}</StrictMode>)
    expect(requestOwnedOutfitRecommendation).not.toHaveBeenCalled()
    expect(requestOutfitPreview).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: "Create Today's Look ✨" }))
    await screen.findByText('Look 1')
    const add = screen.getByRole('button', { name: '✨ Add Another Look' })
    fireEvent.click(add)
    fireEvent.click(add)
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Look 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /adding another look/i })).toBeDisabled()
    resolveSecond({ ok: true, result: ownedTwo })
    await waitFor(() => expect(screen.getByText('Look 2')).toBeInTheDocument())
    expect(requestOwnedOutfitRecommendation).toHaveBeenCalledTimes(2)
  })
})
