# V1.2 Slice 4: Photo Checker Integration Core and Coordinates

Status: **done**. This slice is glue and geometry only. It has no UI, no file picker, no route, no copy
and no persistence, and the production bundle is byte-identical (nothing imports these modules yet).

Files:
- [coordinates.ts](../src/domain/photoColor/coordinates.ts): pure geometry (contain rect, tap mapping, radius rule).
- [inspect.ts](../src/domain/photoColor/inspect.ts): pure glue from a tap to `samplePhotoRegion` and then `matchPhotoColor`.
- [types.ts](../src/domain/photoColor/types.ts): new geometry and result types, added at the end.
- Tests: [coordinates.test.ts](../src/domain/photoColor/coordinates.test.ts) (82) and
  [inspect.test.ts](../src/domain/photoColor/inspect.test.ts) (19).

The sampler, the matcher, the image pipeline and the manual checker are unchanged.

## 1. Objective

Connect the pieces built so far without building the screen:

```
PixelSource (Slice 3) + display geometry + tap + known subtype
  → displayToImage → samplePhotoRegion (Slice 1) → matchPhotoColor (Slice 2) → typed result
```

The whole non-visual pipeline is proven here with synthetic RGBA buffers.

## 2. Coordinate spaces

| Space | Unit and origin | Who produces it |
|---|---|---|
| **A. Display (container)** | CSS px. The origin is the top-left of the preview container's content box; x goes right and y goes down. | The UI: `clientX − containerRect.left`, `clientY − containerRect.top` |
| **B. Displayed image rect** (`DisplayRect`) | Same space as A. This is where the photo is actually drawn, with the letterbox excluded. | `fitContain(image, containerSize)` (pure) |
| **C. Working image** (`ImagePoint`) | Working-image px, continuous. Pixel `(col,row)` covers `[col,col+1)×[row,row+1)` and its center is `(col+0.5,row+0.5)`. Valid points are in the closed rectangle `[0,width]×[0,height]`. | `displayToImage(point, rect, image)` |

The canvas **backing store** (`canvas.width/height`) is a fourth size. It is never an input to the mapping (§8).

## 3. Aspect-fit calculation

`fitContain(image, container)` reproduces CSS `object-fit: contain` with the default centered `object-position`:

```
if container.w · image.h ≥ container.h · image.w      // box relatively wider → height binds
  h = container.h;  w = min(container.w, container.h · image.w / image.h)
  x = (container.w − w) / 2;  y = 0
else                                                // box relatively taller → width binds
  w = container.w;  h = min(container.h, container.w · image.h / image.w)
  x = 0;  y = (container.h − h) / 2
```

- Aspect ratios are compared by cross-multiplication, so the binding axis is chosen with no division.
- The binding axis equals the container length exactly. The `min` guarantees the rect never exceeds
  the container, even after round-off.
- A container that is 0 wide or high (not laid out yet) gives an empty rect. Every tap on it is outside.
- A non-finite or negative container, or an image that is not positive and finite, throws `RangeError`.
  These are programming errors.

The domain never reads browser layout. The UI measures the container and asks the domain where the photo goes.

## 4. Letterboxing

The container is not assumed to match the photo. Examples with a 1600×1200 working image:

| Box (CSS px) | Image rect | Empty bands |
|---|---|---|
| 390×500 (phone) | x 0, y 103.75, 390×292.5 | top/bottom 103.75 |
| 430×600 | x 0, y 138.75, 430×322.5 | top/bottom 138.75 |
| 1280×720 (desktop) | x 160, y 0, 960×720 | left/right 160 |
| 1200×1600 portrait in 390×500 | x 7.5, y 0, 375×500 | left/right 7.5 |
| 1200×1600 portrait in 1280×720 | x 370, y 0, 540×720 | left/right 370 |

A tap in a band returns `{ kind: 'outside-displayed-image' }`. It is not an error, and nothing is sampled.

## 5. Tap mapping

```
inside ⇔ rect.x ≤ p.x ≤ rect.x + rect.w  and  rect.y ≤ p.y ≤ rect.y + rect.h      (closed)
u = (p.x − rect.x) / rect.w,   v = (p.y − rect.y) / rect.h                        (normalized, [0,1])
image.x = u · image.width,     image.y = v · image.height
```

The only floating-point handling is:
- A tap exactly on the far edge (`p.x === rect.x + rect.w`) snaps to exactly `width`. Otherwise
  `(x + w − x) / w` can be 1 − 1 ulp. This showed up in the property tests, as `390.9999999999999` instead of `391`.
- A clamp to `[0,width]×[0,height]`. It is a safety net against round-off only. It cannot pull an outside
  tap in, because the inside test runs first.

`imageToDisplay` is the inverse, used to position the marker. `imageLengthToDisplay` converts the sample
radius into a display length, so the ring can be drawn at the sampled size.

## 6. Boundary semantics

These agree with Slice 1: continuous coordinates and a closed rectangle.

| Tap (display) | Image point |
|---|---|
| Image-rect top-left | `(0, 0)` |
| Top-right / bottom-left / bottom-right | `(W, 0)` / `(0, H)` / `(W, H)` |
| Center | `(W/2, H/2)`, exactly |
| Any edge, exactly | `0` or `W` / `H` on that axis |
| 1e-9, 1e-6, 0.01, 0.5 or 20 CSS px beyond any edge | outside |

- A tap position is **not** a pixel index. On a 4×2 image drawn 400×200, the first pixel's center
  `(0.5, 0.5)` is at CSS `(50, 50)`, and CSS `(400, 200)` maps to `(4, 2)`. That is the far corner, which
  is a valid Slice 1 point; its disc reads the last pixels.
- Edge and corner taps sample a partial disc. Slice 1 clips the disc to the image.

## 7. DPR handling

The mapping uses only **ratios of display lengths**. The same layout expressed in CSS px or in device
px (CSS × DPR) gives the same image point. So:
- **Do not multiply by `devicePixelRatio`** anywhere in the tap path.
- Take the pointer position and the container rect in the same unit, which is CSS px from
  `PointerEvent.clientX/Y` and `getBoundingClientRect()`.

Tests:
- DPR 1, 1.5, 2, 2.625, 2.75, 3 and 4, including fractional CSS boxes, agree to 1e-9.
- Power-of-two DPRs agree bit-for-bit.
- The backing-store size never appears in the API.

Browser page zoom and pinch-zoom scale `clientX` and `getBoundingClientRect` together, so they cancel in
the same way.

## 8. Canvas preview contract (for Slice 5)

Three sizes stay separate:

| Size | Value | Set by |
|---|---|---|
| Backing store | `canvas.width = image.width`, `canvas.height = image.height` (e.g. 1600×1200) | `putImageData(new ImageData(data, w, h), 0, 0)`, drawn once (Slice 3 §2) |
| CSS display size and position | `left/top/width/height = fitContain(image, containerSize)` | The UI, recomputed on resize (ResizeObserver) |
| Image coordinates | `[0,W]×[0,H]` | Owned by `PixelSource`, and never changed by display |

- The backing store is **not** sized by DPR. 1600 px already exceeds `CSS width × DPR` on phones: a
  390 CSS px box at DPR 3 is 1170 device px, and Slice 0 §8 found 1600 sharp. The compositor scales it
  down, and the tap mapping is unaffected either way.
- If a future view needs a DPR-sized backing store (for example zoom), draw with `drawImage` and
  `setTransform(dpr, …)`. That changes only how pixels are painted. Taps still map through the CSS rect,
  and sampling still reads the `PixelSource`, never the display canvas.
- Position the canvas with the `fitContain` rect instead of relying on `object-fit`. What is drawn is
  then exactly the rect the math uses. The canvas and the container need no border or padding, or the
  UI must subtract them from the pointer offset.
- Draw the marker as a separate overlay, at `imageToDisplay(point)` with a radius of
  `imageLengthToDisplay(radius)`. Never paint it into the pixel canvas, and never read pixels back from
  the display canvas.
- On resize, keep the selected **image** point and recompute the marker's display position. A resize
  never changes the sample.

## 9. Sampling radius decision

**Decision: option A, a fixed working-image radius that is independent of the preview size**, with the
plan §8.4 small-image cap:

```
radius = max(3, min(DEFAULT_SAMPLE_RADIUS = 24, round(0.04 · min(width, height))))
```

- Every photo that `openPhoto` downsizes has a 1600 px long edge. For those, the radius is always
  **24 px**, which is the same share of the photo (1.5% of the long edge) and so roughly the same
  garment area on every phone and desktop. This holds for aspect ratios up to 8:3 (short edge ≥ 600).
- Small images, where the source is below 1600 px, get 4% of their short edge. A disc never spans a
  large share of a thumbnail-sized photo, and the floor of 3 px keeps at least 28 pixels for trimming.
- **The preview size cannot enlarge the disc.** An 80 px preview still samples 24 working px (the ring is
  1.2 CSS px). Under the old screen-derived rule, a small preview meant a large image radius.
- Slice 1's default (24) is reused unchanged, and nothing new is tuned.

Why not the plan §8.4 screen-derived rule (14 CSS px × scale):
- Slice 0 §8 measured that on phones the 4% cap is always the binding term. The dynamic part only ever
  mattered on large displays, where it *shrank* the region.
- The sampled color is resolution-independent across this range (Slice 0 §8).
- So there is no evidence that screen-derived scaling improves results, and it would make the answer
  depend on window size.

On a 390 CSS px phone, the disc is about 12 CSS px across, which is smaller than a fingertip. Sampling
precisely where the marker shows is intended. Revisit only if the phone tests show that users
consistently mis-hit.

## 10. Integration API

```ts
inspectPhotoTap(image: PixelSource, tap: { point: DisplayPoint; imageRect: DisplayRect }, subtype: Subtype): PhotoTapInspection
inspectPhotoPoint(image: PixelSource, point: ImagePoint, subtype: Subtype): PhotoPointInspection   // keyboard marker
```

1. `inspectPhotoTap` maps the tap. Outside the rect, it returns `outside-displayed-image` and samples nothing.
2. `inspectPhotoPoint` takes `radius = sampleRadiusFor(image)` and calls `samplePhotoRegion(image, point, { radius })`.
3. If the sample is `unavailable`, it returns that reason with the point and radius.
4. Otherwise it calls `matchPhotoColor(sample, subtype)` and returns both results unmodified. A test
   deep-compares them with direct sampler and matcher calls.

The subtype is used exactly as given. There is no quiz re-scoring, no inference from the photo and no
confidence. `inspect.ts` imports no colour math (audited).

## 11. Result states

```ts
type PhotoTapInspection =
  | { kind: 'outside-displayed-image' }                                         // letterbox / not laid out
  | { kind: 'unavailable'; point; radius; reason: 'outside-image' | 'transparent' | 'insufficient-pixels' }
  | { kind: 'matched'; point; radius; sample: PhotoColorSample; match: PhotoColorMatch }
```

- Normal outcomes never throw and are never `null`.
- `outside-image` cannot come from a mapped tap. It only reaches `inspectPhotoPoint` callers that pass
  an off-image point.
- Programming errors still throw, as the lower layers define:
  - a malformed `PixelSource`
  - a non-finite point
  - an invalid rect

## 12. Warning propagation

`sample.diagnostics.flags` is kept intact, and `match.warnings` is the matcher's copy of it. End-to-end tests:

| Fixture | Flags | Category check |
|---|---|---|
| 2 px red/blue stripes | `mixed` | equals the matcher's category for the same sample with no flags |
| Best color with 40% blown white | `highlight` | same |
| Best color with 40% crushed black | `shadow` | same |
| Best color with 15% white + 15% black | none (trimmed away) | exact Best HEX, `near-face` |

## 13. End-to-end tests

All synthetic RGBA, deterministic (`inspect.test.ts`, 19 tests; the subtype is `warm-autumn`):

- **Solid Best** on a real 1600×1200 buffer, 390×500 box, center tap:
  - maps to the point `(800,600)` with radius 24
  - gives the exact HEX, `near-face` and no warnings
- **Solid Harder:** `away-from-face`, with `resembles` naming that Harder color.
- **Split images:**
  - left/right halves under a letterbox
  - top/bottom halves under a desktop pillarbox
  - each tap reads the correct half
- **Letterbox taps:** `outside-displayed-image`, including 0.01 px beyond the drawn edge.
- **Exact corners and edges:** these sample successfully.
- **Transparent half:** `unavailable / transparent`, with the point and radius. The opaque half still matches.
- **2×2 image:** `insufficient-pixels`.
- **Mixed, highlight, shadow and mild contamination:** §12.
- **Consistency checks:**
  - the output deep-equals direct sampler and matcher calls
  - all 12 subtypes pass through unchanged
  - `inspectPhotoPoint` equals the tap path
  - the output is deterministic
  - programming errors throw
  - there is no colour logic, DOM access or storage (source audit)

The geometry tests (`coordinates.test.ts`, 82 tests) cover:
- the contain table: same aspect, portrait/landscape swaps, square combinations, fractional and sub-pixel boxes
- realistic 390×500, 430×600 and 1280×720 boxes for 1600×1200 and 1200×1600 images
- boundaries, letterbox and pillarbox, round-off at the edges, and pixel index versus coordinate
- DPR
- invariants on 200–3,000 seeded generated cases:
  - the rect stays within the container, binds one axis, is centered and keeps the aspect ratio
  - center maps to center, and edges map to 0 / W / H
  - the mapping is monotonic, and the normalized position is stable
  - display → image → display round-trips
- the radius table and its bounds
- a module-boundary audit

Eight mutations were tried against the new code:

| Mutation | Result |
|---|---|
| Open interval | caught, 19 failures |
| No far-edge snap | caught, 2 |
| Not centered | caught, 17 |
| Sampler default radius | caught, 1 |
| No radius cap | caught, 10 |
| Scale drift | caught, 24 |
| Dropping warnings | caught, 3 |
| Removing the clamp | not caught |

The clamp is a safety net that no test input reaches. A 4-million-case search found no input where it
changes the result.

## 14. Known limitations

- The browser snaps layout to 1/64 CSS px. The drawn canvas can therefore differ from `fitContain` by at
  most about 0.016 CSS px, which is ≤ 0.07 working px at phone scale. That is negligible against a 24 px radius.
- Rotated or skewed CSS transforms on the preview are not supported. Uniform scale cancels like DPR does.
- There is no zoom and no keyboard nudge helper yet. `inspectPhotoPoint` is the pure entry point for a
  keyboard marker, and the step policy belongs to the Slice 5 UI.
- The radius does not adapt to finger size (§9). It needs confirming in the phone tests.
- Thresholds are still calibrated against palettes and simulated lighting only (Slice 2), not against
  real photos.
- Device gates A1–A8 and the iPhone orientation check (Slice 3 §22) are still open. They block release,
  not Slice 5 coding.

## 15. Slice 5 entry criteria

**GO.**
- Geometry and glue are complete and pure.
- Every suite is green.
- The production bundle is unchanged.

Slice 5 should:
1. Build `photoChecker/PhotoCheckerPanel.tsx` and `PhotoSurface.tsx`:
   - The state machine is `idle → preparing → ready(inspection?) → error`.
   - Call `openPhoto(file, { signal })` with one `AbortController` per selection, and ignore `aborted`.
   - Reset `input.value = ''` after each pick.
2. Measure the container (ResizeObserver).
   - Get `imageRect = fitContain(image, size)`.
   - Position the canvas at `imageRect`, and paint it once with `putImageData` (§8).
3. On `pointerup`:
   - Build `point = { clientX − rect.left, clientY − rect.top }` and call `inspectPhotoTap`.
   - Ignore `outside-displayed-image`, and keep the previous result.
   - Ignore taps while preparing.
4. Keyboard: arrow keys move an image-space marker, clamped to `[0,W]×[0,H]`, then Enter calls
   `inspectPhotoPoint`. Draw the ring with `imageToDisplay` / `imageLengthToDisplay`.
5. Map every state to UI:
   - `PhotoImageErrorCode`
   - the `unavailable` reasons
   - the `warnings`
   - the five categories

   EN and TH copy come with `placement.ts`. Show no percentage.
6. Integrate behind the mode tabs, with the manual checker as the default and unchanged. Then run A1–A8
   and I1 on the dev build using real phones.
