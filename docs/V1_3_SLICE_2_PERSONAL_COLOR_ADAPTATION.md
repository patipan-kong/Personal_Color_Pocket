# V1.3 Slice 2 — Personal Color lucky-family adaptation

**Status:** complete. This is a pure domain engine; it has no UI, outfit composition, persistence, clock, network, or presentation input.

## A–D. Entry state and V1.2 structures used

| Item | Finding |
|---|---|
| Entry branch / HEAD | `main` / `77712896649a70af97dbc0c037b2451c8f7169f8` (`feat: add daily lucky color rules`) |
| Entry tree / package | clean / `1.1.0` |
| Subtypes | The authoritative `Subtype` union and `subtypeOrder`: all 12 V1.2 subtypes. |
| Palette model | Each subtype owns curated, ordered `best` (8), `neutrals` (5), `accents` (5), and `harder` (4) swatches. No palette data or HEX changed. |
| Naming model | V1.2 `describeColor(hex)` returns stable `{ hex, family, group, value, temperature, chroma, en, th }`. Slice 2 consumes it unchanged and retains its complete result. |

Files added: `src/domain/luckyColor/adaptation.ts`, `src/domain/luckyColor/adaptation.test.ts`, and this record. The V1.3 plan receives only its completion marker.

## E–I. Broad-family mapping and border decisions

Slice 2 maps V1.2’s **structured `family`** to the ten source-domain families. It never inspects consumer/palette names or locale strings. `none` means the swatch must not be claimed as an expression of a Thai lucky family.

| V1.2 family | Lucky family/families |
|---|---|
| white, off-white, cream | white |
| beige, taupe, brown | none |
| gray, blue-gray, charcoal | gray |
| black | black |
| red, burgundy | red |
| coral | red and orange |
| orange, peach | orange |
| yellow, mustard | yellow |
| olive, green, mint | green |
| teal | green and blue |
| blue, navy | blue |
| purple, lavender | purple |
| pink | pink |

Boundary decisions are therefore explicit: coral is red/orange (not pink); peach is orange; teal can honestly serve green or blue; mint/olive are green; navy is blue; lavender is purple; burgundy is red; mustard is yellow; blue-gray is gray; and cream/off-white are white. Brown, beige, and taupe are deliberately not coerced into orange, yellow, gray, or white.

Multi-family membership is used only for coral and teal. Both sit at a genuine adjacent-family boundary and materially improve coverage without turning the result into an unrelated-family substitution. All other mappings have one primary reading.

## H–N. Candidate pool, ladder, and fallback

The pool is the supplied subtype’s existing `best`, `accents`, `neutrals`, and `harder` lists, in that priority. Existing palette order is curated and preserved inside a category; `id` is the stable final tie-break. No RGB/HSL/OKLab transformation is performed or imported by this module.

| Selected source | Suitability | Meaning |
|---|---|---|
| Best | `near-face` | strongest same-family expression |
| Accent or Neutral | `main-piece` | curated and wearable, but not the subtype’s strongest near-face selection |
| Harder | `below-face` | retained only as a lower/secondary expression |
| No same-family swatch | `accessory` | retain the family for a generic accessory treatment; no HEX is invented |

`Harder` is evidence, not a positive recommendation: a Harder-only result is always `below-face`, never `near-face`. The no-candidate fallback has `selectedColor: null`, no alternatives, and `suitability: 'accessory'`; Slice 3 can render a generic source-family swatch without fabricating colour data.

White, gray, and black use curated expressions rather than literal white/black. White accepts V1.2 white/off-white/cream; gray accepts gray/blue-gray/charcoal; black accepts only V1.2 black. Their neutral swatches are `main-piece`; a Harder neutral remains `below-face`.

## J. 120-combination coverage audit

This matrix records the selected ladder source. Columns: white, yellow, pink, red, green, blue, purple, orange, gray, black. `B` Best, `A` Accent, `N` Neutral, `H` Harder, `-` no same-family swatch/accessory fallback.

| Subtype | W | Y | Pk | R | G | Bl | Pu | O | Gy | Bk |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| light-spring | N | B | B | B | B | B | H | B | N | H |
| warm-spring | N | B | H | B | B | B | - | B | H | - |
| clear-spring | N | B | H | B | B | B | B | B | H | - |
| light-summer | N | B | B | - | B | B | B | H | N | H |
| cool-summer | N | - | B | H | B | B | B | H | N | - |
| soft-summer | H | - | B | H | B | B | B | H | B | H |
| soft-autumn | H | A | B | - | B | B | - | - | N | - |
| warm-autumn | N | B | H | B | B | B | H | B | N | - |
| deep-autumn | N | B | H | B | B | B | H | A | N | - |
| deep-winter | N | H | B | B | B | B | B | H | N | N |
| cool-winter | N | - | B | B | B | B | B | H | N | N |
| clear-winter | N | B | B | B | B | B | B | H | N | N |

Candidate-category presence across all 120 combinations: Best 59, Accent 51, Neutral 30, Harder 38; these overlap when a combination has alternatives. The selected ladder is Best 59, Accent 2, Neutral 22, Harder 23, no candidate 14. There are 67 combinations with multiple candidates, 23 relying only on Harder, and 14 accessory fallbacks.

Family availability (at least one curated same-family swatch across 12 subtypes) is white 12, yellow 9, pink 12, red 10, green 12, blue 12, purple 10, orange 11, gray 12, black 6. The strongest coverage is white/pink/green/blue/gray (12/12); black is weakest (6/12), followed by yellow (9/12). All 120 remain handled.

## E–S. API, output contract, naming, validation, and determinism

```ts
adaptLuckyColorToSubtype(family: LuckyColorFamily, subtype: Subtype): LuckyColorAdaptation
```

The result contains the preserved `luckyFamily`, validated `subtype`, suitability, `selectedColor`, and all ranked same-family `alternatives`. A selected candidate preserves the existing palette `id`, `hex`, source palette display name, palette category, full V1.2 `ColorName`, and its mapped lucky-family membership. The same HEX therefore carries exactly the same EN/TH name everywhere it does in V1.2; Slice 2 defines no names.

Invalid family, subtype, or HEX input throws `RangeError`; there is no default subtype or substitute family. The API accepts no date, weekday, goal, locale, presentation, random seed, or current time. Identical family/subtype input returns an equal result on repeated calls.

## T. Representative human-semantic review

| Review | Result |
|---|---|
| light-spring yellow | `Yellow · เหลือง`, Best / near-face |
| warm-spring green | `Green · เขียว`, Best / near-face |
| clear-spring blue | `Teal · เขียวหัวเป็ด`, Best / near-face; explicit blue-capable teal membership |
| warm-spring black | no curated black: retained as accessory, not replaced |
| light-summer pink | `Light Pink · ชมพูอ่อน`, Best / near-face |
| cool-summer blue | `Soft Blue · ฟ้าหม่น`, Best / near-face |
| soft-summer orange | `Bright Coral · ส้มคอรัลสด`, Harder / below-face |
| cool-summer black | no curated black: accessory fallback |
| soft-autumn orange / purple | both lack a curated expression: accessory fallback |
| warm-autumn green | `Olive · เขียวมะกอก`, Best / near-face |
| deep-autumn purple | `Light Lavender · ม่วงลาเวนเดอร์อ่อน`, Harder / below-face |
| soft-autumn white | `White · ขาว`, Harder / below-face |
| deep-winter red | `Burgundy · แดงไวน์`, Best / near-face |
| cool-winter blue / gray | `Deep Blue · น้ำเงินเข้ม`, Best / near-face; `Light Gray · เทาอ่อน`, Neutral / main-piece |
| clear-winter yellow | `Light Yellow · เหลืองอ่อน`, Best / near-face |

## U–W. Invariants, mutations, and regression

Tests prove every V1.2 naming family has an explicit mapping; every palette swatch is classified deterministically; all 120 valid subtype/family inputs return; the requested family is preserved; a selected swatch belongs to the real subtype palette with its unmodified HEX; its V1.2 name equals `describeColor(hex)`; and Harder-only selections are not near-face. Raw dependency checks reject date, goal, locale, presentation, randomness, browser, network, placement, pairing, or direct OKLab dependencies.

Deliberate temporary production mutations were run and restored: returning blue for green; choosing a foreign subtype swatch; promoting Harder to near-face; moving olive away from green; changing a selected HEX; replacing the V1.2 name with a custom value; adding random selection; and defaulting an invalid subtype. The focused tests failed for each mutation. No V1.2 taxonomy, naming threshold/copy, subtype palette, Manual checker, Photo matcher/sampler, pairing, placement, or quiz code changed; the existing regression suite remains the freeze.

## X–Y. Limits and Slice 3 handoff

The curated palettes intentionally do not express every broad family for every subtype, especially black. Slice 2 does not create new colour data to fill those gaps. It also does not choose a garment, neutral companion, bottom, shoe, or full outfit.

Slice 3 should consume `LuckyColorAdaptation` directly. For a selected candidate, it can use `selectedColor.hex`, `paletteCategory`, `name`, `suitability`, and ranked `alternatives` without reclassifying colours. For `selectedColor: null`, it should preserve `luckyFamily` and apply accessory-only composition with its later generic family visual; it must not invent a palette HEX or substitute a family.
