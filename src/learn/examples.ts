import type { DimensionKey } from '../domain/personalColor/types'
import type { PaletteColorId } from './types'

// Fixed example colours for Learn, by palette id only (colours resolve from palettes.ts). Tests prove
// every id exists and that each example comes from a type at the matching end of its dimension.

// Endpoint swatches for each dimension scale: `low` is the 0 end (cool, deep, soft, low contrast).
// Each pair keeps the other qualities close, e.g. two blues for chroma, two greens for value.
export const dimensionExamples: Readonly<Record<DimensionKey, { low: readonly PaletteColorId[]; high: readonly PaletteColorId[] }>> = {
  temperature: { low: ['cool-summer-best-1'], high: ['warm-spring-best-1'] },
  value: { low: ['deep-winter-best-3'], high: ['light-summer-best-5'] },
  chroma: { low: ['soft-summer-best-3'], high: ['clear-winter-best-1'] },
  // Contrast is about a range, so each end is a light-middle-dark stack from one type.
  contrast: {
    low: ['soft-summer-neutral-1', 'soft-summer-best-3', 'soft-summer-neutral-4'],
    high: ['clear-winter-neutral-1', 'clear-winter-best-1', 'clear-winter-neutral-5'],
  },
}

// The outfit shown in wear.palette and wear.harder when there is no result: all from one type, so the
// "More Considered" colour really is listed for that type.
export const generalOutfitExample: Readonly<{ nearFace: PaletteColorId; base: PaletteColorId; accent: PaletteColorId; moreConsidered: PaletteColorId }> = {
  nearFace: 'soft-autumn-best-1',
  base: 'soft-autumn-neutral-1',
  accent: 'soft-autumn-accent-1',
  moreConsidered: 'soft-autumn-harder-1',
}

// Slice 4: the garment in the Color Checker lighting illustration. The same for everyone: a very light,
// low-chroma neutral, the kind of colour the checker's lighting note says photos shift most.
export const lightingExample: PaletteColorId = 'light-summer-neutral-1'
