# V1.4 Slice 3 — 12 Personal Color Types & Type Guide

**Status:** complete. Learn now has:
- a visual 12-type overview;
- four dimension scales;
- one data-driven type template that renders all 12 canonical types;
- a contextual link from Result to the user's own type.

No new palette, colour, target or rule exists: every page is built from the Slice 0–2 data and copy.

**Governing plan:** [V1_4_LEARN_PLAN.md](V1_4_LEARN_PLAN.md). **Previous slices:** [Slice 1](V1_4_SLICE_1_CONTENT_FOUNDATION.md), [Slice 2](V1_4_SLICE_2_LEARN_HOME_NAV.md).

## 1. Entry state

`main` at `8cd7a2d` "feat: add v1.4 learn home and navigation", clean, version 1.1.0, 4 commits ahead of `origin/main`. This matched the brief.

## 2. Files changed

| File | Change |
|---|---|
| `src/learn/ui/LearnVisuals.tsx` | New. Swatches, the "Your type" marker, the dimension scales, the 12-type grid, the outfit flat-lay, and the visual-kind renderer. |
| `src/learn/ui/LearnType.tsx` | New. The one type template (replaces Slice 2's minimal type page). |
| `src/learn/ui/LearnTypes.test.tsx` | New. 43 behaviour tests (§17). |
| `src/learn/ui/LearnView.tsx` | Page state for any type, a short return trail, direct entry (`LearnEntry`). |
| `src/learn/ui/LearnReader.tsx` | Draws the topic's visual by registry kind; labelled Back; type page moved out. |
| `src/learn/ui/LearnHome.tsx` | Hero link opens `your-type`; swatch import path. |
| `src/learn/model.ts`, `index.ts` | `dimensionBandOrder` (the five bands in scale order) and `learnSubtype(value)` (a canonical id or null). |
| `src/learn/types.ts`, `content/{en,th}.ts` | Three labels: `reader.backTo`, `typeDetail.qualitiesLabel`, `typeDetail.gridHint`. |
| `src/learn/boundaries.test.ts` | New UI files in the Z list; new §F Slice 3 boundary rules. |
| `src/learn/ui/LearnView.test.tsx` | One Slice 2 assertion updated to the full template's scales. |
| `src/App.tsx` | The Result link, a `learnEntry` state, and nav/Welcome opening the Learn home. |
| `src/i18n/{types,en,th}.ts` | `result.learnCta`: "Learn about your type" / "ดูรายละเอียดไทป์ของคุณ". |
| `src/styles.css` | Slice 3 Learn styles and the Result link's placement. |

No quiz, scoring, classifier, target, palette, Color Checker, Photo Checker, Daily, persistence, service, package or native file changed.

## 3. 4 seasons / 12 types overview

The `types.overview` topic now shows its registry visual (`subtype-grid`) between the answer and "Why it works". The visual has:
- a one-line hint ("Choose a type to see its palette.");
- four season sections in `seasonGroups()` order (Spring, Summer, Autumn, Winter). Each has an `h2` with the season name from Learn copy and the existing one-line season summary.
- each season's three types in canonical order, from `subtypeOrder` and never retyped.

Every type card is a button that opens that type's page. There are no season palettes, no season pages, and no invented colours.

## 4. Type-grid visual

Each card is compact:
- a four-segment strip of **that type's own first four Best colours** (`palette.best`), decorative;
- the localized type name, with the English name under it in Thai.

The grid uses `repeat(auto-fill, minmax(5.3em, 1fr))`:
- at 320–1280 px it lays out three per season;
- under large text it drops to two, then one.

The button's hit area covers the whole card, as in Slice 2, and focus draws on the card. Nothing on the grid is ordered by closeness, and it shows no number or score.

## 5. Personalization marker

With a valid result, the user's card gets a text badge, **"✦ Your type" / "✦ ไทป์ของคุณ"** (the star is decorative), plus a stronger border.
- The badge is inside the button, so the accessible name is "Soft Summer, Your type"; it is not signalled by colour alone.
- Exactly one card is marked. Other types are not ranked: there is no "closest", "second" or similarity cue.
- The same badge appears in the type page header when the page is the user's type, and in the dimension topic's legend.

## 6. Full subtype template

`LearnTypePage` renders the registry's `typeDetailSections` in order, entirely from `subtypeGuide(subtype, language)`:

| Section | Content | Source |
|---|---|---|
| header | colour cover strip (the 8 Best colours, decorative); "Season · Winter"; `h1` name; English name in Thai; "Your type" badge (own type only); "Color qualities: Deep · Cool · Dramatic"; summary | `LocaleCopy.subtypes`, `seasonDefinitions`, Learn labels |
| position | "Where this type sits": four banded scales + the existing "not a score" note | canonical targets → `dimensionBand` |
| best | 8 named swatches, the largest tiles | `getPalette().best`, `colorDisplayName` |
| neutrals | 5 named swatches | `.neutrals` |
| accents | 5 named swatches | `.accents` |
| harder | "More Considered": 4 named swatches, the existing description, and the four existing tips | `.harder`, `palette.sections.harder`, `palette.harderTips` |
| metals | 2 metals, each with name and existing note | `.metals`, `metalDisplayNote` |
| formula | flat-lay + the three-line formula | `outfitFormula()` |

**End action:**
- the user's own type: "Explore My Palette" (the existing Palette screen);
- no result: the optional "Find your Personal Color" quiz link;
- another type while the user has a result: no action, so nothing implies the browsed type is theirs.

The P1 "nearby types" section is not built. "See outfit examples" is also not built: it would need the Palette screen to open on its Examples tab, which is outside Slice 3's allowed changes.

**Same template for every type:** the palette, bands and advice are identical whoever is looking. Only the marker and the end action depend on the result.

## 7. Dimension visuals

The same `DimensionScales` component draws both the dimensions topic and the type page's position section.
- **Scale:** each dimension is five equal segments, one per Slice 1 band, left = the 0 end, right = the 1 end:

  | Dimension | Left end | Right end |
  |---|---|---|
  | Temperature | Cool | Warm |
  | Value | Deep | Light |
  | Chroma | Soft | Clear |
  | Contrast | Low | High |

  The order follows the canonical 0→1 direction for all four, so every scale reads the same way. That is why value runs Deep → Light.
- **Position:** a type's position is its band's segment, filled and taller, **and** the band written as text on the scale's heading row ("Chroma — Strongly soft"). The segmented track is `aria-hidden`; the text is the equivalent.
- **No gradient:** the segments are categorical, so no gradient implies a continuous measurement.
- **The dimensions topic** (`basics.dimensions`, visual `dimension-scales`) sits inside a figure between the answer and "Why it works":
  - **endpoint swatches** at both ends of each scale, from the Slice 1 fixed palette-id examples (`dimensionExamples`: Raspberry Rose ↔ Warm Coral, Deep Emerald ↔ Seafoam, Smoky Blue ↔ Electric Blue, and light-middle-dark stacks for contrast);
  - **with a result:** a legend "✦ Your type Soft Summer", the user's type marked on all four scales, and the existing note "Positions describe the type, not a score from your answers";
  - **without a result:** the scales and endpoints only, with no marker.

## 8. Dimension derivation

`guide.position` (Slice 1) derives each band with `dimensionBand(seasonDefinitions[subtype].target[dimension])`. The segment index comes from `dimensionBandOrder.indexOf(band)`. Learn has:
- no per-type labels or positions;
- no target numbers: the UI contains no decimal literal (boundary test).

The browser audit recorded all 48 bands; the jsdom tests recompute each one from the canonical targets for all 12 types in both languages.

## 9. Palette presentation

The four colour groups keep their visual weight, in order:
1. **Best:** the largest tiles, four across (8 = two full rows).
2. **Neutrals and Accents:** smaller tiles, five across (one full row each).
3. **More Considered:** the smallest tiles, four across, inside a soft dashed panel with its tips.
4. **Metals:** a compact two-row list.

Row sizes follow each group's count (`calc(25% − 7px)` / `calc(20% − 7px)`), so no row leaves an orphan at 320–1280 px. An em floor drops columns under large text.

An earlier draft put Neutrals and Accents side by side on desktop. It was dropped because each half-column split 4 + 1, and one column scans better.

Every swatch shows its canonical colour unchanged. Every tile has a neutral inset hairline, so very light colours keep a visible edge on the cream page: Optic White, Pure White, Clear Ivory, Soft White and Warm Ivory. Dark colours (Black, Jet Black, Ink) keep their shape against the light page. The colour name is always written **below** the swatch, never on it.

## 10. More Considered

The section is exactly the app's own title ("More Considered" / "สีที่ต้องเลือกใช้สักนิด"), description ("…choices to balance, not colors to avoid"), the type's four listed colours, and the four existing tips (the last is "None of these are forbidden…"). A test asserts that the section's whole text is exactly those strings, so no avoidance wording can be added. Only listed colours appear; nothing is inferred for unlisted colours.

## 11. Metals

The canonical two metals render as a compact list, each with a round swatch, its localized name and its existing note (`metalDisplayNote`). No metal is inferred and no jewellery rule is added.

## 12. Outfit formula

The formula comes from `outfitFormula(subtype)` (Slice 1): Best[0] near the face, Neutral[0] as the base, Accent[0] in a small piece. It is shown two ways:
- **Flat-lay:** a small Learn-local SVG (`OutfitFlatLay`) with a neutral top, trousers and a bag, filled with those three canonical colours. It is decorative (`aria-hidden`).
- **Text list:** the existing three formula lines, each with the colour's localized name.

It is presentation only: no Daily code, no recommendation engine, and no garment art reused from V1.3 (the boundary test forbids Daily imports). Slice 4 can reuse `OutfitFlatLay` for the `garment-placement` visual.

## 13. Result contextual entry

The Result screen has one new text link, **"Learn about your type →" / "ดูรายละเอียดไทป์ของคุณ →"**, at the end of the "Why this result" section.
- **Wording:** the label matches the Learn hero's existing wording. It lives in `LocaleCopy.result.learnCta`, because the app never reads Learn copy.
- **Placement:** it stays secondary to "Explore My Palette", and no ad hook was added.
- **What it opens:** Learn at the user's type page, with focus on its `h1`, at the top of the page.
- **Back:** "Back to Color Guide" returns to the Learn home.

No Palette or Checker contextual links were added; they belong to Slice 4.

## 14. Direct entry contract

```ts
export type LearnEntry = { kind: 'home' } | { kind: 'type'; subtype: Subtype }
<LearnView … entry={learnEntry} />
```

- **App side:** the app keeps one `learnEntry` state.
  - Result sets `{ kind: 'type', subtype: result.subtype }`.
  - The Guide nav item and the Welcome link set `{ kind: 'home' }`, so the nav never reopens an old entry.
- **Learn side:** Learn reads the entry only when it mounts. `learnSubtype()` accepts only a canonical id.
- **Unknown id:** Learn opens its home. It never guesses a replacement and never crashes (tested).
- There is no URL routing.

## 15. Internal navigation and Back

```ts
type LearnPage = { kind: 'home' } | { kind: 'topic'; topic } | { kind: 'your-type' } | { kind: 'type'; subtype }
```

- **Return trail:** Learn keeps a short return trail, whose depth the IA limits to home → topic → type. Each entry holds the page, the scroll position and the id of the control that opened the next page. Opening from the home starts a new trail. This is not a history stack.
- **Overview → type:** Back is "← Back to 4 seasons, 12 types". It restores the overview's scroll position and focuses the card (browser QA: 724 → 724 at TH 320, 552 → 552 at EN 1280).
- **Overview → Back:** returns to the Learn home, focused on the overview row.
- **Home hero → your type:** Back returns to the home, focused on the hero action (Slice 2 behaviour).
- **Result → type:** Back returns to the Learn home, at the top.
- **Switcher decision:** there is **no previous/next or inline type switcher**; the overview is the selector. A switcher would duplicate it and lengthen an already long phone page.

## 16. Profile changes while open

| Situation | Behaviour |
|---|---|
| "Your type" page (from the home hero), result changes | The page follows the new result: it is "your type" by meaning. |
| "Your type" page, result removed | Falls back to the Learn home (Slice 2 behaviour). |
| A type chosen from the overview (or Result), result changes | Stays on the chosen type. The "Your type" marker and the end action follow the new result. |
| A chosen type, result removed | Stays; the marker disappears, and the quiz link appears. |

## 17. Tests

`LearnTypes.test.tsx` has 43 tests:

**A. Overview**
- 4 seasons of 3 types, in canonical order, with TH and EN names.
- Card swatches equal each type's first four Best colours.
- Exactly one text-marked card, with the marker in the button's accessible name.
- No digits, "%" or ranking words on the grid.
- No marker without a result.
- Every type opens, and Back returns focus to its card, then to the home row.

**B/C. All 12 types × TH/EN**
- Registry section order.
- Identity, canonical season, summary, and labelled qualities.
- 4 scales, each band recomputed from the canonical target with the segment index matching.
- The four groups, with counts, colours and names equal to `getPalette` + `colorDisplayName`.
- The exact More Considered text; metals with notes; formula names and flat-lay fills.
- No HEX, palette ids, subtype ids or raw role ids (`harder`, `neutrals`, `accents`); no digits.
- Ordered headings.
- The dimensions topic's endpoint swatches equal the Slice 1 palette-id examples; the user's type is marked in words and position.

**D. Navigation**
- Result → own type page, with focus, the marker and Guide current; Back → home; the nav reopens the home.
- The Thai Result link.
- An unknown entry opens the home.
- A language switch keeps the dimensions topic, the overview and a type page.
- A browsed type stays when the result changes or is removed.
- "Your type" follows the result.
- My Palette appears only on the user's own type, and the quiz link only without a result.

**E. Accessibility**
- Keyboard open.
- Headings with a result (TH and EN).
- The named colour list (`listitem` names = colour names); every swatch and scale track is decorative.

`boundaries.test.ts` §F adds four rules:
- no Daily, colour-naming or photo import, and no Daily recommendation or garment-art identifiers;
- no decimal literal in the UI;
- no topic comparison or topic-id lookup in the UI;
- the package lists are pinned.

## 18. Localization

- **New Learn strings:** three per language: "Back to" / "กลับไปที่", "Color qualities" / "ลักษณะสี", "Choose a type to see its palette." / "เลือกไทป์เพื่อดูพาเลตต์".
- **New `LocaleCopy` string:** one, the Result link.
- **Existing tests:** they check the new strings for parity, Thai script, no full stops, no personality words and budgets. The template prose is still well under 80 words.
- **Language switch:** switching TH ↔ EN keeps the same page: overview, dimensions topic or type (tested).

## 19. Accessibility

- **Headings:** one `h1` per page, and no skipped heading levels:
  - overview: `h1` → season `h2` → type `h3`;
  - type page: `h1` → section `h2`s.
- **Controls:**
  - every control is a native button, and every target is at least 44 px;
  - type cards have a card-wide hit area and focus outline, and are keyboard-operable;
  - opening a type moves focus to its `h1`, and Back returns it.
- **Meaning is never colour only:**
  - the "Your type" badge is text;
  - positions are written as band text;
  - palette colours are named lists under their group heading, so a screen reader hears "Best Colors, list, 8 items, Peach Bloom…";
  - swatches, scale tracks, the cover strip and the flat-lay are `aria-hidden`.
- **No HEX:** no HEX value or id appears in text or in any exposed attribute.
- **Motion:** only the existing `page-enter`, removed by the reduced-motion rule; in-Learn scrolling is `instant`.
- **ARIA:** no extra ARIA beyond `aria-hidden` on decoration, and the sections' existing `aria-labelledby`.

## 20. All-12 audit (browser)

The production build was driven in headless Chrome over CDP (no dependency). For each state, the harness checked:
- page width against the emulated width, and elements beyond it;
- clipped text;
- HEX or raw ids in text and attributes;
- targets under 44 px, and the heading sequence;
- `h1`, season kicker, the four band labels, group counts and formula lines;
- that every tile keeps its hairline.

| Run | Types | Result |
|---|---|---|
| TH 360 | all 12 | 12/12 clean; counts 8/5/5/4/2; 4 bands each |
| EN 360 | all 12 | 12/12 clean |
| TH 320 | all 12 | 12/12 clean |

36/36 type pages passed, with no console errors and no requests to other origins. Each type was opened from the overview and returned with Back.

## 21. Visual QA

**Matrix:** 20 type-page captures (full page, plus first viewport on phones).

| Type | Why | Widths |
|---|---|---|
| Light Spring | very light Best and Neutrals (Warm Ivory) | TH 320, EN 430, TH 768 |
| Clear Spring | highest chroma, Clear Ivory | EN 320, TH 430, EN 1280 |
| Soft Summer | most muted; Optic White and Jet Black in More Considered | TH 360, EN 768, TH 1280 |
| Deep Autumn | dark warm palette | EN 360, TH 430, EN 768 |
| Deep Winter | darkest (Black, Ink) | TH 320, EN 1280 |
| Clear Winter | high chroma, very high contrast; longest EN name ("Bright White Gold") | EN 320, TH 360, TH 1280 |
| Warm Spring | longest Thai name (เทอร์ควอยซ์โทนอุ่น) | TH 320 |
| Cool Summer | long Thai names (น้ำตาลอมชมพูกุหลาบ) | TH 320, EN 320 |

**Overview and dimensions** were captured with and without a result: TH 320, EN 360, TH 430, EN 768, TH 1280 and EN 320. All were clean.

**Inspected:**
- **Hierarchy:** reads as cover strip → name → qualities → summary → scales → palette.
- **Scales:** readable at every width.
- **Swatch edges:** light-swatch hairlines are visible (Optic White, Pure White); dark swatches are clear on the cream page.
- **Long names:** they wrap below their swatch, and nothing clips.
- **Groups:** More Considered reads as secondary; metals are compact; the flat-lay sits beside its list at every phone width.
- **Page length:** 2,600–2,800 px at 360 px. At 360 × 800, the header and the first scales are in the first viewport; the Best row ends at about 1,200 px.

## 22. 200 % text and zoom

**200 % root text at 360:** overview, type page (Clear Spring) and dimensions in TH and EN.
- The Learn content reflows: tiles drop to two or three columns and the flat-lay stacks.
- No Learn element exceeds the viewport.
- The page is 389 px (EN) / 413 px (EN dimensions) only because of the **existing header and bottom nav**. The Slice 2 build measures the same widths, so Slice 3 adds none.

**200 % zoom** (a 180 CSS px layout at 2×): the same three pages in TH and EN.
- The Learn page's right edge is 160 px, inside 180.
- The page widths (249 TH / 272 EN) come from the header switchers and nav, and are identical in the Slice 2 build.

Both stay recorded for the Slice 5 reflow pass; Slice 3 does no global header redesign.

## 23. Personality-wording review

These were checked as rendered on the type pages, in both languages:

| Wording | Where | Verdict |
|---|---|---|
| Characteristic words: Dramatic (Deep Winter), Bold (Cool Winter), Calm and Refined (Cool Summer), Fresh, Airy, Crisp, Vivid, Rich, Earthy, Blended; TH โดดเด่น, เด่น, สงบ, ละมุน… | Type header | **B.** Out of context, some could describe a person. They are rendered on one line labelled **"Color qualities" / "ลักษณะสี"**, directly under the type name and before the summary sentence, which describes colours. They are never "You are…", and are not shown on the grid or the Learn home. |
| Summaries, e.g. "Dark jewel tones with a cool, dramatic edge" | Type header | **A.** Every summary describes colours. |
| Accents description "…and confident color" / "…วันที่อยากใช้สีอย่างมั่นใจ" | Accents section | **A.** It describes how the colour is used. |
| Metal notes "Rich gold echoes your natural warmth", "Soft sheen suits your blended quality", "High shine mirrors your clarity", "Rich warmth with character" | Metals | **A for personality:** "your warmth, blended quality, clarity" refer to colouring, and "character" is the metal's. On a browsed type the "your" addresses someone with that type. The page is headed by that type's name, and no "Your type" marker appears unless it is theirs. It is noted for the Slice 5 copy review, not rewritten. The Thai notes describe the palette and have no "your". |

No **C** case was found, so no frozen copy was rewritten. The Learn-authored strings still pass the Slice 1 personality check.

## 24. Performance

| | Raw | Gzip |
|---|---|---|
| JS, Slice 2 | 451.45 kB | 134.12 kB |
| JS, Slice 3 | 459.04 kB | 135.96 kB |
| **JS delta** | **+7.59 kB** | **+1.84 kB** |
| CSS, Slice 2 | 53.83 kB | 11.93 kB |
| CSS, Slice 3 | 59.35 kB | 12.90 kB |
| **CSS delta** | **+5.52 kB** | **+0.97 kB** |

The +2.81 kB gzip total is well under the 20 kB investigation threshold: two small UI modules and their styles. There is no new dependency and no lazy loading.

## 25. Adversarial checks

23 mutations were each applied alone, run against the `src/learn` tests, and restored exactly (`git diff` of the domain afterwards: empty). **23/23 caught:**

| Mutation | Caught by |
|---|---|
| Swap a subtype's season (`seasons.ts`) | Slice 1 subtype and season-trait tests |
| Type page shows another season | Slice 1 guide tests; type template |
| Hard-code one dimension label | all-12 template (band text) |
| Remove one palette colour | all-12 template (counts) |
| HEX on a swatch (`title`) | all-12 template (exposed text) |
| Internal palette id exposed (`id`) | all-12 template |
| Remove the text from a dimension position | all-12 template |
| Mark another subtype as the user's type (grid) | overview marker test |
| Every browsed type claimed as "yours" | browsed-type and end-action tests |
| Result link opens the wrong subtype | Result entry tests (EN, TH) |
| Language switch resets the page | language tests (Slice 2 and 3) |
| Browsed own type jumps when the profile changes | browsed-type test |
| Import the Daily recommendation | UI import allow-list; §F Daily rule |
| Import the classifier | UI import allow-list |
| Swatch colour altered for contrast (`color-mix`) | all-12 template (swatch colours) |
| More Considered says "avoid" | all-12 template (exact More Considered text) |
| Season order reversed in the grid | overview order test |
| Back from a type skips the overview's return point | overview Back/focus test |
| Unknown requested type not validated | unknown-entry test |
| Flat-lay colours swapped | all-12 template (flat-lay fills) |
| Visual chosen by topic id | UI boundary tests (topic id; topic comparison) |
| Metal note dropped | all-12 template |
| Formula uses the second Best colour | Slice 1 formula tests; template |

**Layout checks** are guarded by the browser QA rather than jsdom (overflow, clipping, 44 px targets, hairlines). That QA caught and led to the fix of two layout problems during the slice:
- orphan tiles (a Best row of 7 + 1 at 1280, and More Considered 3 + 1 at 320);
- a Neutrals/Accents half-column split at 1280.

## 26. Validation

- **`npm test`:** 52 files; **1,543 passed**, 1 known skip. The baseline was 1,496; the 47 new tests are 43 behaviour tests plus 4 boundary tests.
- **Exhaustive quiz audit:** 177,147 / 177,147.
- **`npm run build`:** passes.
- **`git diff --check`:** clean.
- **V1.2/V1.3 regressions:** unchanged and passing: colour-naming guard, checker, photo, Daily, persistence and release-candidate tests.
- **Offline and privacy:** Learn makes no network call and reads no storage (boundary tests). Browser QA recorded 0 console errors and 0 requests to other origins.

## 27. Known limitations

1. **Device back** still leaves the app (plan Q3).
2. **200 % text / zoom:** the header and bottom nav overflow as before (Slice 2 §20, not changed here). Learn content itself reflows.
3. **Metal notes with "your"** read as addressed to the viewer on a browsed type (§23). This is a Slice 5 copy-review item.
4. **Page length:** a type page is about 2,700 px at 360 px. All palette groups are visible without taps, by design (no hidden palette).
5. **Not built:**
   - the "See outfit examples" link (the Palette screen has no entry to its Examples tab);
   - the P1 nearby types;
   - the season strips for `basics.what-is` (a Slice 4 visual).
6. **Native Thai review** is still pending (plan Q4).
7. **The Welcome Daily-link ordering quirk** is unchanged (Slice 2 §12), deferred to polish.

## 28. Slice 4 handoff

- **Visuals:** add renderers to `TopicVisual` for:
  - `garment-placement` (`wear.palette`, `wear.harder`): reuse `OutfitFlatLay`, and add a "moved lower" variant for More Considered;
  - `lighting-comparison` (`app.color-checker`);
  - optionally `season-strips` (`basics.what-is`).

  Map by kind only; §F forbids topic comparisons.
- **Contextual links:** Palette › More Considered → `wear.harder`, and Checker photo caveat → `app.color-checker`.
  - Extend `LearnEntry` with `{ kind: 'topic'; topic: LearnTopicId }`, validated like types.
  - Set it through `openLearn()` in `App.tsx`.
  - Back from a contextual entry returns to the Learn home, as for Result.
- **Keep:**
  - the UI imports only `react`, the `..` barrel and types;
  - new UI files go on the Z list;
  - colours come only from canonical palette data;
  - no Daily imports.
