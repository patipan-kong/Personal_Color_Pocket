import type { TodayOutfitInput } from '../../../src/domain/todayOutfit/contract.js'
import { getKey } from '../env.js'
import { buildOutfitPrompt } from '../outfitPrompt.js'
import { classifyHttpStatus, errorResult, numberOrNull, resultFromText } from './shared.js'
import type { OutfitAdapterResult } from './shared.js'

export async function runOutfitProvider(input: TodayOutfitInput, signal: AbortSignal, model: string): Promise<OutfitAdapterResult> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': getKey('gemini') },
    body: JSON.stringify({ contents: [{ parts: [{ text: buildOutfitPrompt(input) }] }], generationConfig: { responseMimeType: 'application/json' } }),
  })
  if (!response.ok) return errorResult(classifyHttpStatus(response.status), response.status)
  const json = await response.json().catch(() => null) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } } | null
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') return errorResult('malformed-response')
  const usage = json?.usageMetadata ? { inputTokens: numberOrNull(json.usageMetadata.promptTokenCount), outputTokens: numberOrNull(json.usageMetadata.candidatesTokenCount), totalTokens: numberOrNull(json.usageMetadata.totalTokenCount) } : null
  return resultFromText('gemini', model, text, usage, input)
}
