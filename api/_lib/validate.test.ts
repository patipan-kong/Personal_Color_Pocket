import { describe, expect, it } from 'vitest'
import { extractJsonObject, validateModelOutput } from './validate'

const VALID = {
  targetAssessment: { objectType: 'shirt', objectDescription: 'cream short-sleeve shirt worn by the man on the left', targetMatched: true },
  perceivedColorName: 'Dusty Rose',
  colorFamily: 'pink',
  temperature: 'warm',
  value: 'medium',
  chroma: 'muted',
  lighting: { condition: 'soft window light', cast: 'neutral', severity: 'low' },
  sampleAssessment: { usable: true, issue: 'none' },
  suitability: 'workable',
  confidence: 'medium',
  reasoning: 'Looks like a muted warm pink under soft light.',
}

describe('validateModelOutput', () => {
  it('accepts a fully valid payload', () => {
    expect(validateModelOutput(VALID)).toEqual(VALID)
  })

  it('accepts sampleAssessment.usable as "uncertain"', () => {
    const payload = { ...VALID, sampleAssessment: { usable: 'uncertain', issue: 'mixed' } }
    expect(validateModelOutput(payload)?.sampleAssessment).toEqual({ usable: 'uncertain', issue: 'mixed' })
  })

  it('rejects a non-object', () => {
    expect(validateModelOutput('not json')).toBeNull()
    expect(validateModelOutput(null)).toBeNull()
    expect(validateModelOutput([VALID])).toBeNull()
  })

  it('rejects an invalid enum member instead of coercing it (plan §15: never silently coerce)', () => {
    expect(validateModelOutput({ ...VALID, temperature: 'toasty' })).toBeNull()
    expect(validateModelOutput({ ...VALID, suitability: 'perfect' })).toBeNull()
  })

  it('rejects a missing required field', () => {
    const { reasoning: _reasoning, ...missingReasoning } = VALID
    expect(validateModelOutput(missingReasoning)).toBeNull()
  })

  it('rejects an empty string label', () => {
    expect(validateModelOutput({ ...VALID, perceivedColorName: '   ' })).toBeNull()
  })

  it('rejects an oversized reasoning field rather than truncating it', () => {
    expect(validateModelOutput({ ...VALID, reasoning: 'x'.repeat(5000) })).toBeNull()
  })

  it('rejects a malformed nested object', () => {
    expect(validateModelOutput({ ...VALID, lighting: { condition: 'ok' } })).toBeNull()
    expect(validateModelOutput({ ...VALID, sampleAssessment: 'usable' })).toBeNull()
  })

  // Slice 0.1 grounding audit (plan §22 F, G): the new targetAssessment fields must be validated
  // with the same reject-not-coerce rigor as every other field.
  it('accepts targetAssessment.targetMatched as "uncertain"', () => {
    const payload = { ...VALID, targetAssessment: { ...VALID.targetAssessment, targetMatched: 'uncertain' } }
    expect(validateModelOutput(payload)?.targetAssessment.targetMatched).toBe('uncertain')
  })

  it('rejects a missing targetAssessment entirely', () => {
    const { targetAssessment: _targetAssessment, ...missing } = VALID
    expect(validateModelOutput(missing)).toBeNull()
  })

  it('rejects an invalid targetAssessment.targetMatched value instead of coercing it', () => {
    expect(validateModelOutput({ ...VALID, targetAssessment: { ...VALID.targetAssessment, targetMatched: 'yes' } })).toBeNull()
  })

  it('rejects an empty targetAssessment.objectType', () => {
    expect(validateModelOutput({ ...VALID, targetAssessment: { ...VALID.targetAssessment, objectType: '' } })).toBeNull()
  })

  it('rejects an oversized objectDescription rather than truncating it', () => {
    expect(validateModelOutput({ ...VALID, targetAssessment: { ...VALID.targetAssessment, objectDescription: 'x'.repeat(500) } })).toBeNull()
  })

  it('trims whitespace from targetAssessment string fields', () => {
    const payload = { ...VALID, targetAssessment: { objectType: '  shirt  ', objectDescription: '  cream shirt  ', targetMatched: true } }
    expect(validateModelOutput(payload)?.targetAssessment).toEqual({ objectType: 'shirt', objectDescription: 'cream shirt', targetMatched: true })
  })

  it('trims whitespace from string fields', () => {
    const result = validateModelOutput({ ...VALID, perceivedColorName: '  Dusty Rose  ' })
    expect(result?.perceivedColorName).toBe('Dusty Rose')
  })
})

describe('extractJsonObject', () => {
  it('parses plain JSON text', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 })
  })

  it('extracts JSON from inside a markdown fence', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('extracts a JSON object surrounded by stray prose', () => {
    expect(extractJsonObject('Sure, here you go:\n{"a":1}\nHope that helps!')).toEqual({ a: 1 })
  })

  it('returns null for text with no JSON object', () => {
    expect(extractJsonObject('no json here')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(extractJsonObject('{"a":}')).toBeNull()
  })
})
