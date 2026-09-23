export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type Subtype =
  | 'light-spring' | 'warm-spring' | 'clear-spring'
  | 'light-summer' | 'cool-summer' | 'soft-summer'
  | 'soft-autumn' | 'warm-autumn' | 'deep-autumn'
  | 'deep-winter' | 'cool-winter' | 'clear-winter'

export type DimensionKey = 'temperature' | 'value' | 'chroma' | 'contrast'
export type DimensionVector = Record<DimensionKey, number>
export type QuizAnswers = Record<string, string>

export type QuizQuestionId = 'undertone' | 'metal' | 'white' | 'earth' | 'cool-color' | 'hair' | 'eyes' | 'contrast' | 'intensity' | 'clarity' | 'depth'

export type QuizVisualId =
  | 'undertone-comparison'
  | 'metal-comparison'
  | 'white-comparison'
  | 'warm-earthy'
  | 'cool-colors'
  | 'hair-depth'
  | 'eye-impression'
  | 'contrast-reference'
  | 'chroma-comparison'
  | 'clarity-comparison'
  | 'value-comparison'

export interface QuizOptionIds {
  undertone: 'golden' | 'rosy' | 'neutral'
  metal: 'gold' | 'silver' | 'both'
  white: 'ivory' | 'optic' | 'soft-white'
  earth: 'glow' | 'heavy' | 'mixed'
  'cool-color': 'clear' | 'drain' | 'soft-best'
  hair: 'light' | 'medium' | 'deep'
  eyes: 'light-clear' | 'soft-mixed' | 'deep-clear'
  contrast: 'low' | 'medium' | 'high'
  intensity: 'muted' | 'balanced' | 'bright'
  // Second, independent chroma observation (Model V2) -- a direct muted/soft vs
  // fresh/clear color-family comparison, distinct in framing and visual layout from
  // the single-scale "intensity" question above. See quiz.ts for scoring rationale.
  clarity: 'muted' | 'balanced' | 'clear'
  // Direct value/depth observation (Model V2) -- "which depth of color works near your
  // face", not a natural-feature proxy like hair/eyes. See quiz.ts for scoring rationale.
  depth: 'light' | 'medium' | 'deep'
}

export interface QuizOption {
  id: string
  weights: DimensionVector
}

export interface QuizQuestion {
  id: QuizQuestionId
  options: QuizOption[]
  visualId?: QuizVisualId
}

export interface SeasonDefinition {
  id: Subtype
  season: Season
  target: DimensionVector
}

export type ConfidenceLabel = 'Strong match' | 'Likely match' | 'Possible match'

export interface ResultReason {
  dimension: DimensionKey
  tendency: 'high' | 'low'
  strength: 'strong' | 'moderate'
}

export interface PersonalColorResult {
  season: Season
  subtype: Subtype
  dimensions: DimensionVector
  confidence: number
  confidenceLabel: ConfidenceLabel
  reasons: ResultReason[]
  alternatives: Subtype[]
}

export interface PaletteColor {
  id: string
  name: string
  hex: string
}

export interface MetalRecommendation {
  id: string
  name: string
  note: string
  hex: string
}

export interface PersonalColorPalette {
  best: PaletteColor[]
  neutrals: PaletteColor[]
  accents: PaletteColor[]
  harder: PaletteColor[]
  metals: MetalRecommendation[]
}

export type MatchRating = 'Great Match' | 'Good Match' | 'Wearable' | 'Tricky'

export interface ColorMatchResult {
  normalizedHex: string
  rating: MatchRating
  score: number
  closestColors: PaletteColor[]
  reason: {
    type: MatchRating
    referenceColor: PaletteColor | null
  }
  pairWith: PaletteColor[]
}
