import type { PaletteColor } from '../domain/personalColor/types'
import type { PlacementGuide } from '../domain/photoColor/placement'
import type { Suitability } from '../domain/photoColor/suitability'
import type { PositivePaletteGroup } from '../domain/photoColor/types'

// V1.2 Slice 5d: the one Color Checker result. Manual and Photo are two ways of supplying a colour;
// each has an adapter (manualResult.ts, photoChecker/photoResult.ts) that turns its OWN engine
// output into this shape. Nothing here is calculated: the adapters only relabel what their engine
// already decided, and the card only renders it. Source-specific parts are optional slots.
export interface ColorResultView {
  hex: string
  // "Selected color" / "Color at this spot".
  sampleLabel: string
  suitability: Suitability
  // The engine's own label, shown small under the verdict. `key` only feeds a CSS class.
  category: { key: string; label: string }
  // One short, already translated sentence from the engine's own reason.
  why: string
  // The palette colour to compare with, and what it is: 'similar' (photo: the nearest palette colour
  // of any group) or 'nearestBest' (manual: the engine only reports the nearest Best colours).
  // `group` is shown only for a positive verdict.
  reference: { kind: 'similar' | 'nearestBest'; color: PaletteColor; group: PositivePaletteGroup | null }
  // Photo only: "also close to" a Harder colour.
  note: { color: PaletteColor; text: string } | null
  placement: PlacementGuide
  // Exactly the engine's pairWith, in order.
  pairWith: PaletteColor[]
  // Supporting lines. Photo: direction and descriptors. Manual: none.
  details: string[]
  // Photo only: sampling warnings and the "based on this photo" caveat.
  warnings: string[]
  // Optional source-specific informational note (Photo: the lighting note for a light, near-neutral
  // colour). Supporting guidance only: never a verdict or a warning. Manual: none.
  info: string | null
  caveat: string | null
}
