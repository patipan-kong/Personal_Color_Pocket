import type { AiColorAnalysisRequest, AiColorSubtypeContext } from '../domain/aiColorLab/contract'
import type { PixelSource } from '../domain/photoColor/types'
import type { DeterministicBaseline } from './aiLabDeterministic'
import { encodeImageForAiLab } from './imageEncode'

// Turns the deterministic baseline + subtype context into the SAME payload sent to all four
// providers (plan §11: "All providers must receive semantically equivalent information").
// Returns null when there is no usable sample to send -- callers must not fire a request then.
export function buildAiColorRequest(image: PixelSource, baseline: DeterministicBaseline, subtypeContext: AiColorSubtypeContext | null): AiColorAnalysisRequest | null {
  if (baseline.sample.kind === 'unavailable') return null
  const { sample } = baseline
  return {
    imageDataUrl: encodeImageForAiLab(image),
    sample: {
      hex: sample.hex,
      rgb: sample.rgb,
      oklabL: sample.oklab.l,
      colorName: baseline.colorName?.en ?? null,
      flags: sample.diagnostics.flags,
    },
    subtype: subtypeContext,
  }
}
