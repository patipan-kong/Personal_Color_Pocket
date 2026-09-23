# V1.2 Slice 3 — Local Photo Image Pipeline

Status: **implemented** (browser service only; no UI, no file picker, no tap handling, no matching).
Written 2026-09-23 on `main` @ `9baf6e3`.
Plan: [V1_2_PHOTO_COLOR_CHECKER_PLAN.md](V1_2_PHOTO_COLOR_CHECKER_PLAN.md) §4, §6, §7, §13, §16.
Device findings (authoritative): [V1_2_SLICE_0_DEVICE_SPIKE.md](V1_2_SLICE_0_DEVICE_SPIKE.md).
Consumers: [Slice 1 sampler](V1_2_SLICE_1_SAMPLING_ENGINE.md), then [Slice 2 matcher](V1_2_SLICE_2_PHOTO_MATCH_ENGINE.md).

| File | Role |
|---|---|
| `src/services/photoImage.ts` | `openPhoto()`: limits, preflight, decode, working canvas, pixels, cleanup, typed errors |
| `src/services/photoImageHeader.ts` | Pure byte parsing: JPEG / PNG / WebP dimensions, HEIF and markup sniffing, overflow-safe cap check |
| `src/services/photoImage.test.ts` | Orchestration tests against recording fakes of the browser APIs (67 tests) |
| `src/services/photoImageHeader.test.ts` | Parser tests on tiny synthetic headers, including seeded fuzzing (73 tests) |
| `src/services/photoImage.fixtures.ts` | Test-only header byte builders (a few dozen bytes each; no binary fixtures) |

Nothing in the app imports the service yet. The production bundle is byte-identical.

---

## 1. Objective

Turn a locally selected `File` into the working-image pixels that `samplePhotoRegion()` already
accepts, safely and without keeping anything behind:

```
File → size cap → header preflight (60 MP cap before decode) → createImageBitmap(file)
     → working canvas (long edge ≤ 1600, sRGB) → getImageData once → { width, height, data }
     → cleanup (bitmap closed, URLs revoked, canvas zeroed)
```

## 2. Input/output contracts

```ts
openPhoto(file: Blob, options?: { signal?: AbortSignal }): Promise<PixelSource>
// PixelSource = { width: number; height: number; data: Uint8ClampedArray }  (Slice 1 type)
// rejects with PhotoImageError { code: PhotoImageErrorCode }
```

- **Input**: a `File` (typed as `Blob`, since only `size`, `slice()` and the decoders are used). No URL,
  no fetch, no base64, no `FileReader`. The name and MIME type are never read.
- **Output**: exactly the Slice 1 `PixelSource`. `data` is the `Uint8ClampedArray` that `getImageData`
  returned, with no copy and no wrapper. It goes straight into `samplePhotoRegion()` (tested).
  - Row-major, 4 bytes per pixel, non-premultiplied sRGB.
  - Alpha is kept.
  - `width` and `height` are the upright (EXIF-applied) working size.
- **Nothing else is returned.** There is no original file, bitmap, object URL, canvas, `drawTo()`
  or `dispose()`. That replaces the plan §16 `WorkingImage` sketch, and the plan is updated.
- **How Slice 4 shows the photo without Slice 3 retaining anything**: Slice 4 owns its visible
  `<canvas>` and paints the prepared pixels into it once:

  ```ts
  canvas.width = image.width; canvas.height = image.height
  canvas.getContext('2d', { colorSpace: 'srgb' })!.putImageData(new ImageData(image.data, image.width, image.height), 0, 0)
  ```

  - `new ImageData(data, w, h)` wraps the existing buffer without copying it.
  - `putImageData` writes the exact sampled values, with no smoothing and no second color conversion.
  - What the user sees is therefore exactly what is sampled.
  - Retained total ≈ display canvas + pixel buffer ≈ 15 MiB at 1600×1200. That is the same "working set
    kept" as Slice 0 §7.
  - There is no object URL and no full-resolution decode to keep alive.
  - Dispose = drop the `PixelSource` and set `canvas.width = canvas.height = 0`.
  - The service's own temporary canvas is already released when `openPhoto` settles.

## 3. File limits

| Limit | Value | Boundary | Checked |
|---|---|---|---|
| Compressed size | `MAX_PHOTO_FILE_BYTES = 30 × 1024 × 1024` (31,457,280 B) | **inclusive**: exactly 30 MiB is accepted, +1 byte rejected | first, before any byte is read |
| Empty file | size 0 | rejected as `invalid-image` | first |
| Source pixels | `MAX_PHOTO_PIXELS = 60,000,000` | **inclusive**: exactly 60 MP accepted (6000×10000, 7500×8000) | from the header, **before decode**; again on the decoded size |
| Working size | `WORKING_MAX_EDGE = 1600` | long edge ≤ 1600, never upscaled | after decode |
| Header read | `HEADER_READ_BYTES = 256 KiB` | the only bytes read by our code | before decode |

All values are the provisional Slice 0 values, unchanged. **60 MP is still provisional pending
physical Android tests A1–A7** (especially A3: 48–50 MP on a 3–4 GB phone). It was not tuned
from desktop behaviour.

The cap check never multiplies two untrusted dimensions. `exceedsPixelLimit` rejects:
- any dimension above the cap on its own
- otherwise, `width > cap / height`, which is exact for these magnitudes (tested up to 2³¹−1 × 2³¹−1, a product above 2⁵³)
- non-positive or non-finite values (never treated as safe)

## 4. Header preflight

`readImageHeader(bytes)` identifies the format **by signature only**:
- JPEG: `FF D8 FF`
- PNG: the 8-byte signature
- WebP: `RIFF….WEBP`

It returns one of:

| Status | Meaning | Service action |
|---|---|---|
| `ok` + width/height | dimensions known | cap check, then decode |
| `malformed` | signature matched, structure or dimensions invalid | `invalid-image`. **Never decoded.** |
| `truncated` | bytes ended before the dimensions | whole file read → `invalid-image`; only a 256 KiB prefix was read → `<img>` probe (§4.1) |
| `unrecognized` | not JPEG/PNG/WebP | markup → `unsupported-format`; otherwise `<img>` probe (§4.1) |

Safety rules for untrusted bytes:
- Every read is bounds-checked.
- Nothing is allocated from a length field. Parsing works on `subarray` views of the prefix.
- Every loop strictly advances, so it terminates.
- Malformed input returns a status and never throws.

Seeded fuzzing covers the parser: 3,000 random or mutated JPEG headers and 2,000 mutated WebP headers.

### 4.1 Formats the parser cannot size: the controlled probe

Rejecting everything that is not JPEG/PNG/WebP would break:
- HEIC on Safari, which decodes it natively and which Slice 0 says must be *attempted*
- AVIF
- GIF

Decoding them blind would defeat the pre-decode 60 MP gate. The service therefore uses the
**Slice 0 header probe**: an unattached `<img>` loaded from a revoked-after-use `blob:` URL, reading
`naturalWidth/Height` on `load`, with no `decode()`.

- Slice 0 measured the probe at **+6–22 MiB and no full decode** in Chromium.
- It reports **oriented** dimensions.
- The cap is enforced on those dimensions before `createImageBitmap` is ever called.
- A probe failure is final:
  - HEIF brand → `unsupported-heic`
  - anything else → `unsupported-format`
  - no second attempt
- The same probe also covers the rare JPEG whose APPn segments push the frame header past 256 KiB.

**Markup is refused outright.** Content that begins with `<` (after an optional BOM or whitespace)
is `unsupported-format` without a probe. It is detected by content, so it applies whatever the file is called. The reasons:
- SVG is not a photo.
- SVG can reference external resources (plan §6).

## 5. JPEG parsing

- The parser walks marker segments from SOI using each segment's length field. It never scans inside a
  segment, so the **EXIF thumbnail's own frame header inside APP1 is skipped** (tested with an embedded
  160×120 frame).
- 0xFF fill bytes and standalone TEM / RST0–7 markers are tolerated.
- The first **SOF0–SOF15** gives height and width. That covers baseline, extended, progressive, lossless
  and arithmetic frames. DHT (C4), JPG (C8) and DAC (CC) are excluded.
- **Malformed** cases:
  - a segment length < 2
  - a length that lands on a non-marker byte
  - a stuffed `FF 00` outside entropy data
  - a second SOI
  - EOI or SOS before any frame header
  - a frame header shorter than its fields
  - zero width
  - zero height (DNL-defined, which browsers don't decode)
- **Truncated**: any cut before the last dimension byte. This is tested for every cut position, and
  includes a length pointing far past the end, which is never allocated.
- **Orientation is not parsed.** Header dimensions are raw frame dimensions, used only for the safety
  gate. For EXIF orientations 5–8 the decoded image has width and height swapped. The **pixel count**,
  the only thing the gate uses, is identical. The working size always comes from the **decoded** image
  (§11).

## 6. PNG parsing

- Requires the 8-byte signature, then `IHDR` as the first chunk, with length 13.
- Reads width and height as big-endian uint32.
- **Truncated**: fewer than 24 bytes (every cut is tested).
- **Malformed**: IHDR length ≠ 13, a first chunk that is not IHDR, zero width or height, or a dimension
  above the PNG maximum of 2³¹−1.
- A damaged signature is `unrecognized`, never "PNG with garbage".
- There is no chunk walking and no CRC check. The decoder validates the rest.

## 7. WebP parsing

The first chunk after `RIFF….WEBP` decides the form:

| Chunk | Layout read | Dimension range |
|---|---|---|
| `VP8 ` (lossy) | key-frame bit, start code `9D 01 2A`, 14-bit width/height (top 2 scale bits masked) | 1–16383 |
| `VP8L` (lossless) | signature `0x2F`, 14-bit width−1 / height−1, version bits must be 0 | 1–16384 |
| `VP8X` (extended: alpha, animation, ICC/EXIF) | 24-bit canvas width−1 / height−1 | 1–2²⁴ |

- **Malformed**:
  - a chunk size too small for its header
  - a VP8 start-code mismatch, a non-key first frame, or zero width/height
  - a VP8L signature or version error
  - an unknown first chunk
- **Truncated**: every cut before the end of the dimension bytes.
- A RIFF container that is not WebP is `unrecognized`.

## 8. HEIC detection

The Slice 0 decision is preserved exactly: HEIC is **never rejected by name or MIME, and decode is
always attempted**.

- A HEIC file is `unrecognized` by the parser, so it goes to the probe (§4.1). On Safari the probe
  succeeds and the photo opens normally (tested). On Chromium the probe fails.
- After any decode or probe failure, `isHeifSignature` checks the prefix, which is already in memory:
  bytes 4–8 must be `ftyp` and the major brand one of
  `heic heix hevc hevx heim heis hevm hevs mif1 msf1 heif`.
  - Match → `unsupported-heic`.
  - `avif`/`avis` are excluded on purpose, since AVIF is a different, often decodable format.
- A real JPEG named `.heic` with type `image/heic` is parsed as JPEG and decodes normally (tested).
- There is no HEIC decoder and no dependency. Friendly copy belongs to Slice 5.

## 9. Preferred decode path

`createImageBitmap(file)` is called with **one argument, and no resize options** (tested). Slice 0 §6
showed Chromium honours `resizeWidth/Height` but with the same peak memory and 30–60% slower, so
they are not a memory optimization.

## 10. Fallback policy

Deterministic, and at most one decoder per file:

| Situation | Action |
|---|---|
| `createImageBitmap` is not a function (old Safari 14) | `<img>` fallback: `blob:` URL → `load` → `decode()` → draw → revoke |
| `createImageBitmap` rejects with `TypeError` or `NotSupportedError` (the engine cannot take a `Blob` source: an API gap) | one `<img>` fallback |
| `createImageBitmap` rejects with anything else (`InvalidStateError`, `EncodingError`, …) | **no fallback**. HEIF brand → `unsupported-heic`, else `decode-failed`. All target engines share one decoder behind both APIs, so a retry would only repeat the failure and the memory spike. |
| Header malformed or truncated | `invalid-image`. **Nothing is decoded.** |
| Probe failed (unknown format / HEIC on Chromium) | final: `unsupported-heic` / `unsupported-format`. **No decode attempt, no retry.** |
| `<img>` fallback fails to load or `decode()` rejects | HEIF → `unsupported-heic`, else `decode-failed`. URL revoked. |

**The fallback is not memory-equivalent.** Chromium keeps `<img>` decodes in its image cache after
revoke: +105–186 MiB retained at 48 MP (Slice 0 §6). It evicts under memory pressure, not on our
schedule. This is why the fallback is limited to API gaps.

## 11. Orientation

- **No EXIF parsing.** The browser applies orientation on decode. Slice 0 verified 24/24
  (orientations 1–8 × every decode path), and also verified that the probe reports oriented
  dimensions.
- The working size and the `drawImage` target come from the **decoded** `bitmap.width/height` (or
  `naturalWidth/Height` in the fallback), never from the raw header. This is tested: a 4000×3000
  header whose decode is upright 3000×4000 gives a 1200×1600 working image.
- The canvas redraw drops all metadata, including GPS.
- On physical devices this is still to be confirmed: A4 (Android portrait) and I1 (iPhone).

## 12. Working resolution

`workingSize(w, h)`:
- If `max(w,h) ≤ 1600`, the size is unchanged. The image is never upscaled.
- Otherwise the long edge becomes **exactly 1600**, and the short edge is
  `max(1, Math.round(short × 1600 / long))`: rounded half-up, never 0.

| Source | Working |
|---|---|
| 4000×3000 | 1600×1200 |
| 3000×4000 | 1200×1600 |
| 4032×3024 | 1600×1200 |
| 5000×5000 | 1600×1600 |
| 1080×2400 | 720×1600 |
| 800×600 | 800×600 |
| 3200×1001 | 1600×501 (500.5 → 501) |
| 10000×3 | 1600×1 (0.48 → clamped to 1) |

A sweep also checks that the aspect ratio is kept within one rounding step. The long edge stays 1600
based on Slice 0 §8.

## 13. Canvas / color management

- A temporary `document.createElement('canvas')` sized to the working size.
- The context is `getContext('2d', { colorSpace: 'srgb' })`.
  - `imageSmoothingEnabled = true` and `imageSmoothingQuality = 'high'`.
  - One `drawImage(source, 0, 0, w, h)`: the browser resamples in a single pass.
- Pixels are read with **exactly one** `getImageData(0, 0, w, h, { colorSpace: 'srgb' })`.
  - The result's length is verified: it must equal `w·h·4`.
- **No ICC or P3 math of our own.** The browser color-manages decoded images into the sRGB canvas.
  Slice 0 §12 measured P3 → sRGB matching the browser's own conversion, with out-of-gamut values
  clipped. That is sufficient for approximate Personal Color guidance, which is already framed as
  "as it appears in this photo". `'srgb'` is requested explicitly so engine default changes can't
  alter results.
- There is no color-management dependency.

## 14. Alpha

- Nothing flattens transparency:
  - no background fill
  - `alpha: false` is never requested
  - the default transparent canvas is drawn onto as-is
- PNG/WebP alpha reaches `data` as decoded. Slice 1 already ignores pixels with alpha < 250 and reports
  `transparent`.
- This is tested end to end: an opaque half samples its exact color, and a transparent half samples as
  `{ kind: 'unavailable', reason: 'transparent' }`.
- Engines store canvases premultiplied. Fully transparent pixels therefore read back as `0,0,0,0`, and
  semi-transparent RGB loses a little precision. Neither matters, because the sampler never uses
  pixels below alpha 250.

## 15. Cleanup lifecycle

| Resource | Created | Released | Tested |
|---|---|---|---|
| Header prefix (≤ 256 KiB) | before preflight | when `openPhoto` settles (kept until then for the HEIC sniff) | – |
| Probe `blob:` URL + `<img>` | probe start | right after `load`/`error`: handlers nulled, `src` removed, URL revoked | every probe path |
| `ImageBitmap` | decode | `close()` **right after `drawImage`, before `getImageData`** (safe: Slice 0 §5); and in `finally` on every failure path | order asserted; closed exactly once on every path |
| Fallback `blob:` URL + `<img>` | fallback decode | after draw, or on load/decode/canvas failure | revoked exactly once |
| Working canvas | rasterize | `width = height = 0` in `finally`, on success and failure | every path |
| `ImageData` wrapper | `getImageData` | not kept; only its `data` buffer is returned | `result` has exactly `width/height/data` |
| `File` | caller | never stored by the service | – |

Every release is idempotent (`once`), so overlapping `finally` blocks can't double-revoke. Every test
ends with an `expectAllReleased()` check:
- each bitmap closed exactly once
- each created URL revoked
- each image detached
- each canvas zeroed
- `fetch` never called

## 16. Error model

Errors are `PhotoImageError`, with `name = 'PhotoImageError'` and `message = code`. The code is one of
the following, and each is produced by a distinct, tested path:

| Code | When |
|---|---|
| `file-too-large` | size > 30 MiB |
| `image-too-large` | width × height > 60 MP, from the header, the probe, or the decoded size |
| `invalid-image` | empty file, or a JPEG/PNG/WebP header that is malformed or truncated within the whole file |
| `unsupported-format` | markup/SVG, or an unrecognized format the browser cannot open (probe fails or reports 0×0) |
| `unsupported-heic` | HEIF `ftyp` brand, and the browser could not open or decode it |
| `decode-failed` | the header was fine but the decoder rejected, or the decoded size was 0×0 |
| `canvas-failed` | no 2D context, `drawImage` or `getImageData` threw, or the buffer length is wrong |
| `aborted` | the caller's `AbortSignal` fired |

There are no user-facing strings in the service. Slice 5 maps codes to EN/TH copy.

## 17. Abort decision

**Supported, minimally.** `openPhoto(file, { signal })` checks `signal.aborted`:
- at the start
- after the header read
- after the probe
- after decode

Slice 4 will let the user pick a second photo while the first is preparing, and the most valuable
cancellation point is *before* a large decode. A signal gives the service one place to release what
it holds. Without it, the UI would have to wait for a stale 48 MP decode, receive its pixels, and
discard them.

In-flight `createImageBitmap` can't be interrupted. If it resolves after an abort, the bitmap is
closed and no canvas is created (tested). There is no timeout, retry or queue infrastructure.

## 18. Privacy

- **No network.** The service and parser sources are audited in tests. They contain no:
  - `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`
  - `http(s)://`
  - `localStorage`, `sessionStorage`, `indexedDB`
  - `console.`
  - `FileReader`, `toDataURL`, `toBlob`
  - dynamic `import(`, `navigator.`, `postMessage`

  A `fetch` spy also stays uncalled in every orchestration test.
- `blob:` URLs are page-local, used only for the probe and the fallback, and revoked immediately.
- **Errors carry the code only**, with no `cause`, because browser exception messages can include URLs.
  A test confirms that a file named `secret-family-photo.heic` leaves no trace in the message, `String()`,
  stack or JSON. File names and MIME types are never read.
- Nothing is persisted. Metadata (EXIF, GPS) is never read, and the canvas redraw drops it.
- **Module boundary** (tested): `photoImage.ts` imports only the `PixelSource` *type* from the domain,
  and never the sampler or matcher. `photoImageHeader.ts` imports nothing.

## 19. Memory characteristics

Preferred path, for a 48 MP (8000×6000) JPEG, largest objects in order:

| Stage | Live objects | Approx. |
|---|---|---|
| Preflight | `File` (owned by the input element / caller; never copied), header prefix | file size (not duplicated) + ≤ 256 KiB |
| Decode | + decoded `ImageBitmap` + decoder scratch | +183 MiB RGBA; measured peak Δ ≈ +250–260 MiB (Slice 0 §7) |
| Draw | + working canvas backing store (1600×1200) | +7.3 MiB |
| After `drawImage` | bitmap **closed**, so it becomes eligible for release | −183 MiB |
| Read | + `ImageData` buffer | +7.3 MiB |
| Settled | canvas zeroed; only the returned buffer remains | **7.3 MiB** (≤ 9.8 MiB at 1600×1600) |

- There are no accidental full-resolution copies: no resize-on-decode, no data URL, no second decode,
  and no second `getImageData`.
- The probe path adds only the probe's +6–22 MiB (Slice 0) before the same sequence.
- The fallback path's `<img>` decode may stay in Chromium's cache (§10).
- Phone peaks are expected at about 250–350 MiB for 48–50 MP, and 320–420 MiB at the 60 MP cap
  (Slice 0 §7). They are unmeasured.

## 20. Test coverage

| Area | Tests |
|---|---|
| JPEG header | 13 SOF variants; many segments; EXIF thumbnail skipped; DHT/JPG/DAC excluded; fill + RST/TEM; every truncation cut; oversized length; 10 malformed structures; 3,000-case seeded fuzz |
| PNG header | valid incl. 2³¹−1; every truncation cut; damaged / short signature; 6 malformed cases |
| WebP header | VP8 (incl. scale bits), VP8L (1×1 … 16384²), VP8X (> 14-bit, 2²⁴); every truncation cut for each form; 9 malformed cases; non-WebP RIFF; 2,000-case fuzz |
| Sniffing / limits | HEIF brands vs AVIF/isom; markup with BOM and whitespace; 12 pixel-cap cases below / exactly at / above 60 MP incl. > 2⁵³ products; non-finite dims |
| Working size | 13 cases (landscape, portrait, square, screenshot, small, exact, half-up, 1 px clamp) + aspect sweep |
| Orchestration | preferred path (single arg, sRGB, smoothing, draw/close/read order, one read); prefix-only read; PNG/VP8/VP8L/VP8X end to end; orientation from the decoded size; no upscale |
| Limits | 30 MiB −1 / exact / +1 (no read on reject, no 30 MB buffer); empty file; 60 MP exact / above for 5 formats before decode; decoded size above the cap; 0×0 decode |
| Header outcomes | malformed/truncated never decoded; oversized-APPn JPEG → probe; unknown → probe → decode; probe above the cap; probe failure; probe 0×0; SVG named `.jpg`; JPEG named `.heic` |
| HEIC | unopenable → `unsupported-heic` with one probe; 3 more brands; Safari-decodable HEIC opens; probe-OK-but-decode-fails |
| Fallback | API missing; `TypeError` / `NotSupportedError` → one fallback; 3 decode errors → no fallback; fallback load / `decode()` failure; HEIC without the API |
| Canvas | null context; `drawImage` throws; `getImageData` throws; wrong buffer length; fallback + canvas failure |
| Abort | pre-aborted (nothing read); abort during decode (bitmap closed, no canvas); abort during probe (URL revoked, no decode) |
| Privacy / boundary | error has code only; source audit of both modules; import allowlist |
| Sampler compatibility | prepared buffer → `samplePhotoRegion()` → exact `#B7410E`; transparent half → `transparent`; the same buffer instance |

Mutation checks were run before committing, and each one failed the suite:
- rejecting exactly 30 MiB
- rejecting exactly 60 MP
- skipping canvas zeroing
- closing the bitmap late
- always falling back
- skipping the revoke
- passing resize options
- skipping the SVG reject
- floor rounding

Real decoding is left to the spike harness, which is unchanged and retained.

## 21. Known device risks

| Risk | Note |
|---|---|
| 48–60 MP decode on low-RAM Android | Unchanged from Slice 0: the pre-decode cap bounds it. **A3 decides the cap.** |
| `<img>` probe cost outside Chromium | Measured only in Chromium (+6–22 MiB). It is used only for non-JPEG/PNG/WebP or oversized-header JPEGs, so the common camera path never probes. |
| Safari `createImageBitmap` orientation | Slice 0 verified orientation in Chromium only. Older WebKit versions had orientation bugs in `createImageBitmap`. Covered by **I1**. If it fails, the fix is local to `decode()`. |
| Engines without `createImageBitmap(Blob)` | These use the `<img>` fallback and its cache retention. None of the targets are expected to. |
| HEIC on Android | Expected `unsupported-heic` (A5/A6). Whether the Android picker transcodes is unknown. |
| Canvas memory limits (iOS) | 1600² is far below the ~16.7 MP limit |

## 22. Physical-device gates

These are unchanged from Slice 0 §17 and block **release**, not Slice 4 coding.

| Test | Gates |
|---|---|
| A1 | picker |
| A2 | 12 MP camera photo |
| A3 | 48–50 MP on a 3–4 GB phone: the cap value |
| A4 | portrait orientation |
| A5 / A6 | real HEIC / HEIF → `unsupported-heic` |
| A7 | airplane mode |
| A8 | 10 photos, leak check |
| I1 / X1 | iPhone sources |
| C1 | Capacitor, Android app release only |

The spike harness at `spikes/photo-device-spike/` is **kept unchanged**. It exercises the same
pipeline shape. Wiring the real service into a device test belongs to Slice 4, whose dev build will
use `openPhoto` itself.

## 23. Slice 4 entry criteria

**GO.**
- `openPhoto` is complete with caps, preflight, decode policy, cleanup, abort and typed errors.
- All suites are green.
- The bundle is unchanged.

Slice 4 should:
1. Call `openPhoto(file, { signal })` from the panel.
   - Create one `AbortController` per selection, and abort the previous one when a new photo is chosen or the panel unmounts.
   - Ignore `aborted` rejections.
   - Reset `input.value = ''` after each selection.
2. Render with its own display canvas via `putImageData(new ImageData(data, w, h))` (§2). Do not create
   object URLs for preview.
3. Show "Preparing photo…" after about 150 ms, and ignore taps until the pixels are ready (Slice 0 §7).
4. Build `coordinates.ts` (display → working-image pixels, radius rule §8.4), then `samplePhotoRegion`
   → `matchPhotoColor`.
5. On dispose: drop the `PixelSource` and zero the display canvas.
6. Map `PhotoImageErrorCode` to states. The copy itself is Slice 5.
7. Use the dev build of Slice 4 on a phone to run A1–A8. The spike can be retired after that.
