import { getPalette } from './palettes'
import { hexColorDistance, normalizeHex } from './colorUtils'
import type { ColorMatchResult, PaletteColor, Subtype } from './types'

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const similarity = (distance: number) => Math.exp(-distance * 7.2)

function closest(hex: string, colors: PaletteColor[], count = 1) {
  return [...colors]
    .map((color) => ({ color, distance: hexColorDistance(hex, color.hex) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
}

export function pairingSuggestions(hex: string, subtype: Subtype) {
  const palette = getPalette(subtype)
  const pools = [palette.neutrals, palette.best, palette.accents]
  const selected: PaletteColor[] = []
  pools.forEach((pool) => {
    const candidate = [...pool]
      .filter((color) => normalizeHex(color.hex) !== normalizeHex(hex))
      .sort((a, b) => {
        const da = Math.abs(hexColorDistance(hex, a.hex) - .22)
        const db = Math.abs(hexColorDistance(hex, b.hex) - .22)
        return da - db || a.id.localeCompare(b.id)
      })[0]
    if (candidate && !selected.some((item) => item.id === candidate.id)) selected.push(candidate)
  })
  return selected.slice(0, 3)
}

export function checkColor(value: string, subtype: Subtype): ColorMatchResult | null {
  const hex = normalizeHex(value)
  if (!hex) return null
  const palette = getPalette(subtype)
  const best = closest(hex, palette.best, 2)
  const accent = closest(hex, palette.accents)[0]
  const neutral = closest(hex, palette.neutrals)[0]
  const harder = closest(hex, palette.harder)[0]
  const positive = Math.max(
    similarity(best[0].distance),
    similarity(accent.distance) * .94,
    similarity(neutral.distance) * .9,
  )
  const harderSimilarity = similarity(harder.distance)
  let score = clamp(positive * .9 + .07 - harderSimilarity * .3)
  if (harder.distance < .012) score = Math.min(score, .55)
  if (best[0].distance < .004) score = Math.max(score, .92)

  const rating: ColorMatchResult['rating'] = score >= .82 ? 'Great Match' : score >= .66 ? 'Good Match' : score >= .47 ? 'Wearable' : 'Tricky'
  const reason = {
    type: rating,
    referenceColor: rating === 'Tricky' ? harder.color : rating === 'Wearable' ? null : best[0].color,
  }

  return {
    normalizedHex: hex,
    rating,
    score,
    closestColors: best.map(({ color }) => color),
    reason,
    pairWith: pairingSuggestions(hex, subtype),
  }
}
