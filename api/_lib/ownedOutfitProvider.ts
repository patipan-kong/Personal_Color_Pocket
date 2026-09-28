import type { AiErrorKind } from '../../src/domain/ai/providerCatalog.js'
import type { OwnedOutfitRecommendation, OwnedOutfitRequest } from '../../src/domain/todayOutfitProduction/contract.js'
import { validateOwnedOutfitRecommendation } from '../../src/domain/todayOutfitProduction/contract.js'
import { getKey } from './env.js'
import { OWNED_OUTFIT_PROVIDER } from './ownedOutfitConfig.js'
import { buildOwnedOutfitPrompt } from './ownedOutfitPrompt.js'

export { OWNED_OUTFIT_PROVIDER } from './ownedOutfitConfig.js'

export type OwnedOutfitProviderOutcome =
  | { readonly ok: true; readonly result: OwnedOutfitRecommendation }
  | { readonly ok: false; readonly error: { readonly kind: AiErrorKind; readonly message: string; readonly httpStatus: number | null }; readonly issues?: readonly string[] }

const safeMessage = (kind: AiErrorKind): string => ({
  'not-configured': 'The recommendation service is not configured.', unsupported: 'The recommendation service is unavailable.',
  auth: 'The recommendation service could not authenticate.', 'rate-limited': 'The recommendation service is busy.',
  'bad-request': 'The recommendation service rejected the request.', 'provider-error': 'The recommendation service returned an error.',
  timeout: 'The recommendation took too long.', 'malformed-response': 'The recommendation response was invalid.',
  network: 'The recommendation service could not be reached.', internal: 'The recommendation could not be completed.',
})[kind]

const failure = (kind: AiErrorKind, httpStatus: number | null = null, issues?: readonly string[]): OwnedOutfitProviderOutcome => ({
  ok: false, error: { kind, message: safeMessage(kind), httpStatus }, ...(issues ? { issues } : {}),
})

function classify(status: number): AiErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate-limited'
  if ([400, 404, 422].includes(status)) return 'bad-request'
  return 'provider-error'
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return JSON.parse(trimmed) } catch { return null }
}

export async function runOwnedOutfitProvider(input: OwnedOutfitRequest, signal: AbortSignal): Promise<OwnedOutfitProviderOutcome> {
  let response: Response
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getKey('groq')}` },
      body: JSON.stringify({
        model: OWNED_OUTFIT_PROVIDER.model,
        messages: [{ role: 'user', content: buildOwnedOutfitPrompt(input) }],
        response_format: { type: 'json_object' },
      }),
    })
  } catch (error) {
    return failure(error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network')
  }
  if (!response.ok) return failure(classify(response.status), response.status)
  const envelope = await response.json().catch(() => null) as { choices?: { message?: { content?: string } }[] } | null
  const text = envelope?.choices?.[0]?.message?.content
  if (typeof text !== 'string') return failure('malformed-response')
  const validated = validateOwnedOutfitRecommendation(parseJsonObject(text), input)
  if (!validated.ok || !validated.value) return failure('malformed-response', null, validated.issues)
  return { ok: true, result: validated.value }
}
