import { describe, expect, it } from 'vitest'
import { getPalette } from './palettes'
import { subtypeOrder } from './seasons'
import type { PaletteColor } from './types'

// V2.0 Slice 0.5C (plan §B): audits whether the repository already has a stable canonical
// identifier for every selectable color, before designing the AI palette-selection contract
// around it. Findings (see docs/V2_AI_COLOR_LAB.md §37): PaletteColor.id (palettes.ts's
// `${subtype}-${category}-${index+1}`) is already unique per subtype -- this test proves it
// computationally against the real seed data, rather than trusting the naming scheme by
// inspection alone -- so no new identifier needs to be invented.

const GROUPS = ['best', 'neutrals', 'accents', 'harder'] as const

function allColorsOf(subtype: (typeof subtypeOrder)[number]): PaletteColor[] {
  const palette = getPalette(subtype)
  return GROUPS.flatMap((group) => palette[group])
}

describe('canonical palette identity', () => {
  it('every colorId is unique within its own subtype (across all groups)', () => {
    for (const subtype of subtypeOrder) {
      const ids = allColorsOf(subtype).map((color) => color.id)
      expect(new Set(ids).size, subtype).toBe(ids.length)
    }
  })

  it('every colorId is unique across the ENTIRE app, not just within one subtype', () => {
    const allIds = subtypeOrder.flatMap((subtype) => allColorsOf(subtype).map((color) => color.id))
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('records whether names or hex values repeat within a subtype (informational: colorId is the identity AI must use, never name/hex)', () => {
    const findings: string[] = []
    for (const subtype of subtypeOrder) {
      const colors = allColorsOf(subtype)
      const names = colors.map((color) => color.name)
      const hexes = colors.map((color) => color.hex)
      if (new Set(names).size !== names.length) findings.push(`${subtype}: duplicate name`)
      if (new Set(hexes).size !== hexes.length) findings.push(`${subtype}: duplicate hex`)
    }
    // Not asserted false -- this is an audit record (plan §B), not a correctness requirement:
    // the AI selection contract identifies candidates by colorId, so a same-subtype name/hex
    // collision (if any) cannot cause an ambiguous AI selection. Findings as of this audit:
    // empty -- every subtype's names and hex values are already unique too (docs §37).
    expect(findings).toEqual([])
  })

  it('the same colorId never appears in two different subtypes (palette seeding is namespaced by subtype)', () => {
    const owners = new Map<string, string>()
    for (const subtype of subtypeOrder) {
      for (const color of allColorsOf(subtype)) {
        expect(owners.has(color.id), `${color.id} already owned by ${owners.get(color.id)}`).toBe(false)
        owners.set(color.id, subtype)
      }
    }
  })
})
