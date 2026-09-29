import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { describeColor } from '../domain/colorNames/colorNames'
import { getPalette } from '../domain/personalColor/palettes'
import { analyzeQuiz } from '../domain/personalColor/scoring'
import { GARMENT_DEFINITIONS, getWardrobeDisplayName } from '../domain/wardrobe'
import type { PersonalColorResult } from '../domain/personalColor/types'
import type { WardrobeRecordV1 } from '../domain/wardrobe'
import { en } from '../i18n/en'
import { th } from '../i18n/th'
import { loadWardrobe, saveWardrobe, WARDROBE_STORAGE_KEY } from '../services/wardrobePersistence'
import { WardrobeView } from './WardrobeView'

const profile = analyzeQuiz({ undertone: 'golden', metal: 'gold', white: 'ivory' })
const renderWardrobe = (options: { language?: 'en' | 'th'; result?: PersonalColorResult | null } = {}) => render(<WardrobeView copy={options.language === 'th' ? th : en} language={options.language ?? 'en'} result={options.result === undefined ? profile : options.result} onBack={vi.fn()} />)
const items = () => {
  const loaded = loadWardrobe()
  if (loaded.status !== 'loaded') throw new Error(`unexpected ${loaded.status}`)
  return loaded.items
}

async function openAdd(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button', { name: /Add item/ })[0])
}

async function chooseBasicTShirt(user: ReturnType<typeof userEvent.setup>, color = 'Black') {
  await user.click(screen.getByRole('button', { name: 'T-shirt' }))
  await user.click(screen.getByRole('button', { name: new RegExp(`^${color} #`) }))
}

describe('My Wardrobe empty state and taxonomy', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => cleanup())

  it('starts empty with no fake records, a 5–8 piece guide, outfit coverage, and Add CTA', () => {
    renderWardrobe()
    expect(screen.getByRole('heading', { name: 'My Wardrobe' })).toBeInTheDocument()
    expect(screen.getByText(/5–8 pieces/)).toBeInTheDocument()
    expect(screen.getByText('Top + Bottom + Shoes')).toBeInTheDocument()
    expect(screen.getByText('One-piece + Shoes')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Add item/ })).toHaveLength(2)
    expect(document.querySelectorAll('.wardrobe-card')).toHaveLength(0)
    expect(items()).toEqual([])
  })

  it('renders all 28 localized garment types, including one-piece, from the production taxonomy', async () => {
    const user = userEvent.setup()
    renderWardrobe()
    await openAdd(user)
    const rendered = new Set<string>()
    for (const slot of ['Tops', 'Bottoms', 'One-pieces', 'Outerwear', 'Shoes']) {
      await user.click(screen.getByRole('button', { name: slot }))
      for (const definition of GARMENT_DEFINITIONS) if (screen.queryByRole('button', { name: definition.label.en })) rendered.add(definition.id)
    }
    expect(rendered).toEqual(new Set(GARMENT_DEFINITIONS.map(({ id }) => id)))
    expect(screen.getByRole('button', { name: 'Shoes' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('uses the centralized natural Thai labels without presentation-preference filtering', async () => {
    const user = userEvent.setup()
    renderWardrobe({ language: 'th' })
    await user.click(screen.getAllByRole('button', { name: /เพิ่มเสื้อผ้า/ })[0])
    expect(screen.getByRole('button', { name: 'เสื้อยืด' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ชุดชิ้นเดียว' }))
    expect(screen.getByRole('button', { name: 'เดรส' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'จัมป์สูท' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'รองเท้า' }))
    expect(screen.getByRole('button', { name: 'รองเท้าโลฟเฟอร์' })).toBeInTheDocument()
  })
})

describe('My Wardrobe CRUD and colors', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('adds a Basic Color as arbitrary normalized HEX and survives a fresh render', async () => {
    const user = userEvent.setup()
    const view = renderWardrobe()
    await openAdd(user)
    await chooseBasicTShirt(user)
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(items()).toMatchObject([{ garmentType: 't-shirt', color: { hex: '#111111' }, formality: 'casual' }])
    expect(items()[0].color).not.toHaveProperty('canonicalColorId')
    expect(screen.getByRole('heading', { name: 'Black T-shirt' })).toBeInTheDocument()
    view.unmount()
    renderWardrobe()
    expect(screen.getByRole('heading', { name: 'Black T-shirt' })).toBeInTheDocument()
  })

  it('stores exact canonical HEX and ID from My Palette', async () => {
    const user = userEvent.setup()
    const canonical = getPalette(profile.subtype).best[0]
    renderWardrobe()
    await openAdd(user)
    await user.click(screen.getByRole('button', { name: 'T-shirt' }))
    await user.click(screen.getByRole('tab', { name: 'My Palette' }))
    await user.click(screen.getByRole('button', { name: `Choose ${canonical.name}` }))
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(items()[0].color).toEqual({ hex: canonical.hex, canonicalColorId: canonical.id })
  })

  it('stores normalized Exact Color with no canonical identity', async () => {
    const user = userEvent.setup()
    renderWardrobe()
    await openAdd(user)
    await user.click(screen.getByRole('button', { name: 'T-shirt' }))
    await user.click(screen.getByRole('tab', { name: 'Exact Color' }))
    const input = screen.getByRole('textbox', { name: 'HEX color' })
    await user.clear(input)
    await user.type(input, 'abc')
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(items()[0].color).toEqual({ hex: '#AABBCC' })
  })

  it.each(['basic', 'exact'] as const)('clears canonical identity when an edited palette color changes through %s', async (source) => {
    const canonical = getPalette(profile.subtype).best[0]
    saveWardrobe([{ id: 'canonical-shirt', garmentType: 'shirt', color: { hex: canonical.hex, canonicalColorId: canonical.id }, formality: 'smart-casual' }])
    const user = userEvent.setup()
    renderWardrobe()
    await user.click(screen.getByRole('button', { name: /Edit / }))
    if (source === 'basic') {
      await user.click(screen.getByRole('tab', { name: 'Basic Colors' }))
      await user.click(screen.getByRole('button', { name: /^Black #/ }))
    } else {
      await user.click(screen.getByRole('tab', { name: 'Exact Color' }))
      const input = screen.getByRole('textbox', { name: 'HEX color' })
      await user.clear(input)
      await user.type(input, '123456')
    }
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(items()[0].color).not.toHaveProperty('canonicalColorId')
  })

  it('preserves canonical identity when edit leaves its palette selection unchanged', async () => {
    const canonical = getPalette(profile.subtype).best[0]
    saveWardrobe([{ id: 'canonical-shirt', garmentType: 'shirt', color: { hex: canonical.hex, canonicalColorId: canonical.id }, formality: 'smart-casual' }])
    const user = userEvent.setup()
    renderWardrobe()
    await user.click(screen.getByRole('button', { name: /Edit / }))
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(items()[0].color).toEqual({ hex: canonical.hex, canonicalColorId: canonical.id })
  })

  it('supports Basic and Exact colors without a profile while My Palette is disabled', async () => {
    const user = userEvent.setup()
    renderWardrobe({ result: null })
    await openAdd(user)
    expect(screen.getByRole('tab', { name: 'My Palette' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Basic Colors' })).toBeEnabled()
    expect(screen.getByRole('tab', { name: 'Exact Color' })).toBeEnabled()
  })

  it('uses automatic bilingual names, supports custom override, and drops whitespace-only names', async () => {
    const user = userEvent.setup()
    const view = renderWardrobe()
    await openAdd(user)
    await chooseBasicTShirt(user)
    expect(screen.getByText('Black T-shirt')).toBeInTheDocument()
    await user.click(screen.getByText('More details'))
    await user.type(screen.getByRole('textbox', { name: 'Custom name (optional)' }), 'Weekend tee')
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(screen.getByRole('heading', { name: 'Weekend tee' })).toBeInTheDocument()
    view.unmount()
    localStorage.clear()
    const second = renderWardrobe()
    await user.click(screen.getAllByRole('button', { name: /Add item/ })[0])
    await user.click(screen.getByRole('button', { name: 'T-shirt' }))
    await user.click(screen.getByRole('button', { name: /^Black #/ }))
    await user.click(screen.getByText('More details'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom name (optional)' }), { target: { value: '   ' } })
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(items()[0]).not.toHaveProperty('customName')
    second.unmount()
    renderWardrobe({ language: 'th' })
    expect(screen.getByRole('heading', { name: 'เสื้อยืดสีดำ' })).toBeInTheDocument()
  })

  it('shows concise bilingual card actions while accessible names identify the item', () => {
    saveWardrobe([{ id: 'named-actions', garmentType: 'shirt', color: { hex: '#111111' }, formality: 'smart-casual' }])
    const english = renderWardrobe()
    expect(screen.getByRole('button', { name: 'Edit Black shirt' })).toHaveTextContent(/^Edit$/)
    expect(screen.getByRole('button', { name: 'Delete Black shirt' })).toHaveTextContent(/^Delete$/)
    english.unmount()
    renderWardrobe({ language: 'th' })
    expect(screen.getByRole('button', { name: 'แก้ไข เสื้อเชิ้ตสีดำ' })).toHaveTextContent(/^แก้ไข$/)
    expect(screen.getByRole('button', { name: 'ลบ เสื้อเชิ้ตสีดำ' })).toHaveTextContent(/^ลบ$/)
  })

  it('preserves complete long automatic and custom names in two-line-safe card headings', () => {
    const thaiItem: WardrobeRecordV1 = { id: 'long-thai', garmentType: 'other-one-piece', color: { hex: '#1E2C4D' }, formality: 'casual' }
    saveWardrobe([thaiItem])
    const thaiView = renderWardrobe({ language: 'th' })
    const thaiName = getWardrobeDisplayName(thaiItem, 'th')
    expect(screen.getByRole('heading', { name: thaiName })).toHaveClass('wardrobe-card-name')
    thaiView.unmount()

    const customName = 'Long custom wardrobe name that remains complete for assistive technology'
    saveWardrobe([{ ...thaiItem, id: 'long-custom', customName }])
    renderWardrobe()
    expect(screen.getByRole('heading', { name: customName })).toHaveClass('wardrobe-card-name')
  })

  it('keeps successful Add, Edit, and Delete quiet without a permanent status banner', async () => {
    const user = userEvent.setup()
    renderWardrobe()
    await openAdd(user)
    await chooseBasicTShirt(user)
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit Black T-shirt' }))
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete Black T-shirt' }))
    await user.click(screen.getByRole('button', { name: 'Delete item' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('initializes Add formality from type, persists overrides, and preserves stored formality when Edit changes type', async () => {
    const user = userEvent.setup()
    renderWardrobe()
    await openAdd(user)
    await user.click(screen.getByRole('button', { name: 'shirt' }))
    await user.click(screen.getByRole('button', { name: /^Black #/ }))
    await user.click(screen.getByText('More details'))
    expect(screen.getByRole('radio', { name: 'Smart Casual' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Formal' }))
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(items()[0].formality).toBe('formal')
    await user.click(screen.getByRole('button', { name: /Edit / }))
    await user.click(screen.getByRole('button', { name: 'T-shirt' }))
    expect(screen.getByRole('radio', { name: 'Formal' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Use type default: Casual' }))
    expect(screen.getByRole('radio', { name: 'Casual' })).toBeChecked()
  })

  it('Save & add another persists once, retains the slot group, and clears type/color', async () => {
    const user = userEvent.setup()
    renderWardrobe()
    await openAdd(user)
    await chooseBasicTShirt(user)
    await user.click(screen.getByRole('button', { name: 'Save & add another' }))
    expect(items()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Tops' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'T-shirt' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /^Save$/ })).toBeDisabled()
  })

  it('protects deletion with confirmation and persists only after confirmation', async () => {
    saveWardrobe([{ id: 'delete-me', garmentType: 'dress', color: { hex: '#B93A43' }, formality: 'smart-casual' }])
    const user = userEvent.setup()
    renderWardrobe()
    await user.click(screen.getByRole('button', { name: /Delete / }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(items()).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /Delete / }))
    await user.click(screen.getByRole('button', { name: 'Delete item' }))
    expect(items()).toEqual([])
    expect(screen.getByText(/5–8 pieces/)).toBeInTheDocument()
  })
})

describe('My Wardrobe filters, storage safety, and accessibility', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  const fiveSlots: WardrobeRecordV1[] = [
    { id: 'top-1', garmentType: 'shirt', color: { hex: '#111111' }, formality: 'smart-casual' },
    { id: 'bottom-1', garmentType: 'jeans', color: { hex: '#3568A8' }, formality: 'casual' },
    { id: 'one-1', garmentType: 'dress', color: { hex: '#B93A43' }, formality: 'smart-casual' },
    { id: 'outer-1', garmentType: 'blazer', color: { hex: '#808080' }, formality: 'smart-casual' },
    { id: 'shoes-1', garmentType: 'loafers', color: { hex: '#7B4C31' }, formality: 'smart-casual' },
  ]

  it('filters all five derived slots with semantic selected state', async () => {
    saveWardrobe(fiveSlots)
    const user = userEvent.setup()
    renderWardrobe()
    expect(document.querySelectorAll('.wardrobe-card')).toHaveLength(5)
    for (const [filter, expected] of [['Tops', 'Black shirt'], ['Bottoms', 'Deep Blue jeans'], ['One-pieces', 'Red dress'], ['Outerwear', 'Gray blazer'], ['Shoes', 'Brown loafers']] as const) {
      await user.click(screen.getByRole('button', { name: filter }))
      expect(screen.getByRole('button', { name: filter })).toHaveAttribute('aria-pressed', 'true')
      expect(document.querySelectorAll('.wardrobe-card')).toHaveLength(1)
      expect(screen.getByRole('heading', { name: expected })).toBeInTheDocument()
    }
  })

  it('keeps failed writes in session, clearly avoids claiming success, and offers retry', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    const user = userEvent.setup()
    renderWardrobe()
    await openAdd(user)
    await chooseBasicTShirt(user)
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(screen.getByRole('heading', { name: 'Black T-shirt' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('only in this session')
    expect(screen.queryByText('Saved on this device.')).not.toBeInTheDocument()
    expect(localStorage.getItem(WARDROBE_STORAGE_KEY)).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument()
    setItem.mockRestore()
  })

  it('does not overwrite unsupported future data or expose mutation controls', () => {
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify({ version: 99, futureRecords: [] }))
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    renderWardrobe()
    expect(screen.getByRole('alert')).toHaveTextContent('newer app version')
    expect(screen.queryByRole('button', { name: /Add item/ })).not.toBeInTheDocument()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('does not rewrite a repaired load merely by opening the screen', () => {
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify({ version: 1, items: [{ ...fiveSlots[0], color: { hex: '111' } }] }))
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    renderWardrobe()
    expect(screen.getByRole('heading', { name: 'Black shirt' })).toBeInTheDocument()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('gives color choices text names, visible selected semantics, labelled fields, and named destructive actions', async () => {
    const user = userEvent.setup()
    renderWardrobe()
    await openAdd(user)
    const black = screen.getByRole('button', { name: 'Black #111111' })
    expect(black).toHaveAttribute('aria-pressed', 'false')
    await user.click(black)
    expect(black).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByText('More details'))
    expect(screen.getByRole('textbox', { name: 'Custom name (optional)' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Formality' })).toBeInTheDocument()
  })
})
