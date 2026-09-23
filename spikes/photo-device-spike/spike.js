// V1.2 Slice 0 device spike — dev-only diagnostics. NOT production code.
// Measures the local photo pipeline proposed in docs/V1_2_PHOTO_COLOR_CHECKER_PLAN.md §4:
//   File → decode (createImageBitmap | HTMLImageElement) → ≤ maxEdge working canvas
//        → release source → getImageData once → tap sampling.
// Each stage is a separate step on `window.spike` so a headless runner can measure memory
// between stages. The small OKLab/sampling helpers here are throwaway spike copies used only
// to compare working resolutions; production must reuse src/domain/personalColor/colorUtils.ts.

const now = () => performance.now()
const ms = (t) => Math.round(t * 10) / 10
const $ = (id) => document.getElementById(id)

function fit(width, height, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

// Header-only dimension probe. In Chromium an unattached <img> fires `load` after parsing the
// header + receiving bytes; full decode is deferred until draw/decode(). Orientation-aware.
function probeDimensions(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { const d = { width: img.naturalWidth, height: img.naturalHeight }; URL.revokeObjectURL(url); img.src = ''; resolve(d) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('probe-failed')) }
    img.src = url
  })
}

async function capabilities() {
  const caps = {
    userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    viewport: `${innerWidth}x${innerHeight}`,
    createImageBitmap: typeof createImageBitmap === 'function',
    offscreenCanvas: typeof OffscreenCanvas === 'function',
    imageDecoderApi: typeof ImageDecoder === 'function',
    performanceMemory: Boolean(performance.memory),
    deviceMemoryGB: navigator.deviceMemory ?? null,
  }
  // Does createImageBitmap honour resize options? (Unsupported engines may ignore or throw.)
  try {
    const c = document.createElement('canvas'); c.width = 8; c.height = 4
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    const bmp = await createImageBitmap(blob, { resizeWidth: 2, resizeHeight: 1, resizeQuality: 'high' })
    caps.bitmapResizeOptions = bmp.width === 2 && bmp.height === 1 ? 'honoured' : `ignored (${bmp.width}x${bmp.height})`
    bmp.close()
  } catch (error) { caps.bitmapResizeOptions = `throws: ${error.name}` }
  if (caps.imageDecoderApi) {
    caps.imageDecoderSupports = {}
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/heic', 'image/heif']) {
      try { caps.imageDecoderSupports[type] = await ImageDecoder.isTypeSupported(type) } catch { caps.imageDecoderSupports[type] = 'error' }
    }
  }
  // Canvas colour-space support (P3 canvases exist on Chromium/Safari).
  try { caps.canvasP3 = document.createElement('canvas').getContext('2d', { colorSpace: 'display-p3' })?.getContextAttributes?.().colorSpace ?? 'unknown' } catch { caps.canvasP3 = 'unsupported' }
  return caps
}

let state = null

const steps = {
  // 1. decode (or dimension-probe + resized decode)
  async decode(file, { method = 'bitmap', maxEdge = 1600 } = {}) {
    steps.dispose()
    const rec = { name: file.name, type: file.type || '(empty)', bytes: file.size, method, maxEdge, t: {}, cleanup: {} }
    state = { rec, file, source: null, url: null, canvas: null, pixels: null }
    const t0 = now()
    try {
      if (method === 'bitmap') {
        state.source = await createImageBitmap(file)
        rec.intrinsic = { width: state.source.width, height: state.source.height }
      } else if (method === 'bitmap-resize') {
        const tp = now()
        rec.intrinsic = await probeDimensions(file)
        rec.t.probe = ms(now() - tp)
        const target = fit(rec.intrinsic.width, rec.intrinsic.height, maxEdge)
        state.source = await createImageBitmap(file, { resizeWidth: target.width, resizeHeight: target.height, resizeQuality: 'high' })
        rec.decodedSize = { width: state.source.width, height: state.source.height }
      } else {
        state.url = URL.createObjectURL(file)
        const img = new Image()
        img.src = state.url
        await img.decode()
        state.source = img
        rec.intrinsic = { width: img.naturalWidth, height: img.naturalHeight }
      }
      rec.megapixels = Math.round(rec.intrinsic.width * rec.intrinsic.height / 1e5) / 10
      rec.t.decode = ms(now() - t0)
      rec.ok = true
    } catch (error) {
      rec.t.decode = ms(now() - t0)
      rec.ok = false
      rec.error = `${error?.name ?? 'Error'}: ${error?.message ?? error}`
      if (state.url) { URL.revokeObjectURL(state.url); state.url = null }
    }
    return rec
  },
  // 2. draw into the working canvas (Chromium may defer raster until the first readback)
  draw() {
    const { rec, source } = state
    const target = fit(rec.intrinsic.width, rec.intrinsic.height, rec.maxEdge)
    const canvas = $('preview') ?? document.createElement('canvas')
    canvas.width = target.width; canvas.height = target.height
    const ctx = canvas.getContext('2d', { colorSpace: 'srgb' })
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    const t0 = now()
    ctx.drawImage(source, 0, 0, target.width, target.height)
    rec.t.drawCall = ms(now() - t0)
    rec.working = target
    rec.workingBytes = target.width * target.height * 4
    state.canvas = canvas
    return rec
  },
  // 3. release the full-size source as early as possible
  async release() {
    const { rec } = state
    if (state.source && 'close' in state.source) { state.source.close(); rec.cleanup.bitmapClosed = state.source.width === 0 }
    if (state.url) {
      const url = state.url
      URL.revokeObjectURL(url); state.url = null
      rec.cleanup.objectUrlRevoked = await fetch(url).then(() => false, () => true)
    }
    if (state.source instanceof HTMLImageElement) state.source.src = ''
    state.source = null
    state.file = null // do not retain the original File
    rec.cleanup.fileReleased = true
    return rec
  },
  // 4. read pixels once (this is where deferred raster work lands in Chromium)
  read() {
    const { rec, canvas } = state
    const ctx = canvas.getContext('2d')
    const t0 = now()
    try {
      state.pixels = ctx.getImageData(0, 0, canvas.width, canvas.height, { colorSpace: 'srgb' })
      rec.getImageData = 'ok'
    } catch (error) { rec.getImageData = `${error.name}: ${error.message}` }
    rec.t.getImageData = ms(now() - t0)
    try { canvas.toDataURL('image/png').length; rec.tainted = false } catch { rec.tainted = true }
    rec.t.totalToPixels = ms((rec.t.decode ?? 0) + (rec.t.drawCall ?? 0) + rec.t.getImageData)
    return rec
  },
  dispose() {
    if (!state) return { disposed: false }
    if (state.source && 'close' in state.source) state.source.close()
    if (state.url) URL.revokeObjectURL(state.url)
    if (state.canvas) { state.canvas.width = 0; state.canvas.height = 0 }
    state = null
    const marker = $('marker'); if (marker) marker.style.display = 'none'
    return { disposed: true }
  },
}

async function openPhoto(file, options) {
  const rec = await steps.decode(file, options)
  if (!rec.ok) return rec
  steps.draw()
  await steps.release()
  steps.read()
  return rec
}

// ---- spike-only colour helpers (production must reuse colorUtils.ts) ----
const lin = (c) => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 }
function oklab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b)
  const l = Math.cbrt(.4122214708 * R + .5363325363 * G + .0514459929 * B)
  const m = Math.cbrt(.2119034982 * R + .6806995451 * G + .1073969566 * B)
  const s = Math.cbrt(.0883024619 * R + .2817188376 * G + .6299787005 * B)
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s]
}
const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()

// Plan §8.3 trimmed-mean sampler, on any {width,height,data}.
function samplePatch(img, cx, cy, radius, trim = .2) {
  const px = []
  let transparent = 0, clipped = 0, total = 0
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(img.height - 1, Math.ceil(cy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(img.width - 1, Math.ceil(cx + radius)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue
      total++
      const i = (y * img.width + x) * 4, d = img.data
      if (d[i + 3] < 250) { transparent++; continue }
      if (Math.max(d[i], d[i + 1], d[i + 2]) >= 250 || Math.max(d[i], d[i + 1], d[i + 2]) <= 5) clipped++
      px.push([d[i], d[i + 1], d[i + 2], oklab(d[i], d[i + 1], d[i + 2])])
    }
  }
  if (px.length < total * .5) return { kind: 'no-color', total, transparent }
  px.sort((a, b) => a[3][0] - b[3][0])
  const kept = px.slice(Math.floor(px.length * trim), Math.ceil(px.length * (1 - trim)))
  const mean = [0, 1, 2].map((k) => kept.reduce((s, p) => s + p[k], 0) / kept.length)
  const lab = oklab(...mean)
  const spread = Math.sqrt(kept.reduce((s, p) => s + (p[3][0] - lab[0]) ** 2 + (p[3][1] - lab[1]) ** 2 + (p[3][2] - lab[2]) ** 2, 0) / kept.length)
  return { kind: 'color', hex: hex(mean), oklab: lab.map((v) => +v.toFixed(4)), pixels: px.length, spread: +spread.toFixed(4), clipped: +(clipped / total).toFixed(3), transparent }
}

// Plan §8.4 radius rule: 14 CSS px on screen → image px, clamped [3, 4% of min dimension].
function radiusFor(workingWidth, workingHeight, renderedCssWidth) {
  const r = Math.round(14 * (workingWidth / renderedCssWidth))
  return Math.max(3, Math.min(r, Math.round(.04 * Math.min(workingWidth, workingHeight))))
}

function sampleAt(fx, fy, renderedCssWidth) {
  if (!state?.pixels) return null
  const { width, height } = state.pixels
  const radius = radiusFor(width, height, renderedCssWidth)
  const t0 = now()
  const result = samplePatch(state.pixels, fx * width, fy * height, radius)
  return { ...result, radius, ms: ms(now() - t0) }
}

// Quadrant colours of whatever is in the working canvas (orientation checks).
function quadrants() {
  const p = state?.pixels; if (!p) return null
  const at = (fx, fy) => { const i = (Math.floor(fy * p.height) * p.width + Math.floor(fx * p.width)) * 4; return [p.data[i], p.data[i + 1], p.data[i + 2]] }
  return { size: `${p.width}x${p.height}`, TL: at(.25, .25), TR: at(.75, .25), BL: at(.25, .75), BR: at(.75, .75) }
}

window.spike = { capabilities, steps, openPhoto, sampleAt, samplePatch, radiusFor, quadrants, fit, get state() { return state } }

// ---- manual UI ----
const logLines = []
function log(obj) { logLines.push(JSON.stringify(obj, null, 1)); $('log').textContent = logLines.join('\n\n') }

if ($('file')) {
  capabilities().then((caps) => { $('caps').textContent = JSON.stringify(caps, null, 1) })
  $('file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0]
    event.target.value = '' // allow re-choosing the same photo
    if (!file) return
    const rec = await openPhoto(file, { method: $('method').value, maxEdge: Number($('maxEdge').value) })
    if (performance.memory) rec.jsHeapMB = Math.round(performance.memory.usedJSHeapSize / 1048576)
    log(rec)
  })
  $('preview').addEventListener('click', (event) => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    const fx = (event.clientX - rect.left) / rect.width, fy = (event.clientY - rect.top) / rect.height
    const s = sampleAt(fx, fy, rect.width)
    if (!s) return
    const marker = $('marker'), cssR = s.radius * rect.width / canvas.width
    Object.assign(marker.style, { display: 'block', width: `${cssR * 2}px`, height: `${cssR * 2}px`, left: `${fx * rect.width - cssR}px`, top: `${fy * rect.height - cssR}px` })
    $('swatch').style.background = s.hex ?? 'transparent'
    $('sampleText').textContent = s.kind === 'color' ? `${s.hex} · spread ${s.spread} · ${s.pixels}px · ${s.ms}ms` : 'No color here (transparent)'
    log({ sample: s, at: [fx.toFixed(3), fy.toFixed(3)] })
  })
  $('dispose').addEventListener('click', () => log(steps.dispose()))
  $('copy').addEventListener('click', () => navigator.clipboard?.writeText($('caps').textContent + '\n\n' + $('log').textContent))
}
