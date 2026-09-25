import { pairingSuggestions } from '../personalColor/colorMatch'
import { getPalette } from '../personalColor/palettes'
import type { PaletteColor, Subtype } from '../personalColor/types'
import { getSuitability } from './suitability'
import type { Suitability } from './suitability'
import type { PhotoMatchCategory, PositivePaletteGroup } from './types'

// V2.0 Slice 0.5B (spike, plan §N): the smallest pure contract proving Option 2 (AI selects a
// CANONICAL app color; the app's own existing suitability logic owns the verdict) resolves
// cleanly, without a parallel classification system and without fabricating RGB/OKLab. See
// docs/V2_AI_COLOR_LAB.md §36 for the full audit: Options 1/3/4 were rejected because the AI
// response contract's free-text perceivedColorName/colorFamily and coarse temperature/value/
// chroma bins have no existing, evidenced mapping into the app's canonical taxonomy (building one
// would mean inventing an uncalibrated lookup table), and the 14-case bakeoff replay shows real
// disagreement in exactly the cases (cream/ivory/beige/white) where such a mapping would matter
// most. Option 2 sidesteps all of that: it does not require AI to describe a color at all, only to
// choose ONE of the ~22 colors the app already shows for the user's own subtype.
//
// This module does NOT change the AI response contract (aiColorLab/contract.ts) or call any
// provider -- `colorId` below is what a FUTURE, narrow prompt revision would need to add to
// NormalizedAiColorResult. Nothing here is wired into the app.

export type ColorResultSource = 'deterministic' | 'ai-fallback'

export type AiFallbackGroup = PositivePaletteGroup | 'harder'

// What a revised AI contract would supply: a canonical color ID chosen from the user's OWN
// subtype's palette (never a freeform name), so resolution never needs fuzzy text matching.
export interface AiFallbackSelection {
  subtype: Subtype
  colorId: string
}

export interface AiFallbackResult {
  source: 'ai-fallback' // literal, never 'deterministic' -- see §K: cannot be silently mixed up
  subtype: Subtype
  color: PaletteColor // hex is the EXISTING canonical color's hex, never fabricated
  group: AiFallbackGroup
  category: PhotoMatchCategory
  suitability: Suitability // produced by the unmodified, existing getSuitability()
  pairWith: PaletteColor[] // produced by the unmodified, existing pairingSuggestions()
}

export type AiFallbackResolution =
  | { ok: true; result: AiFallbackResult }
  | { ok: false; reason: 'unknown-color-id' }

// Selecting a group IS selecting a category: a canonical 'best'/'accents' color is, by
// definition, a distance-0 match to itself, so it reads exactly as matchPhotoColor's own
// categorize() would call it 'near-face' (see photoMatch.ts); 'neutrals' reads 'neutral-base';
// 'harder' reads 'away-from-face' (never 'outside' -- the app never offers an outside-palette
// color as a selectable canonical choice). No distance is computed; none is needed.
function categoryFor(group: AiFallbackGroup): PhotoMatchCategory {
  if (group === 'harder') return 'away-from-face'
  if (group === 'neutrals') return 'neutral-base'
  return 'near-face'
}

const GROUPS: AiFallbackGroup[] = ['best', 'accents', 'neutrals', 'harder']

export function resolveAiFallbackSelection(selection: AiFallbackSelection): AiFallbackResolution {
  const palette = getPalette(selection.subtype)
  for (const group of GROUPS) {
    const color = palette[group].find((candidate) => candidate.id === selection.colorId)
    if (!color) continue
    const category = categoryFor(group)
    return {
      ok: true,
      result: {
        source: 'ai-fallback',
        subtype: selection.subtype,
        color,
        group,
        category,
        suitability: getSuitability(category),
        pairWith: pairingSuggestions(color.hex, selection.subtype),
      },
    }
  }
  return { ok: false, reason: 'unknown-color-id' }
}

// ---- Full attempt outcome (plan §I: a single terminal step, never a retry loop) ----
//
// Deliberately takes only the three facts a gating slice would already have -- whether the
// provider call itself succeeded, whether AI reported a target/sample problem, and (if a future
// prompt revision adds it) which canonical color AI chose -- and resolves ONCE. There is no path
// back into calling AI again from inside this function.

export interface AiFallbackAttemptInput {
  providerOk: boolean
  targetMatched: boolean | 'uncertain'
  sampleUsable: boolean | 'uncertain'
  colorId: string | null
  subtype: Subtype
}

export type AiFallbackTerminalReason = 'provider-failed' | 'target-mismatch' | 'sample-unusable' | 'unknown-color-id'

export type AiFallbackAttemptOutcome =
  | { kind: 'result'; result: AiFallbackResult }
  | { kind: 'terminal'; reason: AiFallbackTerminalReason }

export function attemptAiFallback(input: AiFallbackAttemptInput): AiFallbackAttemptOutcome {
  if (!input.providerOk) return { kind: 'terminal', reason: 'provider-failed' }
  if (input.targetMatched === false) return { kind: 'terminal', reason: 'target-mismatch' }
  if (input.sampleUsable === false) return { kind: 'terminal', reason: 'sample-unusable' }
  if (!input.colorId) return { kind: 'terminal', reason: 'unknown-color-id' }
  const resolution = resolveAiFallbackSelection({ subtype: input.subtype, colorId: input.colorId })
  return resolution.ok ? { kind: 'result', result: resolution.result } : { kind: 'terminal', reason: 'unknown-color-id' }
}
