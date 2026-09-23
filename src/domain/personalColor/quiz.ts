import type { QuizQuestion } from './types'

const w = (temperature = 0, value = 0, chroma = 0, contrast = 0) => ({ temperature, value, chroma, contrast })

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'undertone',
    visualId: 'undertone-comparison',
    options: [
      { id: 'golden', weights: w(2.3, .2, .2, 0) },
      { id: 'rosy', weights: w(-2.3, .1, 0, 0) },
      { id: 'neutral', weights: w(0, 0, -.2, -.2) },
    ],
  },
  {
    id: 'metal',
    visualId: 'metal-comparison',
    options: [
      { id: 'gold', weights: w(1.7, .1, .1, 0) },
      { id: 'silver', weights: w(-1.7, .1, .2, .2) },
      { id: 'both', weights: w(0, 0, -.1, -.2) },
    ],
  },
  {
    id: 'white',
    visualId: 'white-comparison',
    options: [
      { id: 'ivory', weights: w(1.4, .5, -.1, -.3) },
      { id: 'optic', weights: w(-.8, .5, 1, 1) },
      { id: 'soft-white', weights: w(-.3, .8, -.7, -.5) },
    ],
  },
  {
    id: 'earth',
    visualId: 'warm-earthy',
    options: [
      { id: 'glow', weights: w(1.8, -.5, -.1, .1) },
      { id: 'heavy', weights: w(-1.1, .5, .4, .2) },
      { id: 'mixed', weights: w(.5, 0, -1.2, -.5) },
    ],
  },
  {
    id: 'cool-color',
    visualId: 'cool-colors',
    options: [
      { id: 'clear', weights: w(-1.7, .1, .7, .6) },
      { id: 'drain', weights: w(1.5, 0, -.1, 0) },
      { id: 'soft-best', weights: w(-.7, .1, -1.5, -.7) },
    ],
  },
  {
    id: 'hair',
    visualId: 'hair-depth',
    options: [
      { id: 'light', weights: w(0, 2, .1, -.7) },
      { id: 'medium', weights: w(0, .1, 0, 0) },
      { id: 'deep', weights: w(0, -2, .2, .8) },
    ],
  },
  {
    id: 'eyes',
    visualId: 'eye-impression',
    options: [
      { id: 'light-clear', weights: w(0, 1.2, 1, .2) },
      { id: 'soft-mixed', weights: w(0, .2, -1.5, -.7) },
      { id: 'deep-clear', weights: w(0, -1.3, .6, .9) },
    ],
  },
  {
    id: 'contrast',
    visualId: 'contrast-reference',
    options: [
      { id: 'low', weights: w(0, .2, -1, -2.2) },
      { id: 'medium', weights: w(0, 0, 0, 0) },
      { id: 'high', weights: w(0, -.1, .8, 2.2) },
    ],
  },
  {
    id: 'intensity',
    visualId: 'chroma-comparison',
    options: [
      { id: 'muted', weights: w(0, 0, -2.4, -1) },
      { id: 'balanced', weights: w(0, 0, 0, 0) },
      { id: 'bright', weights: w(0, 0, 2.4, 1.2) },
    ],
  },
  // Model V2 -- second, independent chroma observation (see the diagnostic-pass finding
  // that "intensity" alone could flip Spring/Autumn). This corroborates or tempers
  // "intensity" rather than duplicating it: magnitude is deliberately smaller than
  // intensity's so agreement strengthens the chroma signal, disagreement produces a
  // genuine intermediate reading, and neither question can single-handedly decide
  // chroma. Contrast carries a small secondary effect only -- muted/dusty color families
  // read as slightly lower natural contrast near the face than fresh/clear ones, mirroring
  // (at reduced magnitude) the same secondary effect already present on "intensity".
  // Temperature and value are intentionally untouched (0): this question isolates chroma.
  {
    id: 'clarity',
    visualId: 'clarity-comparison',
    options: [
      { id: 'muted', weights: w(0, 0, -1.8, -.5) },
      { id: 'balanced', weights: w(0, 0, 0, 0) },
      { id: 'clear', weights: w(0, 0, 1.8, .5) },
    ],
  },
  // Model V2 -- direct value/depth observation: "do lighter or deeper colors work near
  // your face", independent of natural hair/eye pigmentation. Magnitude (2.2) is set
  // slightly above "hair" (2.0, the single largest existing value signal) so a clear
  // direct answer can meaningfully counterbalance naturally dark hair/eyes -- but well
  // below hair+eyes combined (3.3), so hair/eyes remain real supporting evidence rather
  // than being made irrelevant. No temperature/chroma/contrast effect: this question
  // isolates value.
  {
    id: 'depth',
    visualId: 'value-comparison',
    options: [
      { id: 'light', weights: w(0, 2.2, 0, 0) },
      { id: 'medium', weights: w(0, 0, 0, 0) },
      { id: 'deep', weights: w(0, -2.2, 0, 0) },
    ],
  },
]
