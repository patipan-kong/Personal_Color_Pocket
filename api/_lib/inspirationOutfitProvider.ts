import type { AiErrorKind } from '../../src/domain/ai/providerCatalog.js'
import { validateInspirationOutfitRecommendation } from '../../src/domain/todayOutfitProduction/inspirationContract.js'
import type { InspirationOutfitRecommendation, InspirationOutfitRequest } from '../../src/domain/todayOutfitProduction/inspirationContract.js'
import { getKey } from './env.js'
import { OWNED_OUTFIT_PROVIDER as TODAY_OUTFIT_PROVIDER } from './ownedOutfitConfig.js'
import { buildInspirationOutfitPrompt } from './inspirationOutfitPrompt.js'

export { TODAY_OUTFIT_PROVIDER }

export type InspirationOutfitProviderOutcome =
  | { readonly ok: true; readonly result: InspirationOutfitRecommendation }
  | { readonly ok: false; readonly error: { readonly kind: AiErrorKind; readonly message: string; readonly httpStatus: number | null }; readonly issues?: readonly string[] }

const messages: Record<AiErrorKind, string> = {
  'not-configured': 'The recommendation service is not configured.', unsupported: 'The recommendation service is unavailable.',
  auth: 'The recommendation service could not authenticate.', 'rate-limited': 'The recommendation service is busy.',
  'bad-request': 'The recommendation service rejected the request.', 'provider-error': 'The recommendation service returned an error.',
  timeout: 'The recommendation took too long.', 'malformed-response': 'The recommendation response was invalid.',
  network: 'The recommendation service could not be reached.', internal: 'The recommendation could not be completed.',
}
const failure = (kind: AiErrorKind, httpStatus: number | null = null, issues?: readonly string[]): InspirationOutfitProviderOutcome => ({ ok: false, error: { kind, message: messages[kind], httpStatus }, ...(issues ? { issues } : {}) })
const classify = (status: number): AiErrorKind => status === 401 || status === 403 ? 'auth' : status === 429 ? 'rate-limited' : [400, 404, 422].includes(status) ? 'bad-request' : 'provider-error'
const parseJsonObject = (text: string): unknown => { try { return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) } catch { return null } }

export async function runInspirationOutfitProvider(input: InspirationOutfitRequest, signal: AbortSignal): Promise<InspirationOutfitProviderOutcome> {
  let response: Response
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getKey('groq')}` },
      body: JSON.stringify({ model: TODAY_OUTFIT_PROVIDER.model, messages: [{ role: 'user', content: buildInspirationOutfitPrompt(input) }], response_format: { type: 'json_object' } }),
    })
  } catch (error) { return failure(error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network') }
  if (!response.ok) return failure(classify(response.status), response.status)
  const envelope = await response.json().catch(() => null) as { choices?: { message?: { content?: string } }[] } | null
  const text = envelope?.choices?.[0]?.message?.content
  if (typeof text !== 'string') return failure('malformed-response')
  const validated = validateInspirationOutfitRecommendation(parseJsonObject(text), input)
  if (!validated.ok || !validated.value) return failure('malformed-response', null, validated.issues)
  return { ok: true, result: validated.value }
}
