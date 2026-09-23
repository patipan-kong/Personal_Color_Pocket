import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { fitContain, imageLengthToDisplay, imageToDisplay, sampleRadiusFor } from '../domain/photoColor/coordinates'
import type { DisplayTap, ImagePoint, PixelSource, Size } from '../domain/photoColor/types'
import type { ArrowKey } from './photoPanelState'

export type SurfaceKeyIntent = { type: 'check' } | { type: 'move'; key: ArrowKey; big: boolean }

const ARROWS = new Set<string>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
// The marker ring always encloses the sampled disc, but is never smaller than this (CSS px),
// so it stays visible and tappable-looking on small previews. It is a pointer, not a measurement.
const MIN_MARKER_DIAMETER = 26

// Displays the prepared working pixels and turns pointer / keyboard input into intents.
// It owns no coordinate math: layout comes from fitContain, the marker from imageToDisplay /
// imageLengthToDisplay, and taps are handed on as a DisplayTap for inspectPhotoTap.
export function PhotoSurface({ image, marker, label, describedBy, onTap, onKey, onPaintFailed }: {
  image: PixelSource
  marker: ImagePoint | null
  label: string
  describedBy: string
  onTap: (tap: DisplayTap) => void
  onKey: (intent: SurfaceKeyIntent) => void
  onPaintFailed: () => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState<Size | null>(null)
  // Last input used on the photo. Focus moved by script in pointerdown matches :focus-visible in
  // Chrome, so CSS uses this to keep the focus ring and keyboard hint for keyboard use only.
  const [input, setInput] = useState<'keyboard' | 'pointer'>('keyboard')
  const paintFailed = useRef(onPaintFailed)
  paintFailed.current = onPaintFailed

  // Paint the working pixels once per image. `new ImageData(data, …)` wraps the existing buffer
  // (no copy) and putImageData writes the exact sampled values. The backing store is the working
  // size, not DPR-scaled: 1600 px already exceeds a phone preview's device width (Slice 4 §8).
  // The PixelSource stays the sampling truth; this canvas is never read back.
  useLayoutEffect(() => {
    const canvas = canvasRef.current!
    canvas.width = image.width
    canvas.height = image.height
    let painted = false
    try {
      const context = canvas.getContext('2d', { colorSpace: 'srgb' })
      if (context) {
        context.putImageData(new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0)
        painted = true
      }
    } catch { /* reported below */ }
    if (!painted) paintFailed.current()
    // Release the display copy when the photo changes or the panel closes.
    return () => { canvas.width = 0; canvas.height = 0 }
  }, [image])

  // Layout only: re-measure the stage on resize. Never re-opens, re-samples or re-matches.
  useLayoutEffect(() => {
    const stage = stageRef.current!
    const measure = () => {
      const { width, height } = stage.getBoundingClientRect()
      setBox((previous) => previous && previous.width === width && previous.height === height ? previous : { width, height })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const imageRect = box ? fitContain(image, box) : null

  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    // Pointer and stage rect are both CSS px, so DPR cancels (Slice 4 §7). Measured fresh, so a
    // tap right after a resize uses the current layout.
    const rect = event.currentTarget.getBoundingClientRect()
    onTap({
      point: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      imageRect: fitContain(image, { width: rect.width, height: rect.height }),
    })
  }

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    setInput('keyboard')
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onKey({ type: 'check' })
    } else if (ARROWS.has(event.key)) {
      event.preventDefault()
      onKey({ type: 'move', key: event.key as ArrowKey, big: event.shiftKey })
    }
  }

  let markerStyle: React.CSSProperties | null = null
  if (marker && imageRect) {
    const center = imageToDisplay(marker, imageRect, image)
    const diameter = Math.max(MIN_MARKER_DIAMETER, 2 * imageLengthToDisplay(sampleRadiusFor(image), imageRect, image) + 8)
    markerStyle = { left: center.x, top: center.y, width: diameter, height: diameter }
  }

  return <div
    ref={stageRef}
    className="photo-stage"
    style={{ aspectRatio: `${image.width} / ${image.height}` }}
    tabIndex={0}
    role="group"
    aria-label={label}
    aria-describedby={describedBy}
    data-input={input}
    // Focus on press (so keyboard use can follow a tap) without letting focus scroll the page
    // between pointerdown and pointerup, which would move the photo under the finger. Desktop
    // Chrome does not scroll here either way; this guards other engines (device QA item).
    onPointerDown={(event) => { setInput('pointer'); event.currentTarget.focus({ preventScroll: true }) }}
    onPointerUp={pointerUp}
    onKeyDown={keyDown}
  >
    <canvas
      ref={canvasRef}
      className="photo-canvas"
      aria-hidden="true"
      style={imageRect
        ? { left: imageRect.x, top: imageRect.y, width: imageRect.width, height: imageRect.height }
        : { visibility: 'hidden' }}
    />
    {markerStyle && <span className="photo-marker" style={markerStyle} aria-hidden="true" />}
  </div>
}
