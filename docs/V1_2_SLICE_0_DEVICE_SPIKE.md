# V1.2 Slice 0 — Photo Color Checker Device Spike

Status: **desktop portion complete · physical-device portion pending.**
Date: 2026-09-23 · Baseline: `v1.1.0` (`53140e8`) + planning commit.
Design baseline: [V1_2_PHOTO_COLOR_CHECKER_PLAN.md](V1_2_PHOTO_COLOR_CHECKER_PLAN.md) (its §22 summarizes this record).

---

## 1. Objective

Reduce the highest-risk uncertainties of the planned local-only photo pipeline *before* any
product code is written:

- gallery selection
- local-only processing
- large-image decode memory and time
- `createImageBitmap` vs `HTMLImageElement`
- EXIF orientation
- HEIC/HEIF
- working resolution
- Canvas / `getImageData`
- color management
- dependencies
- Capacitor needs

This is **not** an implementation slice. Nothing here is production code.

## 2. Released Baseline

- `main` @ `53140e8e4719fa0c423484eadc62d7927a12c8d3`, tag `v1.1.0`. The entry state was clean
  apart from the untracked plan.
- V1.1 changed only quiz, visual-asset, i18n and style code. `colorUtils.ts`, `colorMatch.ts`,
  `palettes.ts`, `services/*` and `persistence.ts` are **byte-identical to v1.0.0**, so every
  engine assumption in the plan still holds. The only plan corrections were stale
  baseline and line-count references (App.tsx is now ~660 lines, `CheckerView` ≈ L578).

## 3. Original Assumptions (plan) and verdicts

| Assumption | Verdict after Slice 0 |
|---|---|
| No new dependencies | **Confirmed** (§16) |
| No backend | **Confirmed**. The pipeline makes no network calls (§14) |
| `<input type="file" accept="image/*">` | **Expected valid**. Picker behaviour **requires phone test** (§13) |
| File / Blob, `URL.createObjectURL()` | **Confirmed** (object URL only in fallback/probe, revoked, verified) |
| `createImageBitmap` preferred | **Confirmed**, but **without resize options** (**changed**, §6) |
| `HTMLImageElement` fallback | **Confirmed works, demoted**: fallback only where `createImageBitmap` is missing (§6) |
| Canvas + `getImageData()` | **Confirmed**: untainted, works for JPEG/PNG/WebP/transparent PNG (§11) |
| 1600 px long-side working image | **Confirmed** (§8) |
| 30 MB input limit | **Kept**. Synthetic 48 MP JPEG = 10.5 MB. Real 48–50 MP phone JPEGs are typically 8–25 MB |
| 60 MP pixel limit | **Kept, moved earlier**: enforced by a header-only probe *before* decode (**changed**, §7) |
| Local-only, no original-photo persistence | **Confirmed** (§14, §15) |
| HEIC unsupported + friendly error | **Confirmed for Chromium**. Detection is refined to content sniffing (**changed**, §10) |
| No automatic white-balance correction | Unchanged (not a device question) |
| Existing OKLab engine reusable | Unchanged. Color management delivers sRGB, which is what the engine expects (§12) |
| Photo-specific match model | Unchanged (not a device question) |

## 4. Environment Tested

| Item | Value |
|---|---|
| Machine | Windows 11 Pro, Intel Core i3-12100, 16 GB RAM |
| Browsers | **Microsoft Edge 153.0** and **Google Chrome 153.0**, both run with `--headless=new --disable-gpu` so decode and canvas memory land in the renderer process |
| Driver | A throwaway zero-dependency Node 22 script using the Chrome DevTools Protocol over Node's built-in `WebSocket`, with a local `node:http` fixture server. Not committed. |
| Memory source | Windows `Win32_Process` Working Set / **Peak Working Set** of the page's renderer process. A **fresh browser process for every memory case**, so the peak value belongs to that case alone. |
| Harness | [spikes/photo-device-spike/](../spikes/photo-device-spike/) (committed, dev-only, §17) |
| **Not available** | Any physical Android phone, iPhone, Android emulator, or Capacitor shell. No real HEIC file could be produced: the Windows HEIF extension decodes only, and WIC HEIC encoding failed. |

Fixtures were generated programmatically in the browser and never committed:

| Fixture | Details |
|---|---|
| "Photo" JPEGs | 4000×3000 (2.7 MB), 6000×4000 (5.5 MB), 8000×6000 (10.5 MB). Gradient, blobs and noise. |
| Other formats | WebP 12 MP, PNG 1080×2400 screenshot, half-transparent PNG |
| Fabric texture | 12 MP rust, with a weave, ±15 noise, 5% highlight pixels and 5% shadow pixels |
| Stripes | Navy/cream, periods 4, 8, 16 and 32 px at 12 MP |
| EXIF orientation | Quadrant image with an EXIF Orientation tag spliced in for **all 8 values**, plus a 12 MP portrait (EXIF 6) |
| Display-P3 | PNG with an `iCCP` chunk and JPEG with an `ICC_PROFILE` segment, both verified present |
| Format-error cases | A JPEG renamed `.heic` / `image/heic`, a HEIF `ftyp` header, and garbage bytes |

## 5. Local File Pipeline (validated shape)

```
File (from <input>)                        ── never read with fetch/FileReader, never stored
 → size ≤ 30 MB?                           ── before any decode
 → header probe: new Image(objectURL) → onload → naturalWidth/Height → revoke
                                            ── orientation-aware, no full decode (+6–22 MiB)
 → pixels ≤ 60 MP?
 → createImageBitmap(file)                 ── full decode, EXIF applied, ICC → sRGB
 → canvas (≤1600 long edge, 'srgb', imageSmoothingQuality 'high') ← drawImage
 → bitmap.close()                          ── verified: width becomes 0
 → getImageData once ('srgb')              ── deferred raster lands here in Chromium
 → keep only {width,height,data}; drop File reference
 → dispose: canvas.width = canvas.height = 0; drop pixels
```

Closing the bitmap *before* `getImageData` is safe. Every quadrant/sample check after `close()`
returned the correct pixels, because Chromium's recorded draw keeps its own reference until
the raster completes.

## 6. Decode Strategy

| Path | 48 MP peak Δ (Edge / Chrome) | Retained after dispose | Verdict |
|---|---|---|---|
| `createImageBitmap(file)` | +260 / +248 MiB | +63 / +51 MiB | **Preferred** |
| `createImageBitmap(file, {resizeWidth, resizeHeight, resizeQuality:'high'})` | +265 / +254 MiB | +64 / +52 MiB | **Rejected**: no peak benefit, and 30–60% slower |
| `objectURL → img.decode() → drawImage` | +249 / +237 MiB | **+199 / +186 MiB** | **Fallback only** |

- **API vs implementation.** The spec allows an engine to decode at reduced size when
  resize options are given. Chromium 153 **honours** the options (the output is
  1600×1200), but the *peak* is identical to a full decode. The held memory after decode is
  smaller (+70 vs +184 MiB), so the full-size buffer clearly existed only temporarily.
  We therefore **cannot claim** that resize-on-decode reduces peak memory, and we won't rely on it.
  WebKit and other engines are unverified.
- The `<img>` path's decode stays in Chromium's image cache after `revokeObjectURL` and
  `src = ''`: +105–199 MiB is retained. The cache is evicted under memory pressure, but not on
  our schedule. Use it only when `createImageBitmap` is unavailable, which none of our target
  engines lack.

## 7. Large-Image Memory Analysis

Theoretical decoded RGBA = W × H × 4 bytes. The compressed file size is irrelevant.

| Source | Dimensions | Decoded RGBA | Measured renderer **peak Δ** (Edge / Chrome, `createImageBitmap`) | Peak ÷ RGBA | Held after decode | After close + dispose |
|---|---|---|---|---|---|---|
| 12 MP | 4000×3000 | 45.8 MiB | **+77 / +63 MiB** | 1.4–1.7× | +46 / +33 | +17 / +4 |
| 24 MP | 6000×4000 | 91.6 MiB | **+136 / +124 MiB** | 1.35–1.5× | +92 / +80 | +33 / +20 |
| 48 MP | 8000×6000 | 183.1 MiB | **+260 / +248 MiB** | 1.35–1.4× | +184 / +172 | +63 / +51 |
| Probe only | 12 / 48 MP | – | +6 / +22 MiB (Edge) | – | – | – |
| Working set kept | 1600×1200 | 7.3 MiB canvas + 7.3 MiB ImageData ≈ **15 MiB** | – | – | – | – |

The peak path is the full decoded bitmap, plus decoder scratch (JPEG row/MCU buffers), plus
the Skia resampling pass into the working canvas, plus the canvas backing store and the
`ImageData` copy. That comes to about 1.35–1.7 × the decoded RGBA, with the multiplier shrinking
as the image grows. Some residual memory after dispose is allocator retention (PartitionAlloc
keeps freed pages). Three warm repetitions per case completed without errors, but memory was
**not** sampled across repetitions, so leak-freedom over many photos is left to device test A8.

**Phone expectations (category B, not measured).** Android Chrome and WebView use the same
Blink/Skia code, so similar ratios are expected, plus WebView and GPU-raster overhead:

| Source | Expected transient peak on a phone |
|---|---|
| 12 MP | ~65–110 MiB |
| 24 MP | ~125–190 MiB |
| 48–50 MP | ~250–350 MiB |
| 60 MP (the cap) | ~320–420 MiB |

The 60 MP cap turns away 108/200 MP "high-res mode" photos *before* decode. The 48–50 MP band on
a 3–4 GB-RAM Android is the one scenario that could crash a tab, and it must be device-tested.

Desktop timings (first run, File → pixels ready, `createImageBitmap`):

| Browser | 12 MP | 24 MP | 48 MP |
|---|---|---|---|
| Edge | 60 ms | 112 ms | 228 ms |
| Chrome | 54 ms | 102 ms | 190 ms |

**Do not read these as phone numbers.** Expect roughly 3–6× on a mid-range phone: about
0.2–0.4 s for 12 MP and about 0.7–1.5 s for 48 MP. Recommended UX: show *"Preparing photo…"*
if the pipeline hasn't finished within ~150 ms (this avoids a flash on fast devices), and ignore taps
until the pixels are ready.

## 8. Working Resolution

Center sample with the plan's §8.4 radius rule, at a 390 CSS px render width, compared with
a full-resolution sample of the same physical area (Edge; Chrome gave identical colors):

| Fixture | 1280 (4.7 MiB) | 1600 (7.3 MiB) | 2048 (12 MiB) |
|---|---|---|---|
| Fabric (rust, with highlights, shadows and noise): ΔE_OK vs full-res | 0.0006 | 0.0010 | 0.0008 |
| Stripes p4 (finest): spread / ΔE | 0.087 / 0.001 | 0.123 / 0.001 | 0.163 / 0.000 |
| Stripes p8: spread | 0.185 | 0.202 | 0.229 |
| Stripes p16 / p32: spread | 0.245 / 0.269 | 0.254 / 0.277 | 0.266 / 0.282 |
| `getImageData` time (fabric) | 40 ms | 43 ms | 70 ms |

- **The sampled color is resolution-independent** across this range. The disc covers the same
  physical area, and the trimmed mean converges.
- **Pattern detection survives at every size.** All stripe spreads are ≫ 0.045 (`SPREAD_WARN`),
  though finer resolution keeps more of the contrast.
- For 4:3 photos at 390 CSS px, the **4% cap is the binding term** of the radius rule. The disc
  is ≈ 23 CSS px across, which is fingertip-sized. That is fine, and the rule needs no change.
- **Decision: keep 1600.** 1280 gives the same color for 35% less memory, but a portrait photo
  rendered 390 CSS px wide on a DPR 3 phone needs ≥ 1170 device px of width: 1280 long edge gives 960 px
  (visibly soft), while 1600 gives 1200 px (sharp). 2048 costs 65% more memory and time for no product
  benefit.

## 9. EXIF Orientation

- **24/24 correct** in Edge and Chrome: orientations 1–8 × {`createImageBitmap`,
  `createImageBitmap`+resize, `img.decode()`+`drawImage`}. Quadrant colors matched the expected
  transform, and the width/height swap for orientations 5–8 was correct.
- The header probe reports **oriented** dimensions (the 12 MP EXIF-6 file gave 3000×4000, which
  produces a 1200×1600 working canvas), so cap checks and target sizes are correct for portrait photos.
- Chromium 153 treats `imageOrientation: 'none'` as `from-image` (the spec renamed the values).
  That is irrelevant to us, because we always want orientation applied.
- **No EXIF library.** EXIF is never read by our code. Redrawing to canvas discards all
  metadata, including GPS.
- **Expected but not verified:** Android WebView (same Blink code) and iOS Safari 13.1+ apply
  orientation the same way. The fallback behaviour is identical because both paths are covered above.

## 10. HEIC / HEIF

Verified in Chromium 153 (desktop):

- `ImageDecoder.isTypeSupported('image/heic' | 'image/heif')` → **false**, while JPEG, PNG,
  WebP, AVIF and GIF → true.
- A HEIF `ftyp` header fails in **< 2 ms**: `createImageBitmap` throws `InvalidStateError`, and
  `img.decode()` throws `EncodingError`. There is no hang and no memory spike.
- **A real JPEG named `.heic` with type `image/heic` decodes normally.** Browsers sniff the content.
  Rejecting by extension or MIME would therefore break files that are actually fine (some share
  and export flows keep a `.heic` name on transcoded JPEGs).

Expected (category B), to be verified on devices:

- **iPhone Safari:** with `accept="image/*"`, the photo picker hands the page a
  **JPEG-transcoded** file ("Most Compatible" behaviour), and recent Safari can decode HEIC itself,
  so this should work.
- **Android Chrome / WebView:** Chromium has no HEIC decoder, so a genuine HEIC (an iPhone original
  copied over as-is, or Samsung's "Save as HEIF" option) **will fail**. Whether the Android Photo
  Picker transcodes HEIC for web callers is **unknown**. That is a device test (§17, case A5/A6).

**Decision: option A.** Always attempt the decode. On failure, read the first 12 bytes
(`blob.slice(0, 12)`). If bytes 4–8 are `ftyp` and the brand is one of
`heic heix hevc heim heis mif1 msf1 heif`, show the HEIC message. Otherwise show the generic
"couldn't open" message. That costs a few lines and no dependency.

Workaround copy for users (EN draft):

> *This photo is in HEIC format, which this app can't open yet. Take a screenshot of the photo and
> choose the screenshot instead, or change your camera setting to save as JPEG ("Most
> Compatible" on iPhone).*

Rejected options:

- **B** (proactively reject HEIC by name/MIME): wrong, because it blocks mislabelled JPEGs and
  HEICs that the platform has already transcoded.
- **C** (a WASM decoder): roughly 1–2 MB+, plus a large decode memory spike on low-end phones, for a
  minority case.

## 11. Canvas / Pixel Access

- `getImageData` succeeded and `toDataURL` did not throw (**untainted**) for every fixture and
  both decode paths:
  - JPEG 12/24/48 MP
  - WebP
  - PNG screenshot
  - transparent PNG
  - P3 PNG/JPEG
  - EXIF files
- Local `File` and `blob:` sources are same-origin. No remote URLs are involved.
- Transparent PNG: the sampler returned `no-color` on the transparent half (4053/4053 pixels
  transparent) and a real color on the opaque half. A disc straddling the alpha edge at exactly 50%
  also returned `no-color`. **For Slice 1:** define the threshold explicitly (sample when at least 50% of the
  in-bounds pixels are opaque) and test the boundary.

## 12. Color Management

- **Display-P3 content is converted to sRGB on decode.** A P3 patch `color(display-p3 0.8 0.3 0.3)`
  read back as `#DD4047` (PNG) or `#DC4149` (JPEG, with compression error). The browser's own P3→sRGB conversion gives
  `(221, 64, 71)`. An unmanaged read would have given `#CC4D4D` (ΔE ≈ 0.04, large enough to shift a
  match category).
- Out-of-sRGB-gamut P3 (pure P3 green) is **clipped** to `#00FF00`.
- **What V1.2 can assume.** `getImageData` on an `'srgb'` 2D canvas returns 8-bit, gamma-encoded,
  color-managed **sRGB**. That is exactly what `rgbToOklab()` and the sRGB HEX palette expect.
- **Limitations to communicate:**
  - very saturated wide-gamut colors are slightly clipped
  - 8-bit quantization is involved
  - the dominant error remains lighting, white balance and camera processing (plan §12). All of this is
    covered by the existing "as it appears in this photo" framing.
- **No explicit color-profile processing** is needed. Request `colorSpace: 'srgb'` explicitly in
  `getContext` and `getImageData`, for determinism across engines whose defaults might change.

## 13. Browser vs Capacitor

| Topic | Mobile browser | Capacitor Android WebView (future) |
|---|---|---|
| Picker | `<input type="file" accept="image/*">` opens the system chooser / Android Photo Picker (**expected**, phone test A1) | Capacitor's `BridgeWebChromeClient.onShowFileChooser` services file inputs, so the same markup should work (**expected**, test C1) |
| Permissions | None. The picker grants access to the chosen item only. | None needed for a picker selection. **Do not** declare `READ_MEDIA_IMAGES`, which Play policy restricts. |
| URIs | JS receives a `File`. We never see paths. | The chooser returns a `content://` URI that the WebView exposes as a `File`, so our code never sees URIs. |
| Decode / Canvas | Blink (verified on desktop) | The same Blink engine, following the device's WebView version |
| Plugin | – | **`@capacitor/camera` not needed.** It would add native code and a permission surface for no gain. |

**One shared web implementation** is recommended. Keep `openPhoto(file)` behind a service
boundary so a native path could be added later, but only if device testing shows it is needed.

## 14. Privacy Verification

- **Pipeline:** no step uses `fetch`, XHR, upload, a remote URL, a backend, or an external service.
  - `blob:` URLs are page-local and revoked (verified: `fetch(revokedUrl)` rejects).
  - The spike harness itself makes no requests after page load.
  - The runner's fixture `fetch` exists only to automate the tests. The real flow receives a `File`
    from the input.
- **Released app scan** (`src/`, `index.html`, `vite.config.ts`, and dependencies at v1.1.0):
  - **zero** `fetch`/XHR/`sendBeacon`/WebSocket
  - no analytics, telemetry, Sentry or `@vercel/analytics`
  - no global `error`/`unhandledrejection` reporters
  - the only outbound-looking API is `navigator.clipboard` inside the DEV-only diagnostics panel
- **Conclusion:** *"Your photo stays on this device. It isn't uploaded or saved."* is truthful for
  this design.
- **Safeguards for Slice 3+:**
  1. `services/photoImage.ts` never logs or throws with the file name or bytes in its messages.
     Error codes only.
  2. Any future analytics or crash reporter must allowlist enum events only. Add a code comment
     at the boundary.
  3. Add a privacy test (plan §17): after a photo flow, the `fetch` spy has 0 calls and the
     localStorage keys are unchanged.
  4. Never persist `ImageData`, data URLs, object URLs, or file names.
  5. Add a manual airplane-mode check on a phone (§17, test A7).

## 15. Cleanup Lifecycle

| Resource | Created | Released | Verified |
|---|---|---|---|
| Probe `blob:` URL + `Image` | probe start | right after `onload`: `revokeObjectURL` and `img.src=''` | ✓ |
| `ImageBitmap` (full size) | decode | `close()` right after `drawImage` (safe before readback) | ✓ `width === 0` |
| Fallback `blob:` URL | fallback decode | `revokeObjectURL` after draw | ✓ `fetch` rejects |
| `File` reference | input `change` | dropped after decode, and `input.value = ''` so the same photo can be chosen again | implemented in harness (not memory-measured separately) |
| Working canvas | draw | on "another photo" or unmount: `width = height = 0` | ✓ |
| `ImageData` | single read | held by the panel's state only. Dropped on dispose. Never global, never persisted. | ✓ (memory returns to near baseline) |

Memory after one open/dispose cycle returned to within +4–63 MiB of baseline (allocator
retention, §7). Behaviour over many cycles is unverified (device test A8).

## 16. Dependency Decisions

| Library | Decision | Why native is sufficient |
|---|---|---|
| Image processing | **NO** | `createImageBitmap`, Canvas and `drawImage` with `imageSmoothingQuality:'high'` decode, orient, color-manage and downscale correctly (§6–§12) |
| Color | **NO** | The existing `rgbToOklab`/`colorDistance` are correct, and decoded pixels are already sRGB (§12) |
| EXIF | **NO** | Orientation is applied by every decode path (24/24). Metadata is never needed. |
| HEIC | **NO** | Chromium can't decode it, and a WASM decoder is heavy. Content sniffing plus friendly copy is enough (§10). |
| Capacitor Camera/Photos plugin | **NO** | The file input works through the WebView chooser without permissions (expected, to be confirmed in C1) |

Nothing was added to `package.json` during Slice 0.

## 17. Device Test Matrix

Legend: ✅ verified here · ⏳ requires physical device · — not applicable.

| # | Platform | Source | Dims / MP | File size | Decode | Orientation | Time to pixels | Peak memory Δ | getImageData | Cleanup | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| D1 | Desktop Edge 153 | JPEG | 4000×3000 / 12 | 2.7 MB | ✅ | ✅ | 60 ms | +77 MiB | ✅ | ✅ | |
| D2 | Desktop Edge 153 | JPEG | 6000×4000 / 24 | 5.5 MB | ✅ | ✅ | 112 ms | +136 MiB | ✅ | ✅ | |
| D3 | Desktop Edge 153 | JPEG | 8000×6000 / 48 | 10.5 MB | ✅ | ✅ | 228 ms | +260 MiB | ✅ | ✅ | resize options give no peak benefit |
| D4 | Desktop Chrome 153 | JPEG 12/24/48 | as above | as above | ✅ | ✅ | 54 / 102 / 190 ms | +63 / +124 / +248 MiB | ✅ | ✅ | matches Edge |
| D5 | Desktop Edge + Chrome | EXIF 1–8, 12 MP EXIF 6 | 300×200, 4000×3000 | 2.5 kB, 79 kB | ✅ | ✅ 24/24 | – | – | ✅ | ✅ | |
| D6 | Desktop Edge + Chrome | WebP / PNG screenshot / transparent PNG | 12 MP / 2.6 MP / 1.1 MP | 2.0 / 5.5 / 1.2 MB | ✅ | ✅ | 219 / 74 / 20 ms | – | ✅ | ✅ | transparent area gives `no-color` |
| D7 | Desktop Edge + Chrome | P3 PNG / JPEG | 400×300 | 4 / 2 kB | ✅ | – | – | – | ✅ | ✅ | converted to sRGB |
| D8 | Desktop Edge + Chrome | HEIF header / JPEG named `.heic` | – | 64 B / 2.7 MB | ✅ fails fast / ✅ decodes | – | < 2 ms | – | – | – | content is sniffed |
| A1 | Android Chrome | picker opens gallery | – | – | ⏳ | – | – | – | – | – | no permission dialog expected |
| A2 | Android Chrome | own 12 MP camera JPEG | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | |
| A3 | Android Chrome | 48–50 MP high-res mode JPEG | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | **key memory test**, ideally on a 3–4 GB RAM device |
| A4 | Android Chrome | portrait photo | ⏳ | | ⏳ | ⏳ | | | | | |
| A5 | Android Chrome | iPhone HEIC copied as original | ⏳ | ⏳ | ⏳ expected fail | | | | | | error message path |
| A6 | Android Chrome | Samsung "Save as HEIF" (if available) | ⏳ | | ⏳ | | | | | | does the picker transcode? |
| A7 | Android Chrome | airplane mode after page load | | | ⏳ | | | | | | privacy / offline |
| A8 | Android Chrome | 10 photos in a row, no reload | | | ⏳ | | | ⏳ | | ⏳ | leak check |
| I1 | iPhone Safari (optional) | own HEIC photo via picker | ⏳ | ⏳ | ⏳ expected OK (transcoded) | ⏳ | ⏳ | | ⏳ | | report `type` shown |
| X1 | Android Chrome | iPhone-originated **JPEG** (Most Compatible) | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | | ⏳ | | |
| C1 | Capacitor WebView (future) | picker, 12 MP, 48 MP | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | when the Android shell exists |

### Manual procedure (for the ⏳ rows)

1. On the dev PC, run `npm run dev`. The script already binds `0.0.0.0`. Note the PC's LAN IP.
   Allow Node through the Windows firewall if prompted.
2. On the phone, on the same Wi-Fi, open
   `http://<PC-IP>:5173/spikes/photo-device-spike/index.html`.
3. Copy the **Capabilities** block ("Copy log"). It records the UA, DPR, `deviceMemory`,
   resize support, and `ImageDecoder` HEIC support on that device.
4. For each case, keep *Method = createImageBitmap* and *Max edge = 1600*, choose the photo, and record:
   - `type`, `bytes`, `intrinsic`, `megapixels`
   - `t.decode`, `t.getImageData`, `t.totalToPixels`
   - `ok` / `error`
   - `cleanup`
   - whether the preview is **upright**

   Then tap a plain area and confirm the marker ring sits where you tapped and the swatch looks right.
5. **A3:** repeat with each *Method*. If the tab reloads or shows "Aw, Snap!", record the device RAM
   and megapixels. That is the signal to lower the cap.
6. **A7:** load the page, enable airplane mode, then choose and sample a photo. It must still work.
   Optionally use `chrome://inspect` → Network: no requests should appear after choosing a photo.
7. **A8:** choose 10 photos in succession, pressing *Dispose* between some of them. There should be
   no crash or growing sluggishness.
8. **C1 (later):** in the Capacitor project, point `server.url` at the dev server (live reload), open
   the same path, and repeat A1–A3. Confirm no permission prompt and that `AndroidManifest.xml`
   contains no media permissions.

## 18. Verified vs Expected vs Untested

**A. Verified in this environment** (desktop Chromium 153: Edge and Chrome)
- The local pipeline and cleanup
- `createImageBitmap` peak memory at 12/24/48 MP, and that resize options give no peak benefit
- Header-probe cost
- `<img>` cache retention
- EXIF 1–8 on all paths
- HEIC/HEIF undecodable in Chromium, fast failure, content sniffing
- Untainted `getImageData` for all formats
- P3/ICC → sRGB
- Transparency handling
- 1280/1600/2048 give equal colors
- No network or analytics in the app
- No dependency needed

**B. Expected from platform/API behaviour (not measured)**
- Android Chrome and WebView behave like desktop Blink for decode, orientation, color and tainting
- Phone decode is 3–6× slower, with similar memory ratios
- The iOS picker transcodes HEIC to JPEG
- Capacitor services `<input type=file>` without permissions or plugins

**C. Requires a physical device**
- Rows A1–A8, I1, X1 and C1 in §17. Above all:
  - A3 (48–50 MP on low-RAM Android)
  - A5/A6 (real HEIC/HEIF on Android)
  - A1/C1 (picker and permissions)

## 19. Risks

| Rank | Risk | Status after Slice 0 |
|---|---|---|
| HIGH | Tab crash on 48–60 MP photos on low-RAM Android | Quantified (~250–420 MiB transient). Mitigated by the pre-decode cap. **Needs A3.** If it fails, lower the cap (for example to 50 MP or 24 MP) and show the friendly "too large" copy. |
| MEDIUM | HEIC share frequency on Android is unknown | Cheap error path designed. **Needs A5/A6.** Revisit a decoder only if real users hit it often. |
| MEDIUM | Capacitor chooser behaviour | Expected fine. **Needs C1** before the *Android* release (does not block the web V1.2 release). |
| LOW | Timing on slow phones | "Preparing photo…" state after 150 ms, and taps disabled until ready |
| LOW | Engine defaults for canvas color space change | Pass `'srgb'` explicitly |
| LOW (tooling) | Plain `npm test` also runs the git-ignored `.kilo/worktrees/endurable-sundial/` copy of the repo (330 tests reported instead of **165**) | Not introduced by this pass and not modified. The canonical suite passes 165/165 with `--exclude "**/.kilo/**"`. Suggest a one-line `test.exclude` in `vite.config.ts` as a separate, explicit change. |

## 20. Final Slice 0 Recommendation

The architecture holds with **four evidence-driven adjustments**, all of which make it smaller or
safer:

1. Use plain `createImageBitmap` (no resize options).
2. Do a header-only dimension probe and enforce the cap before decode.
3. Demote `<img>` to a fallback only.
4. HEIC: sniff the content and never reject by name or MIME.

No dependency, backend, EXIF parser, color-profile code or Capacitor plugin is required.

## 21. Slice 1 Entry Criteria

**Outcome: GO WITH CONDITIONS.**

| Condition | Blocks coding? | Blocks release? |
|---|---|---|
| Slices 1–3 (pure sampling, match engine, image service with mocked browser APIs) | **No**. They don't depend on device results. | – |
| A1–A3 on at least one real Android phone, preferably 3–4 GB RAM, including a 48–50 MP photo | No | **Yes: web V1.2 release.** The cap value may change. |
| A4, A5/A6 and A7 (portrait, HEIC error path, airplane-mode privacy) | No | **Yes: web V1.2 release** |
| I1 / X1 (iPhone sources) | No | No, but strongly recommended |
| C1 (Capacitor WebView chooser) | No | **Yes: Android app release only** |
| Retire `spikes/photo-device-spike/` | No | Remove it after the device matrix is filled in, no later than V1.2 release |

Slice 1 may begin now.
