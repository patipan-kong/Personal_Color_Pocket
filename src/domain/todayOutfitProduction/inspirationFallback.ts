import { luckyFamiliesForHex } from '../luckyColor/adaptation.js'
import type { LuckyColorFamily } from '../luckyColor/types.js'
import { getCanonicalWardrobeColor } from '../wardrobe/wardrobe.js'
import type { BasicWardrobeColorId } from '../wardrobe/colors.js'
import type { GarmentType } from '../wardrobe/taxonomy.js'
import type { InspirationColor, InspirationOutfit, InspirationOutfitRecommendation, InspirationOutfitRequest } from './inspirationContract.js'
import { validateInspirationOutfitRecommendation, validateInspirationOutfitRequest } from './inspirationContract.js'

type Template =
  | { kind: 'separates'; top: GarmentType; bottom: GarmentType; outerwear: GarmentType | null; shoes: GarmentType }
  | { kind: 'one-piece'; onePiece: GarmentType; outerwear: GarmentType | null; shoes: GarmentType }

const templates: Record<InspirationOutfitRequest['occasion'], Template> = {
  casual: { kind: 'separates', top: 't-shirt', bottom: 'jeans', outerwear: null, shoes: 'sneakers' },
  work: { kind: 'separates', top: 'shirt', bottom: 'trousers', outerwear: 'blazer', shoes: 'loafers' },
  date: { kind: 'separates', top: 'knit-top', bottom: 'trousers', outerwear: null, shoes: 'loafers' },
  'casual-dinner': { kind: 'separates', top: 'polo', bottom: 'chinos', outerwear: 'jacket', shoes: 'loafers' },
  'smart-casual': { kind: 'separates', top: 'shirt', bottom: 'chinos', outerwear: 'blazer', shoes: 'loafers' },
  formal: { kind: 'one-piece', onePiece: 'jumpsuit', outerwear: 'blazer', shoes: 'formal-shoes' },
  'wedding-guest': { kind: 'one-piece', onePiece: 'jumpsuit', outerwear: null, shoes: 'formal-shoes' },
}

const genericDefaults: Record<'nearFace' | 'bottom' | 'outerwear' | 'shoes', BasicWardrobeColorId> = {
  nearFace: 'beige', bottom: 'navy', outerwear: 'gray', shoes: 'brown',
}
const familyGeneric: Partial<Record<LuckyColorFamily, BasicWardrobeColorId>> = {
  white: 'white', pink: 'pink', red: 'red', green: 'green', blue: 'blue', purple: 'purple', gray: 'gray', black: 'black',
}

function generic(request: InspirationOutfitRequest, preferred: BasicWardrobeColorId): InspirationColor {
  const id = request.genericColorIds.includes(preferred) ? preferred : request.genericColorIds[0]
  return { kind: 'generic', colorId: id }
}

function canonicalNearFace(request: InspirationOutfitRequest): InspirationColor | null {
  const id = request.canonicalColorIds[0]
  return id ? { kind: 'canonical', canonicalColorId: id } : null
}

function luckyColor(request: InspirationOutfitRequest): InspirationColor | null {
  for (const preference of request.luckyPreferences) {
    const genericId = familyGeneric[preference.family]
    if (genericId && request.genericColorIds.includes(genericId)) return { kind: 'generic', colorId: genericId }
    const canonicalId = request.canonicalColorIds.find((id) => {
      const color = getCanonicalWardrobeColor(id)
      return color ? luckyFamiliesForHex(color.hex).includes(preference.family) : false
    })
    if (canonicalId) return { kind: 'canonical', canonicalColorId: canonicalId }
  }
  return null
}

export function recommendInspirationOutfitFallback(input: InspirationOutfitRequest): InspirationOutfitRecommendation | null {
  if (!validateInspirationOutfitRequest(input).ok) return null
  const template = templates[input.occasion]
  const nearFace = canonicalNearFace(input) ?? generic(input, genericDefaults.nearFace)
  const lucky = luckyColor(input)
  const bottom = lucky ?? generic(input, genericDefaults.bottom)
  const shoes = template.kind === 'one-piece' ? lucky ?? generic(input, genericDefaults.shoes) : generic(input, genericDefaults.shoes)
  const outerwearColor = generic(input, genericDefaults.outerwear)
  let outfit: InspirationOutfit
  if (template.kind === 'separates') {
    outfit = {
      kind: 'separates',
      top: { garmentType: template.top, color: nearFace },
      bottom: { garmentType: template.bottom, color: bottom },
      outerwear: template.outerwear ? { garmentType: template.outerwear, color: nearFace } : null,
      shoes: { garmentType: template.shoes, color: shoes },
    }
  } else {
    outfit = {
      kind: 'one-piece',
      onePiece: { garmentType: template.onePiece, color: nearFace },
      outerwear: template.outerwear ? { garmentType: template.outerwear, color: outerwearColor } : null,
      shoes: { garmentType: template.shoes, color: shoes },
    }
  }
  const recommendation = { outfit }
  return validateInspirationOutfitRecommendation(recommendation, input).ok ? recommendation : null
}
