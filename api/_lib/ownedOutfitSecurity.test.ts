import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (relative: string) => readFileSync(path.join(ROOT, relative), 'utf8')

describe('production Today Outfit boundary', () => {
  it('keeps the production domain separate from Lab contracts and dev-only routes', () => {
    const production = ['contract.ts', 'request.ts', 'fallback.ts', 'todayInputs.ts'].map((file) => read(`src/domain/todayOutfitProduction/${file}`)).join('\n')
    expect(production).not.toMatch(/domain\/todayOutfit\/|ai-outfit|Lab/i)
    expect(read('src/services/ownedOutfitRecommendation.ts')).toContain('/api/today-outfit/wardrobe')
    expect(read('src/services/ownedOutfitRecommendation.ts')).not.toContain('/api/ai-outfit/')
  })

  it('keeps credentials server-only and excludes private/raw/image facts from the request builder', () => {
    const client = read('src/services/ownedOutfitRecommendation.ts') + read('src/domain/todayOutfitProduction/request.ts')
    expect(client).not.toMatch(/GROQ_API_KEY|process\.env|Authorization/)
    const builder = read('src/domain/todayOutfitProduction/request.ts')
    expect(builder).not.toMatch(/customName\s*:|quizAnswers|localStorage|imageData|photo/)
  })

  it('uses one provider only and never returns raw provider envelopes', () => {
    const provider = read('api/_lib/ownedOutfitProvider.ts')
    const config = read('api/_lib/ownedOutfitConfig.ts')
    const handler = read('api/_lib/ownedOutfitHandler.ts')
    expect(config).toContain("provider: 'groq'")
    expect(provider).not.toMatch(/runOutfitProvider|ADAPTERS|fallback/i)
    expect(handler).not.toMatch(/raw:|envelope|provider:|model:/)
  })
})
