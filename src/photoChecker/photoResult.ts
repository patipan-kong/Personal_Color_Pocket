import type { ColorResultView } from '../colorChecker/resultView'
import { getColorPlacement } from '../domain/photoColor/placement'
import { getSuitability } from '../domain/photoColor/suitability'
import type { PhotoPointMatched } from '../domain/photoColor/types'
import { colorDisplayName } from '../i18n'
import type { Language, LocaleCopy } from '../i18n'
import type { PresentationPreference } from '../services/presentationPreference'

// V1.2 Slice 5d: photo match → the shared Color Checker result. A relabelling only: the verdict is
// getSuitability(category), placement is getColorPlacement(match), and pairWith, nearest,
// resembles, direction, descriptors and warnings are passed through as the engine returned them.
export function toPhotoResultView(matched: PhotoPointMatched, copy: LocaleCopy['photoChecker'], language: Language, presentation: PresentationPreference): ColorResultView {
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
    caveat: copy.caveat,
  }
}
