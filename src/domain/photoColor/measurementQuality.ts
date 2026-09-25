import type { PhotoColorSample, SampleFlag } from './types'

// V2.0 Slice 0.5A (spike, plan §H): the smallest possible pure evaluator the audit could justify.
// It answers ONE question -- "does this sample's own diagnostics show an issue with the
// MEASUREMENT itself" -- using only sample.diagnostics.flags, which already exist and are already
// shown to the user via PhotoResultCard's warnings block (src/i18n/en.ts `warnings.*`). Nothing new
// is computed and no new threshold is introduced; see docs/V2_AI_COLOR_LAB.md §35 for the full
// audit this is derived from, including why a 3-level 'reliable'/'caution'/'retry' state or a
// numeric score is NOT included here (only one threshold exists per signal, so a defensible second
// or third tier cannot be constructed from current evidence), and why 'highlight'/'shadow' come
// with a documented false-positive caveat on legitimate, uniformly near-white/near-black fabric.
//
// Deliberately knows nothing beyond PhotoColorSample: no subtype, no PhotoColorMatch, no category,
// no palette distance, no suitability, no AI. That is what keeps this "measurement quality" and not
// "classification confidence" (plan §I) -- see the module-boundary test in this file's *.test.ts.

export interface MeasurementQuality {
  issues: SampleFlag[] // sample.diagnostics.flags, unchanged and in the same order
}

export function assessPhotoMeasurement(sample: PhotoColorSample): MeasurementQuality {
  return { issues: sample.diagnostics.flags }
}
