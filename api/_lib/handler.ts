import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AiProviderId, AiProviderOutcome } from '../../src/domain/aiColorLab/contract'
import { hasKey } from './env'
import { BodyTooLargeError, InvalidJsonError, readJsonBody, sendJson } from './http'
import * as deepseek from './providers/deepseek'
import * as gemini from './providers/gemini'
import * as groq from './providers/groq'
import * as openai from './providers/openai'
import { safeErrorMessage } from './providers/shared'
import { PROVIDER_TIMEOUT_MS, withTimeout } from './timeout'
import { validateAnalysisRequest } from './validateRequest'

// The one shared request handler behind every provider route (plan §4, §6, §29). Both the Vite
// dev middleware (api/devServer.ts) and the Vercel-style function files (api/ai-color/*.ts) call
// this with the same (IncomingMessage, ServerResponse) pair -- there is exactly one
// implementation of "call one provider safely," reused everywhere.

const ADAPTERS: Record<AiProviderId, { runProvider: (request: Parameters<typeof deepseek.runProvider>[0], signal: AbortSignal) => ReturnType<typeof deepseek.runProvider> }> = {
  gemini, openai, groq, deepseek,
}

// Always resolves -- this function's job is to turn ANY failure (missing key, network error,
// timeout, thrown exception, malformed JSON) into a well-formed AiProviderOutcome, never to
// reject or crash the request (plan §6: no provider failure may take down another; the
// not-crashing half of that lives here, one provider at a time).
async function runProviderSafely(provider: AiProviderId, request: Parameters<typeof deepseek.runProvider>[0], parentSignal: AbortSignal | undefined): Promise<AiProviderOutcome> {
  const start = Date.now()
  if (!hasKey(provider)) {
    return { ok: false, latencyMs: Date.now() - start, error: { kind: 'not-configured', httpStatus: null, message: safeErrorMessage('not-configured') } }
  }
  const guard = withTimeout(parentSignal, PROVIDER_TIMEOUT_MS)
  try {
    const outcome = await ADAPTERS[provider].runProvider(request, guard.signal)
    return { ...outcome, latencyMs: Date.now() - start } as AiProviderOutcome
  } catch (error) {
    const latencyMs = Date.now() - start
    if (guard.didTimeout()) return { ok: false, latencyMs, error: { kind: 'timeout', httpStatus: null, message: safeErrorMessage('timeout') } }
    // Any other thrown error (fetch network failure, unexpected adapter bug, ...) is contained
    // here and reported without ever forwarding its message/stack to the client (plan §16, §20).
    return { ok: false, latencyMs, error: { kind: 'internal', httpStatus: null, message: safeErrorMessage('internal') } }
  } finally {
    guard.cleanup()
  }
}

export async function handleAiColorRequest(provider: AiProviderId, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'POST required.' } })

  let body: unknown
  try {
    body = await readJsonBody(req)
  } catch (error) {
    if (error instanceof BodyTooLargeError) return sendJson(res, 413, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'Request body too large.' } })
    if (error instanceof InvalidJsonError) return sendJson(res, 400, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'Invalid JSON body.' } })
    return sendJson(res, 400, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'Could not read request body.' } })
  }

  const request = validateAnalysisRequest(body)
  if (!request) return sendJson(res, 400, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'Request payload did not match the expected shape.' } })

  // Reserved for a future AbortController tied to the client socket closing; undefined today.
  const outcome = await runProviderSafely(provider, request, undefined)
  // Always 200: this endpoint is already scoped to ONE provider, so isolation comes from there
  // being four separate routes, not from HTTP status juggling -- the client always gets a
  // well-formed ok/error envelope to render (plan §6).
  sendJson(res, 200, outcome)
}
