import type { QuizVisualId } from './types'

// Garment silhouettes used to present quiz color swatches as clothing rather than
// plain color chips (see App.tsx GarmentSwatch). The silhouette/kind only changes the
// presented clothing shape -- the swatch's canonical hex is identical for both, so
// scoring and the underlying color reference never change with presentation preference.
export type GarmentKind = 'shirt' | 'polo' | 'knit' | 'jacket' | 'blouse' | 'top' | 'cardigan' | 'dress'

const menGarmentCycle: GarmentKind[] = ['shirt', 'polo', 'knit', 'jacket']
const womenGarmentCycle: GarmentKind[] = ['blouse', 'top', 'cardigan', 'dress']

export function garmentKindFor(presentationPreference: 'women' | 'men', index: number): GarmentKind {
  const cycle = presentationPreference === 'men' ? menGarmentCycle : womenGarmentCycle
  return cycle[index % cycle.length]
}

export type QuizVisualLabelKey =
  | 'ivory' | 'softWhite' | 'pureWhite'
  | 'camel' | 'terracotta' | 'olive' | 'warmBrown'
  | 'coolBlue' | 'berryPink' | 'blueRed' | 'coolNavy'
  | 'mutedCoral' | 'mediumCoral' | 'clearCoral'
  | 'mutedGreen' | 'mediumGreen' | 'clearGreen'
  // Q10 -- second chroma observation: muted/soft vs fresh/clear, two hue families,
  // two tones each (no medium step -- see quiz.ts, this is a direct A/B, not a scale).
  | 'softCoral' | 'freshCoral' | 'softGreen' | 'freshGreen'
  // Q11 -- direct value/depth observation: light/medium/deep, two hue families so the
  // answer isn't driven by a single hue preference. 'mediumGreen' (already defined
  // above for Q9) is reused here -- its label text applies equally to this swatch.
  | 'lightBlue' | 'mediumBlue' | 'deepBlue' | 'lightGreen' | 'deepGreen'

export interface QuizVisualSwatch {
  id: string
  hex: `#${string}`
  labelKey: QuizVisualLabelKey
}

interface SwatchGroupVisual {
  id: QuizVisualId
  type: 'swatch-group'
  items: QuizVisualSwatch[]
}

interface ChromaScaleVisual {
  id: QuizVisualId
  type: 'chroma-scale'
  rows: Array<{
    id: string
    items: [QuizVisualSwatch, QuizVisualSwatch, QuizVisualSwatch]
  }>
}

// Q10: a direct two-way comparison (no medium step) -- deliberately a different shape
// from the three-step chroma-scale above so Q9 and Q10 do not read as the same question.
interface ClarityPairVisual {
  id: QuizVisualId
  type: 'clarity-pair'
  rows: Array<{
    id: string
    items: [QuizVisualSwatch, QuizVisualSwatch]
  }>
}

// Q11: light/medium/deep progression across two hue families, isolating value rather
// than chroma (see quiz.ts for why this is structurally similar to chroma-scale but
// kept as its own type -- App.tsx and tests key off `type` to label things correctly).
interface ValueScaleVisual {
  id: QuizVisualId
  type: 'value-scale'
  rows: Array<{
    id: string
    items: [QuizVisualSwatch, QuizVisualSwatch, QuizVisualSwatch]
  }>
}

export type QuizVisual = SwatchGroupVisual | ChromaScaleVisual | ClarityPairVisual | ValueScaleVisual

export const quizVisuals: Record<QuizVisualId, QuizVisual> = {
  'white-comparison': {
    id: 'white-comparison',
    type: 'swatch-group',
    items: [
      { id: 'white-ivory', hex: '#FFF1D6', labelKey: 'ivory' },
      { id: 'white-soft', hex: '#F5F3EE', labelKey: 'softWhite' },
      { id: 'white-pure', hex: '#FFFFFF', labelKey: 'pureWhite' },
    ],
  },
  'warm-earthy': {
    id: 'warm-earthy',
    type: 'swatch-group',
    items: [
      { id: 'earth-camel', hex: '#C79A62', labelKey: 'camel' },
      { id: 'earth-terracotta', hex: '#C45F3C', labelKey: 'terracotta' },
      { id: 'earth-olive', hex: '#7C803D', labelKey: 'olive' },
      { id: 'earth-warm-brown', hex: '#8A5638', labelKey: 'warmBrown' },
    ],
  },
  'cool-colors': {
    id: 'cool-colors',
    type: 'swatch-group',
    items: [
      { id: 'cool-blue', hex: '#4E8FCC', labelKey: 'coolBlue' },
      { id: 'cool-berry', hex: '#B93F72', labelKey: 'berryPink' },
      { id: 'cool-blue-red', hex: '#C51F3A', labelKey: 'blueRed' },
      { id: 'cool-navy', hex: '#263A63', labelKey: 'coolNavy' },
    ],
  },
  'chroma-comparison': {
    id: 'chroma-comparison',
    type: 'chroma-scale',
    rows: [
      { id: 'coral-chroma-row', items: [
        { id: 'chroma-coral-muted', hex: '#B77C78', labelKey: 'mutedCoral' },
        { id: 'chroma-coral-medium', hex: '#D5655E', labelKey: 'mediumCoral' },
        { id: 'chroma-coral-clear', hex: '#F23D32', labelKey: 'clearCoral' },
      ] },
      { id: 'green-chroma-row', items: [
        { id: 'chroma-green-muted', hex: '#7F9B86', labelKey: 'mutedGreen' },
        { id: 'chroma-green-medium', hex: '#45A66B', labelKey: 'mediumGreen' },
        { id: 'chroma-green-clear', hex: '#00B85F', labelKey: 'clearGreen' },
      ] },
    ],
  },
  'clarity-comparison': {
    id: 'clarity-comparison',
    type: 'clarity-pair',
    rows: [
      { id: 'coral-clarity-row', items: [
        { id: 'clarity-coral-soft', hex: '#C99691', labelKey: 'softCoral' },
        { id: 'clarity-coral-fresh', hex: '#F2543F', labelKey: 'freshCoral' },
      ] },
      { id: 'green-clarity-row', items: [
        { id: 'clarity-green-soft', hex: '#96A88E', labelKey: 'softGreen' },
        { id: 'clarity-green-fresh', hex: '#34B24A', labelKey: 'freshGreen' },
      ] },
    ],
  },
  'value-comparison': {
    id: 'value-comparison',
    type: 'value-scale',
    rows: [
      { id: 'blue-value-row', items: [
        { id: 'value-blue-light', hex: '#A9C8E8', labelKey: 'lightBlue' },
        { id: 'value-blue-medium', hex: '#4A7FC0', labelKey: 'mediumBlue' },
        { id: 'value-blue-deep', hex: '#1E3F72', labelKey: 'deepBlue' },
      ] },
      { id: 'green-value-row', items: [
        { id: 'value-green-light', hex: '#B7D9A8', labelKey: 'lightGreen' },
        { id: 'value-green-medium', hex: '#4F9A5E', labelKey: 'mediumGreen' },
        { id: 'value-green-deep', hex: '#1F4A2A', labelKey: 'deepGreen' },
      ] },
    ],
  },
}

export function getQuizVisualSwatches(visual: QuizVisual): QuizVisualSwatch[] {
  return visual.type === 'swatch-group' ? visual.items : visual.rows.flatMap((row) => row.items)
}
