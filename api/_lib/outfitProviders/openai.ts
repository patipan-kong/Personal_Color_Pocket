import type { TodayOutfitInput } from '../../../src/domain/todayOutfit/contract.js'
import { getKey } from '../env.js'
import { buildOutfitPrompt } from '../outfitPrompt.js'
import { classifyHttpStatus, errorResult, numberOrNull, resultFromText } from './shared.js'
import type { OutfitAdapterResult } from './shared.js'

export async function runOutfitProvider(input: TodayOutfitInput, signal: AbortSignal, model: string): Promise<OutfitAdapterResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getKey('openai')}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: buildOutfitPrompt(input) }], response_format: { type: 'json_object' } }),
  })
  if (!response.ok) return errorResult(classifyHttpStatus(response.status), response.status)
  const json = await response.json().catch(() => null) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } } | null
  const text = json?.choices?.[0]?.message?.content
  if (typeof text !== 'string') return errorResult('malformed-response')
  const usage = json?.usage ? { inputTokens: numberOrNull(json.usage.prompt_tokens), outputTokens: numberOrNull(json.usage.completion_tokens), totalTokens: numberOrNull(json.usage.total_tokens) } : null
  return resultFromText('openai', model, text, usage, input)
}
