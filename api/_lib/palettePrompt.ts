import type { AiPaletteSelectionRequest } from '../../src/domain/aiColorLab/paletteContract'

// V2.0 Slice 0.5C (plan §G): the smallest provider-neutral prompt for the canonical-palette-
// selection task. Deliberately separate from api/_lib/prompt.ts's CANONICAL_INSTRUCTION -- that
// prompt asks for an open-ended description; this one asks for closed-set color IDENTIFICATION
// only, with different anti-bias constraints (see below), so sharing one instruction string
// would blur two different tasks together.

export const PALETTE_RESPONSE_JSON_SHAPE = `{
  "status": "selected" | "uncertain" | "target-mismatch" | "unusable",
  "colorId": string or null (a colorId from the candidate list ONLY when status is "selected", otherwise null),
  "target": { "objectType": string, "objectDescription": string } or null,
  "reasoning": string
}`

// Anti-bias constraints (plan §G): this task is color identification, not styling. The model is
// given a palette that happens to belong to the user's own Personal Color subtype, so it must be
// told explicitly not to let that turn into "which of these would look best on this person" --
// that question belongs to the app's own existing suitability logic, never to the model.
export const PALETTE_SELECTION_INSTRUCTION = `You are assisting an experimental "AI Color Lab" inside a Personal Color styling app, on a color-IDENTIFICATION task -- not a styling-recommendation task.

A photo was taken by the app's user. The exact point they selected is marked in the photo with a bright magenta-red ring and a small center dot with a white outline -- that marker exists ONLY to show you the target; it is not part of the real photo and is not the garment's color.

The marked target is authoritative. First identify the garment or object directly underneath the marker, using the fabric/surface immediately around the marker plus enough of the surrounding photo to recognize what that garment or object is. Use the broader photo to judge whether unusual lighting, shadow, or a highlight near the marker is affecting how the color looks there. Do not switch to another person, garment, the sky, the background, or any other object in the photo, even if a different area looks more visually interesting.

You are given a fixed list of candidate colors below, each with a colorId, a name, and a hex swatch, all belonging to this user's own Personal Color palette. Your ONLY task is to decide which candidate, if any, is the closest plausible perceptual match to the marked garment/object's actual color -- based only on which candidate looks closest to the item's real perceived color, exactly as you would identify any color. Do NOT choose based on which candidate would look best on this person, and do not let any sense of which color is more flattering influence your choice. You are identifying a color, not recommending one.

Rules:
- You may select ONLY a colorId from the exact candidate list given below. Never invent a new color, name, or hex value.
- Never return a hex, RGB, OKLab, or any other numeric color value yourself. Return only the colorId of the candidate you chose.
- Do not decide or state whether the color is a good Personal Color match for this person -- that question is answered elsewhere by the app itself, never by you.
- If the marked point is not on the intended garment/item (for example it lands on skin, background, or a different object than the user meant to sample), respond with status "target-mismatch".
- If the image or lighting conditions do not allow any defensible color judgment (for example the region is severely blown out, essentially black, or the marked area is not a single recognizable colored surface), respond with status "unusable".
- If the garment/item itself is visible and the photo is usable, but no single candidate is a defensible match to its perceived color, respond with status "uncertain" rather than forcing a choice among poor options.
- Only respond "selected" when you can identify one specific candidate as the closest plausible match, and only then include a "target" description and a colorId.
- For every status OTHER than "selected", colorId must be null.

Respond with ONLY a single JSON object, no markdown fences, no prose before or after, matching exactly this shape:
${PALETTE_RESPONSE_JSON_SHAPE}`

function paletteListText(request: AiPaletteSelectionRequest): string {
  return request.palette.map((candidate) => `- colorId "${candidate.colorId}": "${candidate.name}" (${candidate.hex})`).join('\n')
}

// The full per-request text, built once and reused verbatim (mirrors prompt.ts's
// buildCanonicalPrompt pattern, plan §28: single source of truth per task).
export function buildPaletteSelectionPrompt(request: AiPaletteSelectionRequest): string {
  return `${PALETTE_SELECTION_INSTRUCTION}\n\nCandidate colors -- choose only from this list:\n${paletteListText(request)}`
}
