import { OUTFIT_IMAGE_CANDIDATES } from '../domain/todayOutfitImage/catalog'
import type { TodayOutfitImageRequest, TodayOutfitImageResult } from '../domain/todayOutfitImage/contract'

export async function callOutfitImageCandidate(request: TodayOutfitImageRequest, signal: AbortSignal): Promise<TodayOutfitImageResult> {
  const startedAt = performance.now()
  const config = OUTFIT_IMAGE_CANDIDATES[request.candidate]
  const failure = (message: string, httpStatus: number | null = null): TodayOutfitImageResult => ({
    status: 'failure', candidate: request.candidate, provider: config.provider, model: config.model, latencyMs: performance.now() - startedAt,
    reason: { kind: 'network', httpStatus, message },
  })
  try {
    const response = await fetch(`/api/ai-outfit-image/${request.candidate}`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
    const result = await response.json().catch(() => null) as TodayOutfitImageResult | null
    if (!result || typeof result !== 'object' || !['success', 'failure'].includes(result.status) || result.candidate !== request.candidate || result.provider !== 'gemini' || typeof result.model !== 'string' || typeof result.latencyMs !== 'number') return failure('Unexpected response from the local image server.', response.status)
    if (result.status === 'success' && (typeof result.imageDataUrl !== 'string' || typeof result.mimeType !== 'string' || !result.imageDataUrl.startsWith(`data:${result.mimeType};base64,`) || !result.mimeType.startsWith('image/'))) return failure('The local image server returned invalid image data.', response.status)
    if (result.status === 'failure' && (!result.reason || typeof result.reason.message !== 'string')) return failure('Unexpected response from the local image server.', response.status)
    return result
  } catch {
    return failure('Could not reach the local image server.')
  }
}
