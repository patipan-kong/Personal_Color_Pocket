# V1.2 Slice 6 — Photo Checker Hardening and Release Readiness

Status: **engineering hardening done; READY FOR PHYSICAL QA, not yet ready for release.** Written 2026-09-24.
The physical-device gates (48–50 MP on Android, real iPhone HEIC, TalkBack, VoiceOver) are **PENDING**: no phone
was available to this slice.

- Plan: [V1_2_PHOTO_COLOR_CHECKER_PLAN.md](V1_2_PHOTO_COLOR_CHECKER_PLAN.md).
- Earlier records: [Slice 0](V1_2_SLICE_0_DEVICE_SPIKE.md), [1](V1_2_SLICE_1_SAMPLING_ENGINE.md), [2](V1_2_SLICE_2_PHOTO_MATCH_ENGINE.md), [3](V1_2_SLICE_3_IMAGE_PIPELINE.md), [4](V1_2_SLICE_4_INTEGRATION_COORDINATES.md), [5a](V1_2_SLICE_5A_PHOTO_PANEL.md), [5b](V1_2_SLICE_5B_PLACEMENT_GUIDANCE.md), [5c](V1_2_SLICE_5C_VERDICT_CLARITY.md), [5d](V1_2_SLICE_5D_UNIFIED_RESULT_DISPLAY.md), [5e](V1_2_SLICE_5E_REAL_WORLD_SAMPLING_INVESTIGATION.md), [5f](V1_2_SLICE_5F_PHOTO_LIGHTING_GUIDANCE.md).

**Changes in this slice:**

| File | Change | Why |
|---|---|---|
| [PhotoSurface.tsx](../src/photoChecker/PhotoSurface.tsx) | Alt / Ctrl / Meta + key is no longer handled or prevented | **The only production behaviour change** (§18) |
| [vite.config.ts](../vite.config.ts) | `test.exclude` adds `**/.kilo/**` | Test discovery (§4) |
| [unifiedChecker.test.tsx](../src/colorChecker/unifiedChecker.test.tsx), [PhotoCheckerPanel.test.tsx](../src/photoChecker/PhotoCheckerPanel.test.tsx), [App.test.tsx](../src/App.test.tsx), [coordinates.test.ts](../src/domain/photoColor/coordinates.test.ts) | Same assertions, restructured | Timing flake (§5) |
| New [photoHardening.test.tsx](../src/photoChecker/photoHardening.test.tsx) (68 tests) | Races, stress, ownership, resize, pointer, keyboard, errors, mode isolation, result and lighting regression | Slice 6 focused tests |
| New [photoPrivacy.test.tsx](../src/photoChecker/photoPrivacy.test.tsx) (4 tests) | The real `openPhoto` with every outbound channel spied; canvas pipeline; orientation | §15, §21–§24 |
| [photoImage.test.ts](../src/services/photoImage.test.ts) (+23 tests) | Size, pixel and HEIC boundaries on every path | §10, §11, §13 |
| [README.md](../README.md) | Photo privacy note and the canonical test command | Plan §18 Slice 6 row |

---

## 1. Scope

Hardening only: lifecycle, races, memory ownership, boundaries, privacy, accessibility, test infrastructure and
release readiness of the Photo Color Checker built in Slices 1–5f.

**Deferred to Slice 7 (Human-readable Color Names):** colour names, semantic buckets, tone labels and any change to
how HEX is shown. HEX display is unchanged here (§39).

## 2. Entry state

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `8aab2bdd2fd27a1f1736984040e7069656f44f03` (Slice 5f) |
| Working tree | clean (only git-ignored `.kilo/`, `dist/`, `node_modules/` and local intermediates) |
| Ahead of `origin/main` | 12 |

## 3. Frozen behaviour

These were **not** changed, and the existing freezes still pass:
- **Colour and matching:** the quiz classifier and questions, the Manual Checker algorithm and thresholds, the photo
  matcher and its thresholds, OKLab conversion, palettes, placement, pairing, verdict categories and suitability mapping.
- **Photo pipeline:** the sampling algorithm, radius, trim, the mixed / highlight / shadow thresholds, the 5f
  lighting-guidance rule and the shared result hierarchy.

**How the freeze is enforced:**
- the 5e investigation suite re-asserts every sampler and matcher constant
- the Manual regression fingerprints are unchanged
- the exhaustive quiz audit passes
- no matcher or sampler source file is in the diff

**Not added:** AI, ML, object or garment detection, segmentation, any colour correction, multi-tap, camera or Capacitor
plugins, backend, auth, upload or analytics.

## 4. Test discovery

**Before.** `vite.config.ts` had `test: { environment, setupFiles, css }`. Vitest's default exclude is only
`['**/node_modules/**', '**/.git/**']`, so plain `npm test` also collected the git-ignored tool worktree
`.kilo/worktrees/endurable-sundial/`:
- **49 files:** the 33 repository files plus 16 stale copies.
- **1,134 passed + 1 skipped**, as recorded in 5f.

**The 16 accidental files** were `.kilo/worktrees/endurable-sundial/src/`:
- `App.test.tsx`, `presentation.test.tsx`, `styleExperience.test.tsx`
- `i18n/i18n.test.tsx`
- `services/persistence.test.ts`, `services/presentationPreference.test.ts`
- `domain/personalColor/`: `colorMatch`, `colorUtils`, `diagnostics`, `palettes`, `quizModelV2`, `quizVisuals`, `scoring`,
  `scoringAudit`, `styleExampleAssets` and `styleGuide` tests

**After.** One project-config line: `exclude: [...configDefaults.exclude, '**/.kilo/**']`.
- `.kilo` was neither modified nor deleted.
- The discovered file list is **identical to `git ls-files '*.test.ts' '*.test.tsx'`** (33 files before the two new
  Slice 6 files), so no legitimate test is excluded.

**Final canonical suite (`npm test`):** 35 files, **1,073 passed + 1 skipped (1,074)**. The one skip is the opt-in 5e
report generator.

## 5. Timing flake

**The flake:** `unifiedChecker.test.tsx` › "both modes show the same sections in the same order…". It reproduced in the
first full run of this slice: **5,014 ms against the 5,000 ms default**.

**Diagnosis: A, a genuinely slow deterministic test, pushed over by F, machine load. It then cascaded through C, async
cleanup.**
- **A:** one test ran **10 complete App flows** (2 languages × 5 colours): render, type a HEX, switch to Photo, upload,
  tap. In isolation it took **4.19–4.25 s**, so under full-suite parallel load it crossed 5 s.
- **C:** when Vitest timed it out, the test body **kept running** in the background. It uploaded a photo while the next
  test ran, so that next test failed too ("Unable to find a label with the text of: เลือกรูปภาพ": the zombie flow had
  already switched the label to "Choose another photo").
- **Not B:** there are no fake timers in that file.
- **Not D:** there is no React update race; each flow passes alone.
- **Not E:** no production race. The product code is unchanged, and the same flows pass at about 0.4 s each.

**Fix (no timeout raised anywhere):**

| Test | Budget | Before (full-suite load) | Change | After |
|---|---|---|---|---|
| unifiedChecker › same sections, Manual vs Photo | 5 s | 5,014 ms (**timeout**) | split into `it.each` over 10 (language, colour) cases; identical assertions | 10 × ~0.4 s |
| PhotoCheckerPanel › clamps at the image boundaries | 5 s | 3,473 ms | `userEvent.setup({ delay: null })`: no timer between 130 key events | ~0.8 s |
| App › all eleven quiz questions by keyboard | 15 s | 10,937 ms | same `delay: null` | ~3.1–3.4 s |
| coordinates › is monotonic along both axes | 5 s | 3,174 ms | collect violations and assert once, instead of ~308,000 `expect()` calls; same checks, and still catches an overshoot mutation (1,200 violations) | ~0.23 s |

After the fix, the slowest test is the exhaustive quiz audit at **4.55 s of its 15 s budget**. Everything else is under
3.4 s. The canonical suite passed three consecutive runs plus a fourth, verbose run (§35).

## 6. Resource lifecycle

Walked through for: select A → decode A → select B → abort A → decode B → display B → tap B → resize → Manual → Photo →
choose C → unmount.

| Resource | Owner | Created | Released | Evidence |
|---|---|---|---|---|
| `AbortController` | panel ref | each selection | aborted when a newer photo is chosen or on unmount; ref nulled when its photo settles | race tests; `never abort` mutation caught |
| Request id | panel ref `latestRequest` | `++` per selection | `+1` on unmount; completions compare ids | 3-way race tests |
| Preparing timer (150 ms) | panel ref | each selection | cleared on settle, on a new selection and on unmount | fake-timer counts are 0; mutation caught |
| `ResizeObserver` | `PhotoSurface` | on surface mount (one per photo) | `disconnect()` on unmount; the surface is keyed per photo | live observers ≤ 1 over 51 selections; mutation caught |
| window `resize` fallback | `PhotoSurface` | only without `ResizeObserver` | removed on unmount | net listeners = 1, then 0, over 20 photos |
| Pointer / keyboard handlers | React props on the stage | render | with the element | no global listeners are added |
| `ImageBitmap` | `openPhoto` | decode | `close()` right after `drawImage` and in `finally` | Slice 3 tests; real-service test: closed once per photo |
| Probe / fallback `<img>` + object URL | `openPhoto` | only for non-JPEG/PNG/WebP, or when the API is missing | handlers nulled, `src` removed, URL revoked | Slice 3 `expectAllReleased` |
| Temporary canvas | `openPhoto` | rasterize | `width = height = 0` in `finally` | real-service test: every non-display canvas is 0 × 0 |
| `ImageData` wrapper | `openPhoto` / `PhotoSurface` | read / paint | transient; only `.data` is kept, never copied | paint receives the same buffer that `getImageData` returned |
| `PixelSource` | panel reducer state `ready.image` | `prepared` | dropped by the next `select`, and on unmount | ownership scan (§8) |
| Display canvas backing store | `PhotoSurface` | paint (once per photo) | `width = height = 0` in effect cleanup | all earlier canvases 0 × 0; mutation caught |
| Marker / result | reducer `selection` | tap / key | dropped by `select`; never inherited | "never inherits" test |
| File input value | the input element | the picker | `input.value = ''` right after reading `files[0]` | real Chrome: `files.length` 0 right after the change |

No step leaves a live timer, observer, listener, controller or canvas behind.

## 7. Async race handling

There are two independent guards, from Slice 5a:
- **The component guard:** a completion dispatches only if its request id is still the latest.
- **The reducer guard:** every action carries its id, and a mismatch returns the same state object.

The `drop both stale-request guards` mutation is caught.

New deterministic tests, all through `select()` = one `change` event and deferred decodes:

| Scenario | Result |
|---|---|
| A, B, C chosen; resolved B → A → C | only C is ever painted (one paint, C's own buffer); A/B signals aborted |
| A, B, C chosen; resolved C → A → B | C shown after its resolve; late A and B change nothing |
| A fails after B succeeded | B stays, no alert |
| A succeeds after B failed | B's error stays; A is never shown |
| A rejects `aborted` / a raw `DOMException` naming a file / a stale `file-too-large`, after B succeeded | silent; B stays |
| unmount while A and B decode | both aborted, timer cleared, late result and late error do nothing, no React warning |
| switch to Manual while decoding (App) | aborted; back in Photo the panel is fresh; the late result never appears; a new photo works |
| same File chosen twice while the first is pending | first aborted, second shown, late first ignored |
| rapid choice right after an error | the alert clears at once; the last choice wins |
| new photo after a tap | no marker or result before or after it becomes ready |

**Abort nuance (not user-visible):** if a signal fires while `createImageBitmap` is in flight and that decode then
*fails*, `openPhoto` reports the failure code rather than `aborted`. The panel never shows it, because the request is
stale, and the tests above cover exactly that. This is left as a follow-up (§38).

## 8. Memory ownership

**Chain:**
- `File` → header prefix (≤ 256 KiB) → `createImageBitmap(file)` → temporary sRGB canvas → one `getImageData` →
  `PixelSource {width, height, data}` → panel state `ready.image`
- the display canvas is painted once from `data` (`new ImageData(data)` wraps it without copying)

**At READY (steady state), the app references exactly:**
1. The `PixelSource` and its `Uint8ClampedArray`. That is 7.3 MiB at 1600 × 1200 (≤ 9.8 MiB at 1600²).
2. The display canvas backing store, at the same size.
3. The current `selection`: a point plus `{ sample, match }`, which is small.

**Not retained by the app:**
- the `File`: the input is cleared, and nothing stores it
- the header prefix, `ImageBitmap`, probe or fallback `<img>`, object URL, temporary canvas and `ImageData` wrapper: all
  released when `openPhoto` settles (§6)

**Evidence:**
- **React-tree ownership scan (unit test).** A walk over every current fiber's props, hook state, refs and effect deps.
  After 51 selections:
  - the current `PixelSource` is referenced
  - none of the 50 older `PixelSource`s or their buffers are referenced
  - none of the 51 `File`s are referenced

  A mutation that kept prepared photos in a ref is caught.
- **Real Chrome** (§9) confirms the DOM and listener counts.

**Not claimed:**
- These tests prove *application* ownership only. When a browser actually frees decoded or canvas memory is a
  **physical-device** question.
- React may keep the previous committed state in its internal double-buffered fiber until the next render. That is
  framework bookkeeping, not application state, and it holds at most one previous state.

## 9. Repeated-load stress

**APP OWNERSHIP: PASS**
- **Unit test.** 51 selections: 26 completed (each tapped) and 25 superseded while pending, which then complete late.
  - one live `ResizeObserver` at every step, 0 after unmount
  - 0 pending timers
  - 0 window `resize` listeners
  - `createObjectURL` never called by the panel
  - one display canvas in the DOM; every earlier canvas 0 × 0, and all 0 × 0 after unmount
  - one paint per shown photo, each from that photo's own buffer
  - late completions change nothing
  - all superseded signals aborted
  - the ownership scan finds only the current photo
- **Fallback path.** 20 photos with `ResizeObserver` removed: net `resize` listeners stay at 1, then 0 after unmount.
- **Real Chrome 153, headless desktop.** 41 replacements with generated 12 MP JPEGs, each tapped, measured after forced GC:

  | After | DOM nodes | JS event listeners | canvases | JS heap |
  |---|---|---|---|---|
  | 1st photo | 193 | 156 | 1 | 2.4 MB |
  | 21 photos | 195 | 156 | 1 | 2.5 MB |
  | 41 photos | 195 | 156 | 1 | 2.5 MB |

  (+2 nodes is the result card's content after a different tap.) Pixel buffers and canvas backing stores live outside
  the JS heap figure, so it says nothing about pixel memory.

**BROWSER MEMORY / GC: PHYSICAL DEVICE REQUIRED.** Tab-level memory under repeated 12–50 MP decodes on a low-RAM phone is
device test A5/A8 (§36).

## 10. File-size boundaries

`MAX_PHOTO_FILE_BYTES = 30 × 1024 × 1024 = 31,457,280` bytes, **inclusive**. Unchanged.

| Path | 31,457,280 B | 31,457,281 B |
|---|---|---|
| JPEG, PNG, WebP VP8 / VP8L / VP8X (header parse) | opens (header prefix read once) | `file-too-large`: **nothing read, probed or decoded** |
| GIF, AVIF, Safari HEIC (browser probe) | opens | same |
| Real Chrome, JPEG padded after EOI | opens (57 ms) | EN "This photo is larger than 30 MB…" in 14 ms |

The copy says "30 MB". Every rejected file is above 31.46 decimal MB, so the sentence is true under either unit.

## 11. Dimension boundaries

`MAX_PHOTO_PIXELS = 60,000,000`, **inclusive**. Unchanged; still **provisional**.

| Path | 7500 × 8000 (exactly 60 MP) | 7500 × 8001 / 7501 × 8000 / 8000 × 7501 |
|---|---|---|
| JPEG, PNG, WebP VP8, VP8L, VP8X header | decoded → 1500 × 1600 | `image-too-large`, **before decode** |
| GIF, AVIF, Safari HEIC sized by the probe | decoded | rejected before decode |
| EXIF-rotated (header 8000 × 7500, decoded 7500 × 8000) | opens upright | – |
| Decoded size above the cap (header understated) | – | rejected, bitmap closed (Slice 3) |
| Real Chrome (generated JPEG) | opens (225 ms desktop) | rejected in **10 ms**, no decode |

**Integer safety.** The cap check never multiplies two untrusted dimensions. It is compared with the exact `BigInt`
product on more than 20,000 cases:
- every divisor pair of 60,000,000, and each ±1
- the √60 M edge (7,740–7,750²)
- 20,000 seeded pairs up to (2³¹ − 1)², products far above 2⁵³

**0 mismatches.** Non-finite, zero or negative sizes are never treated as safe. Float-product and exclusive-bound
mutations are both caught.

## 12. Large-image risk

| Source | Desktop time to ready in Chrome 153 (**reference only**) | Slice 0 desktop peak | Phone expectation (unmeasured) |
|---|---|---|---|
| 12 MP | 81 ms | +63–77 MiB | ~65–110 MiB |
| 24 MP | 122 ms | +124–136 MiB | ~125–190 MiB |
| 48 MP | 199 ms | +248–260 MiB | ~250–350 MiB |
| 60 MP | 225 ms | – | ~320–420 MiB |

**These desktop results are not evidence that 48–50 MP is safe on a phone.** The 60 MP limit stays
**PROVISIONAL — PHYSICAL ANDROID QA REQUIRED** (§37). It was not changed, because no device evidence exists.

## 13. HEIC / HEIF

| Check | Automated result |
|---|---|
| The extension or MIME alone never rejects | JPEG, PNG and WebP content named `.HEIC` / `image/heic` all open (unit); a JPEG named `.heic` opens in real Chrome |
| Browser-supported HEIC proceeds | the Safari-like probe path opens it (unit) |
| Unsupported genuine HEIC | `unsupported-heic` → "This browser can't read this HEIC/HEIF photo…" (unit and real Chrome, 15 ms) |
| AVIF is not labelled HEIC | `avif` / `avis` → `unsupported-format` |
| Truncated or damaged HEIF headers | every truncation length 1–24 and a corrupt box size fail with a friendly code; never a throw or a decode |
| No HEIC dependency | the dependency list is audited in a test |

**Real iPhone HEIC is a release gate and is PENDING (§37).** Chromium and synthetic headers do not substitute for it.

## 14. Orientation

There is no EXIF code in the app; the browser applies orientation on decode.
- **Real Chrome through the real app.** A generated quadrant JPEG with a spliced EXIF Orientation of 1–8:
  - **8/8 correct**, including the width/height swap for 5–8 (400 × 300 → 300 × 400)
  - tapping each quadrant sampled the expected rotated or mirrored quadrant colour
  - the marker sat at the tapped point
- **Unit, with the real service.** A 4000 × 3000 frame decoded upright as 3000 × 4000 gives:
  - a 1200 × 1600 `PixelSource`
  - `aspect-ratio: 1200 / 1600`
  - a 1200 × 1600 canvas
  - taps in each quadrant in a portrait box that return that quadrant's colour, with the marker at the tap
  - the same quadrants hit again after a pillarboxed desktop resize

A rotated phone photo on a real device is part of the physical matrix (A2, I2).

## 15. Canvas / pixel pipeline

Proved with the real `openPhoto` and counting fakes:
- **One decode, one `drawImage` and one `getImageData` per photo**, and the bitmap is closed once.
- **The preview paints once, from the very buffer `getImageData` returned** (identity check). There is no second decode
  for the preview.
- **25 taps, 25 keyboard moves, 25 checks and 25 resizes** caused no decode, no `getImageData` and no repaint.
- **No pixel copy per resize** (`copy the pixel buffer` and `re-inspect on resize` mutations caught).
- **The sampled colour is identical at device pixel ratio 1, 2 and 3.** DPR is never read; Slice 4 already proves the
  mapping is DPR-invariant.

No optimisation was needed.

## 16. Resize

- **305 layout changes on one photo** (random, fractional, 0 × 0, portrait and landscape boxes):
  - the marker is always at `imageToDisplay(point)`, to 1e-9
  - returning to the first box puts it back at exactly the same CSS position: **no cumulative drift**
  - the result text is unchanged
  - zero extra inspections, opens or paints
- **A transient 0 × 0 container** is safe: no throw, the canvas is 0 px, taps on it are `outside`, the result is kept,
  and the layout recovers exactly.
- **Portrait and landscape:** phone stacked → desktop side-by-side → phone keeps the same image point, and taps hit the
  correct half on both layouts.

## 17. Pointer

- **Exact mapping, and the marker equals the tap point:**
  - center and the four corners
  - the exact far edges (`W`, `H`)
  - 1 CSS px inside every edge
- **Letterbox, pillarbox and just-outside taps** (±0.01 px) are `outside`. The previous marker and result are kept.
- **Rapid taps:** 120 in a burst are all evaluated, the last one wins, and one verdict shows.
- **A tap in the same tick the photo becomes ready** is evaluated against that photo.
- **Ignored:** non-primary pointers and right-clicks.

## 18. Keyboard

Verified:
- **Focus:** the photo is focusable (`tabindex 0`), named and described. In real Chrome, Tab reaches it with a visible
  3 px outline and the hint appears.
- **Enter / Space with no marker:** checks the centre, and focus stays on the photo.
- **Every arrow** clamps at its edge, and Enter checks exactly there.
- **A resize between key presses** keeps the working point.
- **Keys pressed elsewhere on the page** are never captured.

**Bug found and fixed (the only production change).**
- **The bug:** while the photo was focused, the surface handled and `preventDefault`-ed arrows, Enter and Space **even
  with Alt, Ctrl or Meta held**. That blocked browser shortcuts such as Alt+← / Cmd+← (Back) and modified keys used by
  assistive technology, and it moved the marker instead.
- **The fix:** `PhotoSurface` now returns early when `altKey`, `ctrlKey` or `metaKey` is set. Shift (the big step) is
  unchanged.
- **Tests:** 8 new tests failed before the fix and pass after it. In real Chrome, Alt+← and Ctrl+→ leave the marker and
  the page alone, and a plain → still moves.

This is not a new keyboard feature.

## 19. Accessibility (automated audit)

| Item | State |
|---|---|
| Manual / Photo switch | `tablist` / `tab` (`aria-selected`, `aria-controls`) / `tabpanel`, the same pattern as the palette tabs |
| File input | a real `<input type=file>` inside its visible label ("Choose a photo" / "Choose another photo"); focus ring via `:focus-within` |
| Instructions / capture tip | plain text before the photo |
| Photo surface | `role=group`, `aria-label`, `aria-describedby` → the keyboard hint; the canvas is `aria-hidden` |
| Focus indicator | keyboard only (`data-input`); verified in real Chrome |
| Preparing | `role=status`, inserted empty and filled after 150 ms, so fast photos stay silent; `aria-busy` on the panel |
| Errors | `role=alert`, localized, re-announced on each failed attempt |
| Result | concise live summary only: label, HEX, verdict, category and warnings; the guidance card is not live |
| Verdict | text is authoritative; the cue (✨ ✓ △ ✕) is `aria-hidden` |
| Warnings | read once in the summary; the visible list is `aria-hidden` |
| Lighting note | ordinary paragraph outside the live region (5f), verified again |
| Swatches | `aria-hidden`, always beside the HEX or a colour name |
| Placement / pairing | labelled `region`s with headings |

**Observed (follow-up, §38):**
- `aria-controls` points at a tab panel that is not rendered while the other tab is active.
- The tablist has no arrow-key roving.

Both match the existing palette tabs, and neither blocks use.

**Physical screen-reader steps** (gates, §37):
- **TalkBack** (Android Chrome):
  1. Swipe to Color Checker, then Photo; the tab announces "selected".
  2. Activate "Choose a photo" and pick a photo. Only "Preparing photo…" is heard if it is slow.
  3. Swipe to the photo; its name and hint are read.
  4. Double-tap to check the centre. **One** summary is announced: sample label, HEX, verdict, category, warnings.
  5. Swipe on: reason → action → reference → "Where to wear it" → pairing → lighting note → caveat, each once.
  6. Pick a broken file: the error is announced once.
  7. Switch to Manual and check a HEX: one summary.
- **VoiceOver** (iPhone Safari): the same steps. Also check that VO + arrow keys on a hardware keyboard are not swallowed
  by the photo.

## 20. Errors

**EN × TH × 7 codes (14 tests):** each shows exactly `copy.photoChecker.errors[code]`. Every one:
- **leaks nothing:** no file name, no `.jpg`, no `Error` / `DOMException` / `PhotoImageError`, no stack, no `blob:` or
  URL, no braces, no code string
- is Thai in TH
- keeps the picker available
- clears at once on the next choice
- **reopens the same `File`**

**Other error paths:**
- **`aborted`:** never shown (§7).
- **An unknown rejection** whose message holds a path and a `blob:` URL shows the generic `decode-failed` copy, and none
  of the message.
- **A display canvas that cannot paint** shows `canvas-failed`, and choosing again recovers.
- **Stale errors** can never replace a newer success (§7).

## 21. Privacy audit

**Production source scan** (44 files, excluding tests, fixtures and the investigation harness):
- **No network:** no `fetch`, XHR, `sendBeacon`, WebSocket, EventSource, form action, `window.open`, `postMessage`,
  analytics or telemetry.
- **No storage** beyond the three existing keys: profile (`personal-color-pocket:v1`), language and presentation.
- **No logging.**
- **`navigator.clipboard`** exists only in the DEV-only diagnostics panel (§32).

Values that could leave the device, and what actually happens to them:

| Value | Leaves the device? |
|---|---|
| File, file name, object URL | no: the name is never read (Slice 3); object URLs are page-local and revoked |
| PixelSource / pixels | no |
| Sampled RGB / HEX, tap coordinate | no: shown on screen only |

Expected: none. **Found: none.**

## 22. Network guard

[photoPrivacy.test.tsx](../src/photoChecker/photoPrivacy.test.tsx) runs the **real** image service and App end to end:

> choose a JPEG named `IMG_2041-secret-family-photo.jpg` → prepare → display → tap → keyboard move and check → resize →
> choose a second photo (`.heic` name) → tap → Manual → Photo

It spies on every outbound channel and asserts **zero** calls:
- **Network:** `fetch`, `XMLHttpRequest.open/send`, `navigator.sendBeacon`, `WebSocket`, `EventSource`, `Worker`,
  `SharedWorker`, `window.open`, `postMessage`.
- **Forms:** `form.submit/requestSubmit`, `submit` events.
- **Files and storage:** `URL.createObjectURL`, `indexedDB`, `caches`, cookie writes.
- **Images:** no `<img>.src` assignment during the flow.

Mutations that add a `fetch` of the sampled HEX or a `sendBeacon` of the file name are caught.

**Real Chrome.** From the first photo to the end of the checks, the server received **0 requests**. The only request
event was one **page-local `blob:` URL**: the service's `<img>` probe for the HEIC header, which is not a network
request. The app's own static assets load before the photo flow and are not part of it.

## 23. Storage

- **Unit.** During the photo flow there are no `setItem`, `removeItem` or `clear` calls on local or session storage.
  - The storage snapshots before and after are identical.
  - The keys are exactly the existing profile and language keys.
  - No file name or sampled HEX appears in storage.
  - A `persist the last photo HEX` mutation is caught.
- **Real Chrome.**
  - Local and session storage are byte-identical before and after.
  - `indexedDB.databases()` is `[]` and `caches.keys()` is `[]`.
  - There are 0 service-worker registrations.
- **Kept:** the existing profile, language and presentation persistence.

## 24. Local / offline analysis

**Accurate claim: "Photo analysis runs locally on the device."**

Real Chrome, after the app had loaded, with the network set to **offline**:
- choose → decode → tap → verdict all worked (`#E9785D` → "✨ Yes! Excellent for your Personal Color")
- **0 server hits**

**Not claimed:** "the hosted app works offline". There is no service worker, so a cold load needs the network (plan §13.3,
README).

## 25. Mode isolation

**Current policy, unchanged:**
- **Manual state** (input, submitted colour, result) lives in `CheckerView` and **survives** switching to Photo and back.
- **Photo state lives in the panel**, which **unmounts** when leaving Photo. The photo, marker and result are discarded,
  and any pending decode is aborted.
- Returning to Photo starts at the picker.
- The checker always reopens in Manual.

**App test: Manual → Photo (clipped-white warning) → Manual → Photo (lighting note) → Manual:**
- the manual input, section classes and text are identical every time
- no caveat, warning, lighting note, details, capture tip or photo element ever appears in Manual
- the photo tap uses the saved subtype
- storage is unchanged

The policy is sensible, so it was not changed.

## 26. Unified-result regression

For both modes, the Slice 5d order holds: swatch / HEX → verdict → rating or category → why → action → palette
reference → (note) → placement → pairing → details → warnings → lighting note → caveat.
- Real Chrome checked at every width that the verdict is above every other section.
- The verdict font is the largest in the card.
- No percentage appears anywhere.
- HEX is shown exactly as before (`#RRGGBB`, equal to the sampler's HEX).
- No colour names were added.

## 27. Lighting guidance regression

The 5f rule is unchanged (`L ≥ LIGHT_VALUE_MIN` and chroma `< NEUTRAL_CHROMA_MAX`, warnings first). Through the real
panel:

| Sample | Warnings | Lighting note |
|---|---|---|
| `#9FABB4` (reported shaded white) | – | **yes** |
| white fabric `#F4F4F2` | – | **yes** |
| off-white `#FAF9F6` | – | **yes** |
| light grey `#D3D3D3` | – | **yes** |
| pure `#FFFFFF` (clipped) | highlight | no: the warning wins |
| navy `#1F2A44`, charcoal `#333333` | – | no |
| red `#CC0000` | – | no |
| white / navy stripes | mixed | no |
| `#000000` | shadow | no |

- The caveat is always present in Photo and never in Manual.
- The note is never in the live region.
- The full 70-test 5f suite passes.

## 28. Same-garment tap stability (human QA metric)

**Principle: exact HEX stability is not required.** Neighbouring taps on one garment see different pixels because of
folds, exposure, lighting, reflections and camera processing. One light suit gave `#C6CACF`, `#D9DCDF` and `#D0D1D5`,
which is acceptable in itself.

**Procedure (physical QA, A13 / I7):**
1. Photograph one visually uniform garment.
2. Tap about 5 reasonable points on it (flat, evenly lit, away from edges).
3. Record each HEX, category and verdict.

| Outcome | Meaning |
|---|---|
| **PASS** | HEX varies moderately, but the recommendation stays semantically stable (same tone, or neighbouring levels) |
| **INVESTIGATE** | nearby reasonable taps repeatedly flip between materially different recommendations, e.g. positive ↔ negative |

- **No automated threshold is set for this in Slice 6, and taps are never averaged.** It is a human metric.
- A result of INVESTIGATE feeds Slice 7 naming and any later product decision. It is not a reason to tune the sampler here.

## 29. Responsive QA

This was measured on the production build in headless Chrome 153 over the DevTools Protocol (the Slice 0/5 method, script
not committed).
- **Setup:** phone widths at DPR 3 with mobile emulation; the saved Warm Spring profile; **EN / Women** and **TH / Men**.
- **Photos:** real encoded PNG and JPEG files generated in the page from HEX values, through the real picker and `openPhoto`.

**Cases, at every width × language:**
- **Manual:** positive `#E9785D` (Great → ✨), middle `#2E86AB` (Wearable → △) and negative `#9B738A` (Tricky → △).
- **Photo idle.**
- **Errors:** an unreadable file, and a HEIC header in Chromium.
- **Preparing:** the notice, with the decoder delayed by the harness.
- **Landscape photo (4000 × 3000), 8 stripes:**
  - strong `#E9785D` ✨ and middle `#2E86AB` △
  - negative `#5B3A8C` ✕
  - the lighting note on `#F4F4F2` and `#9FABB4`
  - highlight, shadow and mixed warnings
- **Portrait photo (3000 × 4000):** strong, note and mixed.

| Width | Overflow (px) | Verdict first | Chips / sections in the card | Controls in the viewport | Image inside its stage / stage in the viewport | Marker visible and on the image | Layout |
|---|---|---|---|---|---|---|---|
| 320 | 0 | ✓ | ✓ | ✓ | ✓ | ✓ | stacked |
| 360 | 0 | ✓ | ✓ | ✓ | ✓ | ✓ | stacked |
| 390 | 0 | ✓ | ✓ | ✓ | ✓ | ✓ | stacked |
| 430 | 0 | ✓ | ✓ | ✓ | ✓ | ✓ | stacked |
| 768 | 0 | ✓ | ✓ | ✓ | ✓ | ✓ | stacked |
| 900 | 0 | ✓ | ✓ | ✓ | ✓ | ✓ | side by side |
| 1024 | 0 | ✓ | ✓ | ✓ | ✓ | ✓ | side by side |
| 1280 | 0 | ✓ | ✓ | ✓ | ✓ | ✓ | side by side |

Each row holds for **both EN and TH**, across every Manual, Photo, error, HEIC-error, preparing, landscape and portrait
state (16 × 21 layouts).

**Verdicts and guidance** were identical at every width and in both languages:
- **Manual:** ✨ / △ / △.
- **Photo stripes, in order:** ✨ / △ / ✕ / △ with note / △ with note / △ with highlight warning / △ with shadow warning /
  ✕ with mixed warning.

**Screenshots:** EN at 320 / 390 / 900 / 1280 and TH at 360 / 390 / 1024, reviewed by eye:
- the verdict reads first
- Thai wraps naturally, including the ✕ verdict and the error copy
- pairing chips wrap
- placement rows are readable
- the lighting note is a quiet aside above the caveat
- desktop side-by-side is stable

**Other real-browser facts are in their own sections:**
- EXIF orientation (§14)
- keyboard focus (§18)
- offline use (§24)
- storage and network (§22–§23)
- 41-photo DOM counters (§9)
- the 30 MiB and 60 MP boundaries and HEIC (§10–§13)

**Not automated:** real touch hardware, OS font scaling and on-screen keyboards. These are part of the physical matrix.

## 30. Production build audit

**Clean-checkout build.** Only the tracked files plus this slice's new files were copied, with `node_modules` linked.
**97 files, 8.9 MB:**
- `index.html`, `favicon.svg`, `color-draping.png`
- the 24 palette illustrations and 66 quiz images (all `.webp`, all tracked)
- one JS and one CSS file

It contains no:
- 5e investigation harness, synthetic fixtures, test files or test-only assets
- `.kilo` or `spikes/` content
- personal photos or screenshots
- source maps, diagnostics dumps or debug output

**Bundle scan:**
- `investigation`, `lightModel`, `diagnosePoint`, `realMatchFixtures`, `vitest`, `describe(`, `expect(`,
  `console.log/debug/table/warn`, `9FABB4`, `spike`, `localhost`, `sourceMappingURL`, XHR, `sendBeacon`, WebSocket,
  `indexedDB`, `caches.`: **0**.
- The one `fetch(` is Vite's modulepreload polyfill, for the app's own chunks.
- The `https://react.dev/errors/` strings are React's error-message template.
- `console.error` appears only inside React and its scheduler.
- The DEV diagnostics panel markup is present but is never rendered in production: it is gated by `import.meta.env.DEV`
  plus `?debug=color`. It is intentional, documented tooling from before V1.2, and was left alone.

**Local build (found, not changed).** A build in this working copy also copied **12 git-ignored intermediate images**
(`public/img/personal-color/*/both.png`, about 29.5 MB), because Vite copies `public/` wholesale.
- They are generated product-art sources (the palette illustrations), not personal photos, and nothing references them.
- The JS and CSS are byte-identical to the clean build.
- **Release builds must come from a clean checkout** (follow-up, §38).

**Slice 0 spike.** `spikes/photo-device-spike/` is not in `dist` (Vite builds only `index.html`). Slice 0 §21 says to
retire it after the physical matrix is recorded, no later than the V1.2 release. The matrix is still pending, so it
stays for the device tests. Follow-up.

## 31. Personal-photo audit

- **Git history (all refs).** Every image ever added is a V1.0/V1.1 product illustration (`public/img/**.webp`,
  `public/color-draping.png`, 2026-09-22). **No image of any format has been added since v1.1.0.**
- **Tracked text:** no `data:image/…;base64` and no long base64 runs.
- **Untracked, non-ignored files:** none.
- **Fixtures:** all photo fixtures are generated from HEX values in code, both in tests and in the browser QA scripts.
- **Screenshots:** QA screenshots were written to a scratch directory outside the repository, and contain only generated
  stripes and quadrants.
- **Not found anywhere:** the real photos used in human testing (e.g. the `#9FABB4` shirt and the light suit) are not in
  `public/`, fixtures, `docs/`, screenshots or history.

## 32. Logging

- **Photo code** (`photoChecker/`, `services/photoImage*`, `domain/photoColor/`, `colorChecker/`): **no `console.*` at
  all**, no pixel dumps, and no logging of file names, `File`s, object URLs or sample results. Nothing to remove.
- **Other production code:** no `console.*` either.
- **Kept:** the DEV-only diagnostics panel (`?debug=color`), which is unrelated to photos.

## 33. Dependencies

No change to `package.json` or the lockfile. No dependency was needed: every test above uses Vitest, jsdom, Testing
Library and small in-test doubles. A test now guards against HEIC, EXIF or image-library dependencies.

## 34. Bundle

| | Slice 5f baseline | Slice 6 | Δ |
|---|---|---|---|
| JS raw | 382.19 kB | 382.23 kB | +0.04 kB |
| JS gzip | 112.88 kB | 112.90 kB | +0.02 kB |
| CSS raw | 36.83 kB | 36.83 kB | 0 (same hash `DNQhf8p2`) |
| CSS gzip | 8.38 kB | 8.38 kB | 0 |

The only growth is the one-line modifier-key guard. Against the pre-V1.2 101.04 kB gzip, the V1.2 total is +11.86 kB,
within the plan's 15 kB budget.

## 35. Canonical test stability

`npm test` (= `vitest run`, with `.kilo` excluded by config):

| Run | Files | Tests | Result | Duration |
|---|---|---|---|---|
| 1 | 35 | 1,073 passed + 1 skipped | pass | 22.29 s |
| 2 | 35 | 1,073 passed + 1 skipped | pass | 23.12 s |
| 3 | 35 | 1,073 passed + 1 skipped | pass | 24.16 s |

These are the final-tree runs.
- **Earlier runs:** three more consecutive runs (22.85 / 22.96 / 22.67 s) and a verbose timing run (23.74 s) also passed,
  before the last test-only restructure.
- **Before the fix:** the first full run of this slice failed 2 tests (§5).
- **Since the fix:** no failures.

## 36. Physical-device QA matrix (HUMAN REQUIRED)

**Record for every row:**
- load success or error (and the message)
- responsiveness (time to photo; tap → result)
- crash or reload
- marker usability
- sampled colour plausibility
- verdict visibility without scrolling
- verdict stability
- usefulness of the warning / guidance
- memory symptoms (sluggishness, tab reload)
- any runtime error, if inspectable (`chrome://inspect`, Safari Web Inspector)

**Android** (Chrome; ideally a 3–4 GB RAM phone; note the model, RAM and Chrome version):

| # | Case | Watch for |
|---|---|---|
| A1 | normal camera JPEG, ~12 MP | picker opens with no permission prompt; ready ≤ 1.5 s; tap → result |
| A2 | rotated (portrait) JPEG | upright preview; the marker sits under the finger; the sampled colour matches |
| A3 | 24 MP | time; memory symptoms |
| A4 | **48–50 MP (high-res mode)** | **no crash or reload**; if the tab dies, record RAM + MP (decides the cap, §37) |
| A5 | rapid replace A → B → C | only C shown; no stale photo or result; no sluggishness |
| A6 | same file reselected | reopens |
| A7 | white / off-white, even daylight | plausible HEX; lighting note; verdict |
| A8 | white / off-white, open shade | note appears; an evenly lit re-tap moves lighter |
| A9 | white / off-white, warm indoor light | note; plausibility |
| A10 | dark garment | no light note |
| A11 | saturated garment | no light note; stable verdict |
| A12 | patterned / mixed garment | `mixed` warning, worded well |
| A13 | same garment, 5 tap points | §28 metric: PASS / INVESTIGATE |
| A14 | offline after the app loaded (airplane mode) | the photo flow still works |
| A15 | TalkBack | §19 steps; one summary per tap |

**iPhone** (Safari; note the model and iOS version):

| # | Case | Watch for |
|---|---|---|
| I1 | HEIC from Photos | opens (transcoded or native); upright; plausible colour |
| I2 | rotated HEIC | upright; marker and colour agree |
| I3 | JPEG | as A1 |
| I4 | white / off-white, even light | as A7 |
| I5 | white / off-white, shade | as A8 |
| I6 | rapid replacement | as A5 |
| I7 | same garment, 5 tap points | §28 metric |
| I8 | VoiceOver | §19 steps |

**Also carried over:**
- a native Thai reader reviews every photo and result string on a device
- Samsung "Save as HEIF" or an iPhone HEIC copied to Android shows the HEIC message
- **when the Android shell exists:** the Capacitor WebView file chooser (plan §18 Capacitor row)

**AUTOMATED vs HUMAN:**
- **Automated in this slice (jsdom and headless desktop Chrome):** everything in §4–§35.
- **HUMAN REQUIRED:** every row above. No row has been performed.

## 37. Release gates

| Gate | State |
|---|---|
| 48–50 MP on physical Android | **C. PENDING**: physical Android QA not yet performed. The 60 MP limit is **PROVISIONAL — PHYSICAL ANDROID QA REQUIRED** |
| Real iPhone HEIC | **C. PENDING**: real iPhone QA not yet performed |
| TalkBack | **PENDING** |
| VoiceOver | **PENDING** |
| Native Thai review (from 5a–5f) | **PENDING** |

Automated accessibility tests and desktop Chromium do not close these gates.

**V1.2 is READY FOR PHYSICAL QA. It is not ready for release.**

## 38. Blockers, follow-ups and accepted limitations

**BLOCKERS (engineering):** none open.
- No crash, stale-photo race, uncontrolled-memory failure, leaked personal photo or upload was found.
- The primary interaction is accessible by touch, pointer and keyboard.
- Release still waits on the physical gates in §37.

**FOLLOW-UPS:**

| # | Item | Note |
|---|---|---|
| F1 | Local builds copy 12 git-ignored `public/…/both.png` intermediates (~29.5 MB) into `dist` | build releases from a clean checkout (verified clean: 97 files), or move the intermediates out of `public/`; predates V1.2 |
| F2 | Retire `spikes/photo-device-spike/` | after the physical matrix is recorded (Slice 0 §21); not in `dist` |
| F3 | Tabs: `aria-controls` points at an unrendered panel; no arrow-key roving | shared with the palette tabs; align both with the WAI-ARIA tabs pattern later |
| F4 | `openPhoto` reports a decode failure instead of `aborted` if abort and failure coincide | not user-visible (stale requests are dropped) |
| F5 | A mouse drag that starts outside the photo and ends on it samples a spot | desktop-only; touch scrolls end in `pointercancel` |
| F6 | Open product questions Q1 (ad gating; V1.2 ships ungated), Q3 (open-in-manual link), Q5 (engine alignment) | plan §19 |
| F7 | The DEV diagnostics panel code is in the bundle (never rendered) | predates V1.2; out of scope |

**ACCEPTED LIMITATIONS:**
- A physical garment's colour cannot always be recovered from one photo. A uniform light or colour cast is not
  detectable (5e).
- Exact HEX varies across nearby taps (§28). Its presentation is Slice 7's problem.
- HEIC support differs by browser and platform. Chromium cannot decode it and shows a friendly message.
- Wide-gamut colours are clipped to sRGB, and 8-bit quantisation applies.
- Thresholds are calibrated on palettes and simulated lighting, not on real photos.
- Manual and Photo can give different verdicts for the same HEX (5d §20).
- The web app works offline only once loaded (no service worker).
- Engines without `createImageBitmap(Blob)` use the `<img>` fallback, which Chromium caches after revoke.
- Automated tests cannot prove browser GC or phone memory behaviour.

## 39. Slice 7 handoff: Human-readable Color Names

**Do not implement it in Slice 6. Slice 6 does not decide the taxonomy.**

**The confirmed product problem.** Exact HEX such as `#C6CACF`, `#D9DCDF` and `#D0D1D5` (three taps on one light suit) is:
1. **too technical** for many users
2. **more precise than photographic variation justifies**
3. **visually misleading** when nearby taps produce slightly different values that all mean "the same light grey"

**Slice 7 should investigate and implement:**
- stable semantic colour names and human-readable tone descriptions (lightness, warmth, softness) in EN and TH, with
  a Thai colour-name taxonomy
- naming stability for nearby colours: taps that PASS the §28 metric should usually share a name
- how much prominence HEX keeps (primary, secondary or on demand), in both Manual and Photo
- consistency with the existing `colorDisplayName()` palette names and the 5f lighting note

**Inputs from this slice:**
- the §28 physical metric and its recorded outcomes (A13 / I7)
- the unchanged result hierarchy (§26)
- the rule that names must not claim a garment's true colour (plan §12)

**Constraints to keep:**
- no change to the sampler, matcher or thresholds merely to stabilise names
- names describe the sampled colour, not the garment
- Manual and Photo share one result card
