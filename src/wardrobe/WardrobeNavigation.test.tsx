import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { LANGUAGE_STORAGE_KEY } from '../i18n'

describe('My Wardrobe secondary navigation', () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en') })

  it('opens from Today, returns to Today, and never adds a sixth bottom-navigation item', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: "See today's lucky color" }))
    expect(screen.getByRole('heading', { name: 'What should I wear today?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Manage My Wardrobe/ }))
    expect(screen.getByRole('heading', { name: 'My Wardrobe' })).toBeInTheDocument()
    expect(document.querySelector('.bottom-nav')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Back to Today/ }))
    expect(screen.getByRole('heading', { name: 'What should I wear today?' })).toBeInTheDocument()
    expect(document.querySelectorAll('.bottom-nav button')).toHaveLength(0)
  })

  it('keeps the production bottom-nav definition at exactly five destinations', () => {
    const items = document.createElement('div')
    render(<App />, { container: items })
    expect(items.textContent).not.toContain('My Wardrobe')
  })
})
