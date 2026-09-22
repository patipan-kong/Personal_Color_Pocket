import { describe, expect, it } from 'vitest'
import { checkColor } from './colorMatch'
import { palettes } from './palettes'
import { subtypeOrder } from './seasons'

describe('color checker', () => {
  it.each(subtypeOrder)('%s returns strong exact best matches and cautious harder matches', (subtype) => {
    const palette = palettes[subtype]
    const best = checkColor(palette.best[0].hex, subtype)!
    const harder = checkColor(palette.harder[0].hex, subtype)!
    expect(best.rating).toBe('Great Match')
    expect(harder.rating).not.toBe('Great Match')
    expect(best.score).toBeGreaterThanOrEqual(0)
    expect(best.score).toBeLessThanOrEqual(1)
    expect(best.pairWith).toHaveLength(3)
    const ownIds = new Set([...palette.best, ...palette.neutrals, ...palette.accents].map((color) => color.id))
    best.pairWith.forEach((color) => expect(ownIds.has(color.id)).toBe(true))
    expect(checkColor(palette.best[0].hex, subtype)).toEqual(best)
  })
})
