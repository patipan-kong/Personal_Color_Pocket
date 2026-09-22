import type { Subtype } from './types'
import type { PresentationPreference } from '../../services/presentationPreference'

// Presentation-only asset registry -- maps each subtype x presentation to its editorial
// style-example image. These are VISUAL INSPIRATION only (see styleGuide.ts and the task
// brief): the exact palette HEX data in palettes.ts remains the sole source of truth for
// color. Nothing here participates in scoring, and scoring.ts/diagnostics.ts/scoringAudit.ts
// must never import from this module.
export type StyleExampleAssetSet = Record<PresentationPreference, string>

const assetPath = (subtype: Subtype, preference: PresentationPreference) => `/img/personal-color/${subtype}/${preference}.webp`

function buildAssetSet(subtype: Subtype): StyleExampleAssetSet {
  return { men: assetPath(subtype, 'men'), women: assetPath(subtype, 'women') }
}

const subtypeIds: Subtype[] = [
  'light-spring', 'warm-spring', 'clear-spring',
  'light-summer', 'cool-summer', 'soft-summer',
  'soft-autumn', 'warm-autumn', 'deep-autumn',
  'deep-winter', 'cool-winter', 'clear-winter',
]

export const styleExampleAssets: Record<Subtype, StyleExampleAssetSet> = Object.fromEntries(
  subtypeIds.map((subtype) => [subtype, buildAssetSet(subtype)]),
) as Record<Subtype, StyleExampleAssetSet>

export function getStyleExampleAsset(subtype: Subtype, preference: PresentationPreference): string {
  return styleExampleAssets[subtype][preference]
}
