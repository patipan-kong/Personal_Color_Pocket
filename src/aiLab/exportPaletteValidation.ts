import type { Subtype } from '../domain/personalColor/types'
import { resolvePaletteSelectionResult } from '../domain/photoColor/aiPaletteFallback'
import type { DeterministicBaseline } from './aiLabDeterministic'
import type { PaletteReview, PaletteRunRecord } from './paletteSelectionState'

// V2.0 Slice 0.5C (plan §M, §N): validation export for the canonical-palette-selection task.
// Deliberately mirrors exportBakeoff.ts's narrow-allowlist philosophy (plan §19 precedent) --
// never spreads `outcome`/`raw`, never includes imageDataUrl/base64 image bytes. Slice 0.3C found
// the OLD bakeoff export omitted deterministic sample diagnostics; this export includes them
// (hex, color name, flags only -- never the image) so a human reviewer can see the deterministic
// context the AI was NOT given (Strategy A, plan §D) alongside what AI actually chose.
export interface PaletteValidationExportRun {
  runId: number
  timestamp: string
  subtype: Subtype | null
  deterministic: { hex: string; colorName: string | null; flags: string[] } | null
  ok: boolean
  status: string | null
  selectedColorId: string | null
  selectedName: string | null
  selectedHex: string | null
  resolvedCategory: string | null
  resolvedSuitability: string | null
  reasoning: string | null
  error: unknown
  latencyMs: number
  review: PaletteReview | null
}

export interface PaletteValidationExport {
  exportedAt: string
  runs: PaletteValidationExportRun[]
}

export function buildPaletteValidationExport(
  history: PaletteRunRecord[],
  reviews: Record<number, PaletteReview>,
  subtype: Subtype | null,
  baseline: DeterministicBaseline | null,
): PaletteValidationExport {
  return {
    exportedAt: new Date().toISOString(),
    runs: history.map((record) => {
      const { outcome } = record
      // Resolution reuses the UNMODIFIED Slice 0.5B resolver (aiPaletteFallback.ts) -- category
      // and suitability in this export are never AI's own judgment, only the app's existing logic.
      const resolved = outcome.ok && subtype ? resolvePaletteSelectionResult(outcome.result, subtype) : null
      const selected = resolved?.kind === 'result' ? resolved.resolution.result : null
      return {
        runId: record.runId,
        timestamp: new Date(record.timestamp).toISOString(),
        subtype,
        deterministic: baseline && baseline.sample.kind === 'color'
          ? { hex: baseline.sample.hex, colorName: baseline.colorName?.en ?? null, flags: baseline.sample.diagnostics.flags }
          : null,
        ok: outcome.ok,
        status: outcome.ok ? outcome.result.status : null,
        selectedColorId: selected?.color.id ?? null,
        selectedName: selected?.color.name ?? null,
        selectedHex: selected?.color.hex ?? null,
        resolvedCategory: selected?.category ?? null,
        resolvedSuitability: selected?.suitability ?? null,
        reasoning: outcome.ok ? outcome.result.reasoning : null,
        error: outcome.ok ? null : outcome.error,
        latencyMs: outcome.latencyMs,
        review: reviews[record.runId] ?? null,
      }
    }),
  }
}

export function downloadPaletteValidationExport(
  history: PaletteRunRecord[],
  reviews: Record<number, PaletteReview>,
  subtype: Subtype | null,
  baseline: DeterministicBaseline | null,
): void {
  const data = buildPaletteValidationExport(history, reviews, subtype, baseline)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ai-palette-validation-${Date.now()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
