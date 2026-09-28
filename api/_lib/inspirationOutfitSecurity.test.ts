import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (relative: string) => readFileSync(path.join(ROOT, relative), 'utf8')

describe('production Inspiration security boundary', () => {
  it('uses a dedicated non-Lab endpoint and keeps credentials server-only', () => {
    const client = read('src/services/inspirationOutfitRecommendation.ts') + read('src/domain/todayOutfitProduction/inspirationRequest.ts')
    expect(client).toContain('/api/today-outfit/inspiration')
    expect(client).not.toMatch(/api\/ai-outfit|GROQ_API_KEY|process\.env|Authorization/)
  })

  it('does not build Inspiration from wardrobe/private/photo/presentation state', () => {
    const builder = read('src/domain/todayOutfitProduction/inspirationRequest.ts')
    expect(builder).not.toMatch(/WardrobeRecord|customName|quizAnswers|localStorage|imageData|photo|presentationPreference/)
  })

  it('shares exactly one production provider/model boundary and exposes no generic prompt API', () => {
    const provider = read('api/_lib/inspirationOutfitProvider.ts')
    const handler = read('api/_lib/inspirationOutfitHandler.ts')
    expect(provider).toContain("from './ownedOutfitConfig.js'")
    expect(provider).not.toMatch(/ADAPTERS|runOutfitProvider/)
    expect(handler).not.toMatch(/raw:|envelope|provider:|model:|prompt:/)
  })
})
