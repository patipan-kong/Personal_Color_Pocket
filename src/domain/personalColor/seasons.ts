import type { SeasonDefinition, Subtype } from './types'

export const seasonDefinitions: Record<Subtype, SeasonDefinition> = {
  'light-spring': { id: 'light-spring', season: 'spring', target: { temperature: .72, value: .88, chroma: .62, contrast: .38 } },
  'warm-spring': { id: 'warm-spring', season: 'spring', target: { temperature: .94, value: .61, chroma: .68, contrast: .52 } },
  'clear-spring': { id: 'clear-spring', season: 'spring', target: { temperature: .66, value: .57, chroma: .94, contrast: .83 } },
  'light-summer': { id: 'light-summer', season: 'summer', target: { temperature: .28, value: .88, chroma: .46, contrast: .3 } },
  'cool-summer': { id: 'cool-summer', season: 'summer', target: { temperature: .08, value: .58, chroma: .43, contrast: .42 } },
  'soft-summer': { id: 'soft-summer', season: 'summer', target: { temperature: .31, value: .53, chroma: .14, contrast: .22 } },
  'soft-autumn': { id: 'soft-autumn', season: 'autumn', target: { temperature: .7, value: .45, chroma: .13, contrast: .25 } },
  'warm-autumn': { id: 'warm-autumn', season: 'autumn', target: { temperature: .94, value: .35, chroma: .43, contrast: .46 } },
  'deep-autumn': { id: 'deep-autumn', season: 'autumn', target: { temperature: .7, value: .1, chroma: .42, contrast: .72 } },
  'deep-winter': { id: 'deep-winter', season: 'winter', target: { temperature: .23, value: .06, chroma: .7, contrast: .9 } },
  'cool-winter': { id: 'cool-winter', season: 'winter', target: { temperature: .05, value: .4, chroma: .72, contrast: .78 } },
  'clear-winter': { id: 'clear-winter', season: 'winter', target: { temperature: .32, value: .4, chroma: .97, contrast: .94 } },
}

export const subtypeOrder = Object.keys(seasonDefinitions) as Subtype[]
