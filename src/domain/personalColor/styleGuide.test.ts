import { describe, expect, it } from 'vitest'
import { getPalette } from './palettes'
import { subtypeOrder } from './seasons'
import { styleGuides } from './styleGuide'
import type { PresentationStyleGuide } from './styleGuide'
import scoringSource from './scoring.ts?raw'
import diagnosticsSource from './diagnostics.ts?raw'
import auditSource from './scoringAudit.ts?raw'
import guideSource from './styleGuide.ts?raw'

function allColors(guide: PresentationStyleGuide) {
  return [...guide.categories.flatMap((c) => c.colors), ...guide.combinations.flatMap((combo) => combo.pieces.map((p) => p.color))]
}

describe('style guidance data', () => {
  it('covers all 12 subtypes', () => {
    expect(Object.keys(styleGuides).sort()).toEqual([...subtypeOrder].sort())
  })

  it('covers both presentation variants (men and women) for every subtype, each with categories and combinations', () => {
    subtypeOrder.forEach((subtype) => {
      ;(['men', 'women'] as const).forEach((preference) => {
        const guide = styleGuides[subtype][preference]
        expect(guide.categories.length).toBeGreaterThanOrEqual(6)
        expect(guide.combinations.length).toBeGreaterThanOrEqual(3)
        guide.combinations.forEach((combo) => expect(combo.pieces.length).toBeGreaterThanOrEqual(2))
      })
    })
  })

  it('men and women guides differ in category composition (dresses only for women, outerwear labeled for men)', () => {
    subtypeOrder.forEach((subtype) => {
      const menKeys = styleGuides[subtype].men.categories.map((c) => c.key)
      const womenKeys = styleGuides[subtype].women.categories.map((c) => c.key)
      expect(menKeys).not.toContain('dresses')
      expect(womenKeys).toContain('dresses')
    })
  })

  it('every referenced color is drawn from that exact subtype\'s own canonical palette (never invented, never borrowed from another subtype)', () => {
    subtypeOrder.forEach((subtype) => {
      const palette = getPalette(subtype)
      const canonicalIds = new Set([...palette.best, ...palette.neutrals, ...palette.accents].map((c) => c.id))
      ;(['men', 'women'] as const).forEach((preference) => {
        allColors(styleGuides[subtype][preference]).forEach((color) => {
          expect(canonicalIds.has(color.id)).toBe(true)
          expect(color.id.startsWith(subtype)).toBe(true)
        })
      })
    })
  })

  it('recommendations are not copied uniformly across subtypes -- each subtype gets its own distinct color set', () => {
    const signature = (subtype: (typeof subtypeOrder)[number]) => allColors(styleGuides[subtype].men).map((c) => c.hex).join(',')
    const signatures = new Set(subtypeOrder.map(signature))
    expect(signatures.size).toBe(subtypeOrder.length)
  })

  it('scoring modules never import style-guide data', () => {
    expect(scoringSource).not.toMatch(/styleGuide/)
    expect(diagnosticsSource).not.toMatch(/styleGuide/)
    expect(auditSource).not.toMatch(/styleGuide/)
  })

  it('styleGuide.ts never imports scoring internals', () => {
    expect(guideSource).not.toMatch(/from '\.\/scoring'/)
    expect(guideSource).not.toMatch(/from '\.\/diagnostics'/)
    expect(guideSource).not.toMatch(/from '\.\/scoringAudit'/)
  })
})
