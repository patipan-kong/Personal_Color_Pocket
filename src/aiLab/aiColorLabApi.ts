import type { AiCandidateId, AiColorAnalysisRequest, AiProviderOutcome } from '../domain/aiColorLab/contract'

// V2.0 AI Color Lab (Slice 0; extended Slice 0.2 plan §4): the ONLY place the client talks to
// the server-side boundary. Plain same-origin fetch to our own /api/ai-color/<candidateId>
// route -- never a provider's API directly, and never a provider SDK, so no credential can reach
// the browser (plan §29: "Do not make feature UI import provider SDKs").
export async function callAiColorCandidate(candidateId: AiCandidateId, payload: AiColorAnalysisRequest, signal: AbortSignal): Promise<AiProviderOutcome> {
  const start = performance.now()
  try {
    const response = await fetch(`/api/ai-color/${candidateId}`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await response.json().catch(() => null) as AiProviderOutcome | null
    if (!json || typeof json !== 'object' || !('ok' in json)) {
      return { ok: false, latencyMs: performance.now() - start, error: { kind: 'network', httpStatus: response.status, message: 'Unexpected response from the local server.' } }
    }
    return json
  } catch {
    // Covers both a real network failure and our own AbortController firing (deliberate cancel,
    // e.g. a newer run superseding this one). The caller's runId-keyed reducer (aiLabState.ts)
    // discards a stale completion either way, so this branch does not need to distinguish them.
    return { ok: false, latencyMs: performance.now() - start, error: { kind: 'network', httpStatus: null, message: 'Could not reach the local server.' } }
  }
}
