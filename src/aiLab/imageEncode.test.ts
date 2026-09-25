import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PixelSource } from '../domain/photoColor/types'
import { encodeAnnotatedImageForAiLab } from './imageEncode'

// Slice 0.1 grounding audit (docs/V2_AI_COLOR_LAB.md §16-18, plan §22 A/E): the AI Lab previously
// sent providers the full photo with no indication of which point was selected. These tests prove
// the fix directly at the unit level: the marker is centered on the EXACT working-image point
// passed in (no separate coordinate representation to transform, so no room for a mapping bug),
// the whole working image is painted unscaled and uncropped (surrounding context preserved per
// plan §10), and the original pixel buffer is never mutated (production/deterministic sampling
// never sees the marker, plan §15/§19).

class FakeImageData {
  constructor(readonly data: Uint8ClampedArray, readonly width: number, readonly height: number) {}
}

function solidImage(width: number, height: number): PixelSource {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(200) }
}

function fakeContext() {
  return {
    putImageData: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
  }
}

beforeEach(() => {
  vi.stubGlobal('ImageData', FakeImageData)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('encodeAnnotatedImageForAiLab', () => {
  it('paints the full working image unscaled and uncropped, then burns a marker centered exactly on the selected point (plan §22 A/E)', () => {
    const context = fakeContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,MARKED')

    const image = solidImage(400, 300)
    const point = { x: 123, y: 87 }
    const dataUrl = encodeAnnotatedImageForAiLab(image, point, 24)

    expect(dataUrl).toBe('data:image/jpeg;base64,MARKED')
    expect(context.putImageData).toHaveBeenCalledTimes(1)
    const paintedImageData = context.putImageData.mock.calls[0][0] as { width: number; height: number }
    expect(paintedImageData.width).toBe(400)
    expect(paintedImageData.height).toBe(300)
    expect(context.putImageData.mock.calls[0][1]).toBe(0)
    expect(context.putImageData.mock.calls[0][2]).toBe(0)

    // Every arc() call (ring + dot, each drawn twice for a white halo underneath a colored line)
    // is centered on the exact selected point.
    expect(context.arc.mock.calls.length).toBeGreaterThan(0)
    for (const call of context.arc.mock.calls) {
      expect(call[0]).toBe(point.x)
      expect(call[1]).toBe(point.y)
    }
  })

  it('scales the ring to the sample radius but keeps it within sane bounds (never so large it swallows the fabric, plan §9)', () => {
    const context = fakeContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,MARKED')

    encodeAnnotatedImageForAiLab(solidImage(2000, 2000), { x: 500, y: 500 }, 24)
    const radii = context.arc.mock.calls.map((call) => call[2] as number)
    // Two ring radii (halo + color, same value) and two dot radii (smaller), all bounded.
    expect(Math.max(...radii)).toBeLessThanOrEqual(90)
    expect(Math.max(...radii)).toBeGreaterThan(10)
  })

  it('does not mutate the source pixel buffer -- production/deterministic sampling never sees the marker (plan §15, §19)', () => {
    const context = fakeContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,MARKED')

    const image = solidImage(200, 150)
    const before = image.data.slice()
    encodeAnnotatedImageForAiLab(image, { x: 10, y: 10 }, 24)
    expect(image.data).toEqual(before)
  })
})
