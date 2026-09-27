import type { IncomingMessage, ServerResponse } from 'node:http'
import { AI_CANDIDATES } from '../../src/domain/ai/providerCatalog.js'
import type { AiCandidateId, AiProviderId } from '../../src/domain/ai/providerCatalog.js'
import type { TodayOutfitInput } from '../../src/domain/todayOutfit/contract.js'
import type { OutfitProviderOutcome } from '../../src/domain/todayOutfit/provider.js'
import { validateTodayOutfitInput } from '../../src/domain/todayOutfit/contract.js'
import { hasKey } from './env.js'
import { BodyTooLargeError, InvalidJsonError, readJsonBody, sendJson } from './http.js'
import * as gemini from './outfitProviders/gemini.js'
import * as groq from './outfitProviders/groq.js'
import * as openai from './outfitProviders/openai.js'
import { safeErrorMessage } from './outfitProviders/shared.js'
import { PROVIDER_TIMEOUT_MS, withTimeout } from './timeout.js'

type Adapter = { runOutfitProvider: (input: TodayOutfitInput, signal: AbortSignal, model: string) => Promise<Omit<OutfitProviderOutcome, 'latencyMs'>> }
const ADAPTERS: Record<AiProviderId, Adapter> = { gemini, openai, groq }

async function runSafely(candidateId: AiCandidateId, input: TodayOutfitInput): Promise<OutfitProviderOutcome> {
  const start = Date.now()
  const { provider, model } = AI_CANDIDATES[candidateId]
  if (!hasKey(provider)) return { ok: false, latencyMs: Date.now() - start, error: { kind: 'not-configured', httpStatus: null, message: safeErrorMessage('not-configured') } }
  const guard = withTimeout(undefined, PROVIDER_TIMEOUT_MS)
  try {
    const outcome = await ADAPTERS[provider].runOutfitProvider(input, guard.signal, model)
    return { ...outcome, latencyMs: Date.now() - start } as OutfitProviderOutcome
  } catch {
    const kind = guard.didTimeout() ? 'timeout' : 'internal'
    return { ok: false, latencyMs: Date.now() - start, error: { kind, httpStatus: null, message: safeErrorMessage(kind) } }
  } finally { guard.cleanup() }
}

export async function handleAiOutfitRequest(candidateId: AiCandidateId, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'POST required.' } })
  let body: unknown
  try { body = await readJsonBody(req) }
  catch (error) {
    if (error instanceof BodyTooLargeError) return sendJson(res, 413, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'Request body too large.' } })
    if (error instanceof InvalidJsonError) return sendJson(res, 400, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'Invalid JSON body.' } })
    return sendJson(res, 400, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'Could not read request body.' } })
  }
  const validated = validateTodayOutfitInput(body)
  if (!validated.ok || !validated.value) return sendJson(res, 400, { ok: false, error: { kind: 'bad-request', httpStatus: null, message: 'Request payload did not match the outfit contract.' }, validation: { valid: false, issues: validated.issues } })
  sendJson(res, 200, await runSafely(candidateId, validated.value))
}
