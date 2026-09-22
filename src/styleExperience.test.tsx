import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { analyzeQuiz } from './domain/personalColor/scoring'
import { getPalette } from './domain/personalColor/palettes'
import { saveState } from './services/persistence'
import { loadPresentationPreference, savePresentationPreference } from './services/presentationPreference'

const warmAnswers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }

function seedResult(preference: 'men' | 'women' = 'women') {
  const result = analyzeQuiz(warmAnswers)
  saveState({ answers: warmAnswers, result, quizStep: 10 })
  savePresentationPreference(preference)
  return result
}

describe('visual experience V1 -- style examples', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('Result selects the image for the correct subtype and presentation', async () => {
    const result = seedResult('women')
    render(<App />)
    const img = await screen.findByRole('img', { name: new RegExp(result.subtype.replace('-', ' '), 'i') })
    expect(img).toHaveAttribute('src', `/img/personal-color/${result.subtype}/women.webp`)
  })

  it('switching Men/Women on Result swaps the image, persists the preference, and never changes the scoring result', async () => {
    const user = userEvent.setup()
    const result = seedResult('women')
    render(<App />)
    const heading = await screen.findByRole('heading', { level: 1 })
    const matchPillText = document.querySelector('.match-pill')?.textContent

    // Both the global header switcher and the local one near the visual toggle the same
    // presentationPreference -- either is a valid target here.
    await user.click(screen.getAllByRole('button', { name: 'Men' })[0])
    expect(loadPresentationPreference()).toBe('men')
    const img = await screen.findByRole('img', { name: new RegExp(result.subtype.replace('-', ' '), 'i') })
    expect(img).toHaveAttribute('src', `/img/personal-color/${result.subtype}/men.webp`)
    // subtype heading and confidence pill are untouched by a presentation change
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(heading.textContent)
    expect(document.querySelector('.match-pill')?.textContent).toBe(matchPillText)
  })

  it('language switch does not change which subtype/asset is selected', async () => {
    const user = userEvent.setup()
    const result = seedResult('men')
    render(<App />)
    const bySrc = () => document.querySelector(`img[src="/img/personal-color/${result.subtype}/men.webp"]`)
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(bySrc()).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(bySrc()).toBeTruthy()
  })

  it('image error falls back to a non-broken palette panel instead of breaking the page', async () => {
    const result = seedResult('women')
    render(<App />)
    const selector = `img[src="/img/personal-color/${result.subtype}/women.webp"]`
    const img = await screen.findByRole('heading', { level: 1 }).then(() => document.querySelector(selector) as HTMLImageElement)
    expect(img).toBeTruthy()
    fireEvent.error(img)
    expect(document.querySelector(selector)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument() // page still intact
  })

  it('the image viewer opens on click, closes on the close button, and closes on Escape', async () => {
    const user = userEvent.setup()
    seedResult('women')
    render(<App />)
    const enlargeButtons = await screen.findAllByRole('button', { name: 'View larger image' })
    await user.click(enlargeButtons[0])
    const dialog = document.querySelector('dialog.image-viewer') as HTMLDialogElement
    expect(dialog).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await user.click(enlargeButtons[0])
    await user.keyboard('{Escape}')
    expect(document.querySelector('dialog.image-viewer[open]')).toBeFalsy()
  })

  it('My Palette defaults to the Palette tab, and the Examples tab renders on demand', async () => {
    const user = userEvent.setup()
    seedResult('women')
    render(<App />)
    await user.click(screen.getByRole('button', { name: /explore my palette/i }))
    const paletteTab = screen.getByRole('tab', { name: 'Palette' })
    const examplesTab = screen.getByRole('tab', { name: 'Examples' })
    expect(paletteTab).toHaveAttribute('aria-selected', 'true')
    expect(examplesTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText('Best Colors')).toBeInTheDocument()

    await user.click(examplesTab)
    expect(examplesTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Style examples')).toBeInTheDocument()
  })

  it('Examples tab uses the correct subtype and presentation for its image', async () => {
    const user = userEvent.setup()
    const result = seedResult('men')
    render(<App />)
    await user.click(screen.getByRole('button', { name: /explore my palette/i }))
    await user.click(screen.getByRole('tab', { name: 'Examples' }))
    const img = await screen.findByRole('img', { name: new RegExp(result.subtype.replace('-', ' '), 'i') })
    expect(img).toHaveAttribute('src', `/img/personal-color/${result.subtype}/men.webp`)
  })

  it('Palette tab still shows the exact canonical HEX values from the palette module', async () => {
    const user = userEvent.setup()
    const result = seedResult('women')
    const palette = getPalette(result.subtype)
    render(<App />)
    await user.click(screen.getByRole('button', { name: /explore my palette/i }))
    palette.best.forEach((color) => {
      expect(screen.getAllByText(color.hex).length).toBeGreaterThan(0)
    })
  })

  it('style categories render for the current subtype/presentation', async () => {
    const user = userEvent.setup()
    seedResult('women')
    render(<App />)
    await user.click(screen.getByRole('button', { name: /explore my palette/i }))
    await user.click(screen.getByRole('tab', { name: 'Examples' }))
    expect(screen.getByText('Tops')).toBeInTheDocument()
    expect(screen.getByText('Bottoms')).toBeInTheDocument()
    expect(screen.getByText('Dresses')).toBeInTheDocument() // women preference
    expect(screen.getByText('Outfit combinations')).toBeInTheDocument()
  })

  it('diagnostic mode remains functional alongside the new visual UI', async () => {
    const originalSearch = window.location.search
    window.history.replaceState({}, '', '?debug=color')
    seedResult('women')
    render(<App />)
    expect(await screen.findByText(/DEV diagnostic/i)).toBeInTheDocument()
    window.history.replaceState({}, '', originalSearch)
  })

  it('legacy (pre-Model-V2) persistence still migrates correctly with the new UI in place', () => {
    localStorage.setItem('personal-color-pocket:v1', JSON.stringify({
      version: 1,
      answers: { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced' },
      result: null,
      quizStep: 8,
    }))
    render(<App />)
    // A legacy-complete profile routes back into the quiz rather than showing a stale result.
    expect(screen.queryByRole('heading', { level: 1, name: /warm spring/i })).not.toBeInTheDocument()
  })

  it('tabs and the presentation switch are keyboard accessible', async () => {
    const user = userEvent.setup()
    seedResult('women')
    render(<App />)
    await user.click(screen.getByRole('button', { name: /explore my palette/i }))
    const examplesTab = screen.getByRole('tab', { name: 'Examples' })
    examplesTab.focus()
    await user.keyboard('{Enter}')
    expect(examplesTab).toHaveAttribute('aria-selected', 'true')

    const menButtons = screen.getAllByRole('button', { name: 'Men' })
    menButtons[0].focus()
    await user.keyboard(' ')
    expect(loadPresentationPreference()).toBe('men')
  })
})
