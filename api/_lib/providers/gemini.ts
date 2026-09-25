import type { AiColorAnalysisRequest } from '../../../src/domain/aiColorLab/contract'
import { getKey } from '../env'
import { classifyHttpStatus, dataUrlParts, errorOutcome, outcomeFromModelText, promptFor } from './shared'
import type { AdapterResult } from './shared'

// Gemini adapter (plan §5 research, 2026-09-25 sources: ai.google.dev/gemini-api/docs/
// image-understanding, .../structured-output, .../models). Uses
// generationConfig.responseMimeType "application/json" WITHOUT responseSchema -- the combination
// of responseSchema + image input is not confirmed compatible by official docs (one reported
// 400 "JSON mode is not enabled" case for a different model), so this adapter relies on the
// canonical prompt's explicit JSON-shape instruction plus server-side validate.ts instead of a
// provider-enforced schema (plan §15: validate regardless of what structured output was asked
// for).
//
// Slice 0.2 (plan §4): this ONE adapter now serves two bake-off candidates -- Gemini Flash
// (`gemini-3.5-flash`) and Gemini Flash-Lite (`gemini-3.5-flash-lite`, verified against current
// official docs, docs/V2_AI_COLOR_LAB.md §Slice 0.2) -- which share an endpoint shape, a key, and
// every request field except the model ID in the URL. `model` is a parameter, never a hardcoded
// constant here, so there is exactly one source of truth for candidate model IDs
// (src/domain/aiColorLab/contract.ts's AI_CANDIDATES).
export async function runProvider(request: AiColorAnalysisRequest, signal: AbortSignal, model: string): Promise<AdapterResult> {
  const { mimeType, base64 } = dataUrlParts(request.imageDataUrl)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': getKey('gemini') },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptFor(request) }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })

  if (!response.ok) return errorOutcome(classifyHttpStatus(response.status), response.status)

  const json = await response.json().catch(() => null) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
  } | null
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') return errorOutcome('malformed-response')

  const usage = json?.usageMetadata
    ? { inputTokens: numberOrNull(json.usageMetadata.promptTokenCount), outputTokens: numberOrNull(json.usageMetadata.candidatesTokenCount), totalTokens: numberOrNull(json.usageMetadata.totalTokenCount) }
    : null
  return outcomeFromModelText('gemini', model, text, usage, json)
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === 'number' ? value : null
}
