import { isPreviewImageMimeType, OUTFIT_PREVIEW_ERROR_KINDS, validateOutfitPreviewInput } from '../domain/todayOutfitProduction/previewContract'
import type { OutfitPreviewApiResponse, OutfitPreviewInput } from '../domain/todayOutfitProduction/previewContract'

const plain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const exact = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).every((field) => fields.includes(field)) && fields.every((field) => field in value)
const safeFailure = (): OutfitPreviewApiResponse => ({ ok: false, error: { kind: 'network', message: 'The preview service is unavailable.' } })

function parseResponse(value: unknown): OutfitPreviewApiResponse | null {
  if (!plain(value)) return null
  if (value.ok === true) {
    if (!exact(value, ['ok', 'result']) || !plain(value.result) || !exact(value.result, ['mimeType', 'imageDataUrl'])) return null
    if (!isPreviewImageMimeType(value.result.mimeType) || typeof value.result.imageDataUrl !== 'string' || !value.result.imageDataUrl.startsWith(`data:${value.result.mimeType};base64,`)) return null
    const base64 = value.result.imageDataUrl.slice(`data:${value.result.mimeType};base64,`.length)
    if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null
    return value as unknown as OutfitPreviewApiResponse
  }
  if (value.ok === false) {
    if (!exact(value, ['ok', 'error']) || !plain(value.error) || !exact(value.error, ['kind', 'message'])) return null
    if (typeof value.error.kind !== 'string' || !OUTFIT_PREVIEW_ERROR_KINDS.includes(value.error.kind as typeof OUTFIT_PREVIEW_ERROR_KINDS[number]) || typeof value.error.message !== 'string') return null
    return value as unknown as OutfitPreviewApiResponse
  }
  return null
}

export async function requestOutfitPreview(input: OutfitPreviewInput, signal?: AbortSignal): Promise<OutfitPreviewApiResponse> {
  const validated = validateOutfitPreviewInput(input)
  if (!validated.ok || !validated.value) return { ok: false, error: { kind: 'bad-request', message: 'The preview request is invalid.' } }
  try {
    const response = await fetch('/api/today-outfit/preview', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validated.value),
    })
    const parsed = parseResponse(await response.json().catch(() => null))
    return response.ok && parsed ? parsed : safeFailure()
  } catch {
    return safeFailure()
  }
}
