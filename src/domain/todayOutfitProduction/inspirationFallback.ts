import { luckyFamiliesForHex } from '../luckyColor/adaptation.js'
import type { LuckyColorFamily } from '../luckyColor/types.js'
import { getCanonicalWardrobeColor } from '../wardrobe/wardrobe.js'
import type { BasicWardrobeColorId } from '../wardrobe/colors.js'
import type { GarmentType } from '../wardrobe/taxonomy.js'
import { getWardrobeSlot } from '../wardrobe/taxonomy.js'
import type { InspirationColor, InspirationOutfit, InspirationOutfitRecommendation, InspirationOutfitRequest, InspirationPiece } from './inspirationContract.js'
import { validateInspirationOutfitRecommendation, validateInspirationOutfitRequest } from './inspirationContract.js'
import { createInspirationOutfitSignature, isOutfitSignatureExcluded } from './signatures.js'

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

function genericCandidates(request: InspirationOutfitRequest, preferred: BasicWardrobeColorId): readonly BasicWardrobeColorId[] {
  const rest = request.genericColorIds.filter((id) => id !== preferred)
  return request.genericColorIds.includes(preferred) ? [preferred, ...rest] : [...request.genericColorIds]
}

function generic(request: InspirationOutfitRequest, preferred: BasicWardrobeColorId, offset = 0): InspirationColor {
  const candidates = genericCandidates(request, preferred)
  return { kind: 'generic', colorId: candidates[offset % candidates.length] }
}

function canonicalNearFace(request: InspirationOutfitRequest, offset = 0): InspirationColor | null {
  const id = request.canonicalColorIds[offset % request.canonicalColorIds.length]
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
function buildVariant(request: InspirationOutfitRequest, template: Template, offset: number): InspirationOutfit {
  const nearFace = canonicalNearFace(request, offset) ?? generic(request, genericDefaults.nearFace, offset)
  const lucky = offset === 0 ? luckyColor(request) : null
  const bottom = lucky ?? generic(request, genericDefaults.bottom, offset + 1)
  const shoes = template.kind === 'one-piece'
    ? lucky ?? generic(request, genericDefaults.shoes, offset + 2)
    : generic(request, genericDefaults.shoes, offset + 2)
  const outerwearColor = generic(request, genericDefaults.outerwear, offset + 3)
  if (template.kind === 'separates') {
    return {
      kind: 'separates',
      top: { garmentType: template.top, color: nearFace },
      bottom: { garmentType: template.bottom, color: bottom },
      outerwear: template.outerwear ? { garmentType: template.outerwear, color: outerwearColor } : null,
      shoes: { garmentType: template.shoes, color: shoes },
    }
  }
  return {
    kind: 'one-piece',
    onePiece: { garmentType: template.onePiece, color: nearFace },
    outerwear: template.outerwear ? { garmentType: template.outerwear, color: outerwearColor } : null,
    shoes: { garmentType: template.shoes, color: shoes },
  }
}

export function recommendInspirationOutfitFallback(input: InspirationOutfitRequest): InspirationOutfitRecommendation | null {
  if (!validateInspirationOutfitRequest(input).ok) return null
  const template = templates[input.occasion]
  // BASIC_WARDROBE_COLORS currently offers twelve identities; the cap keeps the
  // fallback bounded while covering every ordinary alternate in V1.
  const maxVariants = Math.min(12, Math.max(input.genericColorIds.length, input.canonicalColorIds.length, 1))
  for (let offset = 0; offset < maxVariants; offset += 1) {
    const recommendation = { outfit: buildVariant(input, template, offset) }
    if (validateInspirationOutfitRecommendation(recommendation, input).ok && !isOutfitSignatureExcluded(createInspirationOutfitSignature(recommendation), input.exclusions)) return recommendation
  }
  return null
}
