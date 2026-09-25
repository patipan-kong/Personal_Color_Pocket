import type { AiColorAnalysisRequest } from '../../../src/domain/aiColorLab/contract'
import { getKey } from '../env'
import { classifyHttpStatus, errorOutcome, outcomeFromModelText, promptFor } from './shared'
import type { AdapterResult } from './shared'

// DeepSeek adapter (plan §5 research, 2026-09-25 sources: api-docs.deepseek.com/guides/vision,
// .../news/news260821). IMPORTANT: `deepseek-flash` is currently the ONLY DeepSeek model that
// accepts image input (`deepseek-v4-pro` is text-only); vision support is recent (GA since
// 2026-08-21, ~5 weeks before this slice), flagged in docs/V2_AI_COLOR_LAB.md as a newer/less
// battle-tested capability. json_object structured output + vision together is NOT documented
// either way by DeepSeek, so this adapter leans on the canonical prompt's explicit JSON-shape
// instruction and server-side validate.ts as the real safety net (plan §15).
export const MODEL = 'deepseek-flash'
const ENDPOINT = 'https://api.deepseek.com/chat/completions'

export async function runProvider(request: AiColorAnalysisRequest, signal: AbortSignal): Promise<AdapterResult> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getKey('deepseek')}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: promptFor(request) },
          { type: 'image_url', image_url: { url: request.imageDataUrl } },
        ],
      }],
      response_format: { type: 'json_object' },
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
  return outcomeFromModelText('deepseek', MODEL, text, usage, json)
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === 'number' ? value : null
}
