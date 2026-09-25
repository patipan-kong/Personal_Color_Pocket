import type { AiColorAnalysisRequest } from '../../src/domain/aiColorLab/contract'

// V2.0 Slice 0 (plan §12, §28): the ONE canonical instruction, shared by every provider adapter.
// Adapters may wrap it differently (system+user split, JSON-mode preamble, etc.) but must never
// author their own competing wording -- see api/_lib/prompt.test.ts for the parity check.

// The exact JSON shape every provider is asked to return (mirrors ValidatedModelOutput). Spelled
// out in the prompt text itself, not just in a schema object, because two of the four providers
// (plan §5 research: Gemini, DeepSeek) have unconfirmed structured-output+vision support and may
// fall back to plain instruction-following.
export const RESPONSE_JSON_SHAPE = `{
  "perceivedColorName": string,
  "colorFamily": string,
  "temperature": "warm" | "neutral" | "cool" | "uncertain",
  "value": "light" | "medium" | "deep" | "uncertain",
  "chroma": "muted" | "medium" | "clear" | "uncertain",
  "lighting": { "condition": string, "cast": "warm" | "neutral" | "cool" | "uncertain", "severity": "low" | "medium" | "high" | "uncertain" },
  "sampleAssessment": { "usable": true | false | "uncertain", "issue": "none" | "highlight" | "shadow" | "mixed" | "uncertain" },
  "suitability": "recommended" | "workable" | "more_considered" | "uncertain",
  "confidence": "low" | "medium" | "high",
  "reasoning": string
}`

// The task instruction, independent of any one photo (safe to unit-test verbatim for parity).
export const CANONICAL_INSTRUCTION = `You are assisting an experimental "AI Color Lab" inside a Personal Color styling app. A photo was taken by the app's user, and a small circular region of it was already sampled by a deterministic, non-AI color engine (given to you below only as context).

Your job is NOT to restate that measurement. Evaluate the photo yourself and add context a raw pixel measurement cannot:
- what garment or object the marked region appears to show
- the perceived color family and its warm/neutral/cool temperature
- its value (light/medium/deep) and chroma (muted/medium/clear)
- whether the ambient lighting in the photo looks warm, cool, or neutral, and how strongly it is affecting the marked region (severity)
- whether the marked region itself looks shadowed, highlighted/blown-out, or a mixed/ambiguous area, and whether it is usable for a color judgment at all
- given the user's stated Personal Color subtype (if any), whether this color is recommended, workable, or more_considered (their app's term for colors that need a little more care near the face) for that subtype -- or "uncertain" if you cannot judge

Do not claim to have recovered the garment's objectively true physical color -- lighting and cameras make that impossible from a photo alone. If you are unsure of any field, answer "uncertain" rather than guessing.

Respond with ONLY a single JSON object, no markdown fences, no prose before or after, matching exactly this shape:
${RESPONSE_JSON_SHAPE}`

function sampleContextText(request: AiColorAnalysisRequest): string {
  const { sample } = request
  const flags = sample.flags.length > 0 ? sample.flags.join(', ') : 'none'
  return `Deterministic engine's own measurement of the marked region (context only, not a target to repeat): hex ${sample.hex}, approximate name "${sample.colorName ?? 'unknown'}", OKLab lightness ${sample.oklabL.toFixed(3)}, sampling flags: ${flags}.`
}

function subtypeContextText(request: AiColorAnalysisRequest): string {
  if (!request.subtype) return 'The user has no saved Personal Color subtype. Answer "suitability": "uncertain" rather than inventing one.'
  return `The user's saved Personal Color subtype is "${request.subtype.label}" (${request.subtype.season} season, id "${request.subtype.subtype}"). Judge suitability against this subtype.`
}

// The full per-request text, built once and reused verbatim by every adapter (plan §11, §28).
export function buildCanonicalPrompt(request: AiColorAnalysisRequest): string {
  return `${CANONICAL_INSTRUCTION}\n\n${sampleContextText(request)}\n${subtypeContextText(request)}`
}
