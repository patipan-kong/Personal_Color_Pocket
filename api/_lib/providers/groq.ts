import type { AiColorAnalysisRequest } from '../../../src/domain/aiColorLab/contract'
import { getKey } from '../env'
import { classifyHttpStatus, errorOutcome, outcomeFromModelText, promptFor } from './shared'
import type { AdapterResult } from './shared'

// Groq adapter (plan §5 research, 2026-09-25 sources: console.groq.com/docs/vision,
// .../deprecations, .../models). IMPORTANT: `qwen/qwen3.8-27b` is currently the ONLY model Groq
// serves that accepts image input -- Groq's fast Llama/gpt-oss lineup is text-only, and the
// previous Llama-4 vision models were deprecated 2026-02-20. It is also listed under Groq's
// "Preview Models" tier (evaluation-only, no production-stability guarantee) -- flagged in
// docs/V2_AI_COLOR_LAB.md as an availability risk, not treated as UNSUPPORTED since it does
// currently work (plan §21 only requires UNSUPPORTED when no vision model exists at all).
// Uses OpenAI-compatible `response_format: json_object` (confirmed working with vision in
// Groq's own docs) rather than json_schema, whose vision compatibility Groq does not document.
export const MODEL = 'qwen/qwen3.8-27b'
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

export async function runProvider(request: AiColorAnalysisRequest, signal: AbortSignal): Promise<AdapterResult> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getKey('groq')}` },
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
  return outcomeFromModelText('groq', MODEL, text, usage, json)
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === 'number' ? value : null
}
