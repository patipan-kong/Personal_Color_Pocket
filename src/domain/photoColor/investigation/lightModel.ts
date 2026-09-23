import { hexToRgb, rgbToHex } from '../../personalColor/colorUtils'
import type { OKLab, RGB } from '../../personalColor/colorUtils'
import type { PixelSource } from '../types'

// INVESTIGATION ONLY (Slice 5e). Imported by investigation tests, never by the app. A tiny,
// deliberately simple physical model for synthetic photos:
//
//   pixel = encode( clip( material_linear × light_gain[channel] × intensity ) ) + noise
//
// "material" is the colour the fabric renders as under neutral, normal light (a camera-encoded
// HEX). Light is a per-channel linear gain: intensity models exposure / shade, and the channel
// gains model an environmental colour cast (skylight, tungsten, foliage). It is NOT a camera
// simulation: no tone curve, AWB, noise reduction or JPEG. It only shows which failure modes
// exist and roughly how large they are.

export interface Light { intensity: number; r?: number; g?: number; b?: number }

export const NEUTRAL_LIGHT: Light = { intensity: 1 }

export function decode(channel: number) {
  const value = channel / 255
  return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
}

export function encode(linear: number) {
  const value = Math.min(1, Math.max(0, linear))
  return 255 * (value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055)
}

// A material seen under a light, as an unrounded 8-bit sRGB triple.
export function lit(material: RGB, light: Light): RGB {
  const { intensity, r = 1, g = 1, b = 1 } = light
  return { r: encode(decode(material.r) * r * intensity), g: encode(decode(material.g) * g * intensity), b: encode(decode(material.b) * b * intensity) }
}

export function litHex(hex: string, light: Light) {
  return rgbToHex(lit(hexToRgb(hex)!, light))
}

// Two lights blended in linear light (soft shadow edges, fold shading).
export function mixLight(first: Light, second: Light, amount: number): Light {
  const t = Math.min(1, Math.max(0, amount))
  const channel = (key: 'r' | 'g' | 'b') => (first[key] ?? 1) * first.intensity * (1 - t) + (second[key] ?? 1) * second.intensity * t
  return { intensity: 1, r: channel('r'), g: channel('g'), b: channel('b') }
}

// Deterministic noise (sensor / weave), so every run gives identical numbers.
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

// Build a synthetic RGBA image. `paint` returns an unrounded sRGB triple for a pixel centre.
// `noise` adds ±noise per channel (uniform), then values are rounded and clamped like a camera.
export function scene(width: number, height: number, paint: (x: number, y: number) => RGB, noise = 0, seed = 1): PixelSource {
  const random = seededRandom(seed)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const { r, g, b } = paint(col + .5, row + .5)
      const jitter = () => noise ? (random() * 2 - 1) * noise : 0
      data.set([Math.round(r + jitter()), Math.round(g + jitter()), Math.round(b + jitter()), 255], (row * width + col) * 4)
    }
  }
  return { width, height, data }
}

export const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// OKLab → sRGB, the exact inverse of colorUtils.rgbToOklab (for the investigation's OKLab-mean
// strategy only). Out-of-gamut results are clamped.
export function oklabToRgb({ l, a, b }: OKLab): RGB {
  const lRoot = l + .3963377774 * a + .2158037573 * b
  const mRoot = l - .1055613458 * a - .0638541728 * b
  const sRoot = l - .0894841775 * a - 1.291485548 * b
  const L = lRoot ** 3
  const M = mRoot ** 3
  const S = sRoot ** 3
  return {
    r: encode(4.0767416621 * L - 3.3077115913 * M + .2309699292 * S),
    g: encode(-1.2684380046 * L + 2.6097574011 * M - .3413193965 * S),
    b: encode(-.0041960863 * L - .7034186147 * M + 1.707614701 * S),
  }
}
