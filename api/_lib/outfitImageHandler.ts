import type { IncomingMessage, ServerResponse } from 'node:http'
import { hasKey } from './env.js'
import { BodyTooLargeError, InvalidJsonError, readJsonBody, sendJson } from './http.js'
import { runOutfitImageProvider } from './outfitImageProvider.js'
import { safeErrorMessage } from './outfitProviders/shared.js'
import { withTimeout } from './timeout.js'
import { OUTFIT_IMAGE_CANDIDATES } from '../../src/domain/todayOutfitImage/catalog.js'
import type { OutfitImageCandidateId } from '../../src/domain/todayOutfitImage/catalog.js'
import { validateTodayOutfitImageRequest } from '../../src/domain/todayOutfitImage/contract.js'
import type { TodayOutfitImageRequest, TodayOutfitImageResult } from '../../src/domain/todayOutfitImage/contract.js'

const IMAGE_PROVIDER_TIMEOUT_MS = 60_000

function requestFailure(candidate: OutfitImageCandidateId, message: string): TodayOutfitImageResult {
  const config = OUTFIT_IMAGE_CANDIDATES[candidate]
  return { status: 'failure', candidate, provider: config.provider, model: config.model, latencyMs: 0, reason: { kind: 'bad-request', httpStatus: null, message } }
}

async function runSafely(candidate: OutfitImageCandidateId, request: TodayOutfitImageRequest): Promise<TodayOutfitImageResult> {
  const startedAt = Date.now()
  const config = OUTFIT_IMAGE_CANDIDATES[candidate]
  const failure = (kind: Parameters<typeof safeErrorMessage>[0], httpStatus: number | null = null): TodayOutfitImageResult => ({
    status: 'failure', candidate, provider: config.provider, model: config.model, latencyMs: Date.now() - startedAt,
    reason: { kind, httpStatus, message: safeErrorMessage(kind) },
  })
  if (!hasKey(config.provider)) return failure('not-configured')
  const guard = withTimeout(undefined, IMAGE_PROVIDER_TIMEOUT_MS)
  try {
    const outcome = await runOutfitImageProvider(request, guard.signal, config.model)
    if (!outcome.ok) return { status: 'failure', candidate, provider: config.provider, model: config.model, latencyMs: Date.now() - startedAt, reason: outcome.error }
    return { status: 'success', candidate, provider: config.provider, model: config.model, mimeType: outcome.mimeType, imageDataUrl: outcome.imageDataUrl, latencyMs: Date.now() - startedAt, usage: outcome.usage }
  } catch {
    return failure(guard.didTimeout() ? 'timeout' : 'internal')
  } finally { guard.cleanup() }
}

export async function handleOutfitImageRequest(candidate: OutfitImageCandidateId, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, requestFailure(candidate, 'POST required.'))
  let body: unknown
  try { body = await readJsonBody(req) }
  catch (error) {
    const message = error instanceof BodyTooLargeError ? 'Request body too large.' : error instanceof InvalidJsonError ? 'Invalid JSON body.' : 'Could not read request body.'
    return sendJson(res, error instanceof BodyTooLargeError ? 413 : 400, requestFailure(candidate, message))
  }
  const validated = validateTodayOutfitImageRequest(body)
  if (!validated.ok || !validated.value) return sendJson(res, 400, requestFailure(candidate, `Request payload did not match the outfit image contract: ${validated.issues.join('; ')}`))
  if (validated.value.candidate !== candidate) return sendJson(res, 400, requestFailure(candidate, 'Route candidate did not match request candidate.'))
  return sendJson(res, 200, await runSafely(candidate, validated.value))
}
