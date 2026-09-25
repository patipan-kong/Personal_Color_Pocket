import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AiPaletteApiOutcome } from '../../src/domain/aiColorLab/paletteContract'
import { hasKey } from './env'
import { BodyTooLargeError, InvalidJsonError, readJsonBody, sendJson } from './http'
import { runPaletteSelectionProvider } from './providers/geminiPalette'
import { safeErrorMessage } from './providers/shared'
import { PROVIDER_TIMEOUT_MS, withTimeout } from './timeout'
import { validatePaletteSelectionRequest } from './validatePaletteRequest'

// V2.0 Slice 0.5C (plan §L): the ONE route for the canonical-palette-selection task. Unlike
// handler.ts's multi-candidate routing, there is exactly one model exercised here (Gemini
// Flash-Lite), so no candidateId parameter is needed -- mirrors handler.ts's shape otherwise
// (same body-reading, timeout, and always-200-envelope conventions) so the two are easy to read
// side by side, without actually sharing code that would force them to evolve together.
const MODEL = 'gemini-3.5-flash-lite'

export async function handlePaletteSelectionRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'POST required.' } })

  let body: unknown
  try {
    body = await readJsonBody(req)
  } catch (error) {
    if (error instanceof BodyTooLargeError) return sendJson(res, 413, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'Request body too large.' } })
    if (error instanceof InvalidJsonError) return sendJson(res, 400, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'Invalid JSON body.' } })
    return sendJson(res, 400, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'Could not read request body.' } })
  }

  const request = validatePaletteSelectionRequest(body)
  if (!request) return sendJson(res, 400, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'Request payload did not match the expected shape.' } })

  const start = Date.now()
  if (!hasKey('gemini')) {
    return sendJson(res, 200, { ok: false, latencyMs: Date.now() - start, error: { kind: 'not-configured', httpStatus: null, message: safeErrorMessage('not-configured') } })
  }

  const guard = withTimeout(undefined, PROVIDER_TIMEOUT_MS)
  let outcome: AiPaletteApiOutcome
  try {
    const result = await runPaletteSelectionProvider(request, guard.signal, MODEL)
    outcome = { ...result, latencyMs: Date.now() - start } as AiPaletteApiOutcome
  } catch {
    const latencyMs = Date.now() - start
    outcome = guard.didTimeout()
      ? { ok: false, latencyMs, error: { kind: 'timeout', httpStatus: null, message: safeErrorMessage('timeout') } }
      : { ok: false, latencyMs, error: { kind: 'internal', httpStatus: null, message: safeErrorMessage('internal') } }
  } finally {
    guard.cleanup()
  }
  // Always 200, same rationale as handler.ts (plan §6): one well-formed envelope to render.
  sendJson(res, 200, outcome)
}
