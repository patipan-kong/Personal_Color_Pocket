import type { AiErrorKind } from '../../src/domain/ai/providerCatalog.js'
import type { OutfitPreviewInput, PreviewImageMimeType } from '../../src/domain/todayOutfitProduction/previewContract.js'
import { runGeminiImageProvider } from './geminiImageProvider.js'
import { OUTFIT_PREVIEW_PROVIDER } from './outfitPreviewConfig.js'
import { buildOutfitPreviewPrompt } from './outfitPreviewPrompt.js'

export { OUTFIT_PREVIEW_PROVIDER } from './outfitPreviewConfig.js'

export type OutfitPreviewProviderOutcome =
  | { readonly ok: true; readonly mimeType: PreviewImageMimeType; readonly imageDataUrl: string }
  | { readonly ok: false; readonly error: { readonly kind: AiErrorKind; readonly message: string } }

const safeMessage = (kind: AiErrorKind): string => ({
  'not-configured': 'The preview service is not configured.',
  unsupported: 'The preview service is unavailable.',
  auth: 'The preview service could not authenticate.',
  'rate-limited': 'The preview service is busy.',
  'bad-request': 'The preview service rejected the request.',
  'provider-error': 'The preview service returned an error.',
  timeout: 'The preview took too long.',
  'malformed-response': 'The preview service returned invalid image data.',
  network: 'The preview service could not be reached.',
  internal: 'The preview could not be completed.',
})[kind]

const failure = (kind: AiErrorKind): OutfitPreviewProviderOutcome => ({ ok: false, error: { kind, message: safeMessage(kind) } })

export async function runOutfitPreviewProvider(input: OutfitPreviewInput, signal: AbortSignal): Promise<OutfitPreviewProviderOutcome> {
  try {
    const result = await runGeminiImageProvider({
      prompt: buildOutfitPreviewPrompt(input),
      model: OUTFIT_PREVIEW_PROVIDER.model,
      signal,
      diagnosticLabel: 'Today Outfit Preview',
    })
    return result.ok
      ? { ok: true, mimeType: result.mimeType, imageDataUrl: result.imageDataUrl }
      : failure(result.error.kind)
  } catch (error) {
    return failure(error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network')
  }
}
