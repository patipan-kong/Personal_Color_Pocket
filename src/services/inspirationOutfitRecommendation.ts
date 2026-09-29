import { validateInspirationOutfitRecommendation } from '../domain/todayOutfitProduction/inspirationContract'
import type { InspirationOutfitRecommendation, InspirationOutfitRequest } from '../domain/todayOutfitProduction/inspirationContract'

export type InspirationOutfitApiOutcome =
  | { readonly ok: true; readonly result: InspirationOutfitRecommendation }
  | { readonly ok: false; readonly error: { readonly kind: string; readonly message: string } }

const safeFailure = (): InspirationOutfitApiOutcome => ({ ok: false, error: { kind: 'network', message: 'The recommendation service is unavailable.' } })

export async function requestInspirationOutfitRecommendation(input: InspirationOutfitRequest, signal?: AbortSignal): Promise<InspirationOutfitApiOutcome> {
  try {
    const response = await fetch('/api/today-outfit/inspiration', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !payload || payload.ok !== true) return safeFailure()
    const validated = validateInspirationOutfitRecommendation(payload.result, input)
    return validated.ok && validated.value ? { ok: true, result: validated.value } : safeFailure()
  } catch { return safeFailure() }
}
