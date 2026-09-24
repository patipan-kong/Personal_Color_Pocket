# V1.3 Slice 5.1 — Editorial Outfit Board Refinement

**Status:** complete. This is a visual-only refinement inserted between Slice 5 and Slice 6. It changes how the
Daily outfit looks, not what it recommends. The Slice 1–4.1 domain, the Slice 5 presentation mapper
(`buildOutfitBoardModel`), the copy and the V1.2 colour names are all unchanged.

## 1. Entry state

`main` at `f5ea44fa8676ec133e00ad87f54b7742712fcf60` (`feat: add daily outfit visual experience`), clean tree,
package `1.1.0`. Before editing, the Slice 5 page was built and captured in headless Chrome at 360, 430, 768 and
1280 px for all 12 QA cases (the "before" set).

## 2. Human visual feedback

The product owner found the Slice 5 board understandable, friendly and clearly better than the old text list, with
obvious lucky colours. But it still read as an infographic:
- garments were isolated diagram icons in separate cells;
- too much labelling sat inside the visual;
- the outfit did not feel styled or aspirational.

## 3. Design objective

Make the Daily recommendation feel like a styled outfit someone would want to wear ("วันนี้ใส่แบบนี้ก็สวยดี"),
not a diagram of one. The fix had to be compositional, not more shadows, corners or badges.

## 4. Reference principles used

The reference image was used as art direction only. Principles taken from it:
- one editorial flat-lay scene;
- large, dominant garments that overlap slightly;
- an asymmetric composition with negative space;
- a warm paper surface with subtle depth;
- refined garment detail;
- small floating annotations;
- lucky colours visible at once, with supporting pieces quieter.

## 5. What was intentionally not copied

- **Not copied from the image:** its exact layout, the handbag, plants, books, typography, photorealism and imagery.
- **Nothing generated:** no AI or raster asset.
- **No invented accessory:** the domain only says "accessory", so there is no bag, watch or jewellery.
- **Nothing gendered:** no dress, skirt, heels or tie.

## 6. Files changed

| File | Change |
|---|---|
| `src/dailyLuckyColor/GarmentArt.tsx` | Redrawn flat-lay garments (see §7). Same `GarmentArt({ role, color })` API. |
| `src/dailyLuckyColor/DailyView.tsx` | **Board markup only:**<br>• a decorative light pool for lucky pieces;<br>• the figure without the cell wrapper;<br>• `data-board-area` in place of the inline `gridArea`;<br>• the colour line names only the exact V1.2 shade;<br>• a non-breaking space ties "· goal" to "Lucky color";<br>• the badge glyph gets a class.<br>No state, date, goal or keyboard change. |
| `src/styles.css` | The board block is rebuilt as a composed canvas (see §8–9); the 900 px board overrides are removed; the Personal Color story gets an accent rule. |
| `src/dailyLuckyColor/DailyBoard.test.tsx` | Two expectations updated for the new structure; two Slice 5.1 tests added. |
| `docs/V1_3_SLICE_5_1_EDITORIAL_OUTFIT_BOARD.md`, `docs/V1_3_DAILY_LUCKY_COLOR_PLAN.md` | This record, plus the status line and a 5.1 row. |

**Unchanged:** `outfitBoard.ts`, `presentation.ts`, every file under `src/domain/`, all i18n files, V1.2 files,
`package.json`/lock, `public/`, `android/` and `capacitor.config.json`.

## 7. Garment-art changes

All garments are now drawn from above, like a real flat-lay, and stay presentation-neutral.

- **Top:** a relaxed short-sleeve shirt (viewBox `0 0 180 170`) with:
  - sloped shoulders and set-in sleeves with hem stitching;
  - a camp collar;
  - a centre placket with four outline-only buttons;
  - armhole seams, a curved hem and one soft fold.
- **Bottom:** tailored straight-leg trousers (`0 0 130 190`) with:
  - a waistband, belt loops and fly stitching;
  - slant pockets;
  - pressed creases and cuffs.
- **Shoes:** a pair seen from above (`0 0 150 104`), toes slightly splayed, with a vamp seam, toe stitching and a
  neutral lining.
- **Accessory:** still a generic ring (`0 0 110 110`), now with a bevel line.

The garment paths are painted only with the fill they are given. Detail uses neutral ink only:
- `--garment-line`, `--garment-seam`;
- `--garment-shade`: a translucent neutral for the inside of the collar;
- `--garment-inner`: the neutral shoe lining.

## 8. Board composition

The 2 × 2 grid is gone. `.daily-board` is one bounded canvas:
- a warm paper gradient with a soft light at the upper left and a hairline inset edge;
- no cells, no per-piece boxes, and no caption row under each garment.

Placement:
- **Top:** the large anchor, upper left, turned −3°.
- **Bottom:** tucked under the top's hem, offset right, turned 4°. The top is layered over the waistband, so the two
  read as one outfit without forming a body.
- **Shoes:** smaller, lower left beside the trouser legs, turned −7°.
- **Accessory:** an accent at the upper right. Two accessories overlap slightly as one accent pair (the second
  smaller and turned 16°), rather than stacking like a legend.

## 9. Responsive strategy

- **Container:** `.daily-outfit` is a size container. Each piece sets custom properties in container-width units:
  `--x`, `--y`, `--w` and `--r` for the garment, and `--ax`, `--ay` and `--aw` for its note. One rule positions every
  garment and note; layouts only change the variables.
- **Narrow (under 540 px of board width):** tall canvas, 134–142 cqw.
- **Wide (540 px and over):** wide canvas, 82–84 cqw, re-spaced rather than scaled up.
- **Variants:** each layout has variants for 0, 1 and 2 accessories.
- **Page layout:** the Slice 5 desktop two-column layout, sticky outfit and 640 px tablet cap are unchanged.

## 10. Annotations

Each garment has a small note in the negative space beside or beneath it:
- a short hairline;
- the role in small caps (`h3`);
- the colour name;
- then either "✦ Lucky color · {goal}" in the accent ink, or the muted supporting label.

Changes from Slice 5:
- Lucky pieces no longer use a filled pill.
- The colour line no longer repeats the family ("Green · Olive" → "Olive"), because today's colours above already
  name the family.
- The placement notes and the Personal Color story stay below the board.

## 11. Lucky and supporting hierarchy

**Lucky pieces:**
- a soft light pool on the paper beneath the garment (a separate layer under every garment, so it never tints
  another piece);
- a small accent ✦ tag with a cream ring, turned upright;
- the "✦ Lucky color · goal" note.

**Supporting pieces:** no pool, no tag, and a muted label.

**Never used to mark status:** opacity or colour changes on the garment itself.

## 12. Exact HEX behaviour

- Exact palette colours pass through `boardFillColor` unchanged.
- A new test checks every garment's painted colour. Each piece is painted with exactly one colour: the
  recommendation's exact HEX, or its token swatch. The only other ink is the neutral detail tokens.
- No HEX is printed.

## 13. Semantic fallback

- Broad-family tokens still use the Slice 4 display swatches.
- They show the family name, and the summary still shows the dashed "Lucky color family" dot.
- Nothing invents an exact shade or a HEX.

## 14. Single goal

One lucky garment carries the light pool, ✦ tag and lucky note; every other piece is quiet.

## 15. Dual goal

- Both lucky pieces get the identical treatment.
- The visual size differs only because roles differ (top versus accessory).
- No order, number or priority word is used; the Slice 5 no-priority test still passes.

## 16. Accessory fallback

The main outfit stays in Personal Color pieces. The lucky family arrives as a deliberate accent at the upper right.
Two fallbacks show as one coordinated pair of distinct rings, each with its own tag and note.

## 17. Accessibility

Preserved:
- `ul[aria-label]` with one `li` per piece, in recommendation order (the layout is CSS-only);
- the `h3` role labels, and colour and status text;
- `aria-hidden`, non-focusable SVGs;
- the light pool, the ✦ tag and the badge glyph are `aria-hidden`;
- no tab stops in the board;
- the goal buttons and their focus styles are untouched;
- the settle animation still respects reduced motion.

Meaning never depends on position or hue alone.

## 18. First visual pass

The first pass built:
- the canvas, the new art and the notes;
- the narrow and wide layouts.

It was captured at 360 and 430 px (TH and EN) for all 12 cases, including the six required views. Wide layouts at 1280
px were checked in the same run.

## 19. Self-critique

1. **Does it look like four icons in a UI?** No.
2. **Does it look like one outfit?** Yes.
3. **Are the top and bottom dominant?** The top is; the trousers are only moderately so on phones.
4. **Do the pieces relate spatially?** Yes: the top overlaps the waistband.
5. **Is there enough negative space?** Yes on wide layouts, tight on phones.
6. **Are labels secondary?** Yes, except in the narrow notes column.
7. **Too many pills?** No.
8. **Does dual goal look intentional?** Not with two accessories: they stacked down a narrow column like a legend, and
   one note ran into the second ring.
9. **More premium than Slice 5?** Yes.
10. **Credible in a fashion app?** Close, with the fixes below.

Other problems observed:
- Thai lucky notes broke across three lines in the narrow column.
- The shoes note spilled out of the canvas at 360.
- The top's note touched the trousers.

## 20. Refinement pass

One pass, addressing only those observations:
- The two accessories are laid together as an overlapping accent pair, on narrow and wide layouts.
- The notes column is wider: the phone top is 62 cqw and the trousers 33 cqw.
- The ✦ badge became an inline glyph, so the text gets the full width, with `text-wrap: balance`.
- The narrow layout is re-spaced and taller (134/142 cqw).
- A specificity leak is fixed: a narrow two-accessory rule was moving the wide layout's bottom note.
- The separator is non-breaking, so "· Money" never starts a line.
- The Personal Color story is a two-line insight with an accent rule, not a divider and paragraph.

## 21. Before and after (measured)

Measured in headless Chrome on the English dual-goal and single-goal cases:

| Measure | Slice 5 (360) | 5.1 (360) | Slice 5 (1280) | 5.1 (1280) |
|---|---|---|---|---|
| Board height | 552–598 px | 429–454 px | 717–735 px | 567–581 px |
| Garment share of board | 25–29% | 37–38% | 18% | 28–29% |
| Caption/note share of board | 18–20% | 15–19% | 15% | 6–8% |
| Top, drawn size | 157–203 px wide | 193 px wide | 238–257 px | 283 px |
| Bottom, drawn size | 102 × 155 | 102 × 147 | 130 × 198 | 147 × 213 |

What changed:
- **Structure:** cells are gone, and garments overlap.
- **Notes:** they sit beside the garments instead of in stacked caption blocks, with no lucky pill and no repeated
  family name.
- **Hierarchy:** it now runs garment first, then the note.
- **Height:** the board is shorter because its space goes to clothing, not to caption rows.

On phones the trousers keep their Slice 5 width: the notes column limits them.

## 22. Visual QA performed

- **Where:** headless Chrome through a throwaway CDP harness, with a pinned date, seeded storage and exact viewports,
  on the final build.
- **Matrix:** 12 cases × TH/EN × 360/430/768/1280 = **96 captures**.
- **The 12 cases:**
  - single lucky top;
  - lucky below the face;
  - accessory fallback;
  - dual distinct;
  - dual placements;
  - two accessory fallbacks;
  - general single;
  - general dual;
  - light (pale yellow shirt, light beige, cream);
  - dark (burgundy `#581B33`, dark gray);
  - longest Thai labels;
  - longest English labels.
- **Automated checks:**
  - no horizontal overflow;
  - no note overlapping another note;
  - no note overlapping any garment outline;
  - nothing outside the canvas;
  - no console errors.

  **Result: 0 issues in 96 captures.** On phones the board still starts at 515–618 px.
- **Not done:** no real device or screen reader was used.

## 23. Presentation audits

The Slice 5 audits run unchanged and pass:
- 130 family/profile boards;
- 910 day × selection × profile boards;
- the 12+-shape raw-identifier leakage render in EN and TH.

New tests:
- **Paint rule:** for every piece in four representative outfits (personalized dual, two accessory fallbacks,
  general dual, dark), each piece has exactly one garment colour: the exact HEX for palette pieces. Everything else is
  neutral ink.
- **Lucky-only decoration:** only lucky pieces have the light pool and ✦ tag, all decorations are `aria-hidden`, the
  tag count equals the claim count, and the colour line is the exact shade name.

## 24. Mutation testing

Ten temporary mutations; all caught, and the tree was restored byte-for-byte (checked by diff hash):

| # | Mutation | Failing tests |
|---|---|---|
| 1 | Lucky tag on the wrong piece | 2 |
| 2 | Second dual lucky claim missing | 10 |
| 3 | Exact HEX changed (`color-mix`) | 8 |
| 4 | Fabricated HEX on a semantic fallback | 6 |
| 5 | Top/bottom art swapped | 1 |
| 6 | Goal provenance lost | 9 |
| 7 | Supporting piece marked lucky | 1 |
| 8 | Locale alters the recommendation | 2 |
| 9 | Accessory fallback treated as an exact shade | 13 |
| 10 | Raw enum in the UI | 3 |

## 25. Bundle impact

| | Slice 5 (`f5ea44f`) | Slice 5.1 |
|---|---|---|
| JS | 408.64 kB (122.15 kB gzip) | 409.48 kB (122.53 kB gzip) |
| CSS | 44.33 kB (9.82 kB gzip) | 46.12 kB (10.44 kB gzip) |

No asset was added, and there is no network access and no animation loop.

## 26. Known limitations

- **Phones:** the trousers keep their Slice 5 width because the notes column needs the room. The longest English
  goal ("Luck & opportunity") wraps to three short lines in the note under the top at 360 px.
- **Coordinates:** they are hand-tuned per accessory count and checked at 360–1280 px. Very large system font sizes
  could make notes collide.
- **Accessory art:** it remains an abstract ring by design.
- **Silhouettes:** they stay neutral, and the women/men preference is not used.
- **Not tested:** real phones, TalkBack/VoiceOver, and a native Thai visual review.

## 27. Slice 6 handoff

- **Where to change the board:** composition lives in CSS variables in `styles.css` (one block for narrow, one for
  wide). Truth stays in `buildOutfitBoardModel`.
- **New piece shape:** add a variant keyed on `data-accessory-count` or `data-board-area`, then re-run the QA matrix.
- **Suggested Slice 6 checks:**
  - large-text and zoom behaviour of the absolute-positioned notes;
  - screen-reader reading of the board;
  - a native Thai review of note wrapping.
