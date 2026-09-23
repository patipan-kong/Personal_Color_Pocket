# V1.2 Slice 5a: Photo Checker Panel and Interactive Photo Surface

Status: **done, and ready for the real-device matrix.** This is the first production UI for the
Photo Color Checker. The rich result and guidance card is Slice 5b.

Files:
- [PhotoCheckerPanel.tsx](../src/photoChecker/PhotoCheckerPanel.tsx): picker, lifecycle, errors and compact feedback.
- [PhotoSurface.tsx](../src/photoChecker/PhotoSurface.tsx): display canvas, layout, marker, pointer and keyboard.
- [photoPanelState.ts](../src/photoChecker/photoPanelState.ts): pure reducer and the keyboard step.
- [App.tsx](../src/App.tsx) `CheckerView`: the Manual / Photo tabs.
- i18n: [types.ts](../src/i18n/types.ts), [en.ts](../src/i18n/en.ts), [th.ts](../src/i18n/th.ts) (`photoChecker` section).
- [styles.css](../src/styles.css): the "Photo checker (V1.2)" block.
- Tests:
  - [PhotoCheckerPanel.test.tsx](../src/photoChecker/PhotoCheckerPanel.test.tsx) (48)
  - [checkerModes.test.tsx](../src/photoChecker/checkerModes.test.tsx) (6)

Unchanged: `openPhoto`, the coordinates helpers, `inspectPhotoTap`/`inspectPhotoPoint`, the sampler,
the matcher, palettes and the manual checker.

## 1. Objective

Let a user with a saved result:
1. switch the Color Checker to Photo
2. choose a gallery photo
3. see it prepared locally
4. tap or keyboard-select a spot
5. see a compact result: swatch, HEX, one of five categories, and any warnings

This proves the full interaction on top of the frozen Slice 1–4 pipeline.

## 2. Mode integration

- There is still no new `View`, nav item or route. `CheckerView` gains a `role="tablist"` of
  **Manual / Photo**, reusing the existing `.palette-tabs` pattern (tab/tabpanel ids, `aria-selected`,
  `aria-controls`).
- **Manual is the default** and is selected every time the checker opens, because the mode is local state.
- The manual markup is unchanged, only wrapped in its tabpanel. The manual state (picker, HEX input,
  submitted color) stays in `CheckerView`, so it survives Photo ↔ Manual switches.
- The photo panel exists only while Photo is selected. Its state never reaches the manual state.
- The checker is reachable only with a saved result (existing behaviour). The panel receives
  `result.subtype` from the existing app state. It never re-scores or infers the subtype.

## 3. State model

A pure reducer holds one discriminated union. There are no loose booleans.

```ts
idle
preparing { request, slow }                               // slow = notice visible
ready     { request, image: PixelSource, selection }      // selection: { point, inspection | null } | null
error     { request, code }                               // a PhotoImageErrorCode except 'aborted'
```

| Action | Effect |
|---|---|
| `select(request)` | Always goes to `preparing` and drops any image, marker and result. |
| `slow(request)` | Sets `slow` only if still preparing the same request. |
| `prepared(request, image)` | Goes to `ready` only if preparing the same request. |
| `failed(request, code)` | Goes to `error` only for the current request. `aborted` never changes state. |
| `inspected(request, inspection)` | Updates the selection when ready. `outside-displayed-image` keeps the previous selection. |
| `moved(request, point)` | Keyboard marker move, which sets the inspection to `null` (pending). |

Resets:

| Event | What resets | What survives |
|---|---|---|
| Manual → Photo | the panel mounts at `idle` | the manual state |
| Photo → Manual | the panel unmounts: abort, timer cleared, canvas zeroed, photo dropped | the manual state |
| Leaving and reopening the checker | the mode returns to Manual | the saved profile |
| New photo chosen | image, marker and result drop immediately (`preparing`) | – |
| Preparation fails | `error`, and the picker stays available | – |
| Same file retried | works, because the input value was reset | – |
| Unmount | abort, timer cleared, late results ignored, canvas zeroed | the saved profile (never written) |

## 4. Selection lifecycle

1. `<input type="file" accept="image/*">`. There is no `capture` and no `multiple`, so this is the gallery or files only.
2. Read `files[0]`, then set `input.value = ''` at once, so choosing the same photo again fires `change`.
3. Abort the previous `AbortController` and clear the previous notice timer.
4. Assign `request = ++latestRequest`, create a new controller, and dispatch `select`.
5. Call `openPhoto(file, { signal })`. On settle, dispatch only if `request === latestRequest`.

## 5. Abort and stale-result protection

There are two independent guards, because an in-progress browser decode can finish after its signal fired
(Slice 3 §17):
- **Component:** completions are dropped unless their request id is still the latest. Unmount increments
  the id, so nothing dispatches after unmount.
- **Reducer:** every action carries its request id, and mismatches return the same state object.

`aborted` is ignored at both levels. Any other rejection that is not a `PhotoImageError` maps to
`decode-failed`, and its message is never shown.

Tested: A starts, B is selected, B completes, then A resolves or rejects late. B stays, with one
paint and no alert.

## 6. Preview rendering

The `PhotoSurface` canvas is painted **once per image** in a layout effect:
- The backing store is set to the working size (for example 1600×1200).
- `getContext('2d', { colorSpace: 'srgb' })` is followed by `putImageData(new ImageData(data, w, h), 0, 0)`,
  which wraps the same buffer with no copy.
- There is no object URL, no re-decode, no `drawImage` of the file and no `getImageData`.
- The canvas is `aria-hidden` and `pointer-events: none`. It is never read back, so the `PixelSource`
  stays the sampling truth.
- If there is no context or painting throws, the panel shows `canvas-failed`.
- Each photo gets a fresh canvas (keyed by request), and its cleanup sets width and height to 0.
  Painting sets its own dimensions, so React StrictMode's dev double-mount still paints correctly.

**DPR:** the backing store is not DPR-scaled. 1600 px already exceeds a phone preview's device width
(Slice 4 §8), and there is no second, DPR-sized copy.

## 7. Resize behavior

- A `ResizeObserver` on the stage measures `getBoundingClientRect()`. Without `ResizeObserver`, the
  window `resize` event is used.
- `fitContain(image, box)` gives the canvas `left/top/width/height` in CSS px.
- A resize only re-lays out. There is no re-open, re-sample, re-match or repaint, all of which are tested.
- The selection is stored in working-image px, so the marker is recomputed with `imageToDisplay` and
  stays on the same image point.
- The stage uses `aspect-ratio: W / H`, `width: 100%` and `max-height: min(65vh, 680px)`.
  - On phones a photo gets its natural height with no blank space.
  - Tall photos on wide screens are capped and pillarboxed, and the math handles the bands.

## 8. Pointer interaction

- The listener is `pointerup` on the stage, primary pointer only and the left button for a mouse. There
  is no hover dependency.
- `touch-action: manipulation` keeps scrolling and removes the double-tap-zoom delay. A scroll gesture
  ends in `pointercancel`, so it never samples.
- The component takes a **fresh** `getBoundingClientRect()` and builds
  `point = { clientX − rect.left, clientY − rect.top }` and `imageRect = fitContain(image, rect size)`.
  It then calls `inspectPhotoTap`. There is no coordinate math in the component, which a test
  checks through a spied `inspectPhotoTap`.
- `outside-displayed-image` (a letterbox tap) keeps the previous marker and result.
- `pointerdown` focuses the stage with `preventScroll`, so keyboard use can follow a tap without the
  page scrolling under the finger. Desktop Chrome did not scroll either way in an A/B run, so this is a
  guard for other engines and part of device QA.

## 9. Marker behavior

- It is a CSS overlay, not a pixel change: a hollow white ring with a dark outer and inner outline, so it
  reads on light and dark garments. It is `pointer-events: none` and `aria-hidden`.
- It is centered at `imageToDisplay(selection.point)`.
- Diameter is `max(26 px, 2·imageLengthToDisplay(sampleRadiusFor(image)) + 8)`. The ring always
  encloses the sampled disc (existing radius, no new radius) and is never smaller than 26 px. It is a
  pointer, not a measurement, and the copy claims no precision.
- It shows for matched and unavailable inspections and for keyboard-moved (pending) points.

## 10. Keyboard interaction

The stage is `tabIndex=0`, `role="group"`, with an accessible name and `aria-describedby` pointing
to the keyboard hint.

| Key | No marker yet | With a marker |
|---|---|---|
| Enter / Space | Place the marker at the image center **and check it** | Check the marker (`inspectPhotoPoint`) |
| Arrow | Place the marker at the center (pending) | Move by one sample radius in working-image px (24 on a 1600 px photo) |
| Shift + Arrow | as above | Move 5 radii (120 px) |

- Moves clamp to `[0,W]×[0,H]` and do not depend on the preview size.
- A move sets the result to "Press Enter to check this spot", so a result is never shown for a point
  it was not taken at.
- Arrows and Space call `preventDefault`, so they don't scroll the page. Tab is untouched.
- Focus stays on the stage after checking.
- A resize keeps the working point.

## 11. Accessibility

- The picker is a real `<input type="file">` whose visible label wraps it ("Choose a photo" /
  "Choose another photo"). `:focus-within` shows the app's focus ring.
- The mode switch uses tablist/tab/tabpanel semantics like the palette tabs.
- The photo surface is focusable with a visible `:focus-visible` outline.
- **Keyboard hint:** visually hidden but always the stage's description. It becomes visible below the
  photo when the stage has keyboard focus.
- **Preparing:** a `role="status"` region inserted empty. Text appears only after 150 ms, so fast photos
  are silent. `aria-busy` is set on the panel while preparing.
- **Errors:** `role="alert"`.
- **Results:** the feedback region is `role="status"` (polite). It announces the label, HEX, category
  and warnings as text. The canvas is never the only carrier of meaning.

## 12. Minimal result feedback

The feedback is compact on purpose:
- a swatch
- "Color at this spot"
- the HEX
- the category label (the plan §11.1 names)
- one line per warning

There are no explanations, descriptors, pairings, placement or percentage; those belong to Slice 5b.

Unavailable samples are shown as feedback text, never as an error:
- `transparent`: "This spot is transparent…"
- `insufficient-pixels`: "Too little of the photo here…"
- `outside-image`: "Tap inside the photo." This is defensive only.

The marker stays where the user tapped.

## 13. Errors

| Code | EN copy (TH equivalent in `th.ts`) |
|---|---|
| file-too-large | This photo is larger than 30 MB. Choose a smaller photo. |
| image-too-large | This photo is over 60 megapixels, too large to open here. Choose a smaller version. |
| invalid-image | This file looks damaged or incomplete. Choose another photo. |
| unsupported-format | This browser can't open this file. Choose a JPEG, PNG or WebP photo. |
| unsupported-heic | This browser can't read this HEIC/HEIF photo. Choose or export a JPEG, PNG or WebP copy. |
| decode-failed | This photo couldn't be opened. Try another photo. |
| canvas-failed | This device couldn't prepare the photo. Try again, or choose a smaller photo. |

- The HEIC copy is scoped to "this browser", because Safari may decode HEIC.
- `aborted` is never shown.
- Every error keeps the picker available, and the same file can be retried.

## 14. Warnings

`mixed`, `highlight` and `shadow` from `match.warnings` each show one short line under the category.
The category stays visible, and warnings never become errors (tested with a 40% glare fixture).

## 15. Privacy

- The copy by the picker reads "Your photo stays on this device." This holds for the local-only
  pipeline: no upload, no network, no storage.
- Nothing new is persisted: no file, pixels, point, sample or match. A refresh clears the session.
  Tests assert:
  - `localStorage` is byte-identical and `setItem` is never called
  - `sessionStorage` is empty
  - `fetch` and `createObjectURL` are never called by the panel
- A source audit of the three new modules finds none of these:
  - storage, `fetch`, XHR, `sendBeacon`, `FileReader` or object URLs
  - `getImageData` or DPR
  - sampler or matcher calls, or `console`
- The headless-Chrome run served only the existing static assets, with no request during the photo flow.

## 16. Localization

A typed `photoChecker` section in `LocaleCopy` has EN and TH parity, which the compiler enforces. It covers:
- the mode labels
- choose / change
- privacy
- preparing
- instruction
- surface label
- keyboard hint
- pending
- sample label
- the 5 categories
- the 3 warnings
- the 3 unavailable reasons
- the 7 errors

**The Thai copy needs review by a Thai speaker before release** (plan §18, 5b acceptance).

## 17. Responsive behavior

This was measured on the production build in headless Chrome 153, driven over the DevTools Protocol by
a throwaway zero-dependency script (the Slice 0 method, not committed).
- Phone widths used DPR 3 with mobile emulation. Photos were real 4000×3000 and 3000×4000 JPEGs
  generated in the page and decoded by the real `openPhoto`.

| Width | Horizontal overflow (manual / idle / landscape / portrait) | Stage share of viewport height (L / P) | Marker inside image | Resize keeps point |
|---|---|---|---|---|
| 320 | 0 / 0 / 0 / 0 | 0.23 / 0.41 | ✓ | ✓ |
| 360 | 0 / 0 / 0 / 0 | 0.27 / 0.48 | ✓ | ✓ |
| 390 | 0 / 0 / 0 / 0 | 0.30 / 0.53 | ✓ | ✓ |
| 430 | 0 / 0 / 0 / 0 | 0.34 / 0.60 | ✓ | ✓ |
| 768 | 0 / 0 / 0 / 0 | 0.51 / 0.65 (pillarbox) | ✓ | ✓ |
| 1024 | 0 / 0 / 0 / 0 | 0.65 / 0.65 (pillarbox) | ✓ | ✓ |
| 1280 | 0 / 0 / 0 / 0 | 0.65 / 0.65 (pillarbox) | ✓ | ✓ |

- **Taps:**
  - With the stage partly offscreen (25–120 px), a tap scrolled 0 px, and the marker landed within
    0.02 px of the tap point at every width.
  - Letterbox and pillarbox taps kept the marker and result.
- **Keyboard:** Enter produced a result, focus stayed on the stage, and the hint became visible.
- **Other checks:**
  - The backing store stayed at the working size (1600×1200 / 1200×1600).
  - The tabs, picker (187×53) and feedback fit at every width, and Manual was the default at every width.
- **Not automated:** the fixed bottom nav overlaps the lower part of a tall photo while scrolled, as
  it does with all content. Scrolling reveals it.

## 18. Tests

- `PhotoCheckerPanel.test.tsx` (48):
  - **Reducer:** transitions, stale ids, `aborted`, letterbox, reset, and the nudge step or clamp.
  - **Picker:** `accept`, no `capture`, the label, privacy, reset and same-file reselection, a fresh
    signal per selection, A-after-B, a late failure, `aborted`, clearing on a new photo, unmount cleanup,
    and an empty change.
  - **Preparing:** quiet before 150 ms, then announced, and the timer is cancelled.
  - **Errors:**
    - all 7 codes, each with a same-file retry
    - HEIC wording
    - an unknown rejection without leaking its message
    - `canvas-failed`
  - **Canvas:**
    - painted once, same buffer, working size
    - no `getImageData`/`drawImage`/object URL
    - `fitContain` layout, layout-only resize, and zeroing on replace and unmount
  - **Pointer:**
    - center, edge, letterbox, portrait
    - resize then tap
    - non-primary and right-button taps are ignored
    - unavailable samples, and warnings
  - **Keyboard:** the first marker, arrow moves, Shift, Space, clamping, preview-size independence, resize,
    and `preventDefault` behaviour.
  - **Accessibility and i18n:** roles and names, a full Thai flow, and copy completeness.
  - **Privacy:** no storage, no network, and a source audit.
- `checkerModes.test.tsx` (6), through `App`:
  - Manual is the default and unchanged, and the manual interaction works.
  - Photo ↔ Manual keeps the manual color.
  - Photo → Manual aborts and discards.
  - Reopening returns to Manual.
  - The saved subtype is used, and the saved profile stays untouched.
- jsdom lacks `PointerEvent`, `ResizeObserver`, `ImageData` and canvas. The tests supply small
  doubles, mock `openPhoto` at the service boundary, and run the real geometry and inspection code.

## 19. Physical-device gate

These automated and headless-desktop results **are not device validation**. The feature is ready for
the real-device matrix:
- Slice 0 A1–A8 on a mid-range Android
- I1 orientation, plus HEIC, on an iPhone

No tag, push or deploy has been done.

## 20. Slice 5b entry criteria

**GO.** The panel, surface, lifecycle, errors and compact feedback are complete, and all suites are
green. Slice 5b should:
1. Replace `PhotoFeedback` with the plan §11.1 result card:
   - category, nearest palette color by name (`colorDisplayName`), resembles, direction and descriptors
   - pairings (`match.pairWith`)
   - the "as it appears in this photo" caption
2. Add `placement.ts` (plan §10.3 / §16) using the presentation preference.
3. Keep this slice's lifecycle and state model unchanged. The result card reads `selection.inspection`.
4. On desktop widths, consider placing the result beside the photo, because a tall photo pushes the
   feedback below the fold at 900 px viewport height.
5. Get Thai copy reviewed. Then run the device matrix on a build containing 5a and 5b.
