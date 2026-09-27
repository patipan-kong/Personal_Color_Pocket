import { describe, expect, it } from 'vitest'
import appSource from '../App.tsx?raw'
import viewSource from './TodayOutfitLabView.tsx?raw'
import apiSource from './outfitApi.ts?raw'
import exportSource from './export.ts?raw'
import baselineSource from '../domain/todayOutfit/baseline.ts?raw'
import casesSource from '../domain/todayOutfit/cases.ts?raw'
import contractSource from '../domain/todayOutfit/contract.ts?raw'
import factsSource from '../domain/todayOutfit/facts.ts?raw'
import providerSource from '../domain/todayOutfit/provider.ts?raw'

describe('Today Outfit boundaries', () => {
  it('is gated by DEV plus the explicit outfit query and has no production navigation entry', () => {
    expect(appSource).toMatch(/import\.meta\.env\.DEV\s*&&[\s\S]*get\('debug'\) === 'outfit'/)
    expect(appSource).toContain('if (showOutfitLab) return <TodayOutfitLabView />')
    expect(appSource).not.toMatch(/\['outfit',\s*'outfit'/)
  })
  it('keeps provider keys and server modules out of client source', () => {
    const client = [viewSource, apiSource, exportSource].join('\n')
    expect(client).not.toMatch(/OPENAI_API_KEY|GEMINI_API_KEY|GROQ_API_KEY|process\.env|api\/_lib/)
  })
  it('does not couple the Today Outfit domain to lucky color or persistence', () => {
    const domain = [baselineSource, casesSource, contractSource, factsSource, providerSource].join('\n')
    expect(domain).not.toMatch(/luckyColor|dailyLucky|localStorage|sessionStorage|weather|imageDataUrl/)
  })
})
