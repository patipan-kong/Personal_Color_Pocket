import type { AiErrorKind, AiUsage } from '../../src/domain/ai/providerCatalog.js'
import { getKey } from './env.js'

const SUPPORTED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export type GeminiImageMimeType = typeof SUPPORTED_IMAGE_MIME_TYPES[number]
export const GEMINI_IMAGE_ASPECT_RATIO = 'ASPECT_RATIO_ONE_BY_ONE' as const
export const GEMINI_IMAGE_SIZE = 'IMAGE_SIZE_ONE_K' as const
export const GEMINI_IMAGE_GENERATION_CONFIG = Object.freeze({
  responseModalities: ['IMAGE'] as const,
  responseFormat: { image: { aspectRatio: GEMINI_IMAGE_ASPECT_RATIO, imageSize: GEMINI_IMAGE_SIZE } },
})

export type GeminiImageTransportResult = {
  readonly ok: true
  readonly mimeType: GeminiImageMimeType
  readonly imageDataUrl: string
  readonly usage: AiUsage | null
} | {
  readonly ok: false
  readonly error: { readonly kind: AiErrorKind; readonly httpStatus: number | null; readonly message: string }
}

interface GeminiPart {
  readonly text?: unknown
  readonly inlineData?: { readonly mimeType?: unknown; readonly data?: unknown }
  readonly inline_data?: { readonly mime_type?: unknown; readonly data?: unknown }
}

interface GeminiImageResponse {
  readonly candidates?: readonly { readonly content?: { readonly parts?: readonly GeminiPart[] } }[]
  readonly usageMetadata?: { readonly promptTokenCount?: number; readonly candidatesTokenCount?: number; readonly totalTokenCount?: number }
}

interface GeminiErrorEnvelope {
  readonly error?: { readonly code?: unknown; readonly status?: unknown; readonly message?: unknown; readonly details?: unknown }
}

interface SanitizedGeminiErrorDetail {
  readonly type?: string
  readonly reason?: string
  readonly fieldViolations?: readonly { readonly field: string | null; readonly description: string | null }[]
}

function safeString(value: unknown, apiKey: string): string | null {
  if (typeof value !== 'string') return null
  return value
    .slice(0, 2_000)
    .split(apiKey).join('[REDACTED]')
    .replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, '[REDACTED IMAGE DATA]')
    .replace(/[A-Za-z0-9+/]{128,}={0,2}/g, '[REDACTED BINARY DATA]')
}

function sanitizeGeminiErrorDetails(value: unknown, apiKey: string): readonly SanitizedGeminiErrorDetail[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 20).flatMap((detail) => {
    if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return []
    const raw = detail as Record<string, unknown>
    const type = safeString(raw['@type'], apiKey)
    const reason = safeString(raw.reason, apiKey)
    const fieldViolations = Array.isArray(raw.fieldViolations)
      ? raw.fieldViolations.slice(0, 50).flatMap((violation) => {
          if (!violation || typeof violation !== 'object' || Array.isArray(violation)) return []
          const item = violation as Record<string, unknown>
          return [{ field: safeString(item.field, apiKey), description: safeString(item.description, apiKey) }]
        })
      : undefined
    if (!type && !reason && !fieldViolations) return []
    return [{ ...(type ? { type } : {}), ...(reason ? { reason } : {}), ...(fieldViolations ? { fieldViolations } : {}) }]
  })
}

function logGeminiHttpError(label: string, model: string, httpStatus: number, value: unknown, apiKey: string) {
  const envelope = value && typeof value === 'object' ? value as GeminiErrorEnvelope : null
  const providerError = envelope?.error
  console.error(`[${label}] Gemini provider request failed`, {
    model,
    httpStatus,
    providerCode: typeof providerError?.code === 'number' ? providerError.code : safeString(providerError?.code, apiKey),
    providerStatus: safeString(providerError?.status, apiKey),
    providerMessage: safeString(providerError?.message, apiKey),
    providerDetails: sanitizeGeminiErrorDetails(providerError?.details, apiKey),
  })
}

const numberOrNull = (value: unknown): number | null => typeof value === 'number' ? value : null
const classifyHttpStatus = (status: number): AiErrorKind => status === 401 || status === 403
  ? 'auth'
  : status === 429
    ? 'rate-limited'
    : [400, 402, 404, 422].includes(status)
      ? 'bad-request'
      : 'provider-error'
const safeErrorMessage = (kind: AiErrorKind): string => ({
  'not-configured': 'API key not configured locally.',
  unsupported: 'This candidate is not available.',
  auth: 'The provider could not authenticate this request.',
  'rate-limited': 'The provider rate-limited this request.',
  'bad-request': 'The provider rejected the request.',
  'provider-error': 'The provider returned a server error.',
  timeout: 'The request timed out.',
  'malformed-response': 'The provider response violated the outfit contract.',
  network: 'The request could not reach the provider.',
  internal: 'An unexpected server error occurred.',
})[kind]
const errorResult = (kind: AiErrorKind, httpStatus: number | null = null): GeminiImageTransportResult => ({ ok: false, error: { kind, httpStatus, message: safeErrorMessage(kind) } })

export function parseGeminiImageResponse(value: unknown): GeminiImageTransportResult {
  if (!value || typeof value !== 'object') return errorResult('malformed-response')
  const response = value as GeminiImageResponse
  const parts = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? []
  for (const part of parts) {
    const inline = part.inlineData ?? (part.inline_data ? { mimeType: part.inline_data.mime_type, data: part.inline_data.data } : undefined)
    if (!inline) continue
    if (typeof inline.mimeType !== 'string' || !(SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(inline.mimeType)) return errorResult('malformed-response')
    if (typeof inline.data !== 'string' || inline.data.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(inline.data)) return errorResult('malformed-response')
    const usage = response.usageMetadata ? {
      inputTokens: numberOrNull(response.usageMetadata.promptTokenCount),
      outputTokens: numberOrNull(response.usageMetadata.candidatesTokenCount),
      totalTokens: numberOrNull(response.usageMetadata.totalTokenCount),
    } : null
    return { ok: true, mimeType: inline.mimeType as GeminiImageMimeType, imageDataUrl: `data:${inline.mimeType};base64,${inline.data}`, usage }
  }
  return errorResult('malformed-response')
}

export async function runGeminiImageProvider(options: {
  readonly prompt: string
  readonly model: string
  readonly signal: AbortSignal
  readonly diagnosticLabel: string
}): Promise<GeminiImageTransportResult> {
  const apiKey = getKey('gemini')
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${options.model}:generateContent`, {
    method: 'POST',
    signal: options.signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: options.prompt }] }],
      generationConfig: GEMINI_IMAGE_GENERATION_CONFIG,
    }),
  })
  const json = await response.json().catch(() => null)
  if (!response.ok) {
    if (process.env.NODE_ENV !== 'production') logGeminiHttpError(options.diagnosticLabel, options.model, response.status, json, apiKey)
    return errorResult(classifyHttpStatus(response.status), response.status)
  }
  return parseGeminiImageResponse(json)
}
