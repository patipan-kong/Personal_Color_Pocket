import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WardrobeRecordV1 } from '../domain/wardrobe/wardrobe'
import { getCopy } from '../i18n'
import { saveDailyLuckyColorGoals } from '../services/dailyLuckyColorGoal'
import { saveWardrobe } from '../services/wardrobePersistence'
import { DailyView } from './DailyView'

const monday = new Date(2026, 8, 21, 10, 0, 0)
const item = (id: string, garmentType: WardrobeRecordV1['garmentType']): WardrobeRecordV1 => ({ id, garmentType, color: { hex: '#112233' }, formality: 'casual' })
const renderToday = (language: 'en' | 'th' = 'en', onWardrobe = vi.fn()) => render(<DailyView copy={getCopy(language)} result={null} onQuiz={vi.fn()} onWardrobe={onWardrobe} clock={() => monday} />)

describe('Today production input shell', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('renders all seven localized occasions as one non-persisted selection, defaulting to casual', async () => {
    const user = userEvent.setup()
    const rendered = renderToday('en')
    const radios = screen.getAllByRole('radio', { name: /casual day|work|date|casual dinner|smart casual|formal event|wedding guest/i })
    expect(radios).toHaveLength(7)
    expect(screen.getByRole('radio', { name: 'Casual day' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Date' }))
    expect(screen.getByRole('radio', { name: 'Date' })).toBeChecked()
    expect(screen.getAllByRole('radio', { checked: true }).filter((radio) => radio.getAttribute('name') === 'today-occasion')).toHaveLength(1)
    expect([...Array(localStorage.length)].map((_, index) => localStorage.key(index))).not.toContain(expect.stringMatching(/occasion/))

    rendered.unmount()
    renderToday('en')
    expect(screen.getByRole('radio', { name: 'Casual day' })).toBeChecked()
  })

  it('renders approved Thai occasion and source labels', () => {
    renderToday('th')
    for (const label of ['วันสบาย ๆ', 'ไปทำงาน', 'ไปเดต', 'ไปกินข้าวแบบสบาย ๆ', 'กึ่งทางการ / สมาร์ตแคชชวล', 'งานทางการ', 'ไปงานแต่ง']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole('radio', { name: /เสื้อผ้าของฉัน ยังไม่มีเสื้อผ้า/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /ไอเดียลุคใหม่ แนะนำลุคได้เต็มที่/ })).toBeChecked()
  })

  it('defaults empty and incomplete wardrobes to inspiration while keeping wardrobe selectable', async () => {
    const user = userEvent.setup()
    saveWardrobe([item('top', 'shirt'), item('shoes', 'loafers')])
    renderToday('en')
    expect(screen.getByRole('radio', { name: /new look ideas/i })).toBeChecked()
    const wardrobe = screen.getByRole('radio', { name: /my wardrobe.*add a few more pieces/i })
    expect(wardrobe).toBeEnabled()
    await user.click(wardrobe)
    expect(wardrobe).toBeChecked()
  })

  it('names shoes as the remaining requirement when the outfit base is complete', () => {
    saveWardrobe([item('top', 'shirt'), item('bottom', 'trousers')])
    renderToday('en')
    expect(screen.getByRole('radio', { name: /my wardrobe.*still needs shoes/i })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /new look ideas/i })).toBeChecked()
  })

  it('defaults a recommendation-ready wardrobe to My Wardrobe and reports its item count', () => {
    saveWardrobe([item('dress', 'dress'), item('shoes', 'heels')])
    renderToday('en')
    expect(screen.getByRole('radio', { name: /my wardrobe.*2 items.*ready for a complete look/i })).toBeChecked()
  })

  it('keeps one clear Wardrobe management action and opens the existing screen callback', async () => {
    const user = userEvent.setup()
    const onWardrobe = vi.fn()
    renderToday('en', onWardrobe)
    const actions = screen.getAllByRole('button', { name: /manage my wardrobe/i })
    expect(actions).toHaveLength(1)
    await user.click(actions[0])
    expect(onWardrobe).toHaveBeenCalledOnce()
  })

  it('captures occasion and source without changing the deterministic Lucky result', async () => {
    const user = userEvent.setup()
    saveDailyLuckyColorGoals(['work'])
    const { container } = renderToday('en')
    const before = container.querySelector('.daily-family-heading h3')?.textContent
    await user.click(screen.getByRole('radio', { name: 'Wedding guest' }))
    await user.click(screen.getByRole('radio', { name: /my wardrobe/i }))
    expect(container.querySelector('.daily-family-heading h3')).toHaveTextContent(before!)
    expect(screen.getByRole('radio', { name: /new look ideas.*without limiting it to clothes you own/i })).not.toBeChecked()
  })
})
