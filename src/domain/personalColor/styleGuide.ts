import { getPalette } from './palettes'
import { subtypeOrder } from './seasons'
import type { PaletteColor, Subtype } from './types'
import type { PresentationPreference } from '../../services/presentationPreference'

// Presentation-only style guidance: which practical clothing categories to show, and which
// of the subtype's OWN canonical palette colors to suggest for each one. This is inspiration
// copy layered on top of the deterministic palette -- it never invents a color (every
// reference below is resolved straight from palettes.ts) and never feeds back into scoring.
// scoring.ts / diagnostics.ts / scoringAudit.ts must never import this module, and this
// module must never import them.

export type ColorReference = PaletteColor

export type StyleCategoryKey =
  | 'tops' | 'bottoms' | 'outerwear' | 'dresses' | 'jacketsCardigans' | 'shoes' | 'bags' | 'accessories'

export type GarmentNounKey =
  | 'shirt' | 'polo' | 'trousers' | 'chinos' | 'loafers' | 'sneakers' | 'jacket'
  | 'top' | 'blouse' | 'skirt' | 'dress' | 'bag' | 'accessory'
  // Photo placement examples (V1.2 Slice 5b) share this vocabulary.
  | 'tshirt' | 'scarf' | 'shoes' | 'belt'

export interface StyleCategory {
  key: StyleCategoryKey
  colors: ColorReference[]
}

export interface OutfitPiece {
  garmentNounKey: GarmentNounKey
  color: ColorReference
}

export interface OutfitCombination {
  id: string
  pieces: OutfitPiece[]
}

export interface PresentationStyleGuide {
  categories: StyleCategory[]
  combinations: OutfitCombination[]
}

export type SubtypeStyleGuide = Record<PresentationPreference, PresentationStyleGuide>

function buildGuide(subtype: Subtype): SubtypeStyleGuide {
  const palette = getPalette(subtype)
  const best = palette.best
  const neutrals = palette.neutrals
  const accents = palette.accents

  const tops: ColorReference[] = [best[0], best[2], accents[0]]
  const bottoms: ColorReference[] = [neutrals[1], neutrals[2], neutrals[4]]
  const shoes: ColorReference[] = [neutrals[3], neutrals[2], neutrals[0]]
  const bags: ColorReference[] = [neutrals[3], neutrals[1], accents[3]]
  const accessories: ColorReference[] = [accents[0], accents[2], accents[4]]
  const outerwear: ColorReference[] = [neutrals[3], best[4], neutrals[4]]
  const jacketsCardigans: ColorReference[] = [neutrals[3], best[4], accents[2]]
  const dresses: ColorReference[] = [best[1], best[5], accents[1]]

  const men: PresentationStyleGuide = {
    categories: [
      { key: 'tops', colors: tops },
      { key: 'bottoms', colors: bottoms },
      { key: 'outerwear', colors: outerwear },
      { key: 'shoes', colors: shoes },
      { key: 'bags', colors: bags },
      { key: 'accessories', colors: accessories },
    ],
    combinations: [
      { id: `${subtype}-men-1`, pieces: [{ garmentNounKey: 'shirt', color: tops[0] }, { garmentNounKey: 'trousers', color: bottoms[0] }, { garmentNounKey: 'loafers', color: shoes[0] }] },
      { id: `${subtype}-men-2`, pieces: [{ garmentNounKey: 'polo', color: tops[1] }, { garmentNounKey: 'chinos', color: bottoms[1] }, { garmentNounKey: 'sneakers', color: shoes[1] }] },
      { id: `${subtype}-men-3`, pieces: [{ garmentNounKey: 'jacket', color: outerwear[1] }, { garmentNounKey: 'trousers', color: bottoms[2] }, { garmentNounKey: 'loafers', color: shoes[2] }] },
    ],
  }

  const women: PresentationStyleGuide = {
    categories: [
      { key: 'tops', colors: tops },
      { key: 'bottoms', colors: bottoms },
      { key: 'dresses', colors: dresses },
      { key: 'jacketsCardigans', colors: jacketsCardigans },
      { key: 'shoes', colors: shoes },
      { key: 'bags', colors: bags },
      { key: 'accessories', colors: accessories },
    ],
    combinations: [
      { id: `${subtype}-women-1`, pieces: [{ garmentNounKey: 'top', color: tops[0] }, { garmentNounKey: 'skirt', color: bottoms[0] }, { garmentNounKey: 'bag', color: bags[0] }] },
      { id: `${subtype}-women-2`, pieces: [{ garmentNounKey: 'blouse', color: tops[1] }, { garmentNounKey: 'trousers', color: bottoms[1] }, { garmentNounKey: 'bag', color: bags[1] }] },
      { id: `${subtype}-women-3`, pieces: [{ garmentNounKey: 'dress', color: dresses[0] }, { garmentNounKey: 'bag', color: bags[2] }, { garmentNounKey: 'accessory', color: accessories[0] }] },
    ],
  }

  return { men, women }
}

export const styleGuides: Record<Subtype, SubtypeStyleGuide> = Object.fromEntries(
  subtypeOrder.map((subtype) => [subtype, buildGuide(subtype)]),
) as Record<Subtype, SubtypeStyleGuide>

export function getStyleGuide(subtype: Subtype, preference: PresentationPreference): PresentationStyleGuide {
  return styleGuides[subtype][preference]
}
