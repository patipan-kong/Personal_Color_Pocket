import type { AiColorAnalysisRequest, AiErrorKind, AiProviderId, AiUsage, NormalizedAiColorResult } from '../../../src/domain/aiColorLab/contract'
import { buildCanonicalPrompt } from '../prompt'
import { extractJsonObject, validateModelOutput } from '../validate'

// Shared plumbing for every provider adapter (plan §29: provider-specific code stays isolated
// in one file per provider; this file holds only the parts that are genuinely identical).
// Adapters return this NARROWER shape (no latencyMs) -- api/_lib/handler.ts measures wall-clock
// time uniformly around every provider call, including the not-configured short-circuit, so
// timing is consistent and adapters cannot forget to record it.
export type AdapterResult =
  | { ok: true; result: NormalizedAiColorResult; usage: AiUsage | null; raw: unknown }
  | { ok: false; error: { kind: AiErrorKind; httpStatus: number | null; message: string } }

export function dataUrlParts(dataUrl: string): { mimeType: string; base64: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('invalid data URL')
  return { mimeType: match[1], base64: match[2] }
}

// HTTP status -> our error taxonomy (plan §6, §20). Providers occasionally use nonstandard
// codes for account/billing (e.g. 402 Payment Required); anything unrecognized still lands as a
// legitimate, isolated per-provider error rather than throwing.
export function classifyHttpStatus(status: number): AiErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate-limited'
  if (status === 400 || status === 402 || status === 404 || status === 422) return 'bad-request'
  if (status >= 500) return 'provider-error'
  return 'provider-error'
}

export function safeErrorMessage(kind: AiErrorKind): string {
  switch (kind) {
    case 'not-configured': return 'API key not configured locally.'
    case 'unsupported': return 'This provider has no vision-capable model available to this app.'
    case 'auth': return 'The provider could not authenticate this request.'
    case 'rate-limited': return 'The provider rate-limited this request.'
    case 'bad-request': return 'The provider rejected the request (unsupported image or malformed request).'
    case 'provider-error': return 'The provider returned a server error.'
    case 'timeout': return 'The request timed out.'
    case 'malformed-response': return 'The provider response did not match the expected structured format.'
    case 'network': return 'The request could not reach the provider.'
    case 'internal': return 'An unexpected error occurred while processing this provider.'
  }
}

export function errorOutcome(kind: AiErrorKind, httpStatus: number | null = null, message?: string): AdapterResult {
  return { ok: false, error: { kind, httpStatus, message: message ?? safeErrorMessage(kind) } }
}

// Turns raw model output TEXT (already extracted from whatever envelope the provider used) into
// a full outcome: parses JSON (tolerating stray prose/fences), validates every field against the
// contract, and only then attaches provider/model. Any failure here is 'malformed-response',
// never a thrown exception (plan §15).
export function outcomeFromModelText(provider: AiProviderId, model: string, text: string, usage: AiUsage | null, raw: unknown): AdapterResult {
  const json = extractJsonObject(text)
  if (json === null) return errorOutcome('malformed-response')
  const validated = validateModelOutput(json)
  if (!validated) return errorOutcome('malformed-response')
  return { ok: true, usage, raw, result: { provider, model, ...validated } }
}

export function promptFor(request: AiColorAnalysisRequest): string {
  return buildCanonicalPrompt(request)
}

// A JSON Schema for the model-output fields (everything ValidatedModelOutput checks), for
// providers whose structured-output mode takes a real schema (OpenAI; Groq accepts one too).
// Even when a provider honors this perfectly, api/_lib/validate.ts still re-validates the
// result server-side (plan §15: "Still validate every response server-side").
export function modelOutputJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['targetAssessment', 'perceivedColorName', 'colorFamily', 'temperature', 'value', 'chroma', 'lighting', 'sampleAssessment', 'suitability', 'confidence', 'reasoning'],
    properties: {
      targetAssessment: {
        type: 'object',
        additionalProperties: false,
        required: ['objectType', 'objectDescription', 'targetMatched'],
        properties: {
          objectType: { type: 'string' },
          objectDescription: { type: 'string' },
          targetMatched: { enum: [true, false, 'uncertain'] },
        },
      },
      perceivedColorName: { type: 'string' },
      colorFamily: { type: 'string' },
      temperature: { type: 'string', enum: ['warm', 'neutral', 'cool', 'uncertain'] },
      value: { type: 'string', enum: ['light', 'medium', 'deep', 'uncertain'] },
      chroma: { type: 'string', enum: ['muted', 'medium', 'clear', 'uncertain'] },
      lighting: {
        type: 'object',
        additionalProperties: false,
        required: ['condition', 'cast', 'severity'],
        properties: {
          condition: { type: 'string' },
          cast: { type: 'string', enum: ['warm', 'neutral', 'cool', 'uncertain'] },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'uncertain'] },
        },
      },
      sampleAssessment: {
        type: 'object',
        additionalProperties: false,
        required: ['usable', 'issue'],
        properties: {
          usable: { enum: [true, false, 'uncertain'] },
          issue: { type: 'string', enum: ['none', 'highlight', 'shadow', 'mixed', 'uncertain'] },
        },
      },
      suitability: { type: 'string', enum: ['recommended', 'workable', 'more_considered', 'uncertain'] },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      reasoning: { type: 'string' },
    },
  } as const
}
