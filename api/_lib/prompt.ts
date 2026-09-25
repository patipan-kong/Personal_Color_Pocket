import type { AiColorAnalysisRequest } from '../../src/domain/aiColorLab/contract'

// V2.0 Slice 0 (plan §12, §28): the ONE canonical instruction, shared by every provider adapter.
// Adapters may wrap it differently (system+user split, JSON-mode preamble, etc.) but must never
// author their own competing wording -- see api/_lib/prompt.test.ts for the parity check.

// The exact JSON shape every provider is asked to return (mirrors ValidatedModelOutput). Spelled
// out in the prompt text itself, not just in a schema object, because Gemini's structured-output+
// vision support is unconfirmed (plan §5 research) and may fall back to plain instruction-following.
export const RESPONSE_JSON_SHAPE = `{
  "targetAssessment": { "objectType": string, "objectDescription": string, "targetMatched": true | false | "uncertain" },
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
//
// Slice 0.1 grounding audit (docs/V2_AI_COLOR_LAB.md §16-18): the first real-world run showed
// providers silently analyzing the WRONG object -- one described the sky, another a different
// person's shirt, instead of the garment the user actually selected. The image sent previously
// carried no indication at all of which point was selected (no marker, no coordinates), so a
// model had nothing to ground on but overall visual salience. The fix burns a bright ring +
// center dot onto the sent image at the exact selected point (src/aiLab/imageEncode.ts) and this
// instruction now explicitly describes that marker and makes the marked target authoritative.
export const CANONICAL_INSTRUCTION = `You are assisting an experimental "AI Color Lab" inside a Personal Color styling app. A photo was taken by the app's user. The exact point they selected is marked in the photo with a bright magenta-red ring and a small center dot with a white outline -- that marker exists ONLY to show you the target; it is not part of the real photo and is not the garment's color. A small circular region of the photo around that marked point was already sampled by a deterministic, non-AI color engine (given to you below only as context).

The marked target is authoritative. First identify the garment or object directly underneath the marker, using the fabric/surface immediately around the marker (the marker itself covers only a small area) plus enough of the surrounding photo to recognize what that garment or object is. Do not switch to another person, garment, the sky, the background, or any other object in the photo, even if a different area looks more visually interesting or salient than the marked one.

Your job is NOT to restate the deterministic measurement below. Evaluate the marked target yourself and add context a raw pixel measurement cannot:
- what garment or object is under the marker, and a short, specific description of it (e.g. which person is wearing it, or where in the photo it sits) so a human reviewer can independently check whether you found the right thing
- whether the garment/object you identified is the one the marker is actually on (targetMatched), or "uncertain" if you cannot tell
- the perceived color family of that garment/object and its warm/neutral/cool temperature
- its value (light/medium/deep) and chroma (muted/medium/clear)
- whether the ambient lighting in the photo looks warm, cool, or neutral, and how strongly it is affecting the marked region (severity)
- whether the marked region itself looks shadowed, highlighted/blown-out, or a mixed/ambiguous area, and whether it is usable for a color judgment at all
- given the user's stated Personal Color subtype (if any), whether this color is recommended, workable, or more_considered (their app's term for colors that need a little more care near the face) for that subtype -- or "uncertain" if you cannot judge

Do not report the marker ring or dot's own color as the garment's color -- look at the fabric or surface underneath and around it, not the marker graphic. Do not claim to have recovered the garment's objectively true physical color -- lighting and cameras make that impossible from a photo alone. If you are unsure of any field, answer "uncertain" rather than guessing.

Respond with ONLY a single JSON object, no markdown fences, no prose before or after, matching exactly this shape:
${RESPONSE_JSON_SHAPE}`

function sampleContextText(request: AiColorAnalysisRequest): string {
  const { sample } = request
  const flags = sample.flags.length > 0 ? sample.flags.join(', ') : 'none'
  return `Deterministic engine's own measurement of the pixels immediately around the marked point (context only, not a target to repeat): hex ${sample.hex}, approximate name "${sample.colorName ?? 'unknown'}", OKLab lightness ${sample.oklabL.toFixed(3)}, sampling flags: ${flags}.`
}

function subtypeContextText(request: AiColorAnalysisRequest): string {
  if (!request.subtype) return 'The user has no saved Personal Color subtype. Answer "suitability": "uncertain" rather than inventing one.'
  return `The user's saved Personal Color subtype is "${request.subtype.label}" (${request.subtype.season} season, id "${request.subtype.subtype}"). Judge suitability against this subtype.`
}

// The full per-request text, built once and reused verbatim by every adapter (plan §11, §28).
export function buildCanonicalPrompt(request: AiColorAnalysisRequest): string {
  return `${CANONICAL_INSTRUCTION}\n\n${sampleContextText(request)}\n${subtypeContextText(request)}`
}
