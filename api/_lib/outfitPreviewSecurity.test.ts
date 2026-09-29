import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (relative: string) => readFileSync(path.join(ROOT, relative), 'utf8')

describe('production Outfit Preview security and privacy boundary', () => {
  it('keeps credentials, provider, and fixed model in server-only files', () => {
    const client = read('src/services/outfitPreview.ts') + read('src/domain/todayOutfitProduction/previewContract.ts') + read('src/domain/todayOutfitProduction/previewInput.ts')
    expect(client).not.toMatch(/GEMINI_API_KEY|x-goog-api-key|process\.env|gemini-3\.1-flash-lite-image/)
    expect(read('api/_lib/outfitPreviewConfig.ts')).toContain("model: 'gemini-3.1-flash-lite-image'")
    expect(read('api/_lib/outfitPreviewProvider.ts')).not.toMatch(/fallback|gemini-3\.1-flash-image/)
  })

  it('introduces no production selector, persistence, export, analytics, or image-byte logging', () => {
    const production = [
      'src/domain/todayOutfitProduction/previewContract.ts',
      'src/domain/todayOutfitProduction/previewInput.ts',
      'src/services/outfitPreview.ts',
      'src/dailyLuckyColor/OutfitPreview.tsx',
      'api/_lib/outfitPreviewConfig.ts',
      'api/_lib/outfitPreviewPrompt.ts',
      'api/_lib/outfitPreviewProvider.ts',
      'api/_lib/outfitPreviewHandler.ts',
    ].map(read).join('\n')
    expect(production).not.toMatch(/localStorage|indexedDB|caches\.|imageHistory|exportImage|analytics|console\.log\s*\(|console\.error\s*\(.*imageDataUrl/s)
    const ui = read('src/dailyLuckyColor/OutfitPreview.tsx') + read('src/dailyLuckyColor/DailyView.tsx')
    expect(ui).not.toMatch(/GEMINI_API_KEY|gemini-3\.1|outfitPreviewProvider|outfitPreviewConfig|api\/_lib|modelSelector|prompt\s*:/i)
    expect(read('src/dailyLuckyColor/OutfitPreview.tsx')).toContain("from '../services/outfitPreview'")
    expect(read('src/App.tsx')).not.toMatch(/imageDataUrl|requestOutfitPreview|OutfitPreviewApiResponse/)
  })

  it('keeps one session image only and never adds image history or automatic generation', () => {
    const preview = read('src/dailyLuckyColor/OutfitPreview.tsx')
    expect(preview).not.toMatch(/\[\s*imageDataUrl|\.push\(|history|useEffect\s*\([^)]*requestOutfitPreview/s)
    expect(preview.match(/requestOutfitPreview\(/g)).toHaveLength(1)
    expect(preview).toContain('const generate = async () =>')
    expect(preview).toContain('onClick={() => void generate()}')
  })

  it('keeps Lab-only contracts and controls out of the production request path', () => {
    const production = read('src/services/outfitPreview.ts') + read('api/_lib/outfitPreviewHandler.ts') + read('api/_lib/outfitPreviewProvider.ts')
    expect(production).not.toMatch(/todayOutfitImage|OUTFIT_IMAGE_CANDIDATES|candidate|PO review|outfitImageExport/)
    expect(read('api/_lib/outfitPreviewPrompt.ts')).not.toMatch(/subtype|occasion|lucky|wardrobeId|customName|reasoning|source mode/i)
  })
})
