import type { OwnedOutfitRecommendation, OwnedOutfitRequest, OwnedOutfitSelection, OwnedWardrobeFact } from './contract.js'
import { validateOwnedOutfitRequest, validateOwnedOutfitRecommendation } from './contract.js'

const targetFormality: Record<OwnedOutfitRequest['occasion'], OwnedWardrobeFact['formality']> = {
  casual: 'casual', work: 'smart-casual', date: 'smart-casual', 'casual-dinner': 'smart-casual',
  'smart-casual': 'smart-casual', formal: 'formal', 'wedding-guest': 'formal',
}
const rank = { casual: 0, 'smart-casual': 1, formal: 2 } as const
const nearFace = new Set(['top', 'one-piece', 'outerwear'])
const outerwearOccasions = new Set<OwnedOutfitRequest['occasion']>(['work', 'smart-casual', 'formal', 'wedding-guest'])

// Hierarchy is encoded in separate magnitude bands: a one-step formality change (4,000) is
// larger than all Personal Color points (<=300), and Personal Color is larger than Lucky (<=12).
// ID comparison is the final stable tie-break only.
function score(item: OwnedWardrobeFact, input: OwnedOutfitRequest): number {
  const distance = Math.abs(rank[item.formality] - rank[targetFormality[input.occasion]])
  const formality = distance === 0 ? 10_000 : distance === 1 ? 6_000 : 2_000
  const personalColor = (item.personalColorCompatibility?.score ?? 0) * (nearFace.has(item.slot) ? 300 : 90)
  const lucky = item.luckyFamilyMatches.length > 0 ? 12 : 0
  return formality + personalColor + lucky
}

function best(items: readonly OwnedWardrobeFact[], slot: OwnedWardrobeFact['slot'], input: OwnedOutfitRequest): OwnedWardrobeFact | null {
  return items.filter((item) => item.slot === slot).sort((left, right) => score(right, input) - score(left, input) || left.id.localeCompare(right.id))[0] ?? null
}

export function recommendOwnedOutfitFallback(input: OwnedOutfitRequest): OwnedOutfitRecommendation | null {
  const request = validateOwnedOutfitRequest(input)
  if (!request.ok) return null
  const shoes = best(input.wardrobe, 'shoes', input)
  if (!shoes) return null
  const top = best(input.wardrobe, 'top', input)
  const bottom = best(input.wardrobe, 'bottom', input)
  const onePiece = best(input.wardrobe, 'one-piece', input)
  const separatesScore = top && bottom ? (score(top, input) + score(bottom, input) + score(shoes, input)) / 3 : -1
  const onePieceScore = onePiece ? (score(onePiece, input) + score(shoes, input)) / 2 : -1
  if (separatesScore < 0 && onePieceScore < 0) return null
  const outerwear = outerwearOccasions.has(input.occasion) ? best(input.wardrobe, 'outerwear', input) : null
  let selection: OwnedOutfitSelection
  if (onePieceScore > separatesScore || (onePieceScore === separatesScore && onePiece && top && onePiece.id.localeCompare(top.id) < 0)) {
    selection = { kind: 'one-piece', onePieceId: onePiece!.id, outerwearId: outerwear?.id ?? null, shoesId: shoes.id }
  } else selection = { kind: 'separates', topId: top!.id, bottomId: bottom!.id, outerwearId: outerwear?.id ?? null, shoesId: shoes.id }

  const th = input.language === 'th'
  const recommendation: OwnedOutfitRecommendation = {
    selection,
    reasoning: {
      occasion: th ? 'เลือกความทางการของแต่ละชิ้นให้เหมาะกับโอกาสวันนี้' : "Each piece's formality is matched to today's occasion.",
      personalColor: input.subtype ? (th ? 'ให้ความสำคัญกับสีที่เข้ากับ Personal Color โดยเฉพาะชิ้นใกล้ใบหน้า' : 'Personal Color compatibility is weighted most strongly near your face.') : null,
      luckyColor: input.luckyPreferences.length ? (th ? 'นำสีมงคลมาใช้เป็นตัวช่วยแบบยืดหยุ่น โดยไม่ลดความเหมาะสมของชุด' : 'Lucky color is used as a soft preference without overriding outfit suitability.') : null,
    },
  }
  return validateOwnedOutfitRecommendation(recommendation, input).ok ? recommendation : null
}
