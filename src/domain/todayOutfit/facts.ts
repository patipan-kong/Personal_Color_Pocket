import { checkColor } from '../personalColor/colorMatch.js'
import type { TodayOutfitInput } from './contract.js'

// App-owned facts sent identically to every model. Models may reason over these fields, but do
// not get an output field with which to redefine subtype, item identity, or compatibility.
export function buildOutfitStylingContext(input: TodayOutfitInput) {
  return {
    subtype: input.subtype,
    occasion: input.occasion,
    ...(input.occasionContext ? { occasionContext: input.occasionContext } : {}),
    wardrobe: input.wardrobe.map((item) => {
      const match = checkColor(item.color.hex, input.subtype)
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        formality: item.formality,
        color: item.color,
        personalColorCompatibility: match ? { rating: match.rating, score: Number(match.score.toFixed(4)) } : null,
        nearFace: item.category === 'top' || item.category === 'outerwear',
      }
    }),
  }
}
