import { describe, expect, it } from 'vitest'
import { analyzeQuiz } from './scoring'
import { quizQuestions } from './quiz'
import type { QuizAnswers } from './types'

const warm: QuizAnswers = { undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'medium', eyes: 'light-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'medium' }
const cool: QuizAnswers = { undertone: 'rosy', metal: 'silver', white: 'optic', earth: 'heavy', 'cool-color': 'clear', hair: 'medium', eyes: 'deep-clear', contrast: 'high', intensity: 'bright', clarity: 'clear', depth: 'medium' }

describe('personal color scoring', () => {
  it('keeps the frozen answer IDs, order, and scoring weights alongside visual metadata', () => {
    const contract = quizQuestions.map((question) => [question.id, question.options.map((option) => [
      option.id, option.weights.temperature, option.weights.value, option.weights.chroma, option.weights.contrast,
    ])])
    expect(contract).toEqual([
      ['undertone', [['golden', 2.3, .2, .2, 0], ['rosy', -2.3, .1, 0, 0], ['neutral', 0, 0, -.2, -.2]]],
      ['metal', [['gold', 1.7, .1, .1, 0], ['silver', -1.7, .1, .2, .2], ['both', 0, 0, -.1, -.2]]],
      // 'ivory' chroma was -.4 (calibration fix): liking warm ivory over optic/soft white is
      // primarily warmth evidence and should not also read as strong muted/Autumn evidence.
      ['white', [['ivory', 1.4, .5, -.1, -.3], ['optic', -.8, .5, 1, 1], ['soft-white', -.3, .8, -.7, -.5]]],
      // 'glow' chroma was -.5 (calibration fix): a Warm Spring person can legitimately love
      // camel/olive/warm-brown, so liking warm earth tones should mostly carry warmth
      // evidence, not automatically push toward Autumn's lower chroma.
      ['earth', [['glow', 1.8, -.5, -.1, .1], ['heavy', -1.1, .5, .4, .2], ['mixed', .5, 0, -1.2, -.5]]],
      ['cool-color', [['clear', -1.7, .1, .7, .6], ['drain', 1.5, 0, -.1, 0], ['soft-best', -.7, .1, -1.5, -.7]]],
      ['hair', [['light', 0, 2, .1, -.7], ['medium', 0, .1, 0, 0], ['deep', 0, -2, .2, .8]]],
      ['eyes', [['light-clear', 0, 1.2, 1, .2], ['soft-mixed', 0, .2, -1.5, -.7], ['deep-clear', 0, -1.3, .6, .9]]],
      ['contrast', [['low', 0, .2, -1, -2.2], ['medium', 0, 0, 0, 0], ['high', 0, -.1, .8, 2.2]]],
      ['intensity', [['muted', 0, 0, -2.4, -1], ['balanced', 0, 0, 0, 0], ['bright', 0, 0, 2.4, 1.2]]],
      // Model V2 additions -- second chroma observation and direct value observation.
      // See quiz.ts for the magnitude rationale (corroborating, not dominant/duplicative).
      ['clarity', [['muted', 0, 0, -1.8, -.5], ['balanced', 0, 0, 0, 0], ['clear', 0, 0, 1.8, .5]]],
      ['depth', [['light', 0, 2.2, 0, 0], ['medium', 0, 0, 0, 0], ['deep', 0, -2.2, 0, 0]]],
    ])
  })
  it('keeps strong warm evidence in a warm season', () => expect(['spring', 'autumn']).toContain(analyzeQuiz(warm).season))
  it('keeps strong cool evidence in a cool season', () => expect(['summer', 'winter']).toContain(analyzeQuiz(cool).season))
  it('lets muted evidence influence a Soft subtype', () => {
    const result = analyzeQuiz({ undertone: 'neutral', metal: 'both', white: 'soft-white', earth: 'mixed', 'cool-color': 'soft-best', hair: 'medium', eyes: 'soft-mixed', contrast: 'low', intensity: 'muted' })
    expect(result.subtype).toMatch(/^soft-/)
  })
  it('lets clear, high-chroma evidence influence a Clear subtype', () => {
    const result = analyzeQuiz({ undertone: 'neutral', metal: 'both', white: 'optic', earth: 'glow', 'cool-color': 'clear', hair: 'medium', eyes: 'light-clear', contrast: 'high', intensity: 'bright' })
    expect(result.subtype).toMatch(/^clear-/)
  })
  it('lets deep signals influence a Deep subtype', () => {
    const result = analyzeQuiz({ undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'clear', hair: 'deep', eyes: 'deep-clear', contrast: 'medium', intensity: 'balanced', clarity: 'balanced', depth: 'deep' })
    expect(result.subtype).toMatch(/^deep-/)
  })
  it('lets light signals influence a Light subtype', () => {
    const result = analyzeQuiz({ ...warm, hair: 'light', eyes: 'light-clear', contrast: 'low', intensity: 'muted', clarity: 'muted', depth: 'light' })
    expect(result.subtype).toMatch(/^light-/)
  })
  it('reduces confidence when strong clues contradict each other', () => {
    const contradictory = analyzeQuiz({ undertone: 'golden', metal: 'silver', white: 'ivory', earth: 'heavy', 'cool-color': 'drain', hair: 'light', eyes: 'deep-clear', contrast: 'low', intensity: 'bright' })
    expect(contradictory.confidence).toBeLessThan(analyzeQuiz(cool).confidence)
  })
  it('is deterministic and bounded', () => {
    expect(analyzeQuiz(warm)).toEqual(analyzeQuiz(warm))
    expect(analyzeQuiz(warm).confidence).toBeGreaterThanOrEqual(.42)
    expect(analyzeQuiz(warm).confidence).toBeLessThanOrEqual(.91)
  })
  it('preserves representative subtype and confidence contracts through presentation refactors', () => {
    // Recomputed for Model V2: `warm`/`cool` now carry clarity/depth answers (11/11
    // complete), and the two new questions widen every dimension's normalization range,
    // so exact confidence numbers shift even though the scoring FORMULA is unchanged --
    // this is the expected, approved effect of adding two more questions (see quiz.ts).
    expect(analyzeQuiz(warm)).toMatchObject({ subtype: 'warm-spring', confidence: 0.681137855888905, confidenceLabel: 'Likely match' })
    expect(analyzeQuiz(cool)).toMatchObject({ subtype: 'cool-winter', confidence: 0.7427158946635926, confidenceLabel: 'Likely match' })
    // Deliberately left as a partial (9/11) profile -- demonstrates an incomplete Model V2
    // profile still normalizes sensibly rather than crashing or defaulting oddly.
    expect(analyzeQuiz({ undertone: 'neutral', metal: 'both', white: 'soft-white', earth: 'mixed', 'cool-color': 'soft-best', hair: 'medium', eyes: 'soft-mixed', contrast: 'low', intensity: 'muted' })).toMatchObject({
      subtype: 'soft-summer', confidence: 0.6998731844536867, confidenceLabel: 'Likely match',
    })
  })

  // --- Calibration audit (see scoringAudit.ts + the audit report in the PR/task write-up) ---
  // These guard the exact failure a real Warm Spring user hit: strong warm/clear evidence
  // getting overridden into Autumn purely because of naturally dark hair and eyes. Natural
  // hair/eye depth should remain SUPPORTING evidence for the value/depth dimension, not
  // overwhelming evidence that outvotes the person's own observed reaction to color.
  describe('dark hair/eyes calibration (natural pigmentation must not overwhelm observed color response)', () => {
    it('1. warm + clear/bright response + dark hair + dark eyes still reaches Spring', () => {
      const result = analyzeQuiz({ undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'deep', eyes: 'deep-clear', contrast: 'medium', intensity: 'bright' })
      expect(result.season).toBe('spring')
    })
    it('2. warm + muted response + dark hair + dark eyes still reaches Autumn', () => {
      const result = analyzeQuiz({ undertone: 'golden', metal: 'gold', white: 'soft-white', earth: 'heavy', 'cool-color': 'soft-best', hair: 'deep', eyes: 'deep-clear', contrast: 'low', intensity: 'muted' })
      expect(result.season).toBe('autumn')
    })
    it('3. cool + clear/bright response + dark hair + dark eyes still reaches Winter', () => {
      const result = analyzeQuiz({ undertone: 'rosy', metal: 'silver', white: 'optic', earth: 'heavy', 'cool-color': 'clear', hair: 'deep', eyes: 'deep-clear', contrast: 'high', intensity: 'bright' })
      expect(result.season).toBe('winter')
    })
    it('4. cool + soft/muted response + dark hair + dark eyes still reaches Summer', () => {
      const result = analyzeQuiz({ undertone: 'rosy', metal: 'silver', white: 'soft-white', earth: 'mixed', 'cool-color': 'soft-best', hair: 'deep', eyes: 'deep-clear', contrast: 'low', intensity: 'muted' })
      expect(result.season).toBe('summer')
    })
    it('5. a genuinely rich/deep warm profile still reaches the Autumn family', () => {
      const result = analyzeQuiz({ undertone: 'golden', metal: 'gold', white: 'ivory', earth: 'glow', 'cool-color': 'drain', hair: 'deep', eyes: 'deep-clear', contrast: 'high', intensity: 'balanced' })
      expect(result.season).toBe('autumn')
    })
    it('6. a genuinely deep, high-contrast cool profile still reaches the Winter family', () => {
      const result = analyzeQuiz({ undertone: 'rosy', metal: 'silver', white: 'optic', earth: 'heavy', 'cool-color': 'clear', hair: 'deep', eyes: 'deep-clear', contrast: 'high', intensity: 'bright' })
      expect(result.season).toBe('winter')
    })
  })
})
