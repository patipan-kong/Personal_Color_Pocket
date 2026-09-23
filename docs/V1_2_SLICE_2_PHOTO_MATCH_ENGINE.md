# V1.2 Slice 2 — Photo Color Match Engine

Status: **implemented** (pure domain code only; no UI, no image loading, no copy). Written 2026-09-23.
Plan: [V1_2_PHOTO_COLOR_CHECKER_PLAN.md](V1_2_PHOTO_COLOR_CHECKER_PLAN.md) §9–§11. Sampling contract: [V1_2_SLICE_1_SAMPLING_ENGINE.md](V1_2_SLICE_1_SAMPLING_ENGINE.md).

## 1. Objective

Turn a successful photo sample plus the user's Personal Color subtype into **qualitative, photo-specific
guidance**: one of five categories, the palette colors that explain it, the direction of any mismatch,
and pairings. It is a separate model from the manual Color Checker, and it does not change that checker.

| File | Role |
|---|---|
| `src/domain/photoColor/photoMatch.ts` | `matchPhotoColor()` and all named calibration constants |
| `src/domain/photoColor/types.ts` | **Added** `PhotoColorMatch`, `PhotoMatchCategory`, `PhotoMatchDirection`, `PositivePaletteGroup`, `PhotoMatchDescriptors` |
| `src/domain/photoColor/photoMatch.test.ts` | Contract, distance, hue/neutral, direction, 12-subtype calibration, robustness, mismatch, boundary, warning and pairing tests |
| `src/domain/personalColor/colorUtils.ts` | **Added** `oklabChroma`, `oklabHue`, `hueDifference`. Nothing existing changed. |
| `src/domain/personalColor/colorMatch.ts` | `pairingSuggestions` is now `export`ed. That is the whole diff. |
| `src/domain/personalColor/colorMatch.regression.test.ts` | **New** manual-checker freeze (§17) |

Nothing in the app imports `photoColor` yet, so the production bundle is unchanged.

## 2. Input contract

```ts
matchPhotoColor(sample: PhotoColorSample, subtype: Subtype): PhotoColorMatch
```

- `sample` is the `kind: 'color'` member of Slice 1's `PhotoSampleResult`. **The type does not accept
  `unavailable` samples.** A caller has to narrow on `kind` first. At runtime a non-`color` value throws
  `TypeError` (a programming error), and non-finite OKLab throws `RangeError`.
- Matching uses `sample.oklab` only. `sample.hex` feeds the reused pairing suggestions, and
  `sample.diagnostics.flags` is carried through as `warnings`.

## 3. Output contract

| Field | Meaning |
|---|---|
| `subtype`, `hex`, `oklab` | Echo of the input |
| `category` | One of the five categories (§10) |
| `nearest` | `{ color, group, distance }` for the nearest Best / Accent / Neutral color. It is **always present**, even for `outside`, so the UI can always name something concrete. |
| `resembles` | `{ color, distance }` for the nearest Harder color, **only when it is within `PHOTO_RELATED_DISTANCE`**, otherwise `null` |
| `closest` | The nearest color in each positive group (`best`, `accents`, `neutrals`), for "More details" |
| `difference` | Sample minus `nearest`: `lightness` (ΔL), `chroma` (ΔC), `hue` (signed degrees, or `null` when either color has chroma < 0.04) |
| `direction` | Up to 2 of `lighter / deeper / brighter / muted / warmer / cooler`, largest first. Empty for `near-face` and `neutral-base` |
| `descriptors` | `value: light / medium / deep` and `clarity: soft / moderate / clear` |
| `pairWith` | Exactly `pairingSuggestions(sample.hex, subtype)` |
| `warnings` | A copy of the sample's `mixed / highlight / shadow` flags |

There is **no score, percentage, confidence or probability** field, and a test asserts that none of those
words appear in a serialized result. `nearest.distance`, `resembles.distance` and `difference` are internal
measurements for debugging and later copy decisions. They are not user-facing numbers.

**Deferred:** `placement.ts` (plan §16/§18 placed it in Slice 2). It needs the presentation preference
(men/women) and garment vocabulary, which are UI and copy concerns. Its inputs, `category` and
`nearest.group`, are already in this result, so Slice 5 can add it without changing this contract.

## 4. Existing data reused

The engine reads everything through `getPalette(subtype)` and duplicates nothing.
- **Best, Accents and Neutrals** are the positive groups.
- **Harder** is the caution group.
- **Metals are excluded.** Photographed metal is specular, so its color is unreliable (plan §10.3).
- **Not used:** subtype `seasonDefinitions` targets. They describe a person, not garment OKLab (plan §10.2).
- **Not reused:** the manual checker's `exp(−7.2·d)` score and its rating tree.
- **Palette data unchanged:** it is frozen by a fingerprint test.

## 5. Distance model

```
ΔL = s.L − p.L          ΔC = C(s) − C(p)          ΔH² = max(0, Δa² + Δb² − ΔC²)
w  = clamp((min(C(s), C(p)) − 0.01) / (0.02 − 0.01), 0, 1)
d  = sqrt( (0.5·ΔL)² + ΔC² + w²·ΔH² )
```

- When both colors have chroma ≥ 0.02, `w = 1`. Because `ΔC² + ΔH² = Δa² + Δb²`, this is **exactly** the
  plan §10.3 formula `sqrt((0.5·ΔL)² + Δa² + Δb²)`. A test checks this to 1e-12 over 80+ chromatic cases.
- Splitting into ΔL, ΔC and ΔH is what lets the model be tolerant on lightness while staying strict on chroma
  and hue, and it is what makes `difference` / `direction` explainable.
- The only deviation from the plan is the hue weight `w` for near-neutral colors (§9).

## 6. Lightness tolerance

- ΔL counts half (`PHOTO_LIGHTNESS_WEIGHT = 0.5`), because exposure mostly moves lightness.
- **Tested:** for every Best color of all 12 subtypes, a ΔL of 0.08 still gives a close category. The plain
  OKLab distance of 0.08 would exceed `PHOTO_CLOSE_DISTANCE`.
- **Large value differences still count.** A ΔL of 0.3 is a photo distance of 0.15, well past
  `PHOTO_RELATED_DISTANCE`.
  - Tested: a ΔL of 0.3 never keeps the same close match for any Best color of any subtype.
  - Tested: the same hue at L 0.9 and L 0.3 gets different guidance for deep-winter.

## 7. Chroma handling

- Chroma comes from OKLab (`oklabChroma = hypot(a, b)`), never from RGB saturation, and it counts at
  **full weight**.
- **Tested:** +0.06 chroma on Smoky Blue (soft-summer) leaves "close".
- **Tested:** clear-winter Best colors are never close for soft-summer, and soft-summer Best colors are never near-face
  for clear-winter.
- `descriptors.clarity` gives muted / moderate / vivid:
  - soft: chroma < 0.06
  - clear: chroma > 0.13
  - moderate: in between
- Doubling a color's chroma often stays near-face in the calibration probe (33 / 96 Best colors). There are two causes:
  - Gamut clipping: a vivid color cannot actually double, so it moves only 0.01–0.02.
  - The palette often contains a more vivid sibling color (e.g. deep-autumn Oxblood ×2 lands on Chili Red).
  - Both results are correct, not tolerance failures.

## 8. Hue handling

- `oklabHue` returns degrees in [0, 360). `hueDifference(from, to)` is the signed shortest rotation in
  (−180, 180], so `hueDifference(359, 1) = +2`. A sweep over all hue pairs checks the range and that the
  rotation is correct.
- Matching never uses a raw hue angle. Hue enters only as the ΔH chord, so it is continuous across 0°.
  Tested: samples at 359° and 1° are within 0.0042 of each other in every subtype.
- **Warmer / cooler** means a rotation toward or away from the warm pole at OKLab hue 70° (yellow-orange;
  the cool pole is opposite, at 250°), beyond ±12°. It is reported only when both colors have chroma ≥ 0.04.
- This is **relative to the nearest palette color**. An absolute "b > 0 ⇒ warm" rule mislabels teals in
  warm palettes (plan §10.3).

## 9. Neutral handling

Near-neutral hue is noise. A plain Δa/Δb distance let a grey with chroma 0.008 change category as its
(random) hue rotated, in 8 of 12 subtypes. So the hue term is weighted by `w`, based on the **less
chromatic** of the two colors:

| Chroma of the less chromatic color | Hue weight | Examples (curated) |
|---|---|---|
| ≤ 0.01 | 0: judged on L and C only | Optic White 0, Black 0–0.007, Soft White 0.004, Pearl Grey 0.005, Ice Grey 0.009 |
| 0.01 – 0.02 | ramps linearly | Charcoal 0.012, Silver Grey 0.013, Mushroom 0.017, Warm Pewter 0.019 |
| ≥ 0.02 | 1: the plan formula | Icy Blue 0.023, Icy Pink 0.027, Blue Grey 0.028, Icy Lilac 0.030 |

The ramp ends at 0.02, not 0.04. With 0.02 → 0.04, the curated pale tints lost their hue, and Harder Icy Lilac
came within 0.041 of Warm Cream (deep-autumn). Their hue is exactly what separates "icy" from "ecru", so
it must count.

Tests:
- A grey at 24 hue angles, chroma 0.008, at L 0.35 / 0.6 / 0.85, gives the identical category,
  nearest color and distance in all 12 subtypes. `difference.hue` is null, there is no warmer/cooler, and
  clarity is soft.
- White, off-white, mid grey, charcoal, near black, beige and taupe never report a hue-based direction.
- White is neutral-base where it is curated (cool-winter, clear-winter). It is away-from-face (resembles
  Optic White) where Optic White is Harder (warm-spring, soft-summer, soft-autumn, warm-autumn).

## 10. Five categories

Order and labels are from plan §11.1:

| Category | Label | Rule (evaluated top to bottom) |
|---|---|---|
| `near-face` | Great near your face | nearest positive is Best/Accent, `d ≤ CLOSE`, and `d ≤ harder.d` |
| `neutral-base` | Easy neutral | nearest positive is a Neutral, `d ≤ CLOSE`, and `d ≤ harder.d` |
| `away-from-face` | Better away from your face | `harder.d ≤ RELATED` and `harder.d < positive.d` |
| `related` | Works with care | `positive.d ≤ RELATED` |
| `outside` | Outside your palette | otherwise |

This is plan §10.3 with one clarification: a positive color only wins "close" when it is **at least as near
as the nearest Harder color**. The plan's first rule would otherwise call a sample sitting on a Harder color
"near-face" whenever a positive color was also within 0.045. Rules 3 and 5 of the plan merge into one
`away-from-face` rule; the outcome is identical.

## 11. Thresholds

All are exported named constants in `photoMatch.ts`. They are **V1.2 calibration constants, pending real-photo
validation**.

| Constant | Value | Role |
|---|---|---|
| `PHOTO_LIGHTNESS_WEIGHT` | 0.5 | kL in the distance |
| `PHOTO_CLOSE_DISTANCE` | 0.045 | near-face / neutral-base / Harder "close" (≈ median palette nearest-neighbour, plan §8.1) |
| `PHOTO_RELATED_DISTANCE` | 0.085 | related / away-from-face reach; `resembles` cut-off |
| `PHOTO_THRESHOLD_EPSILON` | 1e-9 | float guard on the inclusive threshold comparisons |
| `HUE_IGNORED_CHROMA_MAX` / `HUE_FULL_CHROMA_MIN` | 0.01 / 0.02 | hue-weight ramp (§9) |
| `NEUTRAL_CHROMA_MAX` | 0.04 | below this there is no hue difference and no warmer/cooler |
| `DIRECTION_LIGHTNESS_MIN` / `DIRECTION_CHROMA_MIN` / `DIRECTION_HUE_MIN_DEGREES` | 0.06 / 0.03 / 12° | direction reporting (strictly greater) |
| `WARM_HUE_DEGREES` | 70° | warm pole |
| `MAX_DIRECTIONS` | 2 | |
| `LIGHT_VALUE_MIN` / `DEEP_VALUE_MAX` | 0.72 / 0.45 | value descriptor (inclusive) |
| `SOFT_CHROMA_MAX` / `CLEAR_CHROMA_MIN` | 0.06 / 0.13 | clarity descriptor (strict) |

**Boundaries.**
- The distance thresholds are **inclusive**: `d ≤ T + 1e-9`. Tests cover `T − 1e-6`, exactly `T`
  (computed distance within 1e-12 of T), and `T + 1e-6`, for CLOSE and RELATED around an isolated Best
  color, and RELATED around an isolated Harder color.
- Ties: palette order wins inside a group, and Best > Accents > Neutrals across groups. A positive wins a
  tie with Harder.
- Real samples are 8-bit sRGB, so a result exactly on a threshold is rare but deterministic.

The plan's values were kept after calibration. No threshold needed to move to make the tables below pass.

## 12. Calibration results

**Anchors.** Every curated color classifies as its own group in all 12 subtypes:
- 96 Best and 60 Accent colors → near-face
- 60 Neutral colors → neutral-base
- 48 Harder colors → away-from-face, with `resembles` naming themselves

These anchors are necessary but circular, so the real calibration is the perturbation tables below.
No Harder color lies within 0.045 of a positive color of its own subtype. The closest pair is Optic
White → Cream (warm-spring), at a photo distance of 0.050.

**Per subtype**, under the 10 modest transforms of §13:
- "Positives stay close" means the category stays near-face or neutral-base.
- "Same color" means the nearest color is still the original color.
- Random is 2,000 seeded sRGB colors, split as near / neutral / related / away / outside.

| Subtype | Positives stay close | …same color | Harder stay away | Random % (near/neutral/related/away/outside) |
|---|---|---|---|---|
| light-spring | 180/180 | 168 | 40/40 | 11/4/32/8/44 |
| warm-spring | 180/180 | 165 | 40/40 | 12/5/25/11/46 |
| clear-spring | 180/180 | 169 | 40/40 | 14/5/40/6/35 |
| light-summer | 180/180 | 160 | 40/40 | 8/4/27/13/47 |
| cool-summer | 180/180 | 179 | 40/40 | 10/5/24/14/48 |
| soft-summer | 180/180 | 153 | 39/40 | 5/4/18/9/63 |
| soft-autumn | 180/180 | 154 | 40/40 | 7/3/19/14/57 |
| warm-autumn | 180/180 | 150 | 40/40 | 8/4/23/11/54 |
| deep-autumn | 180/180 | 159 | 40/40 | 7/3/16/10/65 |
| deep-winter | 180/180 | 164 | 40/40 | 7/4/21/13/56 |
| cool-winter | 180/180 | 144 | 40/40 | 9/4/29/14/43 |
| clear-winter | 180/180 | 153 | 40/40 | 12/3/42/13/30 |

- When the nearest color changes, it moves to a neighbouring palette color. For example, darkened Cinnamon reads as the
  Cognac neutral. That is honest behaviour, not instability.
- Random colors land mostly `outside` (51%) or `related` (26%), and only 9% `near-face`. This compares with the manual
  checker's 0.2% "Great Match" and 74% "Tricky" (plan §10.1): the photo model is tolerant but not
  indiscriminate.
- The muted palettes (soft-*, deep-autumn) are the most selective.

## 13. Lighting robustness

Deterministic transforms applied to real 8-bit colors:
- Exposure ×0.8 / ×1.2 in linear light
- Warm cast (R×1.08, B×0.82) and cool cast (R×0.92, B×1.12), from plan §10.1
- OKLab ΔL ±0.05
- Chroma ×0.8 / ×1.2
- Hue ±8°

Results:
- **Best, Accent and Neutral colors (all subtypes):** always remain positive (near-face / neutral-base /
  related). The tests assert this. In practice all 2,160 cases stayed near-face or neutral-base.
- **Harder colors:** never become near-face, and ≥ 97% stay away-from-face (measured 479/480).
  - The one exception is soft-summer Optic White at −20% exposure, which honestly reads as the Oyster neutral.
- **Stronger exposure (±25%):** no Best or Accent color leaves the positive categories.
  - Soft-summer Oyster at +25% becomes away-from-face (resembles Optic White). This is expected: an
    overexposed off-white is white.

## 14. Strong mismatch behavior

Opposed subtypes are chosen **from the measured means of each subtype's Best and Accent OKLab values**, not from season
names. The test re-derives them:

| Axis | Low → high | Opposite subtype's Best colors |
|---|---|---|
| Lightness (L 0.399 vs 0.763) | deep-winter ↔ light-spring | light-spring in deep-winter: 5 away, 3 outside. deep-winter in light-spring: 7 away, 1 outside |
| Chroma (0.057 vs 0.169) | soft-summer ↔ clear-winter | clear-winter in soft-summer: 6 outside, 2 related. soft-summer in clear-winter: 6 away, 1 related, 1 neutral-base |
| Warmth (hue distance from 70°) | cool-summer ↔ warm-autumn | warm-autumn in cool-summer: 6 away, 1 near-face, 1 neutral-base. cool-summer in warm-autumn: 4 away, 1 outside, 3 related |

- The tests assert **≤ 1 near-face and ≥ 5 of 8 away/outside** in each direction.
- The single near-face is a warm-autumn color that genuinely sits next to a cool-summer color.
- **Large perturbations of every Best color:** ΔL ±0.35, chroma ×0 or ×0.3, and hue rotated 60° or 180°.
  - These mostly leave near-face.
  - The remaining near-face cases land on *another* palette color, which is correct.
  - The direction tests confirm that deeper, lighter, muted, brighter, warmer and cooler are each reported
    when the sample is still explained relative to the original color (every direction ≥ 5 cases).

## 15. Sampling warnings

- `mixed`, `highlight` and `shadow` are copied into `warnings` and **never change the category** (the plan
  does not require it). A test compares flagged and unflagged results for every subtype.
- Unavailable samples never reach matching. The type forbids them, and the runtime throws.
- For Slice 5, note that the plan's i18n sketch (§14.2) has `warnings: 'mixed' | 'exposure'`. Since Slice 1, it
  needs `mixed / highlight / shadow`.

## 16. Pairing suggestion reuse

- `pairingSuggestions` in `colorMatch.ts` gained `export` and nothing else.
- `pairWith` is its output for `sample.hex`, and a test asserts it equals `checkColor(hex).pairWith` for all 12 subtypes.
- The algorithm is not duplicated.

## 17. Manual checker non-regression

`colorMatch.regression.test.ts` was written and passed **before** any shared code changed. It covers:
- **Every `checkColor` output**, over 282 distinct curated HEX values plus a 6×6×6 sRGB grid (498 inputs × 12
  subtypes). The fields are rating, score to 9 decimals, closest IDs, reason and reference ID, and pairWith
  IDs, frozen as FNV-1a fingerprints plus the rating counts per subtype.
- Two readable reference results (Warm Coral and mid grey for warm-spring) and invalid input.
- The exported `pairingSuggestions` is identical to `checkColor(...).pairWith` for every input.
- The curated palette data is byte-identical (fingerprint).

**Mutation check:** changing the pairing target 0.22 → 0.23 made 13 of 15 freeze tests fail. It was reverted.

Quiz scoring and the subtype classifier are untouched. The 177,147-combination audit passes unchanged.

## 18. Known limitations

- Thresholds are **palette-consistent, not human-validated**. They come from curated data and simulated
  lighting only.
- There is no white-balance correction (plan §12). A strong colored light can still move a color into a
  neighbouring category. The copy must stay "as it appears in this photo".
- Warm/cool is a single hue axis (pole 70°). Purples and teals near the poles report little temperature
  change (e.g. rotating across the cool pole reports neither).
- Two palette colors can be nearly equidistant from a sample, so `nearest` can switch between them for tiny
  changes. The category is usually the same, but the named color can differ.
- Harder colors are examples, not boundaries (plan §10.1). A color can be `outside` although a person
  would call it "harder".

## 19. Real-photo calibration still required

Before release, run photos of real garments through Slice 1 + Slice 2 on devices:
- plain fabrics in daylight, shade and indoor warm light
- whites and blacks
- printed fabrics

Record the category distribution. Tune only the constants in `photoMatch.ts`. The calibration tests
will show what any change costs.

## 20. Slice 3 entry criteria

- Slices 1 and 2 are frozen: `samplePhotoRegion` → `PhotoColorSample` → `matchPhotoColor`. Slice 3
  (`services/photoImage.ts`) only has to produce a `PixelSource`. It needs no knowledge of matching.
- Manual-checker freeze, palette fingerprint, full suite, audit and build are all green, and the production
  bundle is unchanged.
- No UI depends on these yet, so constants can still be tuned after device testing without breaking callers.
