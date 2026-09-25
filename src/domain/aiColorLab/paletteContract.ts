import type { Subtype } from '../personalColor/types'
import type { AiErrorInfo, AiUsage } from './contract'

// V2.0 Slice 0.5C: a DEDICATED contract for the "select a canonical palette color" task, kept
// separate from contract.ts's free-form NormalizedAiColorResult (plan §C: "Do not overload the
// existing free-form analysis contract unless doing so is clearly cleaner" -- it is not: this is
// a genuinely different task, closed-set color IDENTIFICATION rather than open-ended
// description/styling judgment, and keeping the shapes separate means neither request leaks
// fields the other does not need). See docs/V2_AI_COLOR_LAB.md §37 for the full design record.

export const PALETTE_SELECTION_STATUSES = ['selected', 'uncertain', 'target-mismatch', 'unusable'] as const
export type AiPaletteSelectionStatus = typeof PALETTE_SELECTION_STATUSES[number]

// Exactly colorId/name/hex -- deliberately NOT group ('best'/'accents'/'neutrals'/'harder') and
// NOT any suitability label (plan §H: "Do not send best/accent/neutral/harder labels unless the
// model genuinely needs them for color identification. It probably does not... avoid sending
// suitability labels. The AI should not know which answer produces a favourable verdict"). The
// model is doing color identification, never styling recommendation (plan §G).
export interface AiPaletteCandidate {
  colorId: string
  name: string
  hex: string
}

// Strategy A -- independent vision fallback (plan §D). Deliberately excludes the deterministic
// sample's hex/rgb/name/flags: the product intent is "the deterministic measurement may be
// unreliable; inspect the image context and help me choose," so anchoring the model on the very
// measurement the user is asking it to reconsider would cut against that. See docs §37 for the
// full A-vs-B rationale.
export interface AiPaletteSelectionRequest {
  imageDataUrl: string
  subtype: Subtype
  palette: AiPaletteCandidate[]
}

export interface AiPaletteSelectionTarget {
  objectType: string
  objectDescription: string
}

// A closed-set result with an explicit escape hatch (plan §E): "No valid selection is better
// than a confidently fabricated forced choice." Only 'selected' carries a colorId -- every other
// status is structurally incapable of carrying one, so a malformed "non-selected state carrying
// a colorId" cannot even be constructed, let alone silently accepted (plan §S).
//
// No confidence field (plan §F, Option 1): the old generic AiConfidenceLevel was 14/14 "high" in
// the original bakeoff, including the one known-wrong case -- zero discriminative power. status
// itself ('selected' vs 'uncertain') is the honest decision boundary for this closed-set task;
// see docs §37 for why a task-specific confidence is not introduced without evidence it helps.
export type AiPaletteSelectionResult =
  | { status: 'selected'; colorId: string; target: AiPaletteSelectionTarget; reasoning: string }
  | { status: 'uncertain'; target: AiPaletteSelectionTarget | null; reasoning: string }
  | { status: 'target-mismatch'; target: AiPaletteSelectionTarget | null; reasoning: string }
  | { status: 'unusable'; target: AiPaletteSelectionTarget | null; reasoning: string }

// Provider/network/malformed-response failures stay transport/application failures, never a
// model semantic state (plan §E), reusing the SAME AiErrorInfo/AiUsage shapes as the existing
// free-form contract (contract.ts) so the AI Lab UI can render both with shared plumbing.
export type AiPaletteApiOutcome =
  | { ok: true; result: AiPaletteSelectionResult; latencyMs: number; usage: AiUsage | null; raw: unknown }
  | { ok: false; error: AiErrorInfo; latencyMs: number }
