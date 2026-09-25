import type { Season, Subtype } from '../personalColor/types'

// V2.0 Slice 0: the AI Color Lab normalized contract (plan §14). Every provider adapter
// (api/_lib/providers/*) must translate its raw response into exactly this shape before it
// reaches the client -- the UI never sees provider-specific fields. Pure types only: this file
// has no runtime behavior and no secrets, so it is safe to import from both the browser bundle
// (for display) and the Node-only api/_lib code (for validation).

// DeepSeek was evaluated in Slice 0 and removed in Slice 0.1 after its adapter failed
// structured-output validation on the live canonical prompt (see docs/V2_AI_COLOR_LAB.md §15).
// The active bake-off is exactly these three.
export const AI_PROVIDER_IDS = ['gemini', 'openai', 'groq'] as const
export type AiProviderId = typeof AI_PROVIDER_IDS[number]

export const TEMPERATURES = ['warm', 'neutral', 'cool', 'uncertain'] as const
export type AiTemperature = typeof TEMPERATURES[number]

export const VALUE_LEVELS = ['light', 'medium', 'deep', 'uncertain'] as const
export type AiValueLevel = typeof VALUE_LEVELS[number]

export const CHROMA_LEVELS = ['muted', 'medium', 'clear', 'uncertain'] as const
export type AiChromaLevel = typeof CHROMA_LEVELS[number]

export const LIGHTING_CASTS = ['warm', 'neutral', 'cool', 'uncertain'] as const
export type AiLightingCast = typeof LIGHTING_CASTS[number]

export const LIGHTING_SEVERITIES = ['low', 'medium', 'high', 'uncertain'] as const
export type AiLightingSeverity = typeof LIGHTING_SEVERITIES[number]

export const SAMPLE_ISSUES = ['none', 'highlight', 'shadow', 'mixed', 'uncertain'] as const
export type AiSampleIssue = typeof SAMPLE_ISSUES[number]

// 'more_considered' preserves the app's own canonical term for its weaker-but-not-forbidden
// palette group (user-facing copy calls it "More Considered", never "Harder" -- see
// i18n/en.ts palette.sections.harder.title). This is the AI's own independent judgment call,
// never the deterministic engine's verdict re-labelled.
export const SUITABILITY_VERDICTS = ['recommended', 'workable', 'more_considered', 'uncertain'] as const
export type AiSuitabilityVerdict = typeof SUITABILITY_VERDICTS[number]

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const
export type AiConfidenceLevel = typeof CONFIDENCE_LEVELS[number]

export interface AiSampleAssessment {
  usable: boolean | 'uncertain'
  issue: AiSampleIssue
}

// Slice 0.1 grounding audit (docs/V2_AI_COLOR_LAB.md §16-18): the AI Lab previously sent every
// provider the full photo with no indication of which point was selected, which let providers
// silently analyze the wrong garment/object. targetAssessment makes what the model believes it
// looked at explicit and reviewable -- targetMatched is diagnostic (a provider can be confidently
// wrong), never trusted alone; the UI always shows objectType/objectDescription alongside it.
export interface AiTargetAssessment {
  objectType: string
  objectDescription: string
  targetMatched: boolean | 'uncertain'
}

export interface AiLighting {
  condition: string
  cast: AiLightingCast
  severity: AiLightingSeverity
}

// The normalized result every provider adapter produces on success (plan §14). No numeric
// confidence percentages (plan §14 forbids them) and no claim of recovering the garment's
// true physical color (plan §12).
export interface NormalizedAiColorResult {
  provider: AiProviderId
  model: string
  targetAssessment: AiTargetAssessment
  perceivedColorName: string
  colorFamily: string
  temperature: AiTemperature
  value: AiValueLevel
  chroma: AiChromaLevel
  lighting: AiLighting
  sampleAssessment: AiSampleAssessment
  suitability: AiSuitabilityVerdict
  confidence: AiConfidenceLevel
  reasoning: string
}

// ---- Usage / diagnostics (plan §17-19) ----

export interface AiUsage {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
}

// ---- Error envelope (plan §20-21) ----

export type AiErrorKind =
  | 'not-configured'     // API key missing locally (plan §20)
  | 'unsupported'        // provider has no vision-capable model available to us (plan §21)
  | 'auth'                // 401/403
  | 'rate-limited'        // 429
  | 'bad-request'         // 400 / image rejected
  | 'provider-error'      // 5xx / provider outage
  | 'timeout'             // our own per-provider bound (plan §9)
  | 'malformed-response'  // structured output missing/invalid JSON/schema mismatch (plan §15)
  | 'network'             // fetch itself failed (DNS, offline, aborted for a reason other than our timeout)
  | 'internal'            // our own adapter/handler crashed; never leaks a stack to the client

export interface AiErrorInfo {
  kind: AiErrorKind
  message: string // short, safe, user-facing -- never a raw provider dump (plan §16, §20)
  httpStatus: number | null // the PROVIDER's status code, when there was one
}

export type AiProviderOutcome =
  | { ok: true; result: NormalizedAiColorResult; latencyMs: number; usage: AiUsage | null; raw: unknown }
  | { ok: false; error: AiErrorInfo; latencyMs: number }

// ---- Request payload (client -> /api/ai-color/<provider>) ----

// Same deterministic measurement + subtype context sent to every provider, so the comparison is
// fair (plan §11). imageDataUrl is the SAME resized JPEG for all four calls.
export interface AiColorSampleContext {
  hex: string
  rgb: { r: number; g: number; b: number }
  oklabL: number
  colorName: string | null
  flags: string[] // SampleFlag[] from the deterministic sampler, as strings
}

export interface AiColorSubtypeContext {
  subtype: Subtype
  season: Season
  label: string // English display name, e.g. "Warm Autumn" (plan §27)
}

export interface AiColorAnalysisRequest {
  imageDataUrl: string
  sample: AiColorSampleContext
  subtype: AiColorSubtypeContext | null // null when no valid saved profile exists (plan §27)
}

// ---- Response envelope (server -> client, always HTTP 200 so the UI has one shape to read
// regardless of whether the call reached the provider -- plan §6: isolation lives in there
// being one endpoint per provider, not in HTTP status juggling) ----

export type AiColorApiResponse = AiProviderOutcome
