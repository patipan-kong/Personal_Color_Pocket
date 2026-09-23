import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { LANGUAGE_STORAGE_KEY } from '../../i18n'
import { savePresentationPreference } from '../../services/presentationPreference'
import { saveState } from '../../services/persistence'
import { quizQuestions } from './quiz'
import { getExpectedQuizAssetPaths, getQuizVisualAsset, installedQuizVisualAssets, quizVisuals } from './quizVisuals'
import assetChecklist from '../../../docs/ASSET_GENERATION_CHECKLIST.md?raw'
import styles from '../../styles.css?raw'

const q03Files = import.meta.glob('../../../public/img/quiz/q03-white/*/*.webp')
const q02Files = import.meta.glob('../../../public/img/quiz/q02-metal/*/*.webp')
const q04Files = import.meta.glob('../../../public/img/quiz/q04-warm-colors/*/*.webp')
const q05Files = import.meta.glob('../../../public/img/quiz/q05-cool-colors/*/*.webp')
const q06Files = import.meta.glob('../../../public/img/quiz/q06-hair/*/*.webp')
const q07Files = import.meta.glob('../../../public/img/quiz/q07-eyes/*/*.webp')
const q08Files = import.meta.glob('../../../public/img/quiz/q08-contrast/*/*.webp')
const q01Files = import.meta.glob('../../../public/img/quiz/q01-undertone/*/*.webp')
const q09Files = import.meta.glob('../../../public/img/quiz/q09-intensity/*/*.webp')
const q10Files = import.meta.glob('../../../public/img/quiz/q10-clarity/*/*.webp')
const q11Files = import.meta.glob('../../../public/img/quiz/q11-depth/*/*.webp')

describe('V1.1 visual quiz manifest', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('covers all 11 questions exactly once and preserves answer IDs and order', () => {
    const visuals = Object.values(quizVisuals)
    expect(visuals).toHaveLength(11)
    expect(new Set(visuals.map((visual) => visual.questionId)).size).toBe(11)
    expect(visuals.map((visual) => visual.questionNumber).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    quizQuestions.forEach((question) => {
      const visual = quizVisuals[question.visualId!]
      expect(visual.questionId).toBe(question.id)
      expect(visual.variants.map((variant) => variant.answerId)).toEqual(question.options.map((option) => option.id))
      visual.variants.forEach((variant) => expect(variant.altTextKey).toBe(`${question.id}.${variant.answerId}`))
    })
  })

  it('maps every portrait/reference question to distinct Men/Women paths', () => {
    Object.values(quizVisuals).forEach((visual) => visual.variants.forEach((variant) => {
      const paths = variant.expectedAssets
      expect(visual.presentationMode).toBe('presentation-specific')
      expect(paths.men).toContain(`/men/${variant.answerId}.webp`)
      expect(paths.women).toContain(`/women/${variant.answerId}.webp`)
      expect(paths.men).not.toBe(paths.women)
      expect(paths.shared).toBeUndefined()
    }))
    expect(getExpectedQuizAssetPaths()).toHaveLength(66)
    expect(new Set(getExpectedQuizAssetPaths()).size).toBe(66)
  })

  it('installs exactly the sixty-six reviewed Q01–Q11 assets and no other expected asset', () => {
    const installed = Object.keys(installedQuizVisualAssets)
    expect(installed).toHaveLength(66)
    expect(Object.keys(q01Files)).toHaveLength(6)
    expect(Object.keys(q02Files)).toHaveLength(6)
    expect(Object.keys(q03Files)).toHaveLength(6)
    expect(Object.keys(q04Files)).toHaveLength(6)
    expect(Object.keys(q05Files)).toHaveLength(6)
    expect(Object.keys(q06Files)).toHaveLength(6)
    expect(Object.keys(q07Files)).toHaveLength(6)
    expect(Object.keys(q08Files)).toHaveLength(6)
    expect(Object.keys(q09Files)).toHaveLength(6)
    expect(Object.keys(q10Files)).toHaveLength(6)
    expect(Object.keys(q11Files)).toHaveLength(6)
    expect(installed.sort()).toEqual([
      '/img/quiz/q01-undertone/men/golden.webp',
      '/img/quiz/q01-undertone/men/neutral.webp',
      '/img/quiz/q01-undertone/men/rosy.webp',
      '/img/quiz/q01-undertone/women/golden.webp',
      '/img/quiz/q01-undertone/women/neutral.webp',
      '/img/quiz/q01-undertone/women/rosy.webp',
      '/img/quiz/q02-metal/men/both.webp',
      '/img/quiz/q02-metal/men/gold.webp',
      '/img/quiz/q02-metal/men/silver.webp',
      '/img/quiz/q02-metal/women/both.webp',
      '/img/quiz/q02-metal/women/gold.webp',
      '/img/quiz/q02-metal/women/silver.webp',
      '/img/quiz/q03-white/men/ivory.webp',
      '/img/quiz/q03-white/men/optic.webp',
      '/img/quiz/q03-white/men/soft-white.webp',
      '/img/quiz/q03-white/women/ivory.webp',
      '/img/quiz/q03-white/women/optic.webp',
      '/img/quiz/q03-white/women/soft-white.webp',
      '/img/quiz/q04-warm-colors/men/glow.webp',
      '/img/quiz/q04-warm-colors/men/heavy.webp',
      '/img/quiz/q04-warm-colors/men/mixed.webp',
      '/img/quiz/q04-warm-colors/women/glow.webp',
      '/img/quiz/q04-warm-colors/women/heavy.webp',
      '/img/quiz/q04-warm-colors/women/mixed.webp',
      '/img/quiz/q05-cool-colors/men/clear.webp',
      '/img/quiz/q05-cool-colors/men/drain.webp',
      '/img/quiz/q05-cool-colors/men/soft-best.webp',
      '/img/quiz/q05-cool-colors/women/clear.webp',
      '/img/quiz/q05-cool-colors/women/drain.webp',
      '/img/quiz/q05-cool-colors/women/soft-best.webp',
      '/img/quiz/q06-hair/men/deep.webp',
      '/img/quiz/q06-hair/men/light.webp',
      '/img/quiz/q06-hair/men/medium.webp',
      '/img/quiz/q06-hair/women/deep.webp',
      '/img/quiz/q06-hair/women/light.webp',
      '/img/quiz/q06-hair/women/medium.webp',
      '/img/quiz/q07-eyes/men/deep-clear.webp',
      '/img/quiz/q07-eyes/men/light-clear.webp',
      '/img/quiz/q07-eyes/men/soft-mixed.webp',
      '/img/quiz/q07-eyes/women/deep-clear.webp',
      '/img/quiz/q07-eyes/women/light-clear.webp',
      '/img/quiz/q07-eyes/women/soft-mixed.webp',
      '/img/quiz/q08-contrast/men/high.webp',
      '/img/quiz/q08-contrast/men/low.webp',
      '/img/quiz/q08-contrast/men/medium.webp',
      '/img/quiz/q08-contrast/women/high.webp',
      '/img/quiz/q08-contrast/women/low.webp',
      '/img/quiz/q08-contrast/women/medium.webp',
      '/img/quiz/q09-intensity/men/balanced.webp',
      '/img/quiz/q09-intensity/men/bright.webp',
      '/img/quiz/q09-intensity/men/muted.webp',
      '/img/quiz/q09-intensity/women/balanced.webp',
      '/img/quiz/q09-intensity/women/bright.webp',
      '/img/quiz/q09-intensity/women/muted.webp',
      '/img/quiz/q10-clarity/men/balanced.webp',
      '/img/quiz/q10-clarity/men/clear.webp',
      '/img/quiz/q10-clarity/men/muted.webp',
      '/img/quiz/q10-clarity/women/balanced.webp',
      '/img/quiz/q10-clarity/women/clear.webp',
      '/img/quiz/q10-clarity/women/muted.webp',
      '/img/quiz/q11-depth/men/deep.webp',
      '/img/quiz/q11-depth/men/light.webp',
      '/img/quiz/q11-depth/men/medium.webp',
      '/img/quiz/q11-depth/women/deep.webp',
      '/img/quiz/q11-depth/women/light.webp',
      '/img/quiz/q11-depth/women/medium.webp',
    ])
    expect(getExpectedQuizAssetPaths().some((path) => path.includes('/q06-hair/shared/') || path.includes('/q07-eyes/shared/') || path.includes('/q08-contrast/shared/'))).toBe(false)
  })

  it('keeps the shared visual comparison as a shrink-to-fit three-column grid without a mobile carousel', () => {
    expect(styles).toMatch(/\.quiz-visual-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)/)
    expect(styles).not.toMatch(/\.quiz-visual[^}]*overflow-x\s*:/)
    expect(styles).not.toContain('minmax(154px')
    expect(styles).not.toContain('scroll-snap-type: x proximity')
    expect(styles).not.toMatch(/body\s*\{[^}]*min-width\s*:/)
  })

  it('resolves the exact answer/path mapping for all Q02 Men and Women variants', () => {
    const q02 = quizVisuals['metal-comparison']
    expect(q02.variants.map((variant) => [
      variant.answerId,
      getQuizVisualAsset(variant, 'men'),
      getQuizVisualAsset(variant, 'women'),
    ])).toEqual([
      ['gold', '/img/quiz/q02-metal/men/gold.webp', '/img/quiz/q02-metal/women/gold.webp'],
      ['silver', '/img/quiz/q02-metal/men/silver.webp', '/img/quiz/q02-metal/women/silver.webp'],
      ['both', '/img/quiz/q02-metal/men/both.webp', '/img/quiz/q02-metal/women/both.webp'],
    ])
  })

  it('resolves the exact answer/path mapping for all Q03 Men and Women variants', () => {
    const q03 = quizVisuals['white-comparison']
    expect(q03.variants.map((variant) => [
      variant.answerId,
      getQuizVisualAsset(variant, 'men'),
      getQuizVisualAsset(variant, 'women'),
    ])).toEqual([
      ['ivory', '/img/quiz/q03-white/men/ivory.webp', '/img/quiz/q03-white/women/ivory.webp'],
      ['optic', '/img/quiz/q03-white/men/optic.webp', '/img/quiz/q03-white/women/optic.webp'],
      ['soft-white', '/img/quiz/q03-white/men/soft-white.webp', '/img/quiz/q03-white/women/soft-white.webp'],
    ])
  })

  it('resolves the exact answer/path mapping for all Q04 Men and Women variants', () => {
    const q04 = quizVisuals['warm-earthy']
    expect(q04.variants.map((variant) => [
      variant.answerId,
      getQuizVisualAsset(variant, 'men'),
      getQuizVisualAsset(variant, 'women'),
    ])).toEqual([
      ['glow', '/img/quiz/q04-warm-colors/men/glow.webp', '/img/quiz/q04-warm-colors/women/glow.webp'],
      ['heavy', '/img/quiz/q04-warm-colors/men/heavy.webp', '/img/quiz/q04-warm-colors/women/heavy.webp'],
      ['mixed', '/img/quiz/q04-warm-colors/men/mixed.webp', '/img/quiz/q04-warm-colors/women/mixed.webp'],
    ])
  })

  it('resolves the exact answer/path mapping for all Q05 Men and Women variants', () => {
    const q05 = quizVisuals['cool-colors']
    expect(q05.variants.map((variant) => [
      variant.answerId,
      getQuizVisualAsset(variant, 'men'),
      getQuizVisualAsset(variant, 'women'),
    ])).toEqual([
      ['clear', '/img/quiz/q05-cool-colors/men/clear.webp', '/img/quiz/q05-cool-colors/women/clear.webp'],
      ['drain', '/img/quiz/q05-cool-colors/men/drain.webp', '/img/quiz/q05-cool-colors/women/drain.webp'],
      ['soft-best', '/img/quiz/q05-cool-colors/men/soft-best.webp', '/img/quiz/q05-cool-colors/women/soft-best.webp'],
    ])
  })

  it('resolves distinct Women/Men paths for Q06–Q08 without changing canonical answer IDs', () => {
    const q06 = quizVisuals['hair-depth']
    expect(q06.variants.map((variant) => [
      variant.answerId,
      getQuizVisualAsset(variant, 'men'),
      getQuizVisualAsset(variant, 'women'),
    ])).toEqual([
      ['light', '/img/quiz/q06-hair/men/light.webp', '/img/quiz/q06-hair/women/light.webp'],
      ['medium', '/img/quiz/q06-hair/men/medium.webp', '/img/quiz/q06-hair/women/medium.webp'],
      ['deep', '/img/quiz/q06-hair/men/deep.webp', '/img/quiz/q06-hair/women/deep.webp'],
    ])
    const q07 = quizVisuals['eye-impression']
    expect(q07.variants.map((variant) => [
      variant.answerId,
      getQuizVisualAsset(variant, 'men'),
      getQuizVisualAsset(variant, 'women'),
    ])).toEqual([
      ['light-clear', '/img/quiz/q07-eyes/men/light-clear.webp', '/img/quiz/q07-eyes/women/light-clear.webp'],
      ['soft-mixed', '/img/quiz/q07-eyes/men/soft-mixed.webp', '/img/quiz/q07-eyes/women/soft-mixed.webp'],
      ['deep-clear', '/img/quiz/q07-eyes/men/deep-clear.webp', '/img/quiz/q07-eyes/women/deep-clear.webp'],
    ])
    const q08 = quizVisuals['contrast-reference']
    expect(q08.variants.map((variant) => [
      variant.answerId,
      getQuizVisualAsset(variant, 'men'),
      getQuizVisualAsset(variant, 'women'),
    ])).toEqual([
      ['low', '/img/quiz/q08-contrast/men/low.webp', '/img/quiz/q08-contrast/women/low.webp'],
      ['medium', '/img/quiz/q08-contrast/men/medium.webp', '/img/quiz/q08-contrast/women/medium.webp'],
      ['high', '/img/quiz/q08-contrast/men/high.webp', '/img/quiz/q08-contrast/women/high.webp'],
    ])
  })

  it('resolves the exact answer/path mapping for all Q11 Men and Women variants', () => {
    const q11 = quizVisuals['value-comparison']
    expect(q11.variants.map((variant) => [
      variant.answerId,
      getQuizVisualAsset(variant, 'men'),
      getQuizVisualAsset(variant, 'women'),
    ])).toEqual([
      ['light', '/img/quiz/q11-depth/men/light.webp', '/img/quiz/q11-depth/women/light.webp'],
      ['medium', '/img/quiz/q11-depth/men/medium.webp', '/img/quiz/q11-depth/women/medium.webp'],
      ['deep', '/img/quiz/q11-depth/men/deep.webp', '/img/quiz/q11-depth/women/deep.webp'],
    ])
  })

  it('resolves the exact answer/path mapping for all Q10 Men and Women variants', () => {
    const q10 = quizVisuals['clarity-comparison']
    expect(q10.variants.map((variant) => [
      variant.answerId,
      getQuizVisualAsset(variant, 'men'),
      getQuizVisualAsset(variant, 'women'),
    ])).toEqual([
      ['muted', '/img/quiz/q10-clarity/men/muted.webp', '/img/quiz/q10-clarity/women/muted.webp'],
      ['balanced', '/img/quiz/q10-clarity/men/balanced.webp', '/img/quiz/q10-clarity/women/balanced.webp'],
      ['clear', '/img/quiz/q10-clarity/men/clear.webp', '/img/quiz/q10-clarity/women/clear.webp'],
    ])
  })

  it('resolves the exact answer/path mapping for all Q09 Men and Women variants', () => {
    const q09 = quizVisuals['chroma-comparison']
    expect(q09.variants.map((variant) => [
      variant.answerId,
      getQuizVisualAsset(variant, 'men'),
      getQuizVisualAsset(variant, 'women'),
    ])).toEqual([
      ['muted', '/img/quiz/q09-intensity/men/muted.webp', '/img/quiz/q09-intensity/women/muted.webp'],
      ['balanced', '/img/quiz/q09-intensity/men/balanced.webp', '/img/quiz/q09-intensity/women/balanced.webp'],
      ['bright', '/img/quiz/q09-intensity/men/bright.webp', '/img/quiz/q09-intensity/women/bright.webp'],
    ])
  })

  it('keeps every exact manifest path in the handoff checklist', () => {
    getExpectedQuizAssetPaths().forEach((path) => expect(assetChecklist).toContain(`\`${path}\``))
  })

  it('uses only valid deterministic fallback colors', () => {
    Object.values(quizVisuals).forEach((visual) => visual.variants.forEach((variant) => {
      expect(variant.fallbackSwatches.length).toBeGreaterThan(0)
      variant.fallbackSwatches.forEach((hex) => expect(hex).toMatch(/^#[0-9A-F]{6}$/))
    }))
  })

  it('renders deterministic Q07 fallback visuals after production images fail', async () => {
    const user = userEvent.setup()
    savePresentationPreference('women')
    saveState({ answers: {}, result: null, quizStep: 6 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    const visual = document.querySelector('.quiz-visual')!
    visual.querySelectorAll('img').forEach((image) => fireEvent.error(image))
    expect(visual.querySelectorAll('img')).toHaveLength(0)
    expect(visual.querySelectorAll('[data-quiz-visual-hex]').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('radio')).toHaveLength(6)
  })

  it('resolves the exact answer/path mapping for all Q01 Men and Women variants', () => {
    const q01 = quizVisuals['undertone-comparison']
    expect(q01.variants.map((variant) => [
      variant.answerId,
      getQuizVisualAsset(variant, 'men'),
      getQuizVisualAsset(variant, 'women'),
    ])).toEqual([
      ['golden', '/img/quiz/q01-undertone/men/golden.webp', '/img/quiz/q01-undertone/women/golden.webp'],
      ['rosy', '/img/quiz/q01-undertone/men/rosy.webp', '/img/quiz/q01-undertone/women/rosy.webp'],
      ['neutral', '/img/quiz/q01-undertone/men/neutral.webp', '/img/quiz/q01-undertone/women/neutral.webp'],
    ])
  })

  it('renders Q02 images and synchronizes visual, text, and keyboard selection', async () => {
    const user = userEvent.setup()
    savePresentationPreference('women')
    saveState({ answers: {}, result: null, quizStep: 1 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    const visual = document.querySelector('.quiz-visual')!
    expect(Array.from(visual.querySelectorAll('img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q02-metal/women/gold.webp',
      '/img/quiz/q02-metal/women/silver.webp',
      '/img/quiz/q02-metal/women/both.webp',
    ])
    expect(visual.querySelectorAll('.quiz-visual-fallback')).toHaveLength(0)

    await user.click(document.querySelector('[data-visual-answer="gold"]') as HTMLButtonElement)
    expect(document.querySelectorAll('.answer-option')[0]).toHaveAttribute('aria-checked', 'true')
    await user.click(document.querySelectorAll('.answer-option')[1] as HTMLButtonElement)
    const visualSilver = document.querySelector('[data-visual-answer="silver"]') as HTMLButtonElement
    expect(visualSilver).toHaveAttribute('aria-checked', 'true')
    visualSilver.focus()
    await user.keyboard('{ArrowRight}')
    expect(document.querySelector('[data-visual-answer="both"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.answer-option')[2]).toHaveAttribute('aria-checked', 'true')
  })

  it('switches Q02 Women/Men images while preserving the selected answer and language changes', async () => {
    const user = userEvent.setup()
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    savePresentationPreference('women')
    saveState({ answers: { metal: 'both' }, result: null, quizStep: 1 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /continue my quiz/i }))
    expect(document.querySelector('[data-visual-answer="both"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelector('.quiz-visual img')?.getAttribute('src')).toContain('/women/')

    await user.click(screen.getByRole('button', { name: 'Men' }))
    expect(document.querySelector('[data-visual-answer="both"]')).toHaveAttribute('aria-checked', 'true')
    expect(Array.from(document.querySelectorAll('.quiz-visual img')).every((img) => img.getAttribute('src')?.includes('/men/'))).toBe(true)

    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(document.querySelector('[data-visual-answer="both"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.quiz-visual img')).toHaveLength(3)
  })

  it('renders Q03 images instead of fallbacks and keeps visual/text selection synchronized', async () => {
    const user = userEvent.setup()
    savePresentationPreference('women')
    saveState({ answers: {}, result: null, quizStep: 2 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    const visual = document.querySelector('.quiz-visual')!
    expect(Array.from(visual.querySelectorAll('img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q03-white/women/ivory.webp',
      '/img/quiz/q03-white/women/optic.webp',
      '/img/quiz/q03-white/women/soft-white.webp',
    ])
    expect(visual.querySelectorAll('.quiz-visual-fallback')).toHaveLength(0)

    await user.click(document.querySelector('[data-visual-answer="ivory"]') as HTMLButtonElement)
    expect(document.querySelectorAll('.answer-option')[0]).toHaveAttribute('aria-checked', 'true')
    await user.click(document.querySelectorAll('.answer-option')[1] as HTMLButtonElement)
    expect(document.querySelector('[data-visual-answer="optic"]')).toHaveAttribute('aria-checked', 'true')
  })

  it('renders Q04 images and synchronizes visual, text, and keyboard selection', async () => {
    const user = userEvent.setup()
    savePresentationPreference('women')
    saveState({ answers: {}, result: null, quizStep: 3 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    const visual = document.querySelector('.quiz-visual')!
    expect(Array.from(visual.querySelectorAll('img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q04-warm-colors/women/glow.webp',
      '/img/quiz/q04-warm-colors/women/heavy.webp',
      '/img/quiz/q04-warm-colors/women/mixed.webp',
    ])
    expect(visual.querySelectorAll('.quiz-visual-fallback')).toHaveLength(0)

    await user.click(document.querySelector('[data-visual-answer="glow"]') as HTMLButtonElement)
    expect(document.querySelectorAll('.answer-option')[0]).toHaveAttribute('aria-checked', 'true')
    await user.click(document.querySelectorAll('.answer-option')[1] as HTMLButtonElement)
    const visualHeavy = document.querySelector('[data-visual-answer="heavy"]') as HTMLButtonElement
    expect(visualHeavy).toHaveAttribute('aria-checked', 'true')
    visualHeavy.focus()
    await user.keyboard('{ArrowRight}')
    expect(document.querySelector('[data-visual-answer="mixed"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.answer-option')[2]).toHaveAttribute('aria-checked', 'true')
  })

  it('renders Q01 images and preserves Undertone selection across visual, text, keyboard, gender, and language changes', async () => {
    const user = userEvent.setup()
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    savePresentationPreference('women')
    saveState({ answers: { undertone: 'neutral' }, result: null, quizStep: 0 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /continue my quiz/i }))
    const visual = document.querySelector('.quiz-visual')!
    expect(Array.from(visual.querySelectorAll('img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q01-undertone/women/golden.webp',
      '/img/quiz/q01-undertone/women/rosy.webp',
      '/img/quiz/q01-undertone/women/neutral.webp',
    ])
    expect(visual.querySelectorAll('.quiz-visual-fallback')).toHaveLength(0)
    expect(document.querySelector('[data-visual-answer="neutral"]')).toHaveAttribute('aria-checked', 'true')

    await user.click(document.querySelector('[data-visual-answer="golden"]') as HTMLButtonElement)
    expect(screen.getAllByRole('radio', { name: /golden or peachy/i }).at(-1)).toHaveAttribute('aria-checked', 'true')
    const golden = document.querySelector('[data-visual-answer="golden"]') as HTMLButtonElement
    golden.focus()
    await user.keyboard('{ArrowRight}')
    expect(document.querySelector('[data-visual-answer="rosy"]')).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('button', { name: 'Men' }))
    expect(document.querySelector('[data-visual-answer="rosy"]')).toHaveAttribute('aria-checked', 'true')
    expect(Array.from(document.querySelectorAll('.quiz-visual img')).every((img) => img.getAttribute('src')?.includes('/men/'))).toBe(true)
    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(document.querySelector('[data-visual-answer="rosy"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.quiz-visual img')).toHaveLength(3)
  })

  it('falls back to deterministic Q01 swatches when a production image fails', async () => {
    const user = userEvent.setup()
    savePresentationPreference('women')
    saveState({ answers: {}, result: null, quizStep: 0 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    const failedImage = document.querySelector('[data-visual-answer="golden"] img') as HTMLImageElement
    fireEvent.error(failedImage)
    expect(document.querySelector('[data-visual-answer="golden"] img')).not.toBeInTheDocument()
    expect(document.querySelector('[data-visual-answer="golden"] [data-quiz-visual-hex]')).toBeInTheDocument()
    expect(document.querySelectorAll('.quiz-visual img')).toHaveLength(2)
  })

  it('switches Q04 Women/Men images while preserving the selected answer and language changes', async () => {
    const user = userEvent.setup()
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    savePresentationPreference('women')
    saveState({ answers: { earth: 'mixed' }, result: null, quizStep: 3 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /continue my quiz/i }))
    expect(document.querySelector('[data-visual-answer="mixed"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelector('.quiz-visual img')?.getAttribute('src')).toContain('/women/')

    await user.click(screen.getByRole('button', { name: 'Men' }))
    expect(document.querySelector('[data-visual-answer="mixed"]')).toHaveAttribute('aria-checked', 'true')
    expect(Array.from(document.querySelectorAll('.quiz-visual img')).every((img) => img.getAttribute('src')?.includes('/men/'))).toBe(true)

    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(document.querySelector('[data-visual-answer="mixed"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.quiz-visual img')).toHaveLength(3)
  })

  it('switches Q03 Women/Men images while preserving the selected answer and language changes', async () => {
    const user = userEvent.setup()
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    savePresentationPreference('women')
    saveState({ answers: { white: 'soft-white' }, result: null, quizStep: 2 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /continue my quiz/i }))
    expect(document.querySelector('[data-visual-answer="soft-white"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelector('.quiz-visual img')?.getAttribute('src')).toContain('/women/')

    await user.click(screen.getByRole('button', { name: 'Men' }))
    expect(document.querySelector('[data-visual-answer="soft-white"]')).toHaveAttribute('aria-checked', 'true')
    expect(Array.from(document.querySelectorAll('.quiz-visual img')).every((img) => img.getAttribute('src')?.includes('/men/'))).toBe(true)

    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(document.querySelector('[data-visual-answer="soft-white"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.quiz-visual img')).toHaveLength(3)
  })

  it('renders Q05 images and preserves Cool Colors selection across visual, text, keyboard, gender, and language changes', async () => {
    const user = userEvent.setup()
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    savePresentationPreference('women')
    saveState({ answers: { 'cool-color': 'soft-best' }, result: null, quizStep: 4 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /continue my quiz/i }))
    const visual = document.querySelector('.quiz-visual')!
    expect(Array.from(visual.querySelectorAll('img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q05-cool-colors/women/clear.webp',
      '/img/quiz/q05-cool-colors/women/drain.webp',
      '/img/quiz/q05-cool-colors/women/soft-best.webp',
    ])
    expect(visual.querySelectorAll('.quiz-visual-fallback')).toHaveLength(0)
    expect(document.querySelector('[data-visual-answer="soft-best"]')).toHaveAttribute('aria-checked', 'true')
    const drain = document.querySelector('[data-visual-answer="drain"]') as HTMLButtonElement
    drain.focus()
    await user.keyboard('{ArrowRight}')
    expect(document.querySelector('[data-visual-answer="soft-best"]')).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('button', { name: 'Men' }))
    expect(document.querySelector('[data-visual-answer="soft-best"]')).toHaveAttribute('aria-checked', 'true')
    expect(Array.from(document.querySelectorAll('.quiz-visual img')).every((img) => img.getAttribute('src')?.includes('/men/'))).toBe(true)
    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(document.querySelector('[data-visual-answer="soft-best"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.quiz-visual img')).toHaveLength(3)
  })

  it('renders Q06 Women/Men images and synchronizes visual, text, keyboard, gender, and language state', async () => {
    const user = userEvent.setup()
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    savePresentationPreference('women')
    saveState({ answers: { hair: 'medium' }, result: null, quizStep: 5 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /continue my quiz/i }))
    const visual = document.querySelector('.quiz-visual')!
    expect(Array.from(visual.querySelectorAll('img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q06-hair/women/light.webp',
      '/img/quiz/q06-hair/women/medium.webp',
      '/img/quiz/q06-hair/women/deep.webp',
    ])
    expect(visual.querySelectorAll('.quiz-visual-fallback')).toHaveLength(0)
    expect(document.querySelector('[data-visual-answer="medium"]')).toHaveAttribute('aria-checked', 'true')
    expect(visual.querySelector('img')?.getAttribute('alt')).toMatch(/controlled visual example/i)

    const light = document.querySelector('[data-visual-answer="light"]') as HTMLButtonElement
    light.focus()
    await user.keyboard('{Enter}')
    expect(document.querySelector('[data-visual-answer="light"]')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{ArrowRight}')
    expect(document.querySelector('[data-visual-answer="medium"]')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{Enter}')
    expect(document.querySelectorAll('.answer-option')[1]).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('button', { name: 'Men' }))
    expect(document.querySelector('[data-visual-answer="medium"]')).toHaveAttribute('aria-checked', 'true')
    expect(Array.from(document.querySelectorAll('.quiz-visual img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q06-hair/men/light.webp',
      '/img/quiz/q06-hair/men/medium.webp',
      '/img/quiz/q06-hair/men/deep.webp',
    ])
    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(document.querySelector('[data-visual-answer="medium"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.quiz-visual img')).toHaveLength(3)
    expect(document.querySelector('.quiz-visual img')?.getAttribute('alt')).not.toBe('Visual reference: Light')
  })

  it('falls back to deterministic Q06 swatches when a production image fails', async () => {
    const user = userEvent.setup()
    savePresentationPreference('women')
    saveState({ answers: {}, result: null, quizStep: 5 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    const failedImage = document.querySelector('[data-visual-answer="deep"] img') as HTMLImageElement
    fireEvent.error(failedImage)
    expect(document.querySelector('[data-visual-answer="deep"] img')).not.toBeInTheDocument()
    expect(document.querySelector('[data-visual-answer="deep"] [data-quiz-visual-hex]')).toBeInTheDocument()
    expect(document.querySelectorAll('.quiz-visual img')).toHaveLength(2)
  })

  it('renders Q07 Women/Men eye references and keeps answer state independent of presentation', async () => {
    const user = userEvent.setup()
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    savePresentationPreference('women')
    saveState({ answers: { eyes: 'soft-mixed' }, result: null, quizStep: 6 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /continue my quiz/i }))
    expect(Array.from(document.querySelectorAll('.quiz-visual img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q07-eyes/women/light-clear.webp',
      '/img/quiz/q07-eyes/women/soft-mixed.webp',
      '/img/quiz/q07-eyes/women/deep-clear.webp',
    ])
    expect(document.querySelector('[data-visual-answer="soft-mixed"]')).toHaveAttribute('aria-checked', 'true')
    const light = document.querySelector('[data-visual-answer="light-clear"]') as HTMLButtonElement
    light.focus()
    await user.keyboard('{ArrowRight}')
    expect(document.querySelector('[data-visual-answer="soft-mixed"]')).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('button', { name: 'Men' }))
    expect(Array.from(document.querySelectorAll('.quiz-visual img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q07-eyes/men/light-clear.webp',
      '/img/quiz/q07-eyes/men/soft-mixed.webp',
      '/img/quiz/q07-eyes/men/deep-clear.webp',
    ])
    expect(document.querySelector('[data-visual-answer="soft-mixed"]')).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(document.querySelector('[data-visual-answer="soft-mixed"]')).toHaveAttribute('aria-checked', 'true')
  })

  it('renders Q08 Women/Men contrast references and preserves the canonical selection', async () => {
    const user = userEvent.setup()
    savePresentationPreference('women')
    saveState({ answers: { contrast: 'high' }, result: null, quizStep: 7 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /continue my quiz/i }))
    expect(Array.from(document.querySelectorAll('.quiz-visual img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q08-contrast/women/low.webp',
      '/img/quiz/q08-contrast/women/medium.webp',
      '/img/quiz/q08-contrast/women/high.webp',
    ])
    expect(document.querySelector('[data-visual-answer="high"]')).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('button', { name: 'Men' }))
    expect(Array.from(document.querySelectorAll('.quiz-visual img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q08-contrast/men/low.webp',
      '/img/quiz/q08-contrast/men/medium.webp',
      '/img/quiz/q08-contrast/men/high.webp',
    ])
    expect(document.querySelector('[data-visual-answer="high"]')).toHaveAttribute('aria-checked', 'true')
  })

  it('renders Q10 images and synchronizes visual, text, and keyboard selection', async () => {
    const user = userEvent.setup()
    savePresentationPreference('women')
    saveState({ answers: {}, result: null, quizStep: 9 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    const visual = document.querySelector('.quiz-visual')!
    expect(Array.from(visual.querySelectorAll('img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q10-clarity/women/muted.webp',
      '/img/quiz/q10-clarity/women/balanced.webp',
      '/img/quiz/q10-clarity/women/clear.webp',
    ])
    expect(visual.querySelectorAll('.quiz-visual-fallback')).toHaveLength(0)

    await user.click(document.querySelector('[data-visual-answer="muted"]') as HTMLButtonElement)
    expect(document.querySelectorAll('.answer-option')[0]).toHaveAttribute('aria-checked', 'true')
    await user.click(document.querySelectorAll('.answer-option')[1] as HTMLButtonElement)
    const visualBalanced = document.querySelector('[data-visual-answer="balanced"]') as HTMLButtonElement
    expect(visualBalanced).toHaveAttribute('aria-checked', 'true')
    visualBalanced.focus()
    await user.keyboard('{ArrowRight}')
    expect(document.querySelector('[data-visual-answer="clear"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.answer-option')[2]).toHaveAttribute('aria-checked', 'true')
  })

  it('renders Q09 images and synchronizes visual, text, and keyboard selection', async () => {
    const user = userEvent.setup()
    savePresentationPreference('women')
    saveState({ answers: {}, result: null, quizStep: 8 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    const visual = document.querySelector('.quiz-visual')!
    expect(Array.from(visual.querySelectorAll('img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q09-intensity/women/muted.webp',
      '/img/quiz/q09-intensity/women/balanced.webp',
      '/img/quiz/q09-intensity/women/bright.webp',
    ])
    expect(visual.querySelectorAll('.quiz-visual-fallback')).toHaveLength(0)

    await user.click(document.querySelector('[data-visual-answer="muted"]') as HTMLButtonElement)
    expect(document.querySelectorAll('.answer-option')[0]).toHaveAttribute('aria-checked', 'true')
    await user.click(document.querySelectorAll('.answer-option')[1] as HTMLButtonElement)
    const visualBalanced = document.querySelector('[data-visual-answer="balanced"]') as HTMLButtonElement
    expect(visualBalanced).toHaveAttribute('aria-checked', 'true')
    visualBalanced.focus()
    await user.keyboard('{ArrowRight}')
    expect(document.querySelector('[data-visual-answer="bright"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.answer-option')[2]).toHaveAttribute('aria-checked', 'true')
  })

  it('switches Q09 Women/Men images while preserving the selected answer and language changes', async () => {
    const user = userEvent.setup()
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    savePresentationPreference('women')
    saveState({ answers: { intensity: 'bright' }, result: null, quizStep: 8 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /continue my quiz/i }))
    expect(document.querySelector('[data-visual-answer="bright"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelector('.quiz-visual img')?.getAttribute('src')).toContain('/women/')

    await user.click(screen.getByRole('button', { name: 'Men' }))
    expect(document.querySelector('[data-visual-answer="bright"]')).toHaveAttribute('aria-checked', 'true')
    expect(Array.from(document.querySelectorAll('.quiz-visual img')).every((img) => img.getAttribute('src')?.includes('/men/'))).toBe(true)

    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(document.querySelector('[data-visual-answer="bright"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.quiz-visual img')).toHaveLength(3)
  })

  it('switches Q10 Women/Men images while preserving the selected answer and language changes', async () => {
    const user = userEvent.setup()
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    savePresentationPreference('women')
    saveState({ answers: { clarity: 'clear' }, result: null, quizStep: 9 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /continue my quiz/i }))
    expect(document.querySelector('[data-visual-answer="clear"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelector('.quiz-visual img')?.getAttribute('src')).toContain('/women/')

    await user.click(screen.getByRole('button', { name: 'Men' }))
    expect(document.querySelector('[data-visual-answer="clear"]')).toHaveAttribute('aria-checked', 'true')
    expect(Array.from(document.querySelectorAll('.quiz-visual img')).every((img) => img.getAttribute('src')?.includes('/men/'))).toBe(true)

    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(document.querySelector('[data-visual-answer="clear"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.quiz-visual img')).toHaveLength(3)
  })

  it('renders Q11 images and synchronizes visual, text, and keyboard selection', async () => {
    const user = userEvent.setup()
    savePresentationPreference('women')
    saveState({ answers: {}, result: null, quizStep: 10 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    const visual = document.querySelector('.quiz-visual')!
    expect(Array.from(visual.querySelectorAll('img')).map((img) => img.getAttribute('src'))).toEqual([
      '/img/quiz/q11-depth/women/light.webp',
      '/img/quiz/q11-depth/women/medium.webp',
      '/img/quiz/q11-depth/women/deep.webp',
    ])
    expect(visual.querySelectorAll('.quiz-visual-fallback')).toHaveLength(0)

    const visualLight = document.querySelector('[data-visual-answer="light"]') as HTMLButtonElement
    await user.click(visualLight)
    expect(document.querySelectorAll('.answer-option')[0]).toHaveAttribute('aria-checked', 'true')
    await user.click(document.querySelectorAll('.answer-option')[1] as HTMLButtonElement)
    const visualMedium = document.querySelector('[data-visual-answer="medium"]') as HTMLButtonElement
    expect(visualMedium).toHaveAttribute('aria-checked', 'true')
    visualMedium.focus()
    await user.keyboard('{ArrowRight}')
    expect(document.querySelector('[data-visual-answer="deep"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.answer-option')[2]).toHaveAttribute('aria-checked', 'true')
  })

  it('switches Q11 Women/Men images while preserving the selected answer and language changes', async () => {
    const user = userEvent.setup()
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    savePresentationPreference('women')
    saveState({ answers: { depth: 'deep' }, result: null, quizStep: 10 })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /continue my quiz/i }))
    expect(document.querySelector('[data-visual-answer="deep"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelector('.quiz-visual img')?.getAttribute('src')).toContain('/women/')

    await user.click(screen.getByRole('button', { name: 'Men' }))
    expect(document.querySelector('[data-visual-answer="deep"]')).toHaveAttribute('aria-checked', 'true')
    expect(Array.from(document.querySelectorAll('.quiz-visual img')).every((img) => img.getAttribute('src')?.includes('/men/'))).toBe(true)

    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(document.querySelector('[data-visual-answer="deep"]')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelectorAll('.quiz-visual img')).toHaveLength(3)
  })

  it('keeps visual and textual controls synchronized through one answer state', async () => {
    const user = userEvent.setup()
    savePresentationPreference('women')
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    const visualRosy = document.querySelector('[data-visual-answer="rosy"]') as HTMLButtonElement
    await user.click(visualRosy)
    expect(visualRosy).toHaveAttribute('aria-checked', 'true')
    screen.getAllByRole('radio', { name: /rosy or bluish/i }).forEach((item) => expect(item).toHaveAttribute('aria-checked', 'true'))
    await user.click(screen.getAllByRole('radio', { name: /a balanced mix/i }).at(-1)!)
    expect(document.querySelector('[data-visual-answer="neutral"]')).toHaveAttribute('aria-checked', 'true')
    expect(visualRosy).toHaveAttribute('aria-checked', 'false')
  })

  it('keeps selection through language changes and supports arrow-key visual selection', async () => {
    const user = userEvent.setup()
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en')
    savePresentationPreference('men')
    render(<App />)
    await user.click(screen.getByRole('button', { name: /find my colors/i }))
    const first = document.querySelector('[data-visual-answer="golden"]') as HTMLButtonElement
    first.focus()
    await user.keyboard('{ArrowRight}')
    expect(document.querySelector('[data-visual-answer="rosy"]')).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('button', { name: 'ไทย' }))
    expect(document.querySelector('[data-visual-answer="rosy"]')).toHaveAttribute('aria-checked', 'true')
  })
})
