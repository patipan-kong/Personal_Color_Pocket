import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AiCandidateId, AiProviderId, AiProviderOutcome } from '../../src/domain/aiColorLab/contract'
import { AI_CANDIDATES } from '../../src/domain/aiColorLab/contract'
import { hasKey } from './env'
import { BodyTooLargeError, InvalidJsonError, readJsonBody, sendJson } from './http'
import * as gemini from './providers/gemini'
import * as groq from './providers/groq'
import * as openai from './providers/openai'
import { safeErrorMessage } from './providers/shared'
import { PROVIDER_TIMEOUT_MS, withTimeout } from './timeout'
import { validateAnalysisRequest } from './validateRequest'

// The one shared request handler behind every candidate route (plan §4, §6, §29). Both the Vite
// dev middleware (api/devServer.ts) and the Vercel-style function files (api/ai-color/*.ts) call
// this with the same (IncomingMessage, ServerResponse) pair -- there is exactly one
// implementation of "call one candidate safely," reused everywhere.
// (Slice 0.1: DeepSeek's adapter was removed here after failing structured-output validation
// live -- see docs/V2_AI_COLOR_LAB.md §15. Slice 0.2 (plan §4) split "provider" into "provider +
// model candidate": routing is now keyed by AiCandidateId, resolved to a {provider, model} pair
// via AI_CANDIDATES, so one adapter (gemini) can serve two independently isolated candidates.)

const ADAPTERS: Record<AiProviderId, { runProvider: (request: Parameters<typeof gemini.runProvider>[0], signal: AbortSignal, model: string) => ReturnType<typeof gemini.runProvider> }> = {
  gemini, openai, groq,
}

// Always resolves -- this function's job is to turn ANY failure (missing key, network error,
// timeout, thrown exception, malformed JSON) into a well-formed AiProviderOutcome, never to
// reject or crash the request (plan §6: no candidate failure may take down another; the
// not-crashing half of that lives here, one candidate at a time).
async function runProviderSafely(candidateId: AiCandidateId, request: Parameters<typeof gemini.runProvider>[0], parentSignal: AbortSignal | undefined): Promise<AiProviderOutcome> {
  const start = Date.now()
  const { provider, model } = AI_CANDIDATES[candidateId]
  if (!hasKey(provider)) {
    return { ok: false, latencyMs: Date.now() - start, error: { kind: 'not-configured', httpStatus: null, message: safeErrorMessage('not-configured') } }
  }
  const guard = withTimeout(parentSignal, PROVIDER_TIMEOUT_MS)
  try {
    const outcome = await ADAPTERS[provider].runProvider(request, guard.signal, model)
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

export async function handleAiColorRequest(candidateId: AiCandidateId, req: IncomingMessage, res: ServerResponse) {
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
  const outcome = await runProviderSafely(candidateId, request, undefined)
  // Always 200: this endpoint is already scoped to ONE candidate, so isolation comes from there
  // being one separate route per candidate, not from HTTP status juggling -- the client always
  // gets a well-formed ok/error envelope to render (plan §6).
  sendJson(res, 200, outcome)
}
