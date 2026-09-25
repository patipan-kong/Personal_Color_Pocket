import { describe, expect, it } from 'vitest'
import { extractJsonObject, validateModelOutput } from './validate'

const VALID = {
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
