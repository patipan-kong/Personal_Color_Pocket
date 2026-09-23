export interface RGB { r: number; g: number; b: number }
export interface OKLab { l: number; a: number; b: number }

export function normalizeHex(value: string): string | null {
  const cleaned = value.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return `#${cleaned.split('').map((char) => char + char).join('').toUpperCase()}`
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned.toUpperCase()}`
  return null
}

export function hexToRgb(value: string): RGB | null {
  const hex = normalizeHex(value)
  if (!hex) return null
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}

export function rgbToHex({ r, g, b }: RGB): string {
  return `#${[r, g, b].map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function linearize(channel: number) {
  const value = channel / 255
  return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
}

export function rgbToOklab({ r, g, b }: RGB): OKLab {
  const red = linearize(r)
  const green = linearize(g)
  const blue = linearize(b)
  const l = .4122214708 * red + .5363325363 * green + .0514459929 * blue
  const m = .2119034982 * red + .6806995451 * green + .1073969566 * blue
  const s = .0883024619 * red + .2817188376 * green + .6299787005 * blue
  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)
  return {
    l: .2104542553 * lRoot + .793617785 * mRoot - .0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + .4505937099 * sRoot,
    b: .0259040371 * lRoot + .7827717662 * mRoot - .808675766 * sRoot,
  }
}

export function hexToOklab(value: string): OKLab | null {
  const rgb = hexToRgb(value)
  return rgb ? rgbToOklab(rgb) : null
}

export function colorDistance(first: OKLab, second: OKLab) {
  return Math.sqrt((first.l - second.l) ** 2 + (first.a - second.a) ** 2 + (first.b - second.b) ** 2)
}

export function oklabChroma({ a, b }: OKLab) {
  return Math.hypot(a, b)
}

// Hue angle in degrees, [0, 360). Meaningless for near-neutral colors: callers must gate on chroma.
export function oklabHue({ a, b }: OKLab) {
  const degrees = Math.atan2(b, a) * 180 / Math.PI
  return degrees < 0 ? degrees + 360 : degrees
}

// Signed shortest rotation from `from` to `to` in degrees, in (-180, 180]. 359° → 1° is +2°.
export function hueDifference(from: number, to: number) {
  const difference = (((to - from) % 360) + 540) % 360 - 180
  return difference === -180 ? 180 : difference
}

export function hexColorDistance(first: string, second: string) {
  const firstLab = hexToOklab(first)
  const secondLab = hexToOklab(second)
  if (!firstLab || !secondLab) return Number.POSITIVE_INFINITY
  return colorDistance(firstLab, secondLab)
}

export function readableTextColor(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#24181E'
  const luminance = (.299 * rgb.r + .587 * rgb.g + .114 * rgb.b) / 255
  return luminance > .62 ? '#24181E' : '#FFFFFF'
}
