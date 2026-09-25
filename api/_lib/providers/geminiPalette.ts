import type { AiErrorKind, AiUsage } from '../../../src/domain/aiColorLab/contract'
import type { AiPaletteSelectionRequest, AiPaletteSelectionResult } from '../../../src/domain/aiColorLab/paletteContract'
import { getKey } from '../env'
import { buildPaletteSelectionPrompt } from '../palettePrompt'
import { extractJsonObject } from '../validate'
import { validatePaletteSelectionOutput } from '../validatePaletteSelection'
import { classifyHttpStatus, dataUrlParts, safeErrorMessage } from './shared'

// V2.0 Slice 0.5C (plan §L: "Use Gemini Flash-Lite as the primary candidate... Do NOT repeat the
// 4-provider bakeoff... do not add another provider"). A dedicated, minimal adapter for the
// canonical-palette-selection task -- deliberately NOT a generalization of gemini.ts's
// runProvider. Duplicating this small amount of plumbing keeps the existing free-form bake-off
// adapter (already tested, production-adjacent) completely untouched by this experimental task.
// Same request shape (Gemini JSON-mode, no responseSchema -- see gemini.ts's rationale) applies
// here unchanged.

// A plain (non-distributive) Omit<AiPaletteApiOutcome, 'latencyMs'> would flatten the union down
// to only its COMMON keys -- spelled out explicitly here instead, mirroring shared.ts's own
// AdapterResult for the free-form task.
type AdapterResult =
  | { ok: true; result: AiPaletteSelectionResult; usage: AiUsage | null; raw: unknown }
  | { ok: false; error: { kind: AiErrorKind; httpStatus: number | null; message: string } }

function errorResult(kind: AiErrorKind, httpStatus: number | null = null): AdapterResult {
  return { ok: false, error: { kind, httpStatus, message: safeErrorMessage(kind) } }
}

export async function runPaletteSelectionProvider(request: AiPaletteSelectionRequest, signal: AbortSignal, model: string): Promise<AdapterResult> {
  const { mimeType, base64 } = dataUrlParts(request.imageDataUrl)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': getKey('gemini') },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPaletteSelectionPrompt(request) }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })

  if (!response.ok) return errorResult(classifyHttpStatus(response.status), response.status)

  const json = await response.json().catch(() => null) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
  } | null
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') return errorResult('malformed-response')

  const extracted = extractJsonObject(text)
  if (extracted === null) return errorResult('malformed-response')
  const validColorIds = new Set(request.palette.map((candidate) => candidate.colorId))
  const validated = validatePaletteSelectionOutput(extracted, validColorIds)
  if (!validated) return errorResult('malformed-response')

  const usage = json?.usageMetadata
    ? {
        inputTokens: json.usageMetadata.promptTokenCount ?? null,
        outputTokens: json.usageMetadata.candidatesTokenCount ?? null,
        totalTokens: json.usageMetadata.totalTokenCount ?? null,
      }
    : null
  return { ok: true, result: validated, usage, raw: json }
}
