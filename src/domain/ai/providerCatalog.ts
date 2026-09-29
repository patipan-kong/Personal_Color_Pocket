// Provider/model configuration shared by development AI experiments. This module contains
// configuration only: credentials and provider calls remain under api/_lib.
export const AI_PROVIDER_IDS = ['gemini', 'openai', 'groq'] as const
export type AiProviderId = typeof AI_PROVIDER_IDS[number]

export const AI_CANDIDATE_IDS = ['gemini-flash', 'gemini-flash-lite', 'openai', 'groq'] as const
export type AiCandidateId = typeof AI_CANDIDATE_IDS[number]

export interface AiCandidateConfig {
  provider: AiProviderId
  model: string
  label: string
}

// These IDs were already configured and exercised by the AI Color Lab. Today Outfit deliberately
// reuses them rather than guessing newer IDs or treating the Color Lab's eventual winner as given.
export const AI_CANDIDATES: Readonly<Record<AiCandidateId, AiCandidateConfig>> = Object.freeze({
  'gemini-flash': { provider: 'gemini', model: 'gemini-3.5-flash', label: 'Gemini Flash' },
  'gemini-flash-lite': { provider: 'gemini', model: 'gemini-3.5-flash-lite', label: 'Gemini Flash-Lite' },
  openai: { provider: 'openai', model: 'gpt-5-mini', label: 'OpenAI' },
  groq: { provider: 'groq', model: 'qwen/qwen3.8-27b', label: 'Groq' },
})

export interface AiUsage {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
}

export type AiErrorKind =
  | 'not-configured'
  | 'unsupported'
  | 'auth'
  | 'rate-limited'
  | 'bad-request'
  | 'provider-error'
  | 'timeout'
  | 'malformed-response'
  | 'network'
  | 'internal'

export interface AiErrorInfo {
  kind: AiErrorKind
  message: string
  httpStatus: number | null
}
