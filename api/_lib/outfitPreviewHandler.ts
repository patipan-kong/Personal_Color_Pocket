import type { IncomingMessage, ServerResponse } from 'node:http'
import { performance } from 'node:perf_hooks'
import type { OutfitPreviewInput } from '../../src/domain/todayOutfitProduction/previewContract.js'
import { validateOutfitPreviewInput } from '../../src/domain/todayOutfitProduction/previewContract.js'
import { hasKey } from './env.js'
import { BodyTooLargeError, InvalidJsonError, readJsonBody, sendJson } from './http.js'
import { OUTFIT_PREVIEW_TIMEOUT_MS } from './outfitPreviewConfig.js'
import { runOutfitPreviewProvider } from './outfitPreviewProvider.js'
import type { OutfitPreviewProviderOutcome } from './outfitPreviewProvider.js'
import { withTimeout } from './timeout.js'

const failure = (kind: string, message: string) => ({ ok: false, error: { kind, message } })
const PREVIEW_TIMEOUT = 'preview-timeout' as const

export const PREVIEW_TRACE_EVENTS = [
  'route-accepted',
  'handler-entered',
  'deadline-created',
  'provider-invocation-started',
  'deadline-fired',
  'abort-requested',
  'caller-aborted',
  'caller-closed',
  'race-settled',
  'send-json-started',
  'response-finished',
  'response-closed',
] as const

export type PreviewTraceEventName = typeof PREVIEW_TRACE_EVENTS[number]

export interface PreviewTraceEvent {
  readonly name: PreviewTraceEventName
  readonly requestId: string
  readonly elapsedMs: number
}

export type OutfitPreviewTrace = (event: PreviewTraceEvent) => void
export type OutfitPreviewProvider = (input: OutfitPreviewInput, signal: AbortSignal) => Promise<OutfitPreviewProviderOutcome>

export interface PreviewTraceContext {
  readonly requestId: string
  emit(name: PreviewTraceEventName): void
}

export interface OutfitPreviewHandlerOptions {
  // Server-side test/dev harness seams; none of these values are accepted from the client body.
  readonly provider?: OutfitPreviewProvider
  readonly timeoutMs?: number
  readonly trace?: OutfitPreviewTrace
  readonly traceContext?: PreviewTraceContext
}

let nextTraceId = 0

export function createPreviewTraceContext(trace: OutfitPreviewTrace): PreviewTraceContext {
  const requestId = `preview-${++nextTraceId}`
  const startedAt = performance.now()
  return {
    requestId,
    emit(name) {
      try {
        trace({ name, requestId, elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)) })
      } catch {
        // Diagnostics must never affect request handling.
      }
    },
  }
}

export async function handleOutfitPreviewRequest(req: IncomingMessage, res: ServerResponse, options: OutfitPreviewHandlerOptions = {}) {
  const traceContext = options.traceContext ?? (options.trace ? createPreviewTraceContext(options.trace) : undefined)
  const emit = (name: PreviewTraceEventName) => traceContext?.emit(name)
  const send = (statusCode: number, body: unknown) => {
    emit('send-json-started')
    return sendJson(res, statusCode, body)
  }

  emit('handler-entered')
  if (typeof req.once === 'function') {
    req.once('aborted', () => emit('caller-aborted'))
    req.once('close', () => emit('caller-closed'))
  }
  if (typeof res.once === 'function') {
    res.once('finish', () => emit('response-finished'))
    res.once('close', () => emit('response-closed'))
  }

  if (req.method !== 'POST') return send(405, failure('bad-request', 'POST required.'))
  let body: unknown
  try { body = await readJsonBody(req) }
  catch (error) {
    if (error instanceof BodyTooLargeError) return send(413, failure('bad-request', 'Request body too large.'))
    if (error instanceof InvalidJsonError) return send(400, failure('bad-request', 'Invalid JSON body.'))
    return send(400, failure('bad-request', 'Could not read request body.'))
  }
  const validated = validateOutfitPreviewInput(body)
  if (!validated.ok || !validated.value) return send(400, failure('bad-request', 'Request payload did not match the outfit preview contract.'))
  if (!hasKey('gemini')) return send(200, failure('not-configured', 'The preview service is not configured.'))

  const guard = withTimeout(undefined, options.timeoutMs ?? OUTFIT_PREVIEW_TIMEOUT_MS)
  emit('deadline-created')
  const onAbort = () => emit(guard.didTimeout() ? 'abort-requested' : 'caller-aborted')
  guard.signal.addEventListener('abort', onAbort, { once: true })
  void guard.deadline.then(() => emit('deadline-fired'))
  let raceSettled = false
  const markRaceSettled = () => {
    if (raceSettled) return
    raceSettled = true
    emit('race-settled')
  }

  try {
    // The signal requests transport cancellation, but a provider implementation is not required
    // to settle when it observes abort. Race the provider against the application-owned deadline
    // so this handler always returns its normalized timeout envelope on time. Promise.race keeps a
    // rejection handler attached to late provider work, so an abort-related late rejection cannot
    // become unhandled or attempt a second response.
    emit('provider-invocation-started')
    const providerPromise = (options.provider ?? runOutfitPreviewProvider)(validated.value, guard.signal)
    const outcome = await Promise.race([
      providerPromise,
      guard.deadline.then(() => PREVIEW_TIMEOUT),
    ])
    markRaceSettled()
    if (outcome === PREVIEW_TIMEOUT) return send(200, failure('timeout', 'The preview took too long.'))
    return send(200, outcome.ok
      ? { ok: true, result: { mimeType: outcome.mimeType, imageDataUrl: outcome.imageDataUrl } }
      : { ok: false, error: outcome.error })
  } catch {
    markRaceSettled()
    return send(200, failure(guard.didTimeout() ? 'timeout' : 'internal', guard.didTimeout() ? 'The preview took too long.' : 'The preview could not be completed.'))
  } finally {
    guard.signal.removeEventListener('abort', onAbort)
    guard.cleanup()
  }
}
