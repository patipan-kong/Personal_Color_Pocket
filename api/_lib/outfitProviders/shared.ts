import type { AiErrorKind, AiProviderId, AiUsage } from '../../../src/domain/ai/providerCatalog.js'
import type { OutfitProviderOutcome } from '../../../src/domain/todayOutfit/provider.js'
import type { TodayOutfitInput } from '../../../src/domain/todayOutfit/contract.js'
import { validateOutfitRecommendation } from '../../../src/domain/todayOutfit/contract.js'
import { extractJsonObject } from '../validate.js'

export type OutfitAdapterResult = Omit<Extract<OutfitProviderOutcome, { ok: true }>, 'latencyMs'> | Omit<Extract<OutfitProviderOutcome, { ok: false }>, 'latencyMs'>

export function classifyHttpStatus(status: number): AiErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate-limited'
  if ([400, 402, 404, 422].includes(status)) return 'bad-request'
  return 'provider-error'
}

export function safeErrorMessage(kind: AiErrorKind): string {
  const messages: Record<AiErrorKind, string> = {
    'not-configured': 'API key not configured locally.', unsupported: 'This candidate is not available.', auth: 'The provider could not authenticate this request.',
    'rate-limited': 'The provider rate-limited this request.', 'bad-request': 'The provider rejected the request.', 'provider-error': 'The provider returned a server error.',
    timeout: 'The request timed out.', 'malformed-response': 'The provider response violated the outfit contract.', network: 'The request could not reach the provider.', internal: 'An unexpected server error occurred.',
  }
  return messages[kind]
}

export function errorResult(kind: AiErrorKind, httpStatus: number | null = null, issues?: readonly string[]): OutfitAdapterResult {
  return { ok: false, error: { kind, httpStatus, message: safeErrorMessage(kind) }, ...(issues ? { validation: { valid: false, issues } } : {}) }
}

export function resultFromText(_provider: AiProviderId, _model: string, text: string, usage: AiUsage | null, input: TodayOutfitInput): OutfitAdapterResult {
  const parsed = extractJsonObject(text)
  if (parsed === null) return errorResult('malformed-response', null, ['response did not contain a JSON object'])
  const validated = validateOutfitRecommendation(parsed, input)
  if (!validated.ok || !validated.value) return errorResult('malformed-response', null, validated.issues)
  return { ok: true, result: validated.value, usage, validation: { valid: true, issues: [] } }
}

export const numberOrNull = (value: number | undefined): number | null => typeof value === 'number' ? value : null
