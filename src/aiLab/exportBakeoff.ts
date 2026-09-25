import { AI_CANDIDATES } from '../domain/aiColorLab/contract'
import type { BakeoffRunRecord, PoReview } from './aiLabState'
import { reviewKey } from './aiLabState'
import { estimateCostUsd } from './pricing'

// V2.0 Slice 0.2 (plan §19): exports NON-IMAGE bake-off results only. Deliberately built from a
// narrow, explicit allowlist of fields rather than spreading `outcome` -- `raw` (the provider's
// full response envelope) and `imageDataUrl` are NEVER included, so there is no field a future
// change to the outcome shape could accidentally leak into an exported file (plan §19: "must NOT
// contain photo bytes, base64, API keys, auth headers").
export interface BakeoffExportRun {
  candidateId: string
  provider: string
  model: string
  runId: number
  timestamp: string
  ok: boolean
  result: unknown
  error: unknown
  latencyMs: number
  usage: unknown
  estimatedCostUsd: number | null
  review: PoReview | null
}

export interface BakeoffExport {
  exportedAt: string
  runs: BakeoffExportRun[]
}

export function buildBakeoffExport(history: BakeoffRunRecord[], reviews: Record<string, PoReview>): BakeoffExport {
  return {
    exportedAt: new Date().toISOString(),
    runs: history.map((record) => {
      const config = AI_CANDIDATES[record.candidateId]
      return {
        candidateId: record.candidateId,
        provider: config.provider,
        model: config.model,
        runId: record.runId,
        timestamp: new Date(record.timestamp).toISOString(),
        ok: record.outcome.ok,
        result: record.outcome.ok ? record.outcome.result : null,
        error: record.outcome.ok ? null : record.outcome.error,
        latencyMs: record.outcome.latencyMs,
        usage: record.outcome.ok ? record.outcome.usage : null,
        estimatedCostUsd: record.outcome.ok ? estimateCostUsd(record.candidateId, record.outcome.usage) : null,
        review: reviews[reviewKey(record.candidateId, record.runId)] ?? null,
      }
    }),
  }
}

export function downloadBakeoffExport(history: BakeoffRunRecord[], reviews: Record<string, PoReview>): void {
  const data = buildBakeoffExport(history, reviews)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ai-color-bakeoff-${Date.now()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
