import { describe, expect, it } from 'vitest'
import dailySource from '../../dailyLuckyColor/DailyView.tsx?raw'
import inputSource from './todayInputs.ts?raw'

describe('production Today input boundaries', () => {
  it('keeps the input-state domain network-free and the production UI separate from Lab/image paths', () => {
    expect(inputSource).not.toMatch(/domain\/todayOutfit\/|todayOutfitImage|\baiLab\b|\bprovider\b|imageGeneration|photoPersistence|\bfetch\b|XMLHttpRequest|WebSocket|EventSource|sendBeacon/i)
    expect(dailySource).not.toMatch(/domain\/todayOutfit\/|todayOutfitImage|\baiLab\b|imageGeneration|photoPersistence|\bfetch\b|XMLHttpRequest|WebSocket|EventSource|sendBeacon/i)
    expect(dailySource).toContain("requestOwnedOutfitRecommendation")
  })

  it('keeps occasion and source as input state rather than a recommendation request contract', () => {
    expect(inputSource).toContain("export type TodayOccasion")
    expect(inputSource).toContain("export type OutfitSource")
    expect(inputSource).not.toMatch(/request|response|prompt|model/i)
  })
})
