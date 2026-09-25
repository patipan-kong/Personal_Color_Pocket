import type { ColorResultView } from '../colorChecker/resultView'
import type { AiFallbackResult } from '../domain/photoColor/aiFallback'
import type { SampleAdvisory } from '../domain/photoColor/aiNormalization'
import { getPhotoLightingGuidance } from '../domain/photoColor/lightingGuidance'
import { getColorPlacement } from '../domain/photoColor/placement'
import { getSuitability } from '../domain/photoColor/suitability'
import type { PhotoPointMatched } from '../domain/photoColor/types'
import { colorDisplayName } from '../i18n'
import type { Language, LocaleCopy } from '../i18n'
import type { PresentationPreference } from '../services/presentationPreference'

// V1.2 Slice 5d: photo match → the shared Color Checker result. A relabelling only: the verdict is
// getSuitability(category), placement is getColorPlacement(match), and pairWith, nearest,
// resembles, direction, descriptors and warnings are passed through as the engine returned them.
// The lighting note (Slice 5f) is presentation only and never changes any of them.
//
// `advisory` (Slice 0.4) is optional and defaults to null: nothing in production currently calls
// AI, so every existing caller keeps getting aiAdvisory: []. When a caller does have a real
// SampleAdvisory (deriveSampleAdvisory(), aiNormalization.ts), only its `reasons` are turned into
// copy here -- caveat/reasons carry no colour or category, so this can only ever ADD a quiet note
// below the unchanged deterministic result, never change hex/category/suitability above.
export function toPhotoResultView(matched: PhotoPointMatched, copy: LocaleCopy['photoChecker'], language: Language, presentation: PresentationPreference, advisory: SampleAdvisory | null = null): ColorResultView {
  const { match } = matched
  const suitability = getSuitability(match.category)
  const nearestName = colorDisplayName(language, match.nearest.color)
  const harderName = match.resembles ? colorDisplayName(language, match.resembles.color) : null
  return {
    hex: matched.sample.hex,
    sampleLabel: copy.sampleLabel,
    suitability,
    category: { key: match.category, label: copy.categories[match.category] },
    why: copy.why[suitability]({ nearest: nearestName, harder: harderName }),
    reference: { kind: 'similar', color: match.nearest.color, group: match.nearest.group },
    // For "not ideal near your face" the reason already names the Harder colour.
    note: match.resembles && suitability !== 'weak' ? { color: match.resembles.color, text: copy.resembles(harderName!) } : null,
    placement: getColorPlacement(match, presentation),
    pairWith: match.pairWith,
    details: [
      ...(match.direction.length > 0 ? [copy.direction(nearestName, match.direction.map((direction) => copy.directions[direction]))] : []),
      `${copy.descriptorsLabel}: ${copy.descriptors.value[match.descriptors.value]} · ${copy.descriptors.clarity[match.descriptors.clarity]}`,
    ],
    warnings: match.warnings.map((flag) => copy.warnings[flag]),
    // Slice 5f: shown only when no warning already asks for another spot.
    info: getPhotoLightingGuidance(match) ? copy.lightingNote : null,
    caveat: copy.caveat,
    aiAdvisory: (advisory?.reasons ?? []).map((reason) => copy.aiAdvisory[reason]),
    sourceLabel: null,
  }
}

// V2.0 Slice 0.5D (plan §I, §J, §T): the explicit, user-invoked AI fallback's OWN result ->
// the shared Color Checker result. `result` already went through Slice 0.5B's unmodified
// resolveAiFallbackSelection() (colorId -> canonical palette entry -> category -> getSuitability()),
// so category/suitability/pairWith here are exactly the app's own existing logic -- never AI's.
// `result.color.hex` is the canonical palette entry's OWN hex (plan §J: "not an AI-measured pixel
// value"); no distance, direction or descriptors exist for a direct canonical pick, so those stay
// empty/null rather than being invented. `group` is only shown for a positive verdict by the
// shared card already (tone !== 'positive' hides it); 'harder' maps to null here because it is
// not a PositivePaletteGroup, matching the deterministic adapter's own convention.
export function toPhotoAiResultView(result: AiFallbackResult, copy: LocaleCopy['photoChecker'], language: Language, presentation: PresentationPreference): ColorResultView {
  const colorName = colorDisplayName(language, result.color)
  return {
    hex: result.color.hex,
    sampleLabel: copy.sampleLabel,
    suitability: result.suitability,
    category: { key: result.category, label: copy.categories[result.category] },
    why: copy.ai.why[result.suitability](colorName),
    reference: { kind: 'similar', color: result.color, group: result.group === 'harder' ? null : result.group },
    note: null,
    placement: getColorPlacement({ category: result.category }, presentation),
    pairWith: result.pairWith,
    details: [],
    warnings: [],
    info: null,
    caveat: copy.ai.caveat,
    aiAdvisory: [],
    sourceLabel: copy.ai.badge,
  }
}
