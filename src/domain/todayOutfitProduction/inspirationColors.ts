import { describeColor } from '../colorNames/colorNames.js'
import { getCanonicalWardrobeColor } from '../wardrobe/wardrobe.js'
import { getBasicWardrobeColor } from '../wardrobe/colors.js'
import type { PaletteColor } from '../personalColor/types.js'
import type { InspirationColor, InspirationOutfitRequest } from './inspirationContract.js'

export type ResolvedInspirationColor =
  | { readonly kind: 'canonical'; readonly hex: string; readonly canonical: PaletteColor }
  | { readonly kind: 'generic'; readonly hex: string; readonly name: NonNullable<ReturnType<typeof describeColor>> }

export function resolveInspirationColor(color: InspirationColor, request: InspirationOutfitRequest): ResolvedInspirationColor | null {
  if (color.kind === 'canonical') {
    if (!request.canonicalColorIds.includes(color.canonicalColorId)) return null
    const canonical = getCanonicalWardrobeColor(color.canonicalColorId)
    return canonical ? { kind: 'canonical', hex: canonical.hex, canonical } : null
  }
  if (!request.genericColorIds.includes(color.colorId)) return null
  const generic = getBasicWardrobeColor(color.colorId)
  const name = describeColor(generic.hex)
  return name ? { kind: 'generic', hex: generic.hex, name } : null
}
