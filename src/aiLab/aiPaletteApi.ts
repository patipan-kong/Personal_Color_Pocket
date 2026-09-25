import type { AiPaletteApiOutcome, AiPaletteSelectionRequest } from '../domain/aiColorLab/paletteContract'

// V2.0 Slice 0.5C: the client half of the canonical-palette-selection task, mirroring
// aiColorLabApi.ts's callAiColorCandidate exactly (same-origin fetch only, never a provider SDK
// -- plan §29). Only one endpoint exists for this task (plan §L: Gemini Flash-Lite only).
export async function callPaletteSelection(payload: AiPaletteSelectionRequest, signal: AbortSignal): Promise<AiPaletteApiOutcome> {
  const start = performance.now()
  try {
    const response = await fetch('/api/ai-palette/gemini-flash-lite', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await response.json().catch(() => null) as AiPaletteApiOutcome | null
    if (!json || typeof json !== 'object' || !('ok' in json)) {
      return { ok: false, latencyMs: performance.now() - start, error: { kind: 'network', httpStatus: response.status, message: 'Unexpected response from the local server.' } }
    }
    return json
  } catch {
    return { ok: false, latencyMs: performance.now() - start, error: { kind: 'network', httpStatus: null, message: 'Could not reach the local server.' } }
  }
}
