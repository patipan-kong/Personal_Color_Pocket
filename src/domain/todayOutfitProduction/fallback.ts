import type { OwnedOutfitRecommendation, OwnedOutfitRequest, OwnedOutfitSelection, OwnedWardrobeFact } from './contract.js'
import { validateOwnedOutfitRecommendation, validateOwnedOutfitRequest } from './contract.js'
import { createOwnedOutfitSignature, isOutfitSignatureExcluded } from './signatures.js'

const targetFormality: Record<OwnedOutfitRequest['occasion'], OwnedWardrobeFact['formality']> = {
  casual: 'casual', work: 'smart-casual', date: 'smart-casual', 'casual-dinner': 'smart-casual',
  'smart-casual': 'smart-casual', formal: 'formal', 'wedding-guest': 'formal',
}
const rank = { casual: 0, 'smart-casual': 1, formal: 2 } as const
const nearFace = new Set(['top', 'one-piece', 'outerwear'])
const outerwearOccasions = new Set<OwnedOutfitRequest['occasion']>(['work', 'smart-casual', 'formal', 'wedding-guest'])

// Hierarchy is encoded in separate magnitude bands: formality is stronger than
// Personal Color, which is stronger than Lucky. Exclusion never changes that
// priority; it only removes an otherwise valid candidate.
function score(item: OwnedWardrobeFact, input: OwnedOutfitRequest): number {
  const distance = Math.abs(rank[item.formality] - rank[targetFormality[input.occasion]])
  const formality = distance === 0 ? 10_000 : distance === 1 ? 6_000 : 2_000
  const personalColor = (item.personalColorCompatibility?.score ?? 0) * (nearFace.has(item.slot) ? 300 : 90)
  const lucky = item.luckyFamilyMatches.length > 0 ? 12 : 0
  return formality + personalColor + lucky
}

function ranked(items: readonly OwnedWardrobeFact[], slot: OwnedWardrobeFact['slot'], input: OwnedOutfitRequest): readonly OwnedWardrobeFact[] {
  // V1 only has two exclusions. The bounded window keeps fallback work safe for
  // an unusually large wardrobe while making normal alternate combinations reachable.
  return items
    .filter((item) => item.slot === slot)
    .sort((left, right) => score(right, input) - score(left, input) || left.id.localeCompare(right.id))
    .slice(0, 20)
}

function outerwearCandidates(input: OwnedOutfitRequest): readonly (OwnedWardrobeFact | null)[] {
  const outerwearItems = ranked(input.wardrobe, 'outerwear', input)
  return outerwearOccasions.has(input.occasion) ? [...outerwearItems, null] : [null]
}

function candidateScore(
  selection: OwnedOutfitSelection,
  facts: { readonly top?: OwnedWardrobeFact; readonly bottom?: OwnedWardrobeFact; readonly onePiece?: OwnedWardrobeFact; readonly outerwear: OwnedWardrobeFact | null; readonly shoes: OwnedWardrobeFact },
  input: OwnedOutfitRequest,
): number {
  const base = selection.kind === 'separates'
    ? (score(facts.top!, input) + score(facts.bottom!, input) + score(facts.shoes, input)) / 3
    : (score(facts.onePiece!, input) + score(facts.shoes, input)) / 2
  // Outerwear supports a valid base but must not override it.
  return base + (facts.outerwear ? score(facts.outerwear, input) / 8 : 0)
}

function reasoning(input: OwnedOutfitRequest): OwnedOutfitRecommendation['reasoning'] {
  const th = input.language === 'th'
  return {
    occasion: th ? 'เลือกความทางการของแต่ละชิ้นให้เหมาะกับโอกาสวันนี้' : "Each piece's formality is matched to today's occasion.",
    personalColor: input.subtype ? (th ? 'ให้ความสำคัญกับสีที่เข้ากับ Personal Color โดยเฉพาะชิ้นใกล้ใบหน้า' : 'Personal Color compatibility is weighted most strongly near your face.') : null,
    luckyColor: input.luckyPreferences.length ? (th ? 'นำสีมงคลมาใช้เป็นตัวช่วยแบบยืดหยุ่น โดยไม่ลดความเหมาะสมของชุด' : 'Lucky color is used as a soft preference without overriding outfit suitability.') : null,
  }
}

export function recommendOwnedOutfitFallback(input: OwnedOutfitRequest): OwnedOutfitRecommendation | null {
  const request = validateOwnedOutfitRequest(input)
  if (!request.ok) return null

  const shoes = ranked(input.wardrobe, 'shoes', input)
  if (!shoes.length) return null
  const tops = ranked(input.wardrobe, 'top', input)
  const bottoms = ranked(input.wardrobe, 'bottom', input)
  const onePieces = ranked(input.wardrobe, 'one-piece', input)
  const outerwear = outerwearCandidates(input)
  const candidates: Array<{ readonly recommendation: OwnedOutfitRecommendation; readonly score: number; readonly order: string }> = []
  const fallbackReasoning = reasoning(input)

  for (const shoe of shoes) {
    for (const outer of outerwear) {
      for (const top of tops) {
        for (const bottom of bottoms) {
          const selection: OwnedOutfitSelection = { kind: 'separates', topId: top.id, bottomId: bottom.id, outerwearId: outer?.id ?? null, shoesId: shoe.id }
          const recommendation: OwnedOutfitRecommendation = { selection, reasoning: fallbackReasoning }
          if (validateOwnedOutfitRecommendation(recommendation, input).ok && !isOutfitSignatureExcluded(createOwnedOutfitSignature(recommendation), input.exclusions)) {
            candidates.push({ recommendation, score: candidateScore(selection, { top, bottom, outerwear: outer, shoes: shoe }, input), order: `0:${top.id}:${bottom.id}:${outer?.id ?? ''}:${shoe.id}` })
          }
        }
      }
      for (const onePiece of onePieces) {
        const selection: OwnedOutfitSelection = { kind: 'one-piece', onePieceId: onePiece.id, outerwearId: outer?.id ?? null, shoesId: shoe.id }
        const recommendation: OwnedOutfitRecommendation = { selection, reasoning: fallbackReasoning }
        if (validateOwnedOutfitRecommendation(recommendation, input).ok && !isOutfitSignatureExcluded(createOwnedOutfitSignature(recommendation), input.exclusions)) {
          candidates.push({ recommendation, score: candidateScore(selection, { onePiece, outerwear: outer, shoes: shoe }, input), order: `1:${onePiece.id}:${outer?.id ?? ''}:${shoe.id}` })
        }
      }
    }
  }

  candidates.sort((left, right) => right.score - left.score || left.order.localeCompare(right.order))
  return candidates[0]?.recommendation ?? null
}
