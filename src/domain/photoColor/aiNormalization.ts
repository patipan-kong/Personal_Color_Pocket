import type { NormalizedAiColorResult } from '../aiColorLab/contract'
import { oklabChroma } from '../personalColor/colorUtils'
import { DEEP_VALUE_MAX, LIGHT_VALUE_MIN, NEUTRAL_CHROMA_MAX } from './photoMatch'
import type { PhotoColorSample } from './types'

// V2.0 Slice 0.3B (spike, plan §C-D): the boundary between AI vision evidence and the
// deterministic classifier (samplePhotoRegion -> matchPhotoColor -> getSuitability). Nothing
// here is wired into production yet (docs/V2_AI_COLOR_LAB.md §31 records why). This file exists
// to make the boundary concrete enough to test and review, not to change any existing behavior.
//
// Lives in domain/photoColor, not domain/aiColorLab, on purpose: aiColorLab/contract.ts is
// deliberately import-light (pure types + Season/Subtype only) so it stays safe to import from
// the Node-only api/_lib code -- tsconfig.node.json includes that whole directory but only one
// file outside it (personalColor/types.ts). This module needs the classifier's real runtime
// (oklabChroma, photoMatch's constants), which api/_lib has no reason to ever build against, so
// it sits on the classifier's side of that boundary and only TYPE-imports from aiColorLab/contract.
//
// Finding that shaped this design: NormalizedAiColorResult (./contract.ts) already never returns
// a numeric color -- temperature/value/chroma are coarse bins (warm/neutral/cool, light/medium/
// deep, muted/medium/clear), not RGB/hex/OKLab. That was a Slice 0 decision (plan §14: "no claim
// of recovering the garment's true physical color"), not something new here. Reusing those bins
// as a normalized numeric correction (Option 2/3 in the spike prompt: normalizedRgb, or a
// lightness/chroma/hue delta) would require inventing a bin->number mapping that has never been
// validated against a real photo -- exactly the "fake color precision" the spike prompt warns
// against. So the AI evidence stays observational text/enums (Option 1), and it is consumed
// advisory-only (Option 4): it can annotate a deterministic result, never recompute one.

// ---- Observational vs. recommendation split (plan §B) ----

// The subset of NormalizedAiColorResult that describes what the model OBSERVED. Picked field by
// field (never spread) so that adding a field to NormalizedAiColorResult later requires an
// explicit decision about whether the classifier boundary should see it -- it can never leak in
// silently. `suitability` and `reasoning` are deliberately excluded: they are the AI's own
// independent judgement about Personal Color fit, and D3/D4 forbid feeding a second
// recommendation opinion into the one production classifier. `provider`/`model` are excluded too
// -- they identify the run, they are not evidence about the photo.
export type AiColorNormalization = Pick<
  NormalizedAiColorResult,
  'targetAssessment' | 'perceivedColorName' | 'colorFamily' | 'temperature' | 'value' | 'chroma' | 'lighting' | 'sampleAssessment' | 'confidence'
>

export function toAiColorNormalization(result: NormalizedAiColorResult): AiColorNormalization {
  const { targetAssessment, perceivedColorName, colorFamily, temperature, value, chroma, lighting, sampleAssessment, confidence } = result
  return { targetAssessment, perceivedColorName, colorFamily, temperature, value, chroma, lighting, sampleAssessment, confidence }
}

// ---- Advisory (plan §C, §D) ----
//
// deriveSampleAdvisory NEVER touches a PhotoColorSample, PhotoColorMatch, category, or
// suitability -- it only produces a caveat annotation to show alongside the unchanged
// deterministic result. There is no code path from here back into matchPhotoColor's inputs, so
// D1 (no AI -> unchanged result), D3 (AI never decides suitability) and D4 (no parallel
// classifier) hold structurally, by the absence of a wire, not by a runtime check.

export type SampleAdvisoryReason =
  | 'target-mismatch'          // AI believes it analyzed a different object than the deterministic point
  | 'sample-unusable'          // AI reports the sample itself unusable (blur, obstruction, too small)
  | 'lighting-cast-corroborated' // AI's lighting cast/severity AND the deterministic sampler both flagged this region

export interface SampleAdvisory {
  caveat: boolean
  reasons: SampleAdvisoryReason[]
}

export const NO_ADVISORY: SampleAdvisory = { caveat: false, reasons: [] }

// `sample` is the deterministic PhotoColorSample that was ALREADY computed (this never gates
// whether sampling happens -- see suggestsAiAssist for that). `normalization` is null whenever AI
// did not run, was disabled, timed out, or returned a malformed/failed response (D2): every one
// of those collapses to the same NO_ADVISORY, so a caller cannot tell "AI never ran" apart from
// "AI ran and found nothing," which is exactly the point -- no AI opinion means no annotation.
export function deriveSampleAdvisory(sample: PhotoColorSample, normalization: AiColorNormalization | null): SampleAdvisory {
  if (!normalization) return NO_ADVISORY

  const reasons: SampleAdvisoryReason[] = []

  // These two have no deterministic equivalent to corroborate against -- pixel sampling has no
  // notion of "is this the right object" or "is this photo itself unusable," so AI's own report
  // is trusted directly for THESE facts. It still never touches category/suitability/colorName.
  if (normalization.targetAssessment.targetMatched === false) reasons.push('target-mismatch')
  if (normalization.sampleAssessment.usable === false) reasons.push('sample-unusable')

  // D5 ("a low-confidence or unusable AI assessment must not override good deterministic
  // evidence"): a lighting-cast concern only counts when the DETERMINISTIC sampler ALSO already
  // flagged this region (mixed/highlight/shadow, see sampling.ts). AI corroborates existing
  // uncertainty; it never manufactures doubt about a sample that came back clean. Low `confidence`
  // alone is deliberately NOT a trigger anywhere in this function, for the same reason.
  if (sample.diagnostics.flags.length > 0 && normalization.lighting.cast !== 'neutral' && normalization.lighting.severity !== 'low') {
    reasons.push('lighting-cast-corroborated')
  }

  return { caveat: reasons.length > 0, reasons }
}

// ---- Candidate gating signals (plan §E) ----
//
// Every threshold reused below already exists in the shipped classifier (photoMatch.ts,
// sampling.ts) for its own unrelated purpose (drawing direction arrows, naming warnings) -- none
// is invented here. This function is NOT called from anywhere in the app; it exists to prove the
// signals are available cheaply (they are already computed as part of every sample/match) so a
// later slice can decide whether/how to gate real AI calls on them.
export type AiAssistSignal =
  | 'sampler-flag-mixed'
  | 'sampler-flag-highlight'
  | 'sampler-flag-shadow'
  | 'ambiguous-neutral'    // chroma below the threshold matchPhotoColor already uses to drop hue
  | 'extreme-lightness'    // at or beyond the value thresholds matchPhotoColor already uses for "light"/"deep"

export function suggestsAiAssist(sample: PhotoColorSample): AiAssistSignal[] {
  const signals: AiAssistSignal[] = []
  for (const flag of sample.diagnostics.flags) signals.push(`sampler-flag-${flag}` as AiAssistSignal)
  if (oklabChroma(sample.oklab) < NEUTRAL_CHROMA_MAX) signals.push('ambiguous-neutral')
  if (sample.oklab.l >= LIGHT_VALUE_MIN || sample.oklab.l <= DEEP_VALUE_MAX) signals.push('extreme-lightness')
  return signals
}

// Signals from the spike prompt's own list that are NOT included above, and why: "disagreement
// among sampled regions" has no current implementation -- inspectPhotoPoint/samplePhotoRegion
// only ever sample ONE disc per tap, so there is nothing to compare yet; adding multi-region
// sampling to compute this would be new production behavior, out of scope for a contract spike.
