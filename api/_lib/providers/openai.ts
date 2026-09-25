import type { AiColorAnalysisRequest } from '../../../src/domain/aiColorLab/contract'
import { getKey } from '../env'
import { classifyHttpStatus, errorOutcome, modelOutputJsonSchema, outcomeFromModelText, promptFor } from './shared'
import type { AdapterResult } from './shared'

// OpenAI adapter (plan §5 research, 2026-09-25 sources: developers.openai.com/api/docs/guides/
// images-vision, .../structured-outputs, .../pricing). Chat Completions + response_format
// json_schema (strict mode): confirmed compatible with image input in official docs.
export const MODEL = 'gpt-5-mini'
const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

export async function runProvider(request: AiColorAnalysisRequest, signal: AbortSignal): Promise<AdapterResult> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getKey('openai')}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: promptFor(request) },
          { type: 'image_url', image_url: { url: request.imageDataUrl, detail: 'auto' } },
        ],
      }],
      response_format: { type: 'json_schema', json_schema: { name: 'ai_color_result', strict: true, schema: modelOutputJsonSchema() } },
    }),
  })

  if (!response.ok) return errorOutcome(classifyHttpStatus(response.status), response.status)

  const json = await response.json().catch(() => null) as {
    choices?: { message?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  } | null
  const text = json?.choices?.[0]?.message?.content
  if (typeof text !== 'string') return errorOutcome('malformed-response')

  const usage = json?.usage
    ? { inputTokens: numberOrNull(json.usage.prompt_tokens), outputTokens: numberOrNull(json.usage.completion_tokens), totalTokens: numberOrNull(json.usage.total_tokens) }
    : null
  return outcomeFromModelText('openai', MODEL, text, usage, json)
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === 'number' ? value : null
}
