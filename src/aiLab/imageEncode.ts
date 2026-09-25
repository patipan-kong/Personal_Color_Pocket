import type { PixelSource } from '../domain/photoColor/types'

// V2.0 AI Color Lab (Slice 0, plan §25): re-encodes the SAME working-image pixels the photo
// pipeline already produced (openPhoto's canvas is capped at a 1600px long edge -- see
// services/photoImage.ts) into a JPEG data URL for the four provider calls. Deliberately does
// NOT re-read or re-decode the original file: nothing here sends more data than the existing
// local pipeline already keeps in memory.
export const AI_LAB_JPEG_QUALITY = 0.85

export function encodeImageForAiLab(image: PixelSource): string {
  const canvas = document.createElement('canvas')
  try {
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d', { colorSpace: 'srgb' })
    if (!context) throw new Error('canvas-unavailable')
    context.putImageData(new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0)
    return canvas.toDataURL('image/jpeg', AI_LAB_JPEG_QUALITY)
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}
