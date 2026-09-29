import type { TodayOutfitImageRequest } from '../../src/domain/todayOutfitImage/contract.js'
import { runGeminiImageProvider } from './geminiImageProvider.js'
import type { GeminiImageTransportResult } from './geminiImageProvider.js'
import { buildOutfitImagePrompt } from './outfitImagePrompt.js'

export type OutfitImageAdapterResult = GeminiImageTransportResult
export { parseGeminiImageResponse } from './geminiImageProvider.js'

export function runOutfitImageProvider(request: TodayOutfitImageRequest, signal: AbortSignal, model: string): Promise<OutfitImageAdapterResult> {
  return runGeminiImageProvider({
    prompt: buildOutfitImagePrompt(request),
    model,
    signal,
    diagnosticLabel: 'Today Outfit Image Lab',
  })
}
