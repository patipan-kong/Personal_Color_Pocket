# V1.3 Slice 5 — Daily Outfit Visual Experience

**Status:** complete. This is a presentation slice. It turns the Daily result from a list of text rows into an
outfit you can take in at a glance. The Slice 1–4.1 domain is unchanged: the board only draws what the recommendation
already says.

## 1. Entry state

`main` at `b8a99a8c3a639d2c5489ef7af38f0bf916e10644` (`feat: support two daily lucky color goals`), clean tree,
package `1.1.0`.

## 2. Files changed

| File | Change |
|---|---|
| `src/dailyLuckyColor/outfitBoard.ts` | **New.** A small, pure presentation mapper: `buildOutfitBoardModel`, `boardFillColor`, `boardFillTone`. |
| `src/dailyLuckyColor/GarmentArt.tsx` | **New.** Four inline-SVG flat-lay silhouettes: top, bottom, shoes, and a generic accessory token. |
| `src/dailyLuckyColor/DailyView.tsx` | New render: compact goals, "Today's colors" summary, the garment board, and notes under the board. State, date, rollover, goal and keyboard logic are unchanged. |
| `src/styles.css` | The Daily block is replaced with the editorial layout. The old Daily row overrides in the 760 px and 420 px breakpoints are removed. |
| `src/i18n/types.ts`, `en.ts`, `th.ts` | Added `storyFamily`, `storyShade` and `boardLabel`. Retuned `resultEyebrow`, `personalizedShade`, `outfitEyebrow` and `outfitHeading`. Removed the unused `eyebrow` (the weekday is now the eyebrow). |
| `src/dailyLuckyColor/outfitBoard.test.ts` | **New.** Board-model contract tests and the full presentation audits. |
| `src/dailyLuckyColor/DailyBoard.test.tsx` | **New.** Rendered-board tests: DOM, fills, locale, accessibility, raw-ID leakage. |
| `src/dailyLuckyColor/DailyView.test.tsx` | Two selectors and one label updated for the new markup (family names are now `h3`; "Your shade"). |
| `docs/V1_3_SLICE_5_DAILY_OUTFIT_VISUAL.md`, `docs/V1_3_DAILY_LUCKY_COLOR_PLAN.md` | This record, plus the status line and Slice 5 row. |

**Unchanged:** every file under `src/domain/`, `presentation.ts` (the Slice 4 family swatches), V1.2 files,
`package.json`/lock, `public/`, `android/`, and `capacitor.config.json`.

## 3. Design problem

Slice 4/4.1 was correct but looked like settings:
- four long bordered goal rows;
- a large terracotta result card of text;
- the outfit as four bordered text rows, each with a 19 px dot.

At 390 px the outfit rows began roughly 1,150–1,250 px down the page. Nothing showed what to wear.

## 4. Visual direction

The direction is **warm editorial flat-lay**. It keeps the product's cream paper, season accent and Inter/Leelawadee
type. It adds:
- one new surface: a warm paper-tone board (`#efe4d7`);
- Georgia serif for the English colour-family names, echoing the welcome page's serif accent;
- soft cream "spotlights" behind lucky garments;
- no gradients, no mystical symbols, and one small ✦ marker, the glyph Slice 4 already used on badges.

Bordered rectangles now appear only on the four goal chips. The result card, piece rows and goals box are gone.

## 5. Goal selector

- **Layout:** a compact 2 × 2 grid of chips at every width, including 360 px. A small heading has the "Choose up to 2"
  note on the same line.
- **Selected state:** accent border and ring, a tint, and a filled check circle. Both selected chips look identical.
- **Thai wrapping:** long Thai labels wrap with `text-wrap: balance`. "โอกาสและ / โชคลาภ" breaks at a word boundary
  instead of stranding "ลาภ".
- **Unchanged:** exactly four native buttons, `aria-pressed`, arrow-key focus, third click replaces the oldest, no
  priority.

## 6. Today's colors summary

Under the eyebrow "Today's colors" / "สีของวันนี้", each claim is one compact row:
- a colour dot;
- the family name, large;
- a goal pill;
- one line with either "Your shade **{V1.2 name}**" or, for a broad-family fallback, "Lucky color family".

The dot is the exact personalized HEX when there is one. Otherwise it is the family token with a dashed ring, which
marks it visually as a broad colour. Two claims are two equal rows in canonical order, with no numbering.

The long placement sentences moved below the board. That keeps the summary short, so the outfit starts sooner.

## 7. Garment-board architecture

```text
recommendLuckyGoalsOutfit (domain, unchanged)
        ↓ LuckyGoalsOutfitRecommendation
buildOutfitBoardModel (pure, presentation-only)
        ↓ OutfitBoardModel { mode, claims[], pieces[], accessoryCount }
DailyView → TodayColors · OutfitBoard (<ul> of pieces) · OutfitNotes
                               ↳ GarmentArt (decorative SVG, aria-hidden)
```

- **Board element:** a `<ul aria-label="Outfit pieces">`. Each `<li>` holds the SVG art and a caption: role (`h3`),
  colour name, and a lucky badge or a support label.
- **Grid layout:** CSS grid areas lay out the flat-lay:
  - `top top / bottom shoes` with no accessory;
  - `top acc1 / bottom shoes` with one;
  - `top acc1 / top acc2 / bottom shoes` with two.
- **Reading order:** the DOM keeps the recommendation's order (top, bottom, shoes, accessories). Only the visual
  position differs.

## 8. Presentation model

`buildOutfitBoardModel(recommendation)` only reads. For each piece it records:
- the role/slot key;
- whether the piece is lucky, or which support it is;
- the fill;
- for lucky pieces, the claim's family and goals.

Each claim carries its family, goals, placement, piece key, and `exactColor` (or `null`).

**Fill kinds:**
- `exact` carries the palette HEX and V1.2 name.
- `family-token` carries only a family.
- `neutral-token` carries only `light-neutral` or `neutral`.

**Inconsistency guard:** it throws `RangeError` on inconsistent input: a lucky piece without exactly one claim, a claim
without a lucky piece, a token whose family differs from its claim, or a duplicate role/slot. DailyView already catches
recommendation errors and shows the date-error state.

**It never chooses, scores, adapts, places or renames a colour.** It has no locale input.

- `boardFillColor` returns an exact HEX unchanged. For tokens it returns the existing Slice 4 stand-ins: the family
  swatch, or `#F1E9DE` / `#817971` for the neutrals.
- `boardFillTone` classifies a fill as light, mid or dark by sRGB relative luminance, for outline visibility only. It
  never alters the colour and is not colour science that feeds the domain.

## 9. Single-goal rendering

The lucky piece gets a cream spotlight, a ✦ marker, and a badge "✦ Lucky color · {goal}". Its caption reads
"{Family} · {V1.2 shade}", or just the shade when the V1.2 name equals the family name ("Green", not "Green · Green").
- **With no accessory,** the top spans the board, centred.
- **Money on Thursday for Light Spring** gives a yellow top in exactly the curated HEX, with quiet neutral bottom and
  shoes.

## 10. Dual-goal rendering

Both claims show both ways: a summary row each, and a marked garment each, each badge naming its own goal.
- The two pieces get identical lucky treatment (spotlight, marker, badge). Size differs only because the garments differ (a top is larger
  than an accessory).
- Nothing says primary, secondary, #1 or #2.
- The same-family contract is honoured by the model: one claim, one lucky piece, one badge listing both goals. It is
  tested with a synthetic rule, because production has no same-family pairs.

## 11. Exact HEX

Palette pieces, lucky and supporting, paint `fill="{hex}"` with the recommendation's string unchanged.
- Outlines, seams and shadows use neutral UI ink.
- The summary dot uses the same HEX.
- No HEX is printed anywhere on the Daily page; a test asserts this. The V1.2 Color Checker is untouched.

## 12. Semantic fallback

- **Tokens:** a broad-family fallback (accessory fallback, or any general-mode lucky piece) is painted with the existing
  presentation-only family swatch, and general neutrals with the Slice 4 neutral stand-ins.
- **Honest labels:** the caption shows only the family label ("Purple"), and the summary says "Lucky color family" next
  to a dashed-ring dot. No "Your shade" appears.
- **No flow-back:** the token never gets a `hex` property in the model and never reaches the domain.

## 13. Supporting colours

Supporting pieces have no spotlight, no marker and no badge. Their caption shows the V1.2 name and a muted
"Personal Color" or "Supporting neutral" label. Cream, beige and white supports therefore never read as lucky.

## 14. Accessory fallback

- **The outfit:** the main outfit stays Personal Color pieces, and the lucky family appears as an accent ring. The ring
  is a generic accessory token: the domain names no accessory type, so the art doesn't invent one.
- **The message:** the note under the board, "**Purple** Use today's lucky color as a small accessory; your Personal
  Color stays closest to your face.", frames it as a deliberate accent, not a failure.
- **Two accessory fallbacks:** two separate rings stack beside the top, each with its own badge.

## 15. Personal Color story

Under the board, in personalized mode, two short lines:
- **EN:** "The lucky color says which color." / "Personal Color picks the shade and where to wear it."
- **TH:** "สีมงคลบอกว่า “สีอะไร”" / "Personal Color ช่วยเลือก “เฉดและตำแหน่ง”"

They are followed by "Adapted for your {subtype} Personal Color." The summary shows the relationship directly: family
name, then "Your shade". General mode shows the existing general note and the non-blocking quiz CTA instead.

## 16. TH / EN behaviour

- **Scope:** all copy is typed EN/TH. Locale changes labels only; a test proves the board's keys, classes, fill kinds,
  families and fills are identical across a locale switch.
- **Thai layout:**
  - Thai headings get more line height (1.28) and no negative tracking, for tone marks.
  - The family names use the Thai UI font rather than Georgia.
  - Uppercase and letter-spacing are dropped for the Thai role labels and kicker.
- **English layout:** checked separately.
  - "Luck & opportunity" and "Mentor support" wrap cleanly in chips and badges.
  - Two-line badges use a 12 px radius, not a pill.

## 17. Accessibility

- Goal controls are unchanged native buttons with `aria-pressed`, arrow keys and visible focus.
- Every garment SVG is `aria-hidden="true" focusable="false"`, and the ✦ marks are `aria-hidden`. The caption text
  carries the same information: role, colour name, lucky badge with goal, or support label.
- The board has no buttons, links or tab stops. Screen readers get a labelled list of pieces with `h3` roles.
- Lucky status is never colour-only: spotlight, marker and text badge.
- Motion: the board plays a 0.42 s fade/settle only when the outfit changes. There is no continuous animation. The
  global `prefers-reduced-motion` rule reduces it to 0.01 ms.

## 18. Responsive behaviour

| Width | Composition |
|---|---|
| 360 / 430 | Single column: compact hero, 2 × 2 chips, summary, then the board. The board starts at about 515–620 px (depending on one or two claims and language), against roughly 1,150–1,250 px for the old rows. |
| 600–899 (768) | The same single column, capped at 640 px and centred. |
| ≥ 900 (1280) | Two columns: goals and today's colours on the left (380 px); the board as the hero on the right, sticky. Notes sit under the board. The page is capped at 1,120 px. |

## 19. Visual QA performed

A throwaway headless-Chrome/CDP harness (not committed):
- served the production build, with the page clock pinned to a chosen weekday;
- seeded the profile, goals and language;
- opened Daily from the real navigation;
- measured horizontal overflow, piece overlaps, halo–caption collisions, board position and console errors.

It ran **12 cases × TH/EN × 360/430/768/1280 = 96 captures**:

| Case | Setup |
|---|---|
| single lucky top | Mon Work, Warm Spring |
| lucky below-face | Sun Work, Warm Spring, pink bottom |
| accessory fallback | Mon Luck, Soft Autumn, purple |
| dual distinct | Mon Work + Money, Warm Spring |
| dual, different placements | Sun Work + Money, Warm Spring: bottom + accessory |
| dual accessory fallback | Mon Money + Luck, Soft Autumn |
| general dual | Thu |
| general single | Mon |
| light lucky family | Thu Money, Light Spring, yellow |
| dark lucky families | Sat Money, Deep Winter, burgundy; Sat Work, Cool Winter, gray |
| longest labels | Sun Luck + Mentor support, Soft Summer |

The 390 px viewport was also captured during the first pass.

**Result:** 0 horizontal overflow, 0 piece overlaps, 0 halo/caption collisions, 0 console errors or exceptions in the
final run. "Before" captures of the Slice 4.1 build (390 px, same cases) were taken for comparison.

White, cream and light-beige garments were checked (Light Spring, Deep Winter shoes, general light neutral): the
stronger outline keeps them visible on the board. Black/deep fills (burgundy `#581B33`) get light seams.

Real phones and assistive technology were **not** tested in this slice.

## 20. Self-critique and one refinement pass

**First-pass critique:**
- It no longer looked like settings, and the lucky piece was obvious.
- The outfit was the hero once reached, but not above the fold: at 390 px the board started at 670–890 px, behind long
  placement sentences.
- The Thai chip broke "โชค|ลาภ".
- Two stacked accessory spotlights spilled onto the caption above.
- Spotlights stretched into wide ellipses in wide cells.
- Captions such as "Green · Green" repeated the family name.

**The one deliberate refinement pass:**
- moved placement notes and the Personal Color story under the board, and compacted the summary rows;
- made the weekday the eyebrow and dropped the separate "Daily color guide" line;
- balanced chip text;
- bounded each spotlight to its garment's own box;
- de-duplicated family-equals-shade captions;
- capped the tablet width.

Afterwards the board starts at about 515–620 px, and a phone shows the start of the outfit on first view.

## 21. Presentation audits

In `outfitBoard.test.ts`, a shared invariant check `expectFaithfulBoard` runs on:
- **all 120 family × subtype** adaptations plus the 10 general families (130 boards);
- **all 910 production boards**: 7 weekdays × (4 singles + 6 pairs) × (general + 12 subtypes).

For each board it asserts:
- every piece is represented, in order, with no duplicate role/slot, and top/bottom/shoes each once;
- lucky flags match `colorRole`, and the lucky pieces exactly equal the claims;
- the families equal `luckyFamilies`, and no piece introduces a family;
- exact HEX and name pass through unchanged; tokens stay tokens with no `hex`;
- `exactColor` matches Slice 2's `selectedColor`, or is `null`;
- placement and goal provenance are intact, and supports carry no goals;
- general mode never has an exact fill.

Order independence is checked for every weekday × pair × profile. The same-family contract is checked in general and two
personalized modes. `DailyBoard.test.tsx` also renders one representative of every recommendation shape (≥ 12) in EN
and TH, and asserts that no raw identifier or HEX reaches visible text.

## 22. Mutation testing

Ten temporary mutations were applied one at a time to the Slice 5 files. The Daily suites were run after each, and every
file was restored. The final diff was byte-identical to the pre-run diff.

| # | Mutation | Tests failed |
|---|---|---|
| 1 | Lucky badge on every (supporting) piece | 1 |
| 2 | One dual lucky claim dropped from the model | 10 |
| 3 | Exact HEX lightened (`color-mix`) | 7 |
| 4 | Fabricated `hex` on the semantic fallback | 6 |
| 5 | Top/bottom silhouettes swapped | 1 |
| 6 | Goal provenance dropped from pieces | 9 |
| 7 | Supporting neutral labelled lucky | 1 |
| 8 | Thai locale changes the goal set | 2 |
| 9 | Accessory fallback given a fake exact shade | 11 |
| 10 | Raw role/slot key used as the visible label | 3 |

All ten were caught.

## 23. Validation and domain regression

Final results are recorded with the commit: `npm test`, the 177,147 quiz audit, `npm run build`, `git diff --check`.
- The Slice 4.1 exhaustive audits (70 selections, 504 personalized dual, 42 general dual, order, single-goal
  regression) run unchanged inside `npm test`.
- No domain file changed, so domain behaviour is unchanged by construction. The existing domain suites pass untouched.

## 24. Known limitations

- Silhouettes are presentation-neutral (a tee, wide-leg trousers, loafers, a ring). The women/men presentation
  preference does not yet vary them.
- The accessory is an abstract ring, because the domain has no accessory type.
- Family tokens are one representative swatch per broad family, so a general-mode "Blue" top is one blue, not "any
  blue". The text says "Lucky color family".
- Visual QA used headless Chrome at exact viewports, not physical phones. TalkBack/VoiceOver and a native Thai read-through
  of the new strings (`สีของวันนี้`, `เฉดของคุณ`, `ลุคของวันนี้`, the story lines) remain for the V1.3 hardening slice.
- The desktop board is sticky. On very short desktop windows the notes under it scroll normally.

## 25. Slice 6 handoff

Slice 6 (localization, accessibility and edge cases) can build on:
- `buildOutfitBoardModel` as the single presentation seam: extend it rather than adding inference to the view;
- `data-piece-key`, `data-fill-kind`, `data-tone` and `data-lucky-family` for tests.

Suggested checks:
- a native Thai review of the new strings;
- TalkBack/VoiceOver reading of the board list;
- the date-error and storage-failure paths with the new layout;
- whether presentation-specific silhouettes are wanted.

The domain contract needs no change for any of these.
