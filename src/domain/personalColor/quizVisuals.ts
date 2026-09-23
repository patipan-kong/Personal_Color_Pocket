import type { PresentationPreference } from '../../services/presentationPreference'
import type { QuizOptionIds, QuizQuestionId, QuizVisualId } from './types'

// Presentation-only asset contract. Expected paths are deliberately separate from the
// installed registry: only reviewed generated files are registered, so missing files
// never produce a broken <img>. Add a registry entry only with a reviewed file in public/img.
export type QuizVisualType = 'model-triptych' | 'jewelry-comparison' | 'hair-reference' | 'eye-reference' | 'contrast-reference' | 'swatch-scale'
export type QuizAssetPresentation = PresentationPreference | 'shared'
export type QuizVisualFallbackKind = 'drape' | 'metal' | 'hair' | 'eye' | 'contrast' | 'swatch'
export type QuizVisualAssetPath = `/img/quiz/${string}.webp`

// Retained for the V1.0 locale contract; these names also remain useful when the
// deterministic swatch fallback is audited independently from answer copy.
export type QuizVisualLabelKey =
  | 'ivory' | 'softWhite' | 'pureWhite'
  | 'camel' | 'terracotta' | 'olive' | 'warmBrown'
  | 'coolBlue' | 'berryPink' | 'blueRed' | 'coolNavy'
  | 'mutedCoral' | 'mediumCoral' | 'clearCoral'
  | 'mutedGreen' | 'mediumGreen' | 'clearGreen'
  | 'softCoral' | 'freshCoral' | 'softGreen' | 'freshGreen'
  | 'lightBlue' | 'mediumBlue' | 'deepBlue' | 'lightGreen' | 'deepGreen'

export type GarmentKind = 'shirt' | 'polo' | 'knit' | 'jacket' | 'blouse' | 'top' | 'cardigan' | 'dress'
const menGarmentCycle: GarmentKind[] = ['shirt', 'polo', 'knit', 'jacket']
const womenGarmentCycle: GarmentKind[] = ['blouse', 'top', 'cardigan', 'dress']
export function garmentKindFor(preference: PresentationPreference, index: number): GarmentKind {
  const cycle = preference === 'men' ? menGarmentCycle : womenGarmentCycle
  return cycle[index % cycle.length]
}

export interface QuizVisualVariant<Question extends QuizQuestionId = QuizQuestionId> {
  answerId: QuizOptionIds[Question]
  altTextKey: `${Question}.${QuizOptionIds[Question]}`
  fallbackKind: QuizVisualFallbackKind
  fallbackSwatches: readonly `#${string}`[]
  expectedAssets: Partial<Record<QuizAssetPresentation, QuizVisualAssetPath>>
}

export interface QuizVisual<Question extends QuizQuestionId = QuizQuestionId> {
  id: QuizVisualId
  questionId: Question
  questionNumber: number
  visualType: QuizVisualType
  presentationMode: 'presentation-specific' | 'shared'
  variants: readonly QuizVisualVariant<Question>[]
}

export type InstalledQuizVisualAssets = Partial<Record<QuizVisualAssetPath, QuizVisualAssetPath>>
export const installedQuizVisualAssets: InstalledQuizVisualAssets = {
  '/img/quiz/q01-undertone/men/golden.webp': '/img/quiz/q01-undertone/men/golden.webp',
  '/img/quiz/q01-undertone/men/rosy.webp': '/img/quiz/q01-undertone/men/rosy.webp',
  '/img/quiz/q01-undertone/men/neutral.webp': '/img/quiz/q01-undertone/men/neutral.webp',
  '/img/quiz/q01-undertone/women/golden.webp': '/img/quiz/q01-undertone/women/golden.webp',
  '/img/quiz/q01-undertone/women/rosy.webp': '/img/quiz/q01-undertone/women/rosy.webp',
  '/img/quiz/q01-undertone/women/neutral.webp': '/img/quiz/q01-undertone/women/neutral.webp',
  '/img/quiz/q02-metal/men/gold.webp': '/img/quiz/q02-metal/men/gold.webp',
  '/img/quiz/q02-metal/men/silver.webp': '/img/quiz/q02-metal/men/silver.webp',
  '/img/quiz/q02-metal/men/both.webp': '/img/quiz/q02-metal/men/both.webp',
  '/img/quiz/q02-metal/women/gold.webp': '/img/quiz/q02-metal/women/gold.webp',
  '/img/quiz/q02-metal/women/silver.webp': '/img/quiz/q02-metal/women/silver.webp',
  '/img/quiz/q02-metal/women/both.webp': '/img/quiz/q02-metal/women/both.webp',
  '/img/quiz/q03-white/men/ivory.webp': '/img/quiz/q03-white/men/ivory.webp',
  '/img/quiz/q03-white/men/optic.webp': '/img/quiz/q03-white/men/optic.webp',
  '/img/quiz/q03-white/men/soft-white.webp': '/img/quiz/q03-white/men/soft-white.webp',
  '/img/quiz/q03-white/women/ivory.webp': '/img/quiz/q03-white/women/ivory.webp',
  '/img/quiz/q03-white/women/optic.webp': '/img/quiz/q03-white/women/optic.webp',
  '/img/quiz/q03-white/women/soft-white.webp': '/img/quiz/q03-white/women/soft-white.webp',
  '/img/quiz/q04-warm-colors/men/glow.webp': '/img/quiz/q04-warm-colors/men/glow.webp',
  '/img/quiz/q04-warm-colors/men/heavy.webp': '/img/quiz/q04-warm-colors/men/heavy.webp',
  '/img/quiz/q04-warm-colors/men/mixed.webp': '/img/quiz/q04-warm-colors/men/mixed.webp',
  '/img/quiz/q04-warm-colors/women/glow.webp': '/img/quiz/q04-warm-colors/women/glow.webp',
  '/img/quiz/q04-warm-colors/women/heavy.webp': '/img/quiz/q04-warm-colors/women/heavy.webp',
  '/img/quiz/q04-warm-colors/women/mixed.webp': '/img/quiz/q04-warm-colors/women/mixed.webp',
  '/img/quiz/q05-cool-colors/men/clear.webp': '/img/quiz/q05-cool-colors/men/clear.webp',
  '/img/quiz/q05-cool-colors/men/drain.webp': '/img/quiz/q05-cool-colors/men/drain.webp',
  '/img/quiz/q05-cool-colors/men/soft-best.webp': '/img/quiz/q05-cool-colors/men/soft-best.webp',
  '/img/quiz/q05-cool-colors/women/clear.webp': '/img/quiz/q05-cool-colors/women/clear.webp',
  '/img/quiz/q05-cool-colors/women/drain.webp': '/img/quiz/q05-cool-colors/women/drain.webp',
  '/img/quiz/q05-cool-colors/women/soft-best.webp': '/img/quiz/q05-cool-colors/women/soft-best.webp',
  '/img/quiz/q06-hair/men/light.webp': '/img/quiz/q06-hair/men/light.webp',
  '/img/quiz/q06-hair/men/medium.webp': '/img/quiz/q06-hair/men/medium.webp',
  '/img/quiz/q06-hair/men/deep.webp': '/img/quiz/q06-hair/men/deep.webp',
  '/img/quiz/q06-hair/women/light.webp': '/img/quiz/q06-hair/women/light.webp',
  '/img/quiz/q06-hair/women/medium.webp': '/img/quiz/q06-hair/women/medium.webp',
  '/img/quiz/q06-hair/women/deep.webp': '/img/quiz/q06-hair/women/deep.webp',
  '/img/quiz/q07-eyes/men/light-clear.webp': '/img/quiz/q07-eyes/men/light-clear.webp',
  '/img/quiz/q07-eyes/men/soft-mixed.webp': '/img/quiz/q07-eyes/men/soft-mixed.webp',
  '/img/quiz/q07-eyes/men/deep-clear.webp': '/img/quiz/q07-eyes/men/deep-clear.webp',
  '/img/quiz/q07-eyes/women/light-clear.webp': '/img/quiz/q07-eyes/women/light-clear.webp',
  '/img/quiz/q07-eyes/women/soft-mixed.webp': '/img/quiz/q07-eyes/women/soft-mixed.webp',
  '/img/quiz/q07-eyes/women/deep-clear.webp': '/img/quiz/q07-eyes/women/deep-clear.webp',
  '/img/quiz/q08-contrast/men/low.webp': '/img/quiz/q08-contrast/men/low.webp',
  '/img/quiz/q08-contrast/men/medium.webp': '/img/quiz/q08-contrast/men/medium.webp',
  '/img/quiz/q08-contrast/men/high.webp': '/img/quiz/q08-contrast/men/high.webp',
  '/img/quiz/q08-contrast/women/low.webp': '/img/quiz/q08-contrast/women/low.webp',
  '/img/quiz/q08-contrast/women/medium.webp': '/img/quiz/q08-contrast/women/medium.webp',
  '/img/quiz/q08-contrast/women/high.webp': '/img/quiz/q08-contrast/women/high.webp',
  '/img/quiz/q09-intensity/men/muted.webp': '/img/quiz/q09-intensity/men/muted.webp',
  '/img/quiz/q09-intensity/men/balanced.webp': '/img/quiz/q09-intensity/men/balanced.webp',
  '/img/quiz/q09-intensity/men/bright.webp': '/img/quiz/q09-intensity/men/bright.webp',
  '/img/quiz/q09-intensity/women/muted.webp': '/img/quiz/q09-intensity/women/muted.webp',
  '/img/quiz/q09-intensity/women/balanced.webp': '/img/quiz/q09-intensity/women/balanced.webp',
  '/img/quiz/q09-intensity/women/bright.webp': '/img/quiz/q09-intensity/women/bright.webp',
  '/img/quiz/q10-clarity/men/muted.webp': '/img/quiz/q10-clarity/men/muted.webp',
  '/img/quiz/q10-clarity/men/balanced.webp': '/img/quiz/q10-clarity/men/balanced.webp',
  '/img/quiz/q10-clarity/men/clear.webp': '/img/quiz/q10-clarity/men/clear.webp',
  '/img/quiz/q10-clarity/women/muted.webp': '/img/quiz/q10-clarity/women/muted.webp',
  '/img/quiz/q10-clarity/women/balanced.webp': '/img/quiz/q10-clarity/women/balanced.webp',
  '/img/quiz/q10-clarity/women/clear.webp': '/img/quiz/q10-clarity/women/clear.webp',
  '/img/quiz/q11-depth/men/light.webp': '/img/quiz/q11-depth/men/light.webp',
  '/img/quiz/q11-depth/men/medium.webp': '/img/quiz/q11-depth/men/medium.webp',
  '/img/quiz/q11-depth/men/deep.webp': '/img/quiz/q11-depth/men/deep.webp',
  '/img/quiz/q11-depth/women/light.webp': '/img/quiz/q11-depth/women/light.webp',
  '/img/quiz/q11-depth/women/medium.webp': '/img/quiz/q11-depth/women/medium.webp',
  '/img/quiz/q11-depth/women/deep.webp': '/img/quiz/q11-depth/women/deep.webp',
}

const genderedAssets = (folder: string, answerId: string) => ({
  men: `/img/quiz/${folder}/men/${answerId}.webp`,
  women: `/img/quiz/${folder}/women/${answerId}.webp`,
}) as const satisfies Partial<Record<QuizAssetPresentation, QuizVisualAssetPath>>

function defineVisual<Question extends QuizQuestionId>(visual: QuizVisual<Question>): QuizVisual<Question> { return visual }

export const quizVisuals: Record<QuizVisualId, QuizVisual> = {
  'undertone-comparison': defineVisual({ id: 'undertone-comparison', questionId: 'undertone', questionNumber: 1, visualType: 'model-triptych', presentationMode: 'presentation-specific', variants: [
    { answerId: 'golden', altTextKey: 'undertone.golden', fallbackKind: 'drape', fallbackSwatches: ['#C9824C', '#E3B66D'], expectedAssets: genderedAssets('q01-undertone', 'golden') },
    { answerId: 'rosy', altTextKey: 'undertone.rosy', fallbackKind: 'drape', fallbackSwatches: ['#6C85B7', '#C58BA4'], expectedAssets: genderedAssets('q01-undertone', 'rosy') },
    { answerId: 'neutral', altTextKey: 'undertone.neutral', fallbackKind: 'drape', fallbackSwatches: ['#A58C83', '#A5A18D'], expectedAssets: genderedAssets('q01-undertone', 'neutral') },
  ] }),
  'metal-comparison': defineVisual({ id: 'metal-comparison', questionId: 'metal', questionNumber: 2, visualType: 'jewelry-comparison', presentationMode: 'presentation-specific', variants: [
    { answerId: 'gold', altTextKey: 'metal.gold', fallbackKind: 'metal', fallbackSwatches: ['#A87519', '#F4DA83'], expectedAssets: genderedAssets('q02-metal', 'gold') },
    { answerId: 'silver', altTextKey: 'metal.silver', fallbackKind: 'metal', fallbackSwatches: ['#8F969E', '#E8EBEF'], expectedAssets: genderedAssets('q02-metal', 'silver') },
    { answerId: 'both', altTextKey: 'metal.both', fallbackKind: 'metal', fallbackSwatches: ['#D1A33A', '#CDD2D8'], expectedAssets: genderedAssets('q02-metal', 'both') },
  ] }),
  'white-comparison': defineVisual({ id: 'white-comparison', questionId: 'white', questionNumber: 3, visualType: 'model-triptych', presentationMode: 'presentation-specific', variants: [
    { answerId: 'ivory', altTextKey: 'white.ivory', fallbackKind: 'drape', fallbackSwatches: ['#FFF1D6'], expectedAssets: genderedAssets('q03-white', 'ivory') },
    { answerId: 'optic', altTextKey: 'white.optic', fallbackKind: 'drape', fallbackSwatches: ['#FFFFFF'], expectedAssets: genderedAssets('q03-white', 'optic') },
    { answerId: 'soft-white', altTextKey: 'white.soft-white', fallbackKind: 'drape', fallbackSwatches: ['#F5F3EE'], expectedAssets: genderedAssets('q03-white', 'soft-white') },
  ] }),
  'warm-earthy': defineVisual({ id: 'warm-earthy', questionId: 'earth', questionNumber: 4, visualType: 'model-triptych', presentationMode: 'presentation-specific', variants: [
    { answerId: 'glow', altTextKey: 'earth.glow', fallbackKind: 'drape', fallbackSwatches: ['#C79A62', '#C45F3C', '#7C803D'], expectedAssets: genderedAssets('q04-warm-colors', 'glow') },
    { answerId: 'heavy', altTextKey: 'earth.heavy', fallbackKind: 'drape', fallbackSwatches: ['#8A5638', '#C45F3C', '#7C803D'], expectedAssets: genderedAssets('q04-warm-colors', 'heavy') },
    { answerId: 'mixed', altTextKey: 'earth.mixed', fallbackKind: 'drape', fallbackSwatches: ['#C79A62', '#A98168', '#7C803D'], expectedAssets: genderedAssets('q04-warm-colors', 'mixed') },
  ] }),
  'cool-colors': defineVisual({ id: 'cool-colors', questionId: 'cool-color', questionNumber: 5, visualType: 'model-triptych', presentationMode: 'presentation-specific', variants: [
    { answerId: 'clear', altTextKey: 'cool-color.clear', fallbackKind: 'drape', fallbackSwatches: ['#4E8FCC', '#B93F72', '#C51F3A'], expectedAssets: genderedAssets('q05-cool-colors', 'clear') },
    { answerId: 'drain', altTextKey: 'cool-color.drain', fallbackKind: 'drape', fallbackSwatches: ['#4E8FCC', '#C51F3A', '#263A63'], expectedAssets: genderedAssets('q05-cool-colors', 'drain') },
    { answerId: 'soft-best', altTextKey: 'cool-color.soft-best', fallbackKind: 'drape', fallbackSwatches: ['#789CBD', '#A96E88', '#66728A'], expectedAssets: genderedAssets('q05-cool-colors', 'soft-best') },
  ] }),
  'hair-depth': defineVisual({ id: 'hair-depth', questionId: 'hair', questionNumber: 6, visualType: 'hair-reference', presentationMode: 'presentation-specific', variants: [
    { answerId: 'light', altTextKey: 'hair.light', fallbackKind: 'hair', fallbackSwatches: ['#D7B47B', '#B88C55'], expectedAssets: genderedAssets('q06-hair', 'light') },
    { answerId: 'medium', altTextKey: 'hair.medium', fallbackKind: 'hair', fallbackSwatches: ['#8A623F', '#68482F'], expectedAssets: genderedAssets('q06-hair', 'medium') },
    { answerId: 'deep', altTextKey: 'hair.deep', fallbackKind: 'hair', fallbackSwatches: ['#3D2B24', '#171313'], expectedAssets: genderedAssets('q06-hair', 'deep') },
  ] }),
  'eye-impression': defineVisual({ id: 'eye-impression', questionId: 'eyes', questionNumber: 7, visualType: 'eye-reference', presentationMode: 'presentation-specific', variants: [
    { answerId: 'light-clear', altTextKey: 'eyes.light-clear', fallbackKind: 'eye', fallbackSwatches: ['#A9C9C2', '#607F79'], expectedAssets: genderedAssets('q07-eyes', 'light-clear') },
    { answerId: 'soft-mixed', altTextKey: 'eyes.soft-mixed', fallbackKind: 'eye', fallbackSwatches: ['#8C8377', '#6D6F63'], expectedAssets: genderedAssets('q07-eyes', 'soft-mixed') },
    { answerId: 'deep-clear', altTextKey: 'eyes.deep-clear', fallbackKind: 'eye', fallbackSwatches: ['#49372B', '#171719'], expectedAssets: genderedAssets('q07-eyes', 'deep-clear') },
  ] }),
  'contrast-reference': defineVisual({ id: 'contrast-reference', questionId: 'contrast', questionNumber: 8, visualType: 'contrast-reference', presentationMode: 'presentation-specific', variants: [
    { answerId: 'low', altTextKey: 'contrast.low', fallbackKind: 'contrast', fallbackSwatches: ['#C6B4AA', '#AA9188', '#8F7870'], expectedAssets: genderedAssets('q08-contrast', 'low') },
    { answerId: 'medium', altTextKey: 'contrast.medium', fallbackKind: 'contrast', fallbackSwatches: ['#D6C1B3', '#8F756A', '#58443E'], expectedAssets: genderedAssets('q08-contrast', 'medium') },
    { answerId: 'high', altTextKey: 'contrast.high', fallbackKind: 'contrast', fallbackSwatches: ['#E9D6C7', '#7A5D50', '#21191A'], expectedAssets: genderedAssets('q08-contrast', 'high') },
  ] }),
  'chroma-comparison': defineVisual({ id: 'chroma-comparison', questionId: 'intensity', questionNumber: 9, visualType: 'swatch-scale', presentationMode: 'presentation-specific', variants: [
    { answerId: 'muted', altTextKey: 'intensity.muted', fallbackKind: 'swatch', fallbackSwatches: ['#B77C78', '#7F9B86'], expectedAssets: genderedAssets('q09-intensity', 'muted') },
    { answerId: 'balanced', altTextKey: 'intensity.balanced', fallbackKind: 'swatch', fallbackSwatches: ['#D5655E', '#45A66B'], expectedAssets: genderedAssets('q09-intensity', 'balanced') },
    { answerId: 'bright', altTextKey: 'intensity.bright', fallbackKind: 'swatch', fallbackSwatches: ['#F23D32', '#00B85F'], expectedAssets: genderedAssets('q09-intensity', 'bright') },
  ] }),
  'clarity-comparison': defineVisual({ id: 'clarity-comparison', questionId: 'clarity', questionNumber: 10, visualType: 'model-triptych', presentationMode: 'presentation-specific', variants: [
    { answerId: 'muted', altTextKey: 'clarity.muted', fallbackKind: 'drape', fallbackSwatches: ['#C99691', '#96A88E'], expectedAssets: genderedAssets('q10-clarity', 'muted') },
    { answerId: 'balanced', altTextKey: 'clarity.balanced', fallbackKind: 'drape', fallbackSwatches: ['#D8796E', '#65A66D'], expectedAssets: genderedAssets('q10-clarity', 'balanced') },
    { answerId: 'clear', altTextKey: 'clarity.clear', fallbackKind: 'drape', fallbackSwatches: ['#F2543F', '#34B24A'], expectedAssets: genderedAssets('q10-clarity', 'clear') },
  ] }),
  'value-comparison': defineVisual({ id: 'value-comparison', questionId: 'depth', questionNumber: 11, visualType: 'model-triptych', presentationMode: 'presentation-specific', variants: [
    { answerId: 'light', altTextKey: 'depth.light', fallbackKind: 'drape', fallbackSwatches: ['#A9C8E8', '#B7D9A8'], expectedAssets: genderedAssets('q11-depth', 'light') },
    { answerId: 'medium', altTextKey: 'depth.medium', fallbackKind: 'drape', fallbackSwatches: ['#4A7FC0', '#4F9A5E'], expectedAssets: genderedAssets('q11-depth', 'medium') },
    { answerId: 'deep', altTextKey: 'depth.deep', fallbackKind: 'drape', fallbackSwatches: ['#1E3F72', '#1F4A2A'], expectedAssets: genderedAssets('q11-depth', 'deep') },
  ] }),
}

export function getQuizVisualAsset(variant: QuizVisualVariant, preference: PresentationPreference, installed: InstalledQuizVisualAssets = installedQuizVisualAssets): QuizVisualAssetPath | null {
  const expected = variant.expectedAssets.shared ?? variant.expectedAssets[preference]
  return expected ? installed[expected] ?? null : null
}

export function getExpectedQuizAssetPaths(): QuizVisualAssetPath[] {
  return Object.values(quizVisuals).flatMap((visual) => visual.variants.flatMap((variant) => Object.values(variant.expectedAssets)))
}
