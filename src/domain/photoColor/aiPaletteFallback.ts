import type { AiPaletteSelectionResult } from '../aiColorLab/paletteContract'
import type { Subtype } from '../personalColor/types'
import { resolveAiFallbackSelection } from './aiFallback'
import type { AiFallbackResolution } from './aiFallback'

// V2.0 Slice 0.5C (plan §I): connects the palette-selection task's result to the Slice 0.5B
// resolver, UNMODIFIED -- no bins-to-category mapping, no AI suitability, no fabricated numeric
// color. Only 'selected' can ever produce a replacement result (plan §Q): 'uncertain',
// 'target-mismatch', 'unusable' -- and, by construction at the caller, any transport/provider
// failure -- all mean "no replacement result; the deterministic result, if any, stays untouched."
export type PaletteFallbackOutcome =
  | { kind: 'result'; resolution: Extract<AiFallbackResolution, { ok: true }> }
  | { kind: 'unresolved'; reason: 'unknown-color-id' } // AI selected a colorId that does not resolve -- should not happen (the response validator only accepts ids from the request's own palette), but is handled, not assumed impossible
  | { kind: 'no-replacement'; status: Exclude<AiPaletteSelectionResult['status'], 'selected'> }

export function resolvePaletteSelectionResult(result: AiPaletteSelectionResult, subtype: Subtype): PaletteFallbackOutcome {
  if (result.status !== 'selected') return { kind: 'no-replacement', status: result.status }
  const resolution = resolveAiFallbackSelection({ subtype, colorId: result.colorId })
  return resolution.ok ? { kind: 'result', resolution } : { kind: 'unresolved', reason: resolution.reason }
}
