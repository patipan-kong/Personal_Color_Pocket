import type { AiProviderId } from '../../src/domain/aiColorLab/contract'

// Server-only. Reads secret keys from process.env and NEVER returns them to a caller that
// might log or forward the value -- only hasKey()/getKey() exist, and getKey() is for adapters
// to put straight into an outgoing request header, never into a response or a log line
// (plan §3, §26).

const ENV_VAR: Record<AiProviderId, string> = {
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  groq: 'GROQ_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
}

export function hasKey(provider: AiProviderId): boolean {
  const value = process.env[ENV_VAR[provider]]
  return typeof value === 'string' && value.trim().length > 0
}

export function getKey(provider: AiProviderId): string {
  const value = process.env[ENV_VAR[provider]]
  if (!value) throw new Error(`Missing ${ENV_VAR[provider]}`) // callers must check hasKey() first
  return value
}
