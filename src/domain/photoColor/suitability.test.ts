import { describe, expect, it } from 'vitest'
import { subtypeOrder } from '../personalColor/seasons'
import { realMatchFor } from './realMatchFixtures'
import { getSuitability, suitabilityTone } from './suitability'
import suitabilitySource from './suitability.ts?raw'
import type { PhotoMatchCategory } from './types'

const CATEGORIES: PhotoMatchCategory[] = ['near-face', 'neutral-base', 'related', 'away-from-face', 'outside']

describe('suitability: a 1:1 relabelling of the engine category', () => {
  it('maps the five categories to five distinct verdict levels', () => {
    expect(CATEGORIES.map(getSuitability)).toEqual(['strong', 'good', 'conditional', 'weak', 'outside'])
  })

  it('groups them into positive / middle / negative', () => {
    expect(CATEGORIES.map((category) => suitabilityTone(getSuitability(category)))).toEqual(['positive', 'positive', 'middle', 'negative', 'negative'])
  })

  it('rejects an unknown category instead of guessing', () => {
    expect(() => getSuitability('great' as PhotoMatchCategory)).toThrow(RangeError)
  })

  it('agrees with the engine for real matches of every subtype', () => {
    for (const subtype of subtypeOrder) {
      for (const category of CATEGORIES) {
        const { match } = realMatchFor(subtype, category)!
        expect(getSuitability(match.category)).toBe(getSuitability(category))
      }
    }
  })

  it('calculates nothing: no distances, thresholds, scores or colour maths', () => {
    const code = suitabilitySource.replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/distance|PHOTO_|oklab|Math\.|score|percent|confidence|[<>]=?\s*\d/i)
    expect(code.match(/^import .*$/gm)).toEqual([`import type { PhotoMatchCategory } from './types'`])
  })
})
