import type { LuckyGoalsOutfitRecommendation, LuckyOutfitColor, LuckyOutfitLuckyClaim, LuckyOutfitPiece, LuckyOutfitPlacement, LuckyOutfitRole } from '../domain/luckyColor/outfit'
import type { LuckyColorFamily, LuckyGoal } from '../domain/luckyColor/types'
import { LUCKY_FAMILY_DISPLAY_SWATCHES } from './presentation'

// V1.3 Slice 5. A presentation-only view of an existing Slice 3/4.1 recommendation for the garment
// board. It links each piece to its lucky claim and says how to paint it. It never chooses, scores,
// adapts, places, or renames a colour: every decision here is read from the recommendation.

// `exact` is a curated palette colour and is painted with its HEX unchanged. The two token kinds
// are visual stand-ins only; they never become a HEX claim, a Personal Color shade, or domain input.
// The V1.2 structured name exactly as the recommendation carries it (the board never names a colour itself).
type ColorName = Extract<LuckyOutfitColor, { kind: 'palette' }>['name']

export type OutfitBoardFill =
  | { readonly kind: 'exact'; readonly hex: string; readonly name: ColorName }
  | { readonly kind: 'family-token'; readonly family: LuckyColorFamily }
  | { readonly kind: 'neutral-token'; readonly token: 'light-neutral' | 'neutral' }

export interface OutfitBoardPiece {
  // Stable role/slot key, e.g. `top` or `accessory-2`.
  readonly key: string
  readonly role: LuckyOutfitRole
  readonly slot?: number
  readonly lucky: boolean
  // Why a non-lucky piece is there; null for lucky pieces.
  readonly support: 'personal-color' | 'neutral' | null
  readonly fill: OutfitBoardFill
  // The claim this piece carries, when it is lucky.
  readonly luckyFamily: LuckyColorFamily | null
  readonly goals: readonly LuckyGoal[]
}

export interface OutfitBoardClaim {
  readonly luckyFamily: LuckyColorFamily
  readonly goals: readonly LuckyGoal[]
  readonly placement: LuckyOutfitPlacement
  readonly pieceKey: string
  // The exact personalized colour when Slice 2 found one; null means a broad-family fallback.
  readonly exactColor: { readonly hex: string; readonly name: ColorName } | null
}

export interface OutfitBoardModel {
  readonly mode: 'personalized' | 'general'
  readonly claims: readonly OutfitBoardClaim[]
  readonly pieces: readonly OutfitBoardPiece[]
  readonly accessoryCount: number
}

// Existing Slice 4 stand-ins for the two semantic neutral tokens (general mode only).
const NEUTRAL_TOKEN_SWATCHES = Object.freeze({ 'light-neutral': '#F1E9DE', neutral: '#817971' } as const)

const pieceKey = (role: LuckyOutfitRole, slot?: number) => slot === undefined ? role : `${role}-${slot}`

function fillFor(piece: LuckyOutfitPiece): OutfitBoardFill {
  const { color } = piece
  if (color.kind === 'palette') return Object.freeze({ kind: 'exact', hex: color.hex, name: color.name })
  if (color.token === 'lucky-family') {
    if (!color.luckyFamily) throw new RangeError('Lucky-family token without a family')
    return Object.freeze({ kind: 'family-token', family: color.luckyFamily })
  }
  return Object.freeze({ kind: 'neutral-token', token: color.token })
}

function claimFor(claims: readonly LuckyOutfitLuckyClaim[], piece: LuckyOutfitPiece) {
  const matches = claims.filter((claim) => claim.pieceRole === piece.role && claim.pieceSlot === piece.slot)
  if (matches.length !== 1) throw new RangeError(`Lucky piece ${pieceKey(piece.role, piece.slot)} has ${matches.length} claims`)
  return matches[0]
}

export function buildOutfitBoardModel(recommendation: LuckyGoalsOutfitRecommendation): OutfitBoardModel {
  const keys = new Set<string>()
  const pieces = recommendation.pieces.map((piece): OutfitBoardPiece => {
    const key = pieceKey(piece.role, piece.slot)
    if (keys.has(key)) throw new RangeError(`Duplicate outfit piece ${key}`)
    keys.add(key)
    const lucky = piece.colorRole === 'lucky'
    const claim = lucky ? claimFor(recommendation.luckyClaims, piece) : null
    const fill = fillFor(piece)
    if (claim && fill.kind === 'family-token' && fill.family !== claim.luckyFamily) throw new RangeError(`Lucky piece ${key} does not show its claim family`)
    return Object.freeze({
      key, role: piece.role, ...(piece.slot === undefined ? {} : { slot: piece.slot }), lucky,
      support: lucky ? null : piece.colorRole === 'supporting-personal-color' ? 'personal-color' : 'neutral',
      fill, luckyFamily: claim?.luckyFamily ?? null, goals: claim?.goals ?? Object.freeze([]),
    })
  })
  const claims = recommendation.luckyClaims.map((claim): OutfitBoardClaim => {
    const key = pieceKey(claim.pieceRole, claim.pieceSlot)
    const piece = pieces.find((item) => item.key === key)
    if (!piece?.lucky) throw new RangeError(`Lucky claim ${claim.luckyFamily} has no lucky piece`)
    return Object.freeze({
      luckyFamily: claim.luckyFamily, goals: claim.goals, placement: claim.placement, pieceKey: key,
      exactColor: piece.fill.kind === 'exact' ? Object.freeze({ hex: piece.fill.hex, name: piece.fill.name }) : null,
    })
  })
  return Object.freeze({
    mode: recommendation.mode,
    claims: Object.freeze(claims),
    pieces: Object.freeze(pieces),
    accessoryCount: pieces.filter((piece) => piece.role === 'accessory').length,
  })
}

// The CSS colour that paints a fill. Exact colours pass through untouched.
export function boardFillColor(fill: OutfitBoardFill): string {
  if (fill.kind === 'exact') return fill.hex
  if (fill.kind === 'family-token') return LUCKY_FAMILY_DISPLAY_SWATCHES[fill.family]
  return NEUTRAL_TOKEN_SWATCHES[fill.token]
}

// Visibility only: very light fills get a firmer outline so they stay visible on the cream board.
// This reads the colour; it never changes it.
export function boardFillTone(fill: OutfitBoardFill): 'light' | 'mid' | 'dark' {
  const hex = boardFillColor(fill)
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  return luminance > 0.6 ? 'light' : luminance < 0.08 ? 'dark' : 'mid'
}
