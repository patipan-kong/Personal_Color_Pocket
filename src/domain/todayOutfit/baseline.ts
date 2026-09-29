import { checkColor } from '../personalColor/colorMatch'
import type { MatchRating } from '../personalColor/types'
import type { ItemFormality, OutfitOccasion, OutfitRecommendation, OutfitSelection, TodayOutfitInput, WardrobeCategory, WardrobeItem } from './contract'
import { validateTodayOutfitInput } from './contract'

const targetFormality: Record<OutfitOccasion, ItemFormality> = {
  casual: 'casual', 'casual-dinner': 'smart-casual', work: 'smart-casual', 'smart-casual': 'smart-casual',
  date: 'smart-casual', formal: 'formal', 'wedding-guest': 'formal',
}
const formalityRank: Record<ItemFormality, number> = { casual: 0, 'smart-casual': 1, formal: 2 }
const faceWeight: Record<WardrobeCategory, number> = { top: 3, outerwear: 2.5, bottom: 1, shoes: .5 }
const ratingLabel: Record<MatchRating, string> = { 'Great Match': 'great', 'Good Match': 'good', Wearable: 'wearable', Tricky: 'more difficult' }

function itemScore(item: WardrobeItem, input: TodayOutfitInput): number {
  const color = checkColor(item.color.hex, input.subtype)
  const compatibility = color?.score ?? 0
  const distance = Math.abs(formalityRank[item.formality] - formalityRank[targetFormality[input.occasion]])
  return compatibility * faceWeight[item.category] - distance * 0.8
}

function ordered(items: readonly WardrobeItem[], category: WardrobeCategory, input: TodayOutfitInput) {
  return items.filter((item) => item.category === category).map((item) => ({ item, score: itemScore(item, input) }))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
}

function selectionAt(input: TodayOutfitInput, offset: number): OutfitSelection | null {
  const top = ordered(input.wardrobe, 'top', input)
  const bottom = ordered(input.wardrobe, 'bottom', input)
  const shoes = ordered(input.wardrobe, 'shoes', input)
  if (!top[0] || !bottom[0] || !shoes[0]) return null
  const outerwear = ordered(input.wardrobe, 'outerwear', input)
  const useOuterwear = !['casual', 'casual-dinner'].includes(input.occasion) && outerwear.length > 0
  const variants = [top, bottom, shoes, ...(useOuterwear ? [outerwear] : [])].filter((slot) => slot.length > 1)
  const varied = variants[offset - 1]
  return {
    topId: varied === top ? top[1].item.id : top[0].item.id,
    bottomId: varied === bottom ? bottom[1].item.id : bottom[0].item.id,
    outerwearId: useOuterwear ? (varied === outerwear ? outerwear[1].item.id : outerwear[0].item.id) : null,
    shoesId: varied === shoes ? shoes[1].item.id : shoes[0].item.id,
  }
}

export function recommendDeterministicOutfit(input: TodayOutfitInput): OutfitRecommendation {
  const valid = validateTodayOutfitInput(input)
  if (!valid.ok) return { status: 'failure', reason: `Invalid input: ${valid.issues.join('; ')}` }
  const primary = selectionAt(input, 0)
  if (!primary) return { status: 'failure', reason: 'A top, bottom, and shoes are required for a complete outfit.' }
  const selected = Object.values(primary).filter((id): id is string => typeof id === 'string')
    .map((id) => input.wardrobe.find((item) => item.id === id)!)
  const notes = selected.filter((item) => item.category === 'top' || item.category === 'outerwear').map((item) => {
    const match = checkColor(item.color.hex, input.subtype)
    return `${item.name} is a ${match ? ratingLabel[match.rating] : 'unknown'} near-face color match.`
  }).join(' ')
  return {
    status: 'success', selectedItemIds: primary, alternative: selectionAt(input, 1), confidence: 'medium',
    reasoning: `Selected independently by clothing slot for ${targetFormality[input.occasion]} formality, with stable item-ID tie-breaking. The baseline does not understand silhouette, fabric, cultural dress codes, or aesthetic coordination.`,
    personalColorNotes: notes,
  }
}
