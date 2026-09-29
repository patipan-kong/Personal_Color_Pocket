import type { AiCandidateId } from '../domain/ai/providerCatalog'
import type { TodayOutfitInput } from '../domain/todayOutfit/contract'
import type { OutfitProviderOutcome } from '../domain/todayOutfit/provider'

export async function callOutfitCandidate(candidateId: AiCandidateId, input: TodayOutfitInput, signal: AbortSignal): Promise<OutfitProviderOutcome> {
  const start = performance.now()
  try {
    const response = await fetch(`/api/ai-outfit/${candidateId}`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    const json = await response.json().catch(() => null) as OutfitProviderOutcome | null
    if (!json || typeof json !== 'object' || !('ok' in json)) return { ok: false, latencyMs: performance.now() - start, error: { kind: 'network', httpStatus: response.status, message: 'Unexpected response from the local server.' } }
    return json
  } catch {
    return { ok: false, latencyMs: performance.now() - start, error: { kind: 'network', httpStatus: null, message: 'Could not reach the local server.' } }
  }
}
