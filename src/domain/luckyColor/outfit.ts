import { adaptLuckyColorToSubtype } from './adaptation'
import type { LuckyColorAdaptation, LuckyColorCandidate, LuckyColorPaletteCategory, LuckyColorSuitability } from './adaptation'
import { describeColor } from '../colorNames/colorNames'
import { getPalette } from '../personalColor/palettes'
import type { PaletteColor, Subtype } from '../personalColor/types'
import { LUCKY_COLOR_FAMILIES, LUCKY_GOALS } from './types'
import type { LuckyColorFamily, LuckyColorRule, LuckyGoal } from './types'

// V1.3 Slice 3 composes an outfit from the already-resolved lucky family and (when supplied)
// Slice 2's adaptation. It has no date, locale, presentation, persistence, or colour-science input.

export const LUCKY_OUTFIT_ROLES = ['top', 'bottom', 'shoes', 'accessory'] as const
export type LuckyOutfitRole = typeof LUCKY_OUTFIT_ROLES[number]

export const LUCKY_OUTFIT_COLOR_ROLES = ['lucky', 'supporting-neutral', 'supporting-personal-color'] as const
export type LuckyOutfitColorRole = typeof LUCKY_OUTFIT_COLOR_ROLES[number]

export const LUCKY_OUTFIT_STRATEGIES = ['lucky-top', 'lucky-main', 'lucky-bottom', 'lucky-accessory'] as const
export type LuckyOutfitStrategy = typeof LUCKY_OUTFIT_STRATEGIES[number]

export const LUCKY_OUTFIT_PLACEMENTS = ['top', 'main-piece', 'below-face', 'accessory'] as const
export type LuckyOutfitPlacement = typeof LUCKY_OUTFIT_PLACEMENTS[number]

export type LuckyOutfitColor =
  | { readonly kind: 'palette'; readonly id: string; readonly hex: string; readonly paletteName: string; readonly paletteCategory: LuckyColorPaletteCategory; readonly name: LuckyColorCandidate['name'] }
  | { readonly kind: 'semantic'; readonly token: 'lucky-family' | 'light-neutral' | 'neutral'; readonly luckyFamily?: LuckyColorFamily }

export interface LuckyOutfitPiece {
  readonly role: LuckyOutfitRole
  // Dual accessory fallbacks may need two honest semantic accessory slots. The role stays generic;
  // this index is presentation-neutral and absent from the single-family contract.
  readonly slot?: number
  readonly colorRole: LuckyOutfitColorRole
  readonly color: LuckyOutfitColor
}

export interface LuckyOutfitRecommendation {
  readonly mode: 'personalized' | 'general'
  readonly luckyFamily: LuckyColorFamily
  readonly strategy: LuckyOutfitStrategy
  readonly luckyPlacement: LuckyOutfitPlacement
  readonly luckyRule: LuckyColorRule | null
  readonly adaptation: LuckyColorAdaptation | null
  readonly pieces: readonly LuckyOutfitPiece[]
}

export interface LuckyOutfitLuckyClaim {
  readonly luckyFamily: LuckyColorFamily
  readonly goals: readonly LuckyGoal[]
  readonly rules: readonly LuckyColorRule[]
  readonly adaptation: LuckyColorAdaptation | null
  // Slice 2 suitability is retained separately from the resolved outfit placement. A near-face
  // family may move to a second visible role when two families compete for the same top role.
  readonly suitability: LuckyColorSuitability | null
  readonly placement: LuckyOutfitPlacement
  readonly pieceRole: LuckyOutfitRole
  readonly pieceSlot?: number
}

export interface LuckyGoalsOutfitRecommendation extends LuckyOutfitRecommendation {
  readonly selectedGoals: readonly LuckyGoal[]
  readonly luckyFamilies: readonly LuckyColorFamily[]
  readonly luckyRules: readonly LuckyColorRule[]
  readonly luckyClaims: readonly LuckyOutfitLuckyClaim[]
}

export interface LuckyGoalsOutfitInput {
  readonly rules: readonly LuckyColorRule[]
  readonly subtype?: Subtype
}

function invalidInput(kind: string, value: unknown): never {
  throw new RangeError(`Unknown lucky-color outfit ${kind}: ${String(value)}`)
}

function isLuckyFamily(value: unknown): value is LuckyColorFamily {
  return typeof value === 'string' && LUCKY_COLOR_FAMILIES.includes(value as LuckyColorFamily)
}

function isLuckyGoal(value: unknown): value is LuckyGoal {
  return typeof value === 'string' && LUCKY_GOALS.includes(value as LuckyGoal)
}

function placementForSuitability(suitability: LuckyColorSuitability): LuckyOutfitPlacement {
  return suitability === 'near-face' ? 'top' : suitability
}

function paletteColor(color: PaletteColor | null, category: LuckyColorPaletteCategory, adaptation?: LuckyColorCandidate): LuckyOutfitColor {
  if (adaptation) return Object.freeze({
    kind: 'palette', id: adaptation.id, hex: adaptation.hex, paletteName: adaptation.paletteName,
    paletteCategory: adaptation.paletteCategory, name: adaptation.name,
  })
  if (!color) throw new RangeError('Missing curated palette color')
  const name = describeColor(color.hex)
  if (!name) throw new RangeError(`Invalid curated palette HEX: ${color.hex}`)
  return Object.freeze({ kind: 'palette', id: color.id, hex: color.hex, paletteName: color.name, paletteCategory: category, name })
}

function semanticColor(token: 'lucky-family' | 'light-neutral' | 'neutral', luckyFamily?: LuckyColorFamily): LuckyOutfitColor {
  return Object.freeze(token === 'lucky-family' ? { kind: 'semantic', token, luckyFamily } : { kind: 'semantic', token })
}

function selectSupports(subtype: Subtype, excludedHex: string | null) {
  const palette = getPalette(subtype)
  const usable = (colors: PaletteColor[]) => colors.filter((color) => color.hex !== excludedHex)
  const best = usable(palette.best)[0]
  const bottomNeutral = usable(palette.neutrals)[1] ?? usable(palette.neutrals)[0]
  const shoeNeutral = usable(palette.neutrals).find((color) => color.id !== bottomNeutral?.id) ?? bottomNeutral
  if (!best || !bottomNeutral || !shoeNeutral) throw new RangeError(`Incomplete curated palette for ${subtype}`)
  return { best, bottomNeutral, shoeNeutral }
}

function personalizedPiece(role: LuckyOutfitRole, colorRole: LuckyOutfitColorRole, color: PaletteColor | null, category: LuckyColorPaletteCategory, adaptation?: LuckyColorCandidate): LuckyOutfitPiece {
  return Object.freeze({ role, colorRole, color: paletteColor(color, category, adaptation) })
}

function semanticLuckyPiece(role: LuckyOutfitRole, family: LuckyColorFamily, slot?: number): LuckyOutfitPiece {
  return Object.freeze({ role, ...(slot === undefined ? {} : { slot }), colorRole: 'lucky', color: semanticColor('lucky-family', family) })
}

function personalizedRecommendation(family: LuckyColorFamily, subtype: Subtype): LuckyOutfitRecommendation {
  const adaptation = adaptLuckyColorToSubtype(family, subtype)
  const selected = adaptation.selectedColor
  const supports = selectSupports(subtype, selected?.hex ?? null)
  let strategy: LuckyOutfitStrategy
  let pieces: LuckyOutfitPiece[]

  if (adaptation.suitability === 'near-face') {
    if (!selected) throw new RangeError('Near-face lucky adaptation requires a selected color')
    strategy = 'lucky-top'
    pieces = [
      personalizedPiece('top', 'lucky', null, selected.paletteCategory, selected),
      personalizedPiece('bottom', 'supporting-neutral', supports.bottomNeutral, 'neutrals'),
      personalizedPiece('shoes', 'supporting-neutral', supports.shoeNeutral, 'neutrals'),
    ]
  } else if (adaptation.suitability === 'main-piece') {
    if (!selected) throw new RangeError('Main-piece lucky adaptation requires a selected color')
    strategy = 'lucky-main'
    pieces = [
      personalizedPiece('top', 'supporting-personal-color', supports.best, 'best'),
      personalizedPiece('bottom', 'lucky', null, selected.paletteCategory, selected),
      personalizedPiece('shoes', 'supporting-neutral', supports.shoeNeutral, 'neutrals'),
    ]
  } else if (adaptation.suitability === 'below-face') {
    if (!selected) throw new RangeError('Below-face lucky adaptation requires a selected color')
    strategy = 'lucky-bottom'
    pieces = [
      personalizedPiece('top', 'supporting-personal-color', supports.best, 'best'),
      personalizedPiece('bottom', 'lucky', null, selected.paletteCategory, selected),
      personalizedPiece('shoes', 'supporting-neutral', supports.shoeNeutral, 'neutrals'),
    ]
  } else {
    strategy = 'lucky-accessory'
    pieces = [
      personalizedPiece('top', 'supporting-personal-color', supports.best, 'best'),
      personalizedPiece('bottom', 'supporting-neutral', supports.bottomNeutral, 'neutrals'),
      personalizedPiece('shoes', 'supporting-neutral', supports.shoeNeutral, 'neutrals'),
      Object.freeze({ role: 'accessory', colorRole: 'lucky', color: semanticColor('lucky-family', family) }),
    ]
  }

  return Object.freeze({
    mode: 'personalized', luckyFamily: family, strategy, luckyPlacement: placementForSuitability(adaptation.suitability),
    luckyRule: null, adaptation, pieces: Object.freeze(pieces),
  })
}

// Lower-level entry point for composition after a family is already resolved. It is also the honest
// general-mode API: it returns semantic broad colours, never a fabricated exact shade.
export function recommendLuckyFamilyOutfit(family: LuckyColorFamily, subtype?: Subtype): LuckyOutfitRecommendation {
  if (!isLuckyFamily(family)) invalidInput('family', family)
  if (subtype !== undefined) return personalizedRecommendation(family, subtype)
  return Object.freeze({
    mode: 'general', luckyFamily: family, strategy: 'lucky-top', luckyPlacement: 'top', luckyRule: null, adaptation: null,
    pieces: Object.freeze([
      Object.freeze({ role: 'top', colorRole: 'lucky', color: semanticColor('lucky-family', family) }),
      Object.freeze({ role: 'bottom', colorRole: 'supporting-neutral', color: semanticColor('light-neutral') }),
      Object.freeze({ role: 'shoes', colorRole: 'supporting-neutral', color: semanticColor('neutral') }),
    ]),
  })
}

// Slice 4 should use this entry point after resolving an actual positive Slice 1 rule. It preserves
// the canonical rule object for provenance without asking the outfit engine to reinterpret it.
export function recommendLuckyRuleOutfit(rule: LuckyColorRule, subtype?: Subtype): LuckyOutfitRecommendation {
  if (!rule || rule.goal === null || rule.traditionalCategory === 'kalakini' || rule.colorFamilies.length !== 1) invalidInput('positive rule', rule)
  const family = rule.colorFamilies[0]
  if (!isLuckyFamily(family)) invalidInput('rule family', family)
  const recommendation = recommendLuckyFamilyOutfit(family, subtype)
  return Object.freeze({ ...recommendation, luckyRule: rule })
}

type ResolvedFamily = {
  readonly family: LuckyColorFamily
  readonly rules: readonly LuckyColorRule[]
  readonly goals: readonly LuckyGoal[]
  readonly adaptation: LuckyColorAdaptation | null
}

const suitabilityOrder: Readonly<Record<LuckyColorSuitability, number>> = Object.freeze({
  'near-face': 0, 'main-piece': 1, 'below-face': 2, accessory: 3,
})

function familyOrder(family: LuckyColorFamily): number {
  return LUCKY_COLOR_FAMILIES.indexOf(family)
}

function goalOrder(goal: LuckyGoal): number {
  return LUCKY_GOALS.indexOf(goal)
}

function positiveRuleFamily(rule: LuckyColorRule): LuckyColorFamily {
  if (!rule || rule.goal === null || rule.traditionalCategory === 'kalakini' || rule.colorFamilies.length !== 1) invalidInput('positive rule', rule)
  if (!isLuckyGoal(rule.goal)) invalidInput('positive rule goal', rule.goal)
  const family = rule.colorFamilies[0]
  if (!isLuckyFamily(family)) invalidInput('rule family', family)
  return family
}

function canonicalRuleOrder(left: LuckyColorRule, right: LuckyColorRule): number {
  const familyDifference = familyOrder(positiveRuleFamily(left)) - familyOrder(positiveRuleFamily(right))
  return familyDifference || goalOrder(left.goal as LuckyGoal) - goalOrder(right.goal as LuckyGoal)
}

function resolveFamilies(rules: readonly LuckyColorRule[], subtype?: Subtype): ResolvedFamily[] {
  const orderedRules = [...rules].sort(canonicalRuleOrder)
  const groups: ResolvedFamily[] = []
  for (const rule of orderedRules) {
    const family = positiveRuleFamily(rule)
    const existing = groups.find((group) => group.family === family)
    if (existing) {
      const nextRules = Object.freeze([...existing.rules, rule])
      const nextGoals = Object.freeze(nextRules.map((item) => item.goal as LuckyGoal))
      groups[groups.indexOf(existing)] = Object.freeze({ ...existing, rules: nextRules, goals: nextGoals })
    } else {
      groups.push(Object.freeze({
        family,
        rules: Object.freeze([rule]),
        goals: Object.freeze([rule.goal as LuckyGoal]),
        adaptation: subtype ? adaptLuckyColorToSubtype(family, subtype) : null,
      }))
    }
  }
  return groups
}

function selectDualSupports(subtype: Subtype, excludedHexes: readonly string[]) {
  const palette = getPalette(subtype)
  const usable = (colors: PaletteColor[]) => colors.filter((color) => !excludedHexes.includes(color.hex))
  const best = usable(palette.best)[0]
  const bottomNeutral = usable(palette.neutrals)[1] ?? usable(palette.neutrals)[0]
  const shoeNeutral = usable(palette.neutrals).find((color) => color.id !== bottomNeutral?.id) ?? bottomNeutral
  if (!best || !bottomNeutral || !shoeNeutral) throw new RangeError(`Incomplete curated palette for ${subtype}`)
  return { best, bottomNeutral, shoeNeutral }
}

type AssignedRole = { readonly role: 'top' | 'bottom' | 'accessory'; readonly slot?: number }

function assignDualRoles(groups: readonly ResolvedFamily[]): readonly AssignedRole[] {
  const ordered = groups.map((group, index) => ({ group, index }))
  ordered.sort((left, right) => {
    const leftSuitability = left.group.adaptation?.suitability
    const rightSuitability = right.group.adaptation?.suitability
    const suitabilityDifference = (leftSuitability ? suitabilityOrder[leftSuitability] : 3) - (rightSuitability ? suitabilityOrder[rightSuitability] : 3)
    return suitabilityDifference || familyOrder(left.group.family) - familyOrder(right.group.family)
  })
  const assigned: Array<AssignedRole | undefined> = new Array(groups.length)
  let topUsed = false
  let bottomUsed = false
  let accessoryCount = 0
  for (const item of ordered) {
    const suitability = item.group.adaptation?.suitability
    const selectedColor = item.group.adaptation?.selectedColor
    const hasSelectedColor = Boolean(selectedColor)
    const canUseTop = hasSelectedColor && selectedColor?.paletteCategory !== 'harder'
    let role: AssignedRole['role']
    if (canUseTop && suitability === 'near-face' && !topUsed) {
      role = 'top'
      topUsed = true
    } else if (hasSelectedColor && (suitability === 'main-piece' || suitability === 'below-face') && !bottomUsed) {
      role = 'bottom'
      bottomUsed = true
    } else if (canUseTop && !topUsed) {
      role = 'top'
      topUsed = true
    } else {
      role = 'accessory'
    }
    const assignment = role === 'accessory' ? { role, slot: ++accessoryCount } : { role }
    assigned[item.index] = Object.freeze(assignment)
  }
  return Object.freeze(assigned as AssignedRole[])
}

function placementForAssignment(group: ResolvedFamily, assignment: AssignedRole): LuckyOutfitPlacement {
  if (assignment.role === 'top') return 'top'
  if (assignment.role === 'accessory') return 'accessory'
  return group.adaptation?.suitability === 'below-face' ? 'below-face' : 'main-piece'
}

function claimFor(group: ResolvedFamily, assignment: AssignedRole): LuckyOutfitLuckyClaim {
  return Object.freeze({
    luckyFamily: group.family,
    goals: group.goals,
    rules: group.rules,
    adaptation: group.adaptation,
    suitability: group.adaptation?.suitability ?? null,
    placement: placementForAssignment(group, assignment),
    pieceRole: assignment.role,
    ...(assignment.slot === undefined ? {} : { pieceSlot: assignment.slot }),
  })
}

function dualRecommendation(groups: readonly ResolvedFamily[], subtype?: Subtype): LuckyGoalsOutfitRecommendation {
  const selectedGoals = Object.freeze(groups.flatMap((group) => group.goals))
  const luckyRules = Object.freeze(groups.flatMap((group) => group.rules))
  const roles = subtype ? assignDualRoles(groups) : groups.map((_, index) => index === 0 ? { role: 'top' as const } : { role: 'bottom' as const })
  const claims = Object.freeze(groups.map((group, index) => claimFor(group, roles[index])))

  if (!subtype) {
    const pieces: LuckyOutfitPiece[] = [
      semanticLuckyPiece('top', groups[0].family),
      semanticLuckyPiece('bottom', groups[1].family),
      Object.freeze({ role: 'shoes', colorRole: 'supporting-neutral', color: semanticColor('neutral') }),
    ]
    return Object.freeze({
      mode: 'general', luckyFamily: groups[0].family, strategy: 'lucky-top', luckyPlacement: 'top', luckyRule: null, adaptation: null,
      pieces: Object.freeze(pieces), selectedGoals, luckyFamilies: Object.freeze(groups.map((group) => group.family)), luckyRules, luckyClaims: claims,
    })
  }

  const selectedHexes = groups.flatMap((group) => group.adaptation?.selectedColor?.hex ?? [])
  const supports = selectDualSupports(subtype, selectedHexes)
  const pieces: LuckyOutfitPiece[] = []
  const addLucky = (group: ResolvedFamily, assignment: AssignedRole) => {
    const selected = group.adaptation?.selectedColor
    const color = selected
      ? paletteColor(null, selected.paletteCategory, selected)
      : semanticColor('lucky-family', group.family)
    pieces.push(Object.freeze({
      role: assignment.role,
      ...(assignment.slot === undefined ? {} : { slot: assignment.slot }),
      colorRole: 'lucky', color,
    }))
  }
  groups.forEach((group, index) => addLucky(group, roles[index]))
  if (!roles.some((assignment) => assignment.role === 'top')) pieces.push(personalizedPiece('top', 'supporting-personal-color', supports.best, 'best'))
  if (!roles.some((assignment) => assignment.role === 'bottom')) pieces.push(personalizedPiece('bottom', 'supporting-neutral', supports.bottomNeutral, 'neutrals'))
  pieces.push(personalizedPiece('shoes', 'supporting-neutral', supports.shoeNeutral, 'neutrals'))

  const roleOrder = { top: 0, bottom: 1, shoes: 2, accessory: 3 } as const
  pieces.sort((left, right) => roleOrder[left.role] - roleOrder[right.role] || (left.slot ?? 0) - (right.slot ?? 0))
  const firstPlacement = claims.find((claim) => claim.pieceRole === 'top')?.placement ?? claims[0].placement
  return Object.freeze({
    mode: 'personalized', luckyFamily: groups[0].family, strategy: 'lucky-main', luckyPlacement: firstPlacement, luckyRule: null, adaptation: null,
    pieces: Object.freeze(pieces), selectedGoals, luckyFamilies: Object.freeze(groups.map((group) => group.family)), luckyRules, luckyClaims: claims,
  })
}

function decorateSingleRecommendation(rule: LuckyColorRule, recommendation: LuckyOutfitRecommendation): LuckyGoalsOutfitRecommendation {
  const family = positiveRuleFamily(rule)
  const luckyPiece = recommendation.pieces.find((piece) => piece.colorRole === 'lucky')!
  const adaptation = recommendation.adaptation
  const claim: LuckyOutfitLuckyClaim = Object.freeze({
    luckyFamily: family,
    goals: Object.freeze([rule.goal as LuckyGoal]),
    rules: Object.freeze([rule]),
    adaptation,
    suitability: adaptation?.suitability ?? null,
    placement: recommendation.luckyPlacement,
    pieceRole: luckyPiece.role,
    ...(luckyPiece.slot === undefined ? {} : { pieceSlot: luckyPiece.slot }),
  })
  return Object.freeze({
    ...recommendation,
    selectedGoals: Object.freeze([rule.goal as LuckyGoal]),
    luckyFamilies: Object.freeze([family]),
    luckyRules: Object.freeze([rule]),
    luckyClaims: Object.freeze([claim]),
  })
}

// Composes one or two already-resolved positive Slice 1 rules. Each rule is still resolved
// independently; this layer only canonicalizes order, groups same-family provenance, and assigns
// the resulting claims to compact outfit roles. UI selection order is intentionally not an input.
export function recommendLuckyGoalsOutfit(input: LuckyGoalsOutfitInput): LuckyGoalsOutfitRecommendation {
  if (!input || !Array.isArray(input.rules) || input.rules.length < 1 || input.rules.length > 2) invalidInput('goal rule count', input?.rules)
  const inputGoals = input.rules.map((rule) => rule?.goal)
  if (new Set(inputGoals).size !== inputGoals.length) invalidInput('duplicate goal rules', input.rules)
  const groups = resolveFamilies(input.rules, input.subtype)
  if (groups.length === 1 && input.rules.length === 1) return decorateSingleRecommendation(input.rules[0], recommendLuckyRuleOutfit(input.rules[0], input.subtype))
  if (groups.length === 1) {
    const familyRecommendation = recommendLuckyFamilyOutfit(groups[0].family, input.subtype)
    return Object.freeze({
      ...familyRecommendation,
      selectedGoals: Object.freeze(groups[0].goals),
      luckyFamilies: Object.freeze([groups[0].family]),
      luckyRules: Object.freeze(groups[0].rules),
      luckyClaims: Object.freeze([claimFor(groups[0], { role: familyRecommendation.pieces.find((piece) => piece.colorRole === 'lucky')!.role as 'top' | 'bottom' | 'accessory', ...(familyRecommendation.pieces.find((piece) => piece.colorRole === 'lucky')!.slot === undefined ? {} : { slot: familyRecommendation.pieces.find((piece) => piece.colorRole === 'lucky')!.slot }) })]),
    })
  }
  return dualRecommendation(groups, input.subtype)
}
