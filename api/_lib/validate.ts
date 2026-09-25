import {
  CHROMA_LEVELS, CONFIDENCE_LEVELS, LIGHTING_CASTS, LIGHTING_SEVERITIES, SAMPLE_ISSUES, SUITABILITY_VERDICTS, TEMPERATURES, VALUE_LEVELS,
} from '../../src/domain/aiColorLab/contract'
import type {
  AiChromaLevel, AiConfidenceLevel, AiLightingCast, AiLightingSeverity, AiSampleIssue, AiSuitabilityVerdict, AiTemperature, AiValueLevel,
} from '../../src/domain/aiColorLab/contract'

// Server-only: turns an untrusted, already-JSON-parsed provider payload into the fields a
// NormalizedAiColorResult needs (everything except provider/model, which the adapter attaches
// itself -- plan §15: "Never trust provider output merely because structured output was
// requested" and "Do not silently coerce wildly invalid responses into valid-looking results."
// Every enum field must be an exact member of its contract union; anything else fails the whole
// response rather than being guessed at.

export interface ValidatedModelOutput {
  perceivedColorName: string
  colorFamily: string
  temperature: AiTemperature
  value: AiValueLevel
  chroma: AiChromaLevel
  lighting: { condition: string; cast: AiLightingCast; severity: AiLightingSeverity }
  sampleAssessment: { usable: boolean | 'uncertain'; issue: AiSampleIssue }
  suitability: AiSuitabilityVerdict
  confidence: AiConfidenceLevel
  reasoning: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isNonEmptyString = (value: unknown, maxLength: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
const isMember = <T extends string>(value: unknown, members: readonly T[]): value is T => typeof value === 'string' && (members as readonly string[]).includes(value)

// Reasoning may run long; everything else is a short label. Caps guard against a provider
// dumping megabytes of text into one field (plan §16: keep diagnostics safe and bounded).
const LABEL_MAX = 80
const REASONING_MAX = 1200

export function validateModelOutput(json: unknown): ValidatedModelOutput | null {
  if (!isRecord(json)) return null
  const { perceivedColorName, colorFamily, temperature, value, chroma, lighting, sampleAssessment, suitability, confidence, reasoning } = json

  if (!isNonEmptyString(perceivedColorName, LABEL_MAX)) return null
  if (!isNonEmptyString(colorFamily, LABEL_MAX)) return null
  if (!isMember(temperature, TEMPERATURES)) return null
  if (!isMember(value, VALUE_LEVELS)) return null
  if (!isMember(chroma, CHROMA_LEVELS)) return null
  if (!isMember(suitability, SUITABILITY_VERDICTS)) return null
  if (!isMember(confidence, CONFIDENCE_LEVELS)) return null
  if (!isNonEmptyString(reasoning, REASONING_MAX)) return null

  if (!isRecord(lighting)) return null
  if (!isNonEmptyString(lighting.condition, LABEL_MAX)) return null
  if (!isMember(lighting.cast, LIGHTING_CASTS)) return null
  if (!isMember(lighting.severity, LIGHTING_SEVERITIES)) return null

  if (!isRecord(sampleAssessment)) return null
  const usable = sampleAssessment.usable
  if (typeof usable !== 'boolean' && usable !== 'uncertain') return null
  if (!isMember(sampleAssessment.issue, SAMPLE_ISSUES)) return null

  return {
    perceivedColorName: perceivedColorName.trim(),
    colorFamily: colorFamily.trim(),
    temperature,
    value,
    chroma,
    lighting: { condition: lighting.condition.trim(), cast: lighting.cast, severity: lighting.severity },
    sampleAssessment: { usable, issue: sampleAssessment.issue },
    suitability,
    confidence,
    reasoning: reasoning.trim(),
  }
}

// Providers sometimes wrap JSON in a markdown fence or add stray prose even when asked for pure
// JSON (plan §15 assumes this can happen). Extracts the first top-level {...} object; does not
// attempt to repair malformed JSON, only to find it inside surrounding text.
export function extractJsonObject(text: string): unknown | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const candidates = fenced ? [fenced[1], text] : [text]
  for (const candidate of candidates) {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start === -1 || end === -1 || end < start) continue
    try {
      return JSON.parse(candidate.slice(start, end + 1))
    } catch {
      continue
    }
  }
  return null
}
