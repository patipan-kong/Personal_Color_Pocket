import { describe, expect, it } from 'vitest'
import appSource from '../App.tsx?raw'
import dailySource from '../dailyLuckyColor/DailyView.tsx?raw'
import viewSource from './WardrobeView.tsx?raw'
import colorsSource from './basicColors.ts?raw'
import cssSource from './wardrobe.css?raw'

describe('My Wardrobe UI boundaries', () => {
  it('is a secondary view and leaves the five-item bottom navigation unchanged', () => {
    expect(appSource).toContain("| 'wardrobe'")
    expect(appSource).toContain("view !== 'wardrobe'")
    const navDefinition = appSource.match(/const items = \[([\s\S]*?)\] as const/)?.[1] ?? ''
    expect(navDefinition.match(/\['/g)).toHaveLength(5)
    expect(navDefinition).not.toContain('wardrobe')
    expect(dailySource).toContain('onWardrobe')
  })

  it('has no AI/provider, Today Outfit Lab, Lucky behavior, network, image, or photo dependency', () => {
    const production = [viewSource, colorsSource].join('\n')
    expect(production).not.toMatch(/todayOutfit|\baiLab\b|\bprovider\b|outfitImage|luckyColor|dailyLucky|\bfetch\b|XMLHttpRequest|WebSocket|indexedDB|base64|photoColor|FileReader|\bcanvas\b/i)
  })

  it('keeps the complete card name in markup and limits only its visual layout to two lines', () => {
    expect(viewSource).toContain('className="wardrobe-card-name">{displayName}</h2>')
    expect(cssSource).toMatch(/\.wardrobe-card-name\s*\{[^}]*-webkit-line-clamp:\s*2;/)
  })
})
