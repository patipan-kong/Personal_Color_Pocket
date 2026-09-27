import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getPalette } from './domain/personalColor/palettes'
import { subtypeOrder } from './domain/personalColor/seasons'
import { colorDisplayName } from './i18n'
import { CanonicalColorLabel } from './CanonicalColorLabel'
import styles from './styles.css?raw'

describe('CanonicalColorLabel', () => {
  afterEach(cleanup)
  const color = getPalette('cool-summer').neutrals.find((item) => item.name === 'Cool Taupe')!
  const allColors = subtypeOrder.flatMap((subtype) => {
    const palette = getPalette(subtype)
    return [...palette.best, ...palette.neutrals, ...palette.accents, ...palette.harder]
  })

  it('renders Thai primary, canonical English secondary, and unchanged HEX', () => {
    const { container } = render(<CanonicalColorLabel color={color} language="th" showHex />)
    expect(container.querySelector('.canonical-color-primary')).toHaveTextContent(colorDisplayName('th', color))
    expect(container.querySelector('.canonical-color-secondary')).toHaveTextContent(color.name)
    expect(container.querySelector('.canonical-color-secondary')).toHaveAttribute('lang', 'en')
    expect(container.querySelector('.canonical-color-hex')).toHaveTextContent(color.hex)
  })

  it('renders the canonical English name once in English locale', () => {
    const { container } = render(<CanonicalColorLabel color={color} language="en" showHex />)
    expect(screen.getAllByText(color.name)).toHaveLength(1)
    expect(container.querySelector('.canonical-color-secondary')).toBeNull()
    expect(container.querySelector('.canonical-color-hex')).toHaveTextContent(color.hex)
  })

  it.each(['Icy Lavender', 'Cool Taupe', 'Blue Sage', 'Jewel Teal', 'Raspberry Rose'])('takes %s English and HEX from the palette entry and allows its label to wrap', (name) => {
    const long = allColors.find((item) => item.name === name)!
    const { container } = render(<CanonicalColorLabel color={long} language="th" showHex />)
    expect(container.querySelector('.canonical-color-primary')?.textContent).toBe(colorDisplayName('th', long))
    expect(container.querySelector('.canonical-color-secondary')?.textContent).toBe(long.name)
    expect(container.querySelector('.canonical-color-hex')?.textContent).toBe(long.hex)
    expect(styles).toMatch(/\.canonical-color-label\s*\{[^}]*overflow-wrap:\s*anywhere/s)
    expect(styles).not.toMatch(/\.canonical-color-(?:primary|secondary)[^{]*\{[^}]*white-space:\s*nowrap/s)
  })
})
