# V1.2 Slice 1 — Photo Sampling Engine

Status: **implemented** (pure domain code only; no UI, no image loading, no matching). Written 2026-09-23.
Plan: [V1_2_PHOTO_COLOR_CHECKER_PLAN.md](V1_2_PHOTO_COLOR_CHECKER_PLAN.md) §8. Device findings: [V1_2_SLICE_0_DEVICE_SPIKE.md](V1_2_SLICE_0_DEVICE_SPIKE.md).

## Files

| File | Role |
|---|---|
| `src/domain/photoColor/types.ts` | `PixelSource`, `ImagePoint`, `SampleOptions`, `PhotoSampleResult` and related types |
| `src/domain/photoColor/sampling.ts` | `samplePhotoRegion()` and its named threshold constants |
| `src/domain/photoColor/sampling.test.ts` | Synthetic-pixel tests (no canvas, no images) |
| `src/domain/personalColor/colorUtils.ts` | **Added** `rgbToHex()`. Nothing existing changed. |

Nothing in the app imports `photoColor` yet, so the production bundle is unchanged.

## Contract (frozen for Slices 2–4)

```ts
samplePhotoRegion(image: PixelSource, point: ImagePoint, options?: SampleOptions): PhotoSampleResult
```

**Input**
- `image`: `{ width, height, data }` in `getImageData` layout (RGBA, row-major, non-premultiplied sRGB).
  A DOM `ImageData` fits structurally.
- `point`: **working-image pixel coordinates**, continuous. The origin is the top-left corner, x grows
  right and y grows down. Pixel `(col,row)` covers `[col,col+1) × [row,row+1)`, so its center is
  `(col+0.5, row+0.5)`. Valid points lie in the closed rectangle `[0,width] × [0,height]`.
  The engine knows nothing of CSS pixels, DPR, `object-fit` or bounding boxes. The UI (Slice 4) maps
  display coordinates into this space and clamps pointer positions to it.
- `options.radius`: disc radius in working-image px, ≥ 1. Default is `DEFAULT_SAMPLE_RADIUS = 24`, about
  1,800 pixels, which is the plan §7 per-tap budget for a 1600 px image. The UI should pass the §8.4
  screen-derived radius.
- `options.trimFraction`: in `[0, 0.5)`. The default is 0.2.

**Output**: a discriminated union. Nothing is thrown for normal user conditions.

| Result | When |
|---|---|
| `{ kind: 'color', hex, rgb, oklab, diagnostics }` | Usable sample |
| `{ kind: 'unavailable', reason: 'outside-image' }` | Point outside `[0,w] × [0,h]` |
| `{ kind: 'unavailable', reason: 'transparent' }` | No opaque pixels, or opaque pixels are < 50% of the region |
| `{ kind: 'unavailable', reason: 'insufficient-pixels' }` | 1–4 opaque pixels (never a single-pixel answer) |

On success:
- `hex` uses the `normalizeHex` format (`#RRGGBB`).
- `oklab` is exactly `rgbToOklab(rgb)`, so it is identical to what the manual checker derives from `hex`.
- `diagnostics` contains `regionPixelCount`, `opaquePixelCount`, `retainedPixelCount`, `spread`,
  `highlightFraction`, `shadowFraction` and `flags` (`'mixed' | 'highlight' | 'shadow'`).
- There is no score or percentage.

**Throws `RangeError`** (programming errors only): non-integer or < 1 image size, a buffer length ≠ w·h·4, a non-finite point,
a radius < 1 or not finite, or a trim outside `[0, 0.5)`.

## Algorithm

1. **Region.** Take every in-bounds pixel whose **center** is within `radius` of the point (boundary
   inclusive). The loop covers only the disc's bounding box, clipped to the image, so work is
   O(radius²) and independent of image size. A test proxies the buffer and proves no read falls
   outside that box or the buffer.
2. **Alpha.** Pixels with alpha < `MIN_OPAQUE_ALPHA = 250` are ignored, so transparent black is never
   black. 250 rather than 255 tolerates the near-opaque edges of anti-aliased cut-outs.
3. **Guards.** 0 opaque pixels, or opaque < 50% of the region, gives `transparent`. Fewer than 5 opaque pixels gives
   `insufficient-pixels`. With the plan's minimum radius of 3 a full disc has ≥ 28 pixels, so this only
   triggers at image corners with tiny radii, on tiny images, or at cut-out edges.
4. **Trim.** Pixels are sorted by OKLab L (via the existing `rgbToOklab`). A stable sort keeps scan order
   for ties, which keeps the result deterministic. `cut = floor(n × trimFraction)` pixels are dropped from **each** end.
   Because trim < 0.5, at least `n − 2·floor(0.2n) ≥ 0.6n` pixels are always kept (n = 5 keeps 3).
   Trimming is always symmetric, and there is never a division by zero.
5. **Average.** Take the mean of the retained 8-bit sRGB channels, round it, and convert with
   `rgbToHex` / `rgbToOklab`.
   - **Why sRGB and not linear or OKLab:** it needs no new conversion code. In particular there is
     no OKLab→sRGB inverse, and `linearize` stays private.
   - The output is always a real HEX whose OKLab equals the manual checker's.
   - The retained set is lightness-trimmed and near-uniform, so the gamma-space bias is ≪ 0.01 ΔE_OK
     (the noisy-fabric fixture lands within 0.01 of the truth).
   - For genuinely mixed regions no single average is "right" anyway, which is why they are flagged.
6. **Diagnostics.**
   - `spread` is the RMS OKLab distance of the retained pixels from the representative color.
     - `> MIXED_SPREAD (0.045)` gives `mixed`.
   - `highlightFraction` is the share of opaque pixels with **all** channels ≥ 250.
     - `> 0.35` gives `highlight`.
   - `shadowFraction` is the share of opaque pixels with **all** channels ≤ 5.
     - `> 0.35` gives `shadow`.
   - The "all channels" rule means saturated fabric such as `#FF2020` is a color, not a clipped highlight.
     Well-exposed black fabric such as `#121216` is not a crushed shadow.

All thresholds are exported named constants in `sampling.ts`.

## Deviations from plan §8.3 (deliberate)

| Plan sketch | Slice 1 | Reason |
|---|---|---|
| One `exposure` flag. A pixel is clipped if **any** channel ≥ 250 or all ≤ 5 | Separate `highlight` / `shadow` flags. **All** channels must be clipped | "Any channel" flags saturated fabrics (reds, blues) as blown. Separate flags let the UI give the right fix ("less light" vs "more light"). |
| Clipped fraction over all disc pixels | Over **opaque** pixels | Transparent pixels are neither bright nor dark |
| `no-color/transparent` only | Also `outside-image` and `insufficient-pixels` | Explicit, typed behaviour at the edges |
| `coordinates.ts` in Slice 1 | Deferred to Slice 4 | Display→image mapping belongs to the UI. The engine contract is image pixels only. |
| colorUtils weighted distance / chroma / hue | Deferred to Slice 2 | They have no consumer until matching |

## Measured behaviour (synthetic fixtures, default radius 24, trim 0.2)

| Fixture | spread | Flags |
|---|---|---|
| Solid fabric | 0 | — |
| Fabric + seeded ±12 per-channel noise | 0.020 | — (within 0.01 ΔE_OK of the true color) |
| Knit-like alternating slightly darker rows | 0.021 | — |
| Thin dark pinstripe (1 col in 8) | 0 | — (fully trimmed) |
| 4 px navy/cream stripes | 0.313 | mixed |
| Equal-lightness red/green stripes | 0.129 | mixed (L-trimming cannot hide a hue mix) |
| 1 px high-contrast check | 0.376 | mixed |
| 15% shadow + 15% highlight speckle | 0 | — (exact fabric color; untrimmed it would move > 0.03) |
| 60% crushed shadow / 60% blown highlight | — | shadow / highlight |

Per-tap cost measured in Node 22 on the desktop (i3-12100), on a 1600×1200 buffer: **0.64 ms at r = 24** (~1,800 px) and
**3.2 ms at r = 48** (~7,200 px, the §8.4 cap). A mid-range phone is expected to be a few times slower. That
is still far below the 100 ms tap budget in §20.1. There are no workers, no WASM and no dependencies. Timing is not asserted in tests.
Boundedness is asserted instead: the number of reads is ≤ the bounding box.

## For Slice 2

- Consume `sample.oklab` directly. There is no need to re-parse `hex`.
- Treat `flags` as warnings, not failures. A `mixed` sample still has a color to classify.
- `unavailable` results never reach matching.
