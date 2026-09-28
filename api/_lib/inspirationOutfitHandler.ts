import type { IncomingMessage, ServerResponse } from 'node:http'
import { validateInspirationOutfitRequest } from '../../src/domain/todayOutfitProduction/inspirationContract.js'
import { hasKey } from './env.js'
import { BodyTooLargeError, InvalidJsonError, readJsonBody, sendJson } from './http.js'
import { runInspirationOutfitProvider } from './inspirationOutfitProvider.js'
import { PROVIDER_TIMEOUT_MS, withTimeout } from './timeout.js'

const requestError = (message: string) => ({ ok: false, error: { kind: 'bad-request', message } })

export async function handleInspirationOutfitRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, requestError('POST required.'))
  let body: unknown
  try { body = await readJsonBody(req) }
  catch (error) {
    if (error instanceof BodyTooLargeError) return sendJson(res, 413, requestError('Request body too large.'))
    if (error instanceof InvalidJsonError) return sendJson(res, 400, requestError('Invalid JSON body.'))
    return sendJson(res, 400, requestError('Could not read request body.'))
  }
  const validated = validateInspirationOutfitRequest(body)
  if (!validated.ok || !validated.value) return sendJson(res, 400, requestError('Request payload did not match the inspiration outfit contract.'))
  if (!hasKey('groq')) return sendJson(res, 200, { ok: false, error: { kind: 'not-configured', message: 'The recommendation service is not configured.' } })
  const guard = withTimeout(undefined, PROVIDER_TIMEOUT_MS)
  try {
    const outcome = await runInspirationOutfitProvider(validated.value, guard.signal)
    return sendJson(res, 200, outcome.ok ? { ok: true, result: outcome.result } : { ok: false, error: outcome.error })
  } catch {
    return sendJson(res, 200, { ok: false, error: { kind: guard.didTimeout() ? 'timeout' : 'internal', message: guard.didTimeout() ? 'The recommendation took too long.' : 'The recommendation could not be completed.' } })
  } finally { guard.cleanup() }
}
