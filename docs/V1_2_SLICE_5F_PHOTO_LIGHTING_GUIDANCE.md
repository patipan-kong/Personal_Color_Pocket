# V1.2 Slice 5f — Photo Lighting Guidance

Status: **done**. This slice is guidance only. It changes no sampling, matching, threshold, category, placement, pairing
or Manual behaviour.

It is the smallest safe product correction identified by the
[Slice 5e investigation](V1_2_SLICE_5E_REAL_WORLD_SAMPLING_INVESTIGATION.md).

## 1. Triggering 5e findings

- **Shade can turn white into blue-grey.** A visually white garment photographed in open shade under skylight encodes as
  `#9FABB4`. The sampler is correct: those pixels are identical to a genuine blue-grey fabric (§G of the 5e record).
- **The difference is mostly lightness.** ΔL −0.232 of ΔE 0.233; the cast adds only a little blue.
- **Sampling tweaks don't fix it.** Smaller or larger radii, three taps under the same light, and automatic white balance
  (gray-world / white-patch) all fail, and white balance actively harms real cream and grey garments.
- **`shadow` and `highlight` measure clipping, not lighting.**
  - `shadow` fires only when more than 35% of pixels are near-black.
  - `highlight` fires only when more than 35% are near-white.
  - The shipped copy ("Shadow may make this color look darker") implied ordinary shade detection.
- **The capture tips were never shipped.** Plan §12 lists them, but the panel only said "Tap any color…".

## 2. Product decision

The app says what it knows: the result describes the colour **as it appears in this photo**. When a light, near-neutral
colour may have been shifted by the photo's lighting, the app helps the user take a more representative sample.

The verdict, why, action, placement and pairing are unchanged; the guidance only supports them.

Recorded in the plan (§12.1): *Photo lighting uncertainty is handled transparently through guidance in V1.2, not
automatic color correction.*

## 3. Capture tips

A single line under the photo picker (`.photo-tip`), shown in Photo mode before and after choosing a photo:

- EN: "For a more accurate color, use a photo with even lighting and avoid deep shade, glare or strong reflections."
- TH: "เพื่อให้สีใกล้เคียงของจริง ลองใช้ภาพที่แสงสม่ำเสมอ ไม่มืดหรือสว่างจัด และหลีกเลี่ยงบริเวณที่มีเงาหรือแสงสะท้อน"

It needs no acknowledgement and is not a tutorial. It takes 2–3 lines (37–56 px) at phone widths.

## 4. Tap guidance

The existing instruction (shown after a photo is ready, before the first tap) now asks for an evenly lit area:

| | Before | After |
|---|---|---|
| EN | Tap any color in the photo to see where it works best. | Tap an evenly lit area of a color to see where it works best. |
| TH | แตะสีใดก็ได้ในรูป เพื่อดูว่าสีนั้นใช้ตรงไหนได้ดี | แตะบริเวณสีที่แสงสว่างและสม่ำเสมอ เพื่อดูว่าสีนั้นใช้ตรงไหนได้ดี |

It never says "the brightest area". Slice 5e showed that choosing the lightest point distorts genuine grey, beige, pastel,
denim and muted colours (ΔE 0.065–0.085, up to 9 subtypes changed). A test forbids "brightest / lightest" in all new
copy, EN and TH.

## 5. Light-near-neutral presentation rule

`src/domain/photoColor/lightingGuidance.ts`:

```ts
isLightNearNeutral(oklab) = oklab.l >= LIGHT_VALUE_MIN && oklabChroma(oklab) < NEUTRAL_CHROMA_MAX
```

Both boundaries are **existing photo-match constants**, imported unchanged. The helper contains no number of its own, and
a test enforces that.

| Boundary | Value | Existing meaning in `photoMatch.ts` |
|---|---|---|
| `LIGHT_VALUE_MIN` | OKLab L ≥ 0.72 | The "Light" value descriptor (shown as "Color character: Light") |
| `NEUTRAL_CHROMA_MAX` | chroma < 0.04 | Below this, hue is too weak to name a warmer/cooler direction |

- **Why these two:**
  - "Light" is the app's own lightness category.
  - "Near-neutral" is the app's own boundary for "hue is too weak to talk about".
  - `SOFT_CHROMA_MAX` (0.06) was rejected because it covers clearly tinted soft colours such as dusty pink (0.057), whose
    lighting error is not the white/off-white confusion this note addresses.
- **Not tuned to the reported case.** `#9FABB4` (L 0.735, C 0.019) falls inside because it is Light and near-neutral by
  the existing definitions. It is close to the L boundary, and the boundary was not moved for it.
- **Output:** `getPhotoLightingGuidance(match)` returns `{ kind: 'light-near-neutral' }` or `null`. There is no colour,
  corrected value, category, score or confidence.

## 6. Why it is not a detector

The rule looks only at the colour the sampler already returned. It never reads the photo and cannot know whether there is
shade, a cast or a white garment. The same `#9FABB4` can be a shaded white or a real blue-grey, and the app cannot tell
them apart (5e §G).

So the note is conditional: "*If* this doesn't look like the real color, try another evenly lit spot." It never says the
photo is in shade, that the colour is white, that the camera got it wrong, or that bad lighting was detected. Tests pin
this wording in both languages.

## 7. Shadow copy correction

| | Before | After |
|---|---|---|
| EN | Shadow may make this color look darker. Try another spot if you want to double-check. | This spot contains very dark pixels, which may make the color look darker. Try an evenly lit spot. |
| TH | เงาอาจทำให้สีดูเข้มกว่าความจริง ถ้าอยากเช็กให้แน่ใจ ลองแตะจุดอื่น | จุดนี้มีส่วนที่มืดจัด อาจทำให้สีที่วัดได้ดูเข้มกว่าปกติ ลองแตะบริเวณที่แสงสม่ำเสมอ |

The `shadow` enum and its threshold are unchanged. Only the words now match what it measures.

## 8. Highlight copy correction

| | Before | After |
|---|---|---|
| EN | Strong light may make this color look lighter. Try another spot if you want to double-check. | This spot contains very bright pixels, which may make the color look lighter. Try an evenly lit spot. |
| TH | แสงจ้าอาจทำให้สีดูอ่อนกว่าความจริง ถ้าอยากเช็กให้แน่ใจ ลองแตะจุดอื่น | จุดนี้มีส่วนที่สว่างจัด อาจทำให้สีที่วัดได้ดูอ่อนกว่าปกติ ลองแตะบริเวณที่แสงสม่ำเสมอ |

## 9. Mixed copy

| | Before | After |
|---|---|---|
| EN | This spot mixes several colors, so this result may be less reliable. Try a more even area. | This spot contains several colors, so this result may be less reliable. Try a more even area of the same color. |
| TH | จุดนี้มีหลายสีปนกัน ผลอาจคลาดเคลื่อนได้ ลองแตะบริเวณที่สีเรียบกว่านี้ | จุดนี้มีหลายสีปนกัน ผลอาจคลาดเคลื่อนได้ ลองแตะบริเวณสีเดียวกันที่เรียบสม่ำเสมอกว่านี้ |

The meaning and the algorithm are unchanged. "Of the same colour" stops the user from moving to a different colour.

## 10. Guidance priority

**explicit sampler warning (mixed / highlight / shadow) > light-near-neutral note > photo caveat**

- **With any warning:** the warning is the sampling guidance, and the note is not shown, because it would repeat "try an
  evenly lit spot".
- **With no warning, on a light near-neutral sample:** the note is shown.
- **The caveat** ("Based on how the color appears in this photo.") is always shown, quietly, last. It says what the result
  means, while the note says what the user can do.
- **Pure `#FFFFFF`:** a blown-out white in a photo is clipped, so the sampler flags `highlight`. The warning shows and the
  note does not.

The priority is implemented once, in `getPhotoLightingGuidance`, and tested at the domain, card and app level.

## 11. Shared-result integration

- **`ColorResultView` (5d):** gains one optional, source-neutral slot, `info: string | null`, described as supporting
  guidance, never a verdict or warning.
- **Photo adapter:** fills `info` when `getPhotoLightingGuidance(match)` returns a value.
- **Manual adapter:** always sets `info: null`.
- **Shared card:** renders `<p class="check-info">` after the warnings and before the caveat. It has no mode switch, and a
  test forbids `mode ===`, `'photo'` and `lightingNote` in the shared renderer.
- **Order:** swatch + HEX → verdict → category → why → action → reference → placement → pairing → details → warnings / info →
  caveat. The note can never appear above the verdict.
- **Styling:** the note is quiet informational text: muted colour, 0.82 rem, and a thin neutral left rule. That is
  deliberately not the amber rule used for warnings, and not the verdict's weight or size.

## 12. Accessibility

- **The note:** a normal `<p>` in reading order. It is not in the `role="status"` live region and not `aria-hidden`, so
  screen-reader users reach it by normal navigation, and a tap does not trigger a long announcement.
- **Warnings:** unchanged. They are announced once with the summary, and the visible list stays `aria-hidden`.
- **The capture tip:** plain text beside the picker.

## 13. Responsive behavior

Checked in headless Chrome against the production build: 8 widths (320, 360, 390, 430, 768, 900, 1024, 1280) × EN/Women and
TH/Men, a real PNG through the real picker and `openPhoto`, and 8 stripes. The stripes were:

- a strong chromatic sample
- `#9FABB4`
- white fabric `#F4F4F2`
- an outside + note case `#96B9C0`
- navy
- glare over white
- shadow over white
- a mixed stripe

| Check | Result |
|---|---|
| Horizontal overflow | 0 at every width / language |
| Note shown | exactly for `#9FABB4`, `#F4F4F2`, `#96B9C0` (48 / 48 cases); never for chromatic, navy, glare, shadow or mixed |
| Verdict above the note | yes, everywhere |
| Note inside the result column / in the live region | yes / never |
| Note height | TH 57 px; EN 95 px at 320 and 76 px at 390 |
| Capture tip height | 37–56 px |
| Desktop side-by-side (900 / 1024 / 1280) | kept |
| Manual (`#F4F4F2`) | no tip, note, caveat or warnings, at every width |
| Network | only the app's own static assets |

**Screenshots** (TH 360 / 390 / 430 / 1024, EN 390 / 1280):

- The verdict is still the first thing on the card.
- The note reads as a quiet aside above the caveat.
- The ✕ "not recommended" verdict for `#96B9C0` stays ✕, with the note after the pairing section.
- The shadow case shows "มีส่วนที่มืดจัด".

## 14. EN copy

- **Capture tip:** "For a more accurate color, use a photo with even lighting and avoid deep shade, glare or strong
  reflections."
- **Instruction:** "Tap an evenly lit area of a color to see where it works best."
- **Lighting note:** "White and light colors can look darker or pick up a color cast in a photo. If this doesn't look like
  the real color, try another evenly lit spot on the same color."
- **Warnings:** see §7–9.
- **Caveat (unchanged):** "Based on how the color appears in this photo."
- **Avoided phrases:** "shadow detected", "bad lighting detected" and "the camera got it wrong" do not appear. "Pixels" is
  used only where the diagnostic literally counts pixels.

## 15. TH copy

- **Capture tip:** "เพื่อให้สีใกล้เคียงของจริง ลองใช้ภาพที่แสงสม่ำเสมอ ไม่มืดหรือสว่างจัด และหลีกเลี่ยงบริเวณที่มีเงาหรือแสงสะท้อน"
- **Instruction:** "แตะบริเวณสีที่แสงสว่างและสม่ำเสมอ เพื่อดูว่าสีนั้นใช้ตรงไหนได้ดี"
- **Lighting note:** "สีขาวและสีอ่อนอาจดูเข้มขึ้นหรืออมสีจากแสงในภาพ ถ้าสีนี้ดูไม่ตรงกับของจริง
  ลองแตะอีกจุดบนสีเดียวกันที่แสงสว่างและสม่ำเสมอ"
- **Caveat (unchanged):** "คำแนะนำนี้อ้างอิงจากสีที่เห็นในภาพนี้"

Native-copy review notes:

- **"ตรวจพบ…" is not used anywhere.** Ordinary shade is not detected.
- **Concrete, observable wording:** "มีส่วนที่มืดจัด / สว่างจัด", "แสงในภาพอาจทำให้…", "ลองแตะอีกจุด…".
- **"สีที่วัดได้" (the measured colour) instead of "ความจริง".** The old "กว่าความจริง" implied the app knows the true colour.
- **"จุดนี้" is kept** for consistency with the existing "สีของจุดนี้" label and the mixed warning.
- **The shadow warning no longer mentions "เงา".** "เงา" stays only in the capture tip, where it is advice ("avoid areas
  with shadow"), not a detection claim.

## 16. Tests

`src/photoChecker/photoLightingGuidance.test.tsx` has 70 tests.

**Rule**
- The helper reuses both constants and has no literal of its own.
- Inclusive/exclusive boundaries.
- Light neutrals: white, white fabric, off-white, cream, light grey, silver, `#9FABB4`.
- Dark colours: near-black `#111412`, black, navy ×2, dark brown, charcoal. No note just because chroma is low.
- Light or saturated chromatic colours: bright yellow, light cyan, pink, baby blue, saturated red, strong green,
  saturated blue.
- A mid grey below L 0.72.
- The output is a semantic key only.
- `9FABB4` appears in no production source or locale.

**Reported case**
- For all 12 subtypes, `inspectHex('#9FABB4')` equals a direct `samplePhotoRegion` + `matchPhotoColor`.
- The view's category, suitability, nearest reference and pairings are the engine's own.
- The note appears.

**True blue-grey**
- The note is conditional ("If this doesn't look like the real color") and never names shade, white, the camera or
  detection (EN + TH).

**Verdict**
- Deep Winter `#9FABB4` stays △ "Not ideal near your face".
- A light-neutral "outside" result stays ✕ with the note.
- The note is ordered after the verdict, why, action, placement and pairing, and before the caveat.

**Priority**
- Each flag alone, and all three, on a light near-neutral sample: warning only, no note.
- The verdict and caveat are always kept.
- A real clipped white gives the highlight warning.

**Shared / Manual**
- No mode switch in the shared renderer.
- The Manual adapter gives `info: null` for all subtypes.
- App level: Manual `#FFFFFF` shows no tip, note, caveat or warnings.

**Accessibility**
- The note is outside the live region and not hidden.
- Warnings keep their announcement.

**Copy**
- Shadow says "very dark pixels" / "มีส่วนที่มืดจัด" and never shade, shadow or detection.
- Highlight says "very bright pixels" / "มีส่วนที่สว่างจัด" and never strong light, lighting, glare or detection.
- Mixed keeps its meaning.
- No new copy says "detected" / "ตรวจพบ".

**Capture and tap**
- The tip mentions even lighting, deep shade, glare and reflections (EN + TH).
- The instruction says "evenly lit" and never "brightest" or "lightest".
- The copy stays short.

**App**
- EN + TH: Photo shows the tip and, for `#9FABB4`, the note (not announced).
- A navy photo gets no note.

**Updated existing tests**
- `PhotoResultCard.test.tsx` pins the new warning copy.
- `ColorResultCard.test.tsx` adds `info: null` to its synthetic view and `.check-info` to the optional-slot check.

### Domain before / after proof

A throwaway dump covered 7 colours × 12 subtypes = 84 rows. It recorded:

- the sample HEX, OKLab and flags
- the category
- the nearest colour, group and distance
- `resembles`
- the pairings
- the Manual rating, score, closest colours and pairings

It was run with the 5f changes stashed (HEAD `981efdf`) and again with them applied, and the two files are
**byte-identical**. Category codes per subtype use N/B/R/A/O in `subtypeOrder`:

| Sample | L | C | Flags | Photo categories | Note |
|---|---|---|---|---|---|
| `#9FABB4` | 0.735 | 0.019 | – | BARBBBROAABA | yes |
| `#FFFFFF` | 1.000 | 0.000 | highlight | BABBBAAAABBB | no (warning wins) |
| `#FAF9F6` off-white | 0.982 | 0.004 | – | BABBBAAAABBB | yes |
| `#D3D3D3` light grey | 0.867 | 0.000 | – | ARRBRBAAARBB | yes |
| `#CC0000` red | 0.531 | 0.218 | – | ORROAOORRRNN | no |
| `#1F2A44` navy | 0.288 | 0.050 | – | ARBARRORRNBB | no |
| `#000000` black | 0.000 | 0.000 | shadow | OOOOOAOOORRR | no |

## 17. What did not change

- **Sampling:** radius and `sampleRadiusFor`, circular disc, trim fraction, RGB averaging, spread, and the `mixed`,
  `highlight` and `shadow` thresholds.
- **Colour and matching:** OKLab conversion, the matcher and every matcher constant, the five categories, suitability
  mapping, placement and pairing.
- **Image handling:** the image pipeline and coordinates.
- **Manual Checker:** matching and scoring (the regression freeze passes).
- **Other features:** palettes and the quiz (the exhaustive audit passes).
- **Not added:** no image correction, white balance, exposure correction, histogram analysis, scene analysis, object
  detection, AI or multi-tap. There is no new state, persistence, network or dependency.

## 18. Remaining real-phone validation

- **Real photos:** check with real phone photos (iOS and Android, HEIC → JPEG, HDR on and off), see the physical-phone
  checklist in the 5f report, of white, off-white, grey, cream and navy garments. Cover open shade, direct sun, indoor
  warm light and a window.
- **Note coverage:** confirm the note appears for the light garments and not for dark or strongly coloured ones.
- **Evenly lit tap:** confirm that tapping an evenly lit spot on a real shaded-white shirt is possible in practice and
  moves the sample towards white.
- **Real clipping:** confirm how often clipped whites (the `highlight` warning) occur on real phones, and that the warning
  wording reads well.
- **Thai copy:** a native Thai reader should confirm the final wording on a device.
- **The one decision real photos can make:** whether an optional "check another spot" comparison (5e option B) is ever
  worth building.

## 19. Entry criteria for Slice 6

- 5f is committed. The domain proof is identical, and the full suite and quiz audit pass.
- No sampling correction is pending. Photo lighting uncertainty is handled by guidance (plan §12.1).
- **A follow-up slice is justified only by real-phone evidence of a blocker.** Examples: the note never appears for real
  shaded whites, it appears on most ordinary chromatic photos, or the copy confuses testers. Otherwise proceed to Slice 6
  hardening.
