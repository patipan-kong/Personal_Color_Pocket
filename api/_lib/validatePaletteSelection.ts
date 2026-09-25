import { PALETTE_SELECTION_STATUSES } from '../../src/domain/aiColorLab/paletteContract'
import type { AiPaletteSelectionResult, AiPaletteSelectionTarget } from '../../src/domain/aiColorLab/paletteContract'

// Server-only (mirrors api/_lib/validate.ts's philosophy): turns an untrusted, already-JSON-
// parsed provider payload into an AiPaletteSelectionResult. Every field must be an exact,
// structurally valid member of the closed contract; anything else fails the whole response
// rather than being guessed at (plan §15 precedent, applied to the new task).

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isNonEmptyString = (value: unknown, maxLength: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength

const LABEL_MAX = 80
const PHRASE_MAX = 240
const REASONING_MAX = 1200

// Returns: a valid target object, `null` (explicitly no target), or `undefined` (present but
// malformed -- the caller must reject the whole response, never silently drop just this field).
function parseTarget(value: unknown): AiPaletteSelectionTarget | null | undefined {
  if (value === null || value === undefined) return null
  if (!isRecord(value)) return undefined
  if (!isNonEmptyString(value.objectType, LABEL_MAX)) return undefined
  if (!isNonEmptyString(value.objectDescription, PHRASE_MAX)) return undefined
  return { objectType: value.objectType.trim(), objectDescription: value.objectDescription.trim() }
}

// `validColorIds` is the exact set of colorIds THIS request actually offered (plan §S: "test
// rejection of ... invented colorId") -- an id the model invents, or one belonging to some other
// request, is rejected here rather than trusted through to the resolver.
export function validatePaletteSelectionOutput(json: unknown, validColorIds: ReadonlySet<string>): AiPaletteSelectionResult | null {
  if (!isRecord(json)) return null
  const { status, colorId, target, reasoning } = json
  if (typeof status !== 'string' || !(PALETTE_SELECTION_STATUSES as readonly string[]).includes(status)) return null
  if (!isNonEmptyString(reasoning, REASONING_MAX)) return null
  const trimmedReasoning = reasoning.trim()

  if (status === 'selected') {
    if (typeof colorId !== 'string' || !validColorIds.has(colorId)) return null
    const parsedTarget = parseTarget(target)
    if (!parsedTarget) return null // 'selected' requires a real target description
    return { status: 'selected', colorId, target: parsedTarget, reasoning: trimmedReasoning }
  }

  // Every non-selected status is structurally forbidden from carrying a colorId (plan §S: "non-
  // selected state carrying a colorId" must be rejected, not silently stripped of the id).
  if (colorId !== null && colorId !== undefined) return null
  const parsedTarget = parseTarget(target)
  if (parsedTarget === undefined) return null
  return { status, target: parsedTarget, reasoning: trimmedReasoning } as AiPaletteSelectionResult
}
