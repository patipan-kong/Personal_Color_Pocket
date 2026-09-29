import { validateOwnedOutfitRecommendation } from '../domain/todayOutfitProduction/contract'
import type { OwnedOutfitRecommendation, OwnedOutfitRequest } from '../domain/todayOutfitProduction/contract'

export type OwnedOutfitApiOutcome =
  | { readonly ok: true; readonly result: OwnedOutfitRecommendation }
  | { readonly ok: false; readonly error: { readonly kind: string; readonly message: string } }

const safeFailure = (): OwnedOutfitApiOutcome => ({ ok: false, error: { kind: 'network', message: 'The recommendation service is unavailable.' } })

export async function requestOwnedOutfitRecommendation(input: OwnedOutfitRequest, signal?: AbortSignal): Promise<OwnedOutfitApiOutcome> {
  try {
    const response = await fetch('/api/today-outfit/wardrobe', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !payload || payload.ok !== true) return safeFailure()
    const validated = validateOwnedOutfitRecommendation(payload.result, input)
    return validated.ok && validated.value ? { ok: true, result: validated.value } : safeFailure()
  } catch {
    return safeFailure()
  }
}
