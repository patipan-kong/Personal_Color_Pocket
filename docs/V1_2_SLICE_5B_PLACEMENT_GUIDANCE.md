# V1.2 Slice 5b: Photo Color Guidance and Placement Result

Status: **done in automated and headless-browser checks. Real-phone QA and a Thai-speaker copy
review are still open.** This slice replaces the compact Slice 5a feedback with a full result card
that answers *"how can I use this color?"*

Files:
- [placement.ts](../src/domain/photoColor/placement.ts): the pure placement model.
- [PhotoResultCard.tsx](../src/photoChecker/PhotoResultCard.tsx): the result area (live summary and guidance card).
- [PhotoCheckerPanel.tsx](../src/photoChecker/PhotoCheckerPanel.tsx): renders the card beside or below the photo. It now receives `language`, `presentation` and `garments`.
- [PhotoSurface.tsx](../src/photoChecker/PhotoSurface.tsx): a `data-input` attribute, so the focus ring and keyboard hint appear only for keyboard use (§14).
- [App.tsx](../src/App.tsx) `CheckerView`: passes the saved presentation preference.
- [styleGuide.ts](../src/domain/personalColor/styleGuide.ts): `GarmentNounKey` gains `tshirt`, `scarf`, `shoes` and `belt`, with EN/TH labels in `styleExamples.garments`.
- i18n: `photoChecker` result-card keys in [types.ts](../src/i18n/types.ts), [en.ts](../src/i18n/en.ts) and [th.ts](../src/i18n/th.ts).
- [styles.css](../src/styles.css): card styles and the ≥ 900 px side-by-side layout.
- Tests:
  - [placement.test.ts](../src/domain/photoColor/placement.test.ts) (35)
  - [PhotoResultCard.test.tsx](../src/photoChecker/PhotoResultCard.test.tsx) (37)
  - 6 new tests in [PhotoCheckerPanel.test.tsx](../src/photoChecker/PhotoCheckerPanel.test.tsx)
  - 1 new test in [checkerModes.test.tsx](../src/photoChecker/checkerModes.test.tsx)
  - Test-only helper: [realMatchFixtures.ts](../src/domain/photoColor/realMatchFixtures.ts)

Unchanged:
- `openPhoto`, the image limits, the sampler, the radius rule, the coordinate mapping and OKLab
- the photo match distance (lightness weight 0.5, Close 0.045, Related 0.085), the neutral hue ramp and the five categories
- palettes, quiz scoring and the manual checker

## 1. Objective

After a tap, the user should know three things:
1. what the result means
2. where the color is easiest to wear
3. what to pair it with

The slice only consumes the existing `PhotoColorMatch`. It adds no new measurement, score or
classification.

## 2. Product principle: placement, not detection

The app never asks what was tapped. The user already chose the color by tapping it, and the answer
is *"given this color and your subtype, where does it work best?"*

The same sampled color gets the same guidance whether it came from a shirt, trousers, a bag, shoes,
a product screenshot or a fabric swatch.

There is:
- no garment or object detection
- no segmentation
- no ML inference
- no bounding boxes, masks, labels or confidence values

Tests enforce this (§16):
- `getColorPlacement` reads only `match.category`, verified with a property-access proxy.
- Extra "detection" fields cannot change the output.
- The source is scanned for detection, ML and network terms.

## 3. Inputs

`getColorPlacement(match: Pick<PhotoColorMatch, 'category'>, presentation: 'women' | 'men'): ColorPlacement`

```ts
ColorPlacement = { category, rows: { tier, areas[], examples[] }[], pairing: 'around' | 'near-face' }
tier    = 'best' | 'good' | 'easiest' | 'care'
area    = 'near-face' | 'larger-pieces' | 'base' | 'layers' | 'below-face' | 'accents'
example = GarmentNounKey   // shared style-guide vocabulary
```

The result is semantic keys only; the UI renders all prose through i18n. It is one table lookup,
deterministic, and returns fresh arrays. It has no numbers, score, rank or confidence. An unknown
category throws `RangeError` instead of guessing.

## 4. Five-category placement mapping

| Category | Rows (tier: areas) | Pairing framing |
|---|---|---|
| near-face "Great near your face" | best: near your face · good: larger pieces, accessories | `around`: "Try it with" |
| neutral-base "Easy neutral" | best: main or base pieces · good: near your face | `around` |
| related "Works with care" | good: a second color or layer · care: near your face | `near-face`: "Pair it with / Wear one of these closer to your face" |
| away-from-face "Better away from your face" | easiest: below the face, accessories · care: near your face | `near-face` |
| outside "Outside your palette" | easiest: accessories and small accents, below the face · care: near your face | `near-face` |

Notes:
- A neutral is **not** downgraded. It is "best" as a base and still "works well" near the face.
- The weaker categories always keep a usable placement ("easiest" or "good"). "Use with care" means
  "fine when a palette color is nearer the face". It is never a prohibition.
- No card anywhere says "don't wear" or "avoid" (tested).

## 5. Presentation-specific examples

Presentation chooses up to 4 example garments per row and **nothing else**. Tiers, areas, pairing
framing and the category are identical for Women and Men (tested for every category).

| Row | Women | Men |
|---|---|---|
| near-face (best) | Top, Blouse, Scarf, Jacket | Shirt, T-shirt, Polo, Jacket |
| near-face (good) | Dress, Skirt, Bag | Trousers, Bag, Shoes |
| neutral-base (best) | Trousers, Skirt, Jacket, Bag | Trousers, Jacket, Shoes, Bag |
| related (good) | Jacket, Skirt, Bag | Jacket, Trousers, Bag |
| away-from-face (easiest) | Skirt, Trousers, Shoes, Bag | Trousers, Belt, Shoes, Bag |
| outside (easiest) | Bag, Shoes, Accessory, Skirt | Bag, Shoes, Belt, Trousers |
| every "near your face" care/good row | Top, Scarf | Shirt, T-shirt |

- Men never see Dress, Skirt or Blouse (tested).
- Examples reuse `GarmentNounKey` and `styleExamples.garments`, the same vocabulary as the style guide, which gained `tshirt`, `scarf`, `shoes` and `belt`. There is no second garment dictionary.
- The app still falls back to `'women'` when no preference is saved, as elsewhere.

## 6. Result card hierarchy

Top to bottom (beside the photo on desktop):
1. Swatch, "Color at this spot" and the HEX. The HEX is present but not the headline.
2. **Category** badge (strong).
3. Closest palette color: chip (swatch + display name) and group label.
4. Harder resemblance, only when `match.resembles` exists (quiet).
5. **Where to wear it**: 2 rows, each with a tier label, area text (bold) and example garments (muted).
6. Pairing: heading, one line of placement advice, and up to 3 palette chips.
7. Direction and descriptors (quiet).
8. Warnings (amber left border), after the guidance.
9. Photo caveat (quiet).

Nothing is hidden behind an accordion. Placement is rendered as two short rows, not a wall of chips.

## 7. Nearest color

- Shown as a `.color-chip` (the palette's existing chip style), named with the existing `colorDisplayName(language, color)`.
- Group label: Best color / Accent color / Neutral.
- The HEX is only in the chip tooltip, as in the style guide.
- Internal palette ids are never rendered (tested).

## 8. Harder resemblance

The line only appears when the engine sets `match.resembles`.

- EN: "In this photo it is also close to {name}, one of your more considered colors."
- TH: "ในภาพนี้ สีนี้ยังใกล้กับ {name} ซึ่งเป็นสีที่ต้องเลือกใช้สักนิด"

It says the photographed color is *close to* the Harder color, never that it *is* that color
(tested). "More considered" reuses the palette page's name for the Harder group. The line is
small and muted, including when it appears on near-face or neutral-base results.

## 9. Direction and descriptors

- **Direction:** `match.direction` is used as-is (0–2 keys, empty for near-face and neutral-base) and only translated. EN: "A little deeper and more muted than Cream." TH: "สีนี้ดูเข้มและหม่นกว่า … เล็กน้อย". It is not rendered when empty.
- **Descriptors:** `match.descriptors` is shown as "Color character: Light · Soft". It is supporting text, not a verdict.
- The UI computes no RGB, HSL or OKLab values (source-audited).

## 10. Pairing guidance

- `match.pairWith` is rendered exactly, in order (≤ 3 from the existing `pairingSuggestions`). Each pairing is a chip with swatch, display name and HEX tooltip.
- The card has no pairing logic (source-audited: no `pairingSuggestions`, `getPalette` or distance code).
- Framing:
  - near-face / neutral-base: "Try it with: Palette colors that go well with it."
  - related / away-from-face / outside: "Pair it with: Wear one of these closer to your face." (TH "ถ้าชอบสีนี้ ลองจับคู่กับ / ให้สีเหล่านี้อยู่ใกล้ใบหน้ามากกว่า")

## 11. Warnings

`mixed`, `highlight` and `shadow` are carried unchanged from the sampler. They never remove the
category, placement or pairings (tested with unit fixtures, a real glare image through the panel,
and real glare/shadow/mixed patches in headless Chrome).

| Flag | EN | TH |
|---|---|---|
| mixed | This spot mixes several colors. Try a more even area. | จุดนี้มีหลายสีปนกัน ลองแตะบริเวณที่สีเรียบกว่านี้ |
| highlight | Strong light may make this color look lighter than it is. | แสงจ้าอาจทำให้สีดูอ่อนกว่าความจริง |
| shadow | Shadow may make this color look darker than it is. | เงาอาจทำให้สีดูเข้มกว่าความจริง |

## 12. Photo caveat

Every matched result ends with:
- EN: "Based on how the color appears in this photo."
- TH: "คำแนะนำนี้อ้างอิงจากสีที่เห็นในภาพนี้"

Lighting, camera processing, white balance and the screen all change photographed color. The card
never presents itself as a measurement and has no percentage, score or confidence (tested in EN
and TH for every category).

## 13. Responsive layout

- **Below 900 px:** photo, then the result, stacked.
- **900 px and up:** `.photo-layout` becomes `minmax(0, 1.35fr) | minmax(280px, 1fr)`, with the photo on the left and the result on the right, top-aligned. This fixes the Slice 5a problem where a tall photo pushed the result below the fold on desktop.

Headless Chrome, production build, real PNG photos through the real picker and `openPhoto`, EN/Women and TH/Men at each width (DPR 3 phone emulation below 700 px):

| Width | Layout | Overflow | Category visible with the photo at the top | Photo bottom → category |
|---|---|---|---|---|
| 320 / 360 / 390 / 430 | stacked | 0 | yes (landscape and portrait) | 61 px |
| 768 | stacked | 0 | yes | 61 px |
| 1024 | side by side (448 + 332 px) | 0 | yes, and the first placement row too, even for a 3:4 portrait | beside |
| 1280 | side by side (514 + 380 px) | 0 | yes, with placement, for landscape and portrait | beside |

At every width and in both locales:
- chips and placement rows stay inside the card
- Thai text wraps without overflow
- the caveat is present
- all five categories and all three warnings were reached by real taps

On phones the first placement row sits about 210–290 px below the photo, so a short scroll is
needed on tall portrait photos. The category is visible immediately.

## 14. Accessibility

- **Live region:** only the short summary (`.photo-summary`, `role="status"`) is announced: instruction, "Press Enter…", the unavailable reason, or HEX + category + warnings. The guidance card is not in a live region, so a new tap announces one line, not the whole card (tested).
- **Warnings:** they are in the summary as visually hidden text. The visible list is `aria-hidden`, so they are not read twice.
- **Not color alone:** every swatch sits next to a name or the HEX, and tiers have text labels. Best, care and outside are never shown only by color.
- **Headings:** "Where to wear it" and the pairing heading name their `region`s.
- **Focus ring (5a issue fixed here):** Chrome treats focus moved by script in `pointerdown` as `:focus-visible`, so in 5a a tap also showed the ring and the keyboard hint. On a phone that pushed the result about 110 px lower. The surface now records the last input type (`data-input`), and the ring and hint show only for keyboard use. A keypress after a tap brings both back. This was verified in headless Chrome and by a unit test. Tap mapping and focus behavior are unchanged.
- **Keyboard:** moving the marker without Enter removes the old guidance and shows "Press Enter to check this spot", preserving 5a behavior.

## 15. Localization

- New typed keys in `photoChecker`: `nearestLabel`, `groups`, `resembles`, `placementHeading`, `tiers`, `areas`, `pairing`, `direction`, `directions`, `descriptorsLabel`, `descriptors`, `caveat`. EN/TH parity is enforced by the compiler.
- Updated keys:
  - `instruction`: "Tap any color in the photo to see where it works best." It no longer says "garment", following the placement principle.
  - The three warnings.
  - The TH categories use the agreed wording: เหมาะมากเมื่ออยู่ใกล้ใบหน้า, สีกลางที่ใช้ง่าย, ใช้ได้ ถ้าจัดคู่สีให้เหมาะ, เหมาะกว่าเมื่ออยู่ห่างจากใบหน้า, อยู่นอกพาเลตต์หลักของคุณ. They use the app's existing spelling "พาเลตต์".
- **The Thai copy still needs review by a native speaker before release.**

## 16. Tests

| File | Tests | Covers |
|---|---|---|
| `placement.test.ts` | 35 | all five mappings; determinism; no score or confidence; reads only `category`; detection fields ignored; source audit; Women/Men examples-only; no dress/skirt for Men; garment labels in EN/TH; all 12 subtypes × 5 categories reached through real matches, rendered with names, pairings and labels in EN and TH |
| `PhotoResultCard.test.tsx` | 37 | hierarchy order; category prominence; caveat EN/TH; no percentage; rows from `getColorPlacement`; wording for away and outside; presentation; nearest name, group and no id; resemblance present/absent and "close to" wording; direction translation; descriptors; `pairWith` exact across 12 × 5 in TH; pairing framing; source audit; the three warnings advisory; unavailable and pending states; live-region scope; headings; TH copy |
| `PhotoCheckerPanel.test.tsx` | +6 (54) | layout blocks; a new tap replaces the card and keeps the photo; keyboard move clears guidance until Enter; a real glare sample keeps its guidance; presentation examples-only; input-type focus styling; the privacy audit now includes `PhotoResultCard.tsx` and `placement.ts` |
| `checkerModes.test.tsx` | +1 (7) | a saved Men preference reaches the card at App level; storage unchanged |

**Real matches, not fabricated categories.** `realMatchFixtures.ts` is test-only; the app never
imports it. It pushes solid images of the app's existing curated colors (258 unique HEX) through
the real `inspectPhotoPoint` → sampler → matcher. Every subtype reaches every category this way.

**Mutation checks** (throwaway, not committed): 9 of 9 caught. They were:
- Men get a skirt.
- Related pairing is framed generally.
- Presentation is ignored for one category.
- Pairings are truncated.
- The resemblance line is dropped.
- The whole card becomes a live region.
- Warnings hide the guidance.
- The palette id is shown.
- A direction is mistranslated.

## 17. Known limitations

- Placement is a curated table per category. It is guidance, not a measurement, and it has not been validated with users.
- Example garments are presentation-based conventions, and there are only two presentations.
- The "Harder resemblance" wording names a palette color the user may never have looked at.
- On phones, a tall portrait photo plus the card needs a short scroll to reach the placement rows.
- Glare, shadow and mixed detection are the unchanged Slice 1 heuristics.
- The Thai copy has not been reviewed by a Thai speaker.

## 18. Real-device QA remaining

No physical phone was used in this slice; all browser checks were headless desktop Chrome with
phone emulation. On Android Chrome and iPhone Safari, check:
- **Readability and placement:** card readability and scroll length after a tap on a tall photo, and whether the category is visible right after tapping.
- **Focus styling:** no focus ring or hint after a touch tap; they appear with a Bluetooth keyboard.
- **Screen readers:** TalkBack/VoiceOver announce a single summary line per tap, including warnings.
- **Copy:** Thai wording, line breaks and chip wrapping on a 320–360 px device.
- **Carried over from the 5a checklist:** HEIC, EXIF orientation, 48 MP, memory, offline and no page jump on tap.

## 19. V1.2 hardening entry criteria

- A Thai speaker has reviewed every `photoChecker` string.
- The real-device matrix has passed (the 5a checklist plus §18) on at least one mid-range Android and one iPhone.
- There are no crashes on 48 MP input, and the "too large" path works on a 4 GB Android.
- Offline (DevTools) and no-network checks pass on a device build.
- Plan §20.1 criteria are re-checked. Bundle: gzip JS is 110.70 kB against 101.04 kB before V1.2 UI, +9.66 kB within the 15 kB budget.
- Decide on Open Questions Q1 (ad gating) and Q3 (the "open in manual checker" link).
