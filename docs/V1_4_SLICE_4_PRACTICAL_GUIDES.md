# V1.4 Slice 4 — Practical Color Guides & App Guidance

**Status:** complete. The four practical P0 topics now teach with a visual:
- **Using your palette:** a clothing-placement illustration.
- **More Considered:** the same colour near the face, then lower and smaller.
- **Color Checker:** the two modes, then one garment in four photos.
- **Lucky colors:** family → shade → placement.

Two contextual entries were added, **Palette › More Considered → Learn** and **Checker › Photo → Learn**, so all three planned V1.4 links now exist. Browsed type pages no longer address the reader in metal notes.

No palette, colour, rule, matching logic, Daily logic or colour-naming access was added. P1 content was not implemented.

**Governing plan:** [V1_4_LEARN_PLAN.md](V1_4_LEARN_PLAN.md). **Previous slices:** [Slice 1](V1_4_SLICE_1_CONTENT_FOUNDATION.md), [Slice 2](V1_4_SLICE_2_LEARN_HOME_NAV.md), [Slice 3](V1_4_SLICE_3_TYPE_GUIDE.md).

## 1. Entry state

`main` at `56617bf` "feat: add v1.4 personal color type guide", clean, version 1.1.0, 5 commits ahead of `origin/main`. This matched the brief.

## 2. Files changed

| File | Change |
|---|---|
| `src/learn/ui/LearnArt.tsx` | New. The one garment drawing (top, trousers, bag, metal chain) used by every Learn illustration. |
| `src/learn/ui/LearnGuides.tsx` | New. The four practical visuals and their shared frame. |
| `src/learn/ui/LearnGuides.test.tsx` | New. 123 behaviour tests (§23). |
| `src/learn/ui/LearnVisuals.tsx` | `TopicVisual` is now one table from visual kind to component; `OutfitFlatLay` uses `LearnArt`. |
| `src/learn/ui/LearnView.tsx` | `LearnEntry` gains a validated `topic` variant; focus on direct entry. |
| `src/learn/ui/LearnType.tsx` | Metal notes are worded about the type on a browsed type. |
| `src/learn/ui/LearnReader.tsx` | Passes the app copy to the visual. |
| `src/learn/types.ts`, `registry.ts` | Two visual kinds, `placement-shift` and `lucky-flow`, assigned to More Considered and Lucky Color; `LearnCopy.visuals`; `typeDetail.thisTypes`. |
| `src/learn/model.ts`, `examples.ts`, `index.ts` | `learnTopic()`, `typeOrientedNote()`, the example's metal and type, and the fixed `lightingExample`. |
| `src/learn/content/{en,th}.ts` | Visual labels and "this type's". |
| `src/learn/*.test.ts`, `LearnTypes.test.tsx` | The Z list; the Slice 1 personalisation contract; S4 model tests; the browsed-type metal expectation. |
| `src/App.tsx` | The Palette and Checker links. |
| `src/i18n/{types,en,th}.ts` | `palette.learnCta` and `checker.photoLearnCta`. |
| `src/styles.css` | The Slice 4 illustration block and the two link placements. |

No domain, palette, classifier, Color Checker engine, Photo Checker component, Daily, persistence, service, package or native file changed. `PhotoCheckerPanel.tsx` (V1.2) is untouched: the Checker link sits in `App.tsx`, after the panel.

## 3. Using your palette

The topic's visual (`garment-placement`) sits between its answer and "Why it works". It has two parts.

**The flat-lay, split into two zones:**
- **"Near your face":** a Best top with a metal chain and pendant.
- **"Below your face":** Neutral trousers and an Accent bag.

**A list of the roles**, each with a swatch, what the role is, and the colour's localized name:
1. "A Best color near your face"
2. "A metal as a finishing detail"
3. "A Neutral as the base"
4. "An Accent in a small piece"
5. "A More Considered color, lower down or in a smaller piece"

The first, third and fourth labels are the Slice 3 formula labels, reused. The More Considered swatch has a dashed ring, matching the dashed More Considered panel on the type page.

**Where the colours come from:**
- **With a result:** `outfitExample(profile)`, which is the reader's Best[0], Neutral[0], Accent[0], More Considered[0] and first metal. The tag reads "Your colors · Soft Summer".
- **Without a result:** the Slice 1 general example (Soft Autumn) plus that same type's first metal. The tag reads **"Example colors · Soft Autumn"**, so it never implies the reader has that type.

There is no matching engine and no new rule. The roles are the existing palette section meanings and the Slice 1 formula.

## 4. Clothing-placement visual

`LearnArt.tsx` holds the one drawing that every illustration shares:
- **Pieces:** top, trousers, bag with strap, and a metal chain with pendant, as SVG paths in one 200 × 150 space.
- **Line:** a 1.5 px line with round joins.
- **Views:** the whole outfit, the zone near the face, the zone below it, or the top alone.

A piece is filled with a canonical colour, drawn as a dashed outline, or filled with the concept diagram's illustration tone. It has no human figure and no face, and uses no images, AI or Daily garment art.

The Slice 3 outfit formula (`OutfitFlatLay`) now draws through the same component, with unchanged output.

## 5. More Considered visual

The `placement-shift` visual shows two outfits in identical frames, side by side on a phone:

| Outfit | Top | Trousers | Bag | Caption |
|---|---|---|---|---|
| 1 | More Considered colour | Neutral | — | "Near your face" |
| 2 | Best colour | Neutral | the same More Considered colour | "Lower and smaller, with a Best color on top" |

- **List:** the three colours are named under their existing section titles ("More Considered", "Best Colors", "Neutrals").
- **Caption:** "The same color in both outfits. Only where it sits has changed."
- **Nothing is re-graded:** there are no ticks, crosses, "wrong" or "avoid". The second outfit is never called Best, so moving the colour lower does not change its group.
- **Profile mode:** the colour is the reader's own More Considered[0], with their Best[0] and Neutral[0] as support.
- **General mode:** the Slice 1 example.

The More Considered colour is always taken from the palette's own `harder` list, so it is always a listed More Considered colour.

## 6. Color Checker visual

The `lighting-comparison` visual has two parts.

1. **The two modes**, named with the Checker's own labels (`photoChecker.modes`):
   - **Manual:** "You choose the color yourself." Drawn as a swatch with a picker ring.
   - **Photo:** "The app reads the pixels where you tap." Drawn as a photo with a tap ring.
2. **"Illustration · One light, soft-colored shirt in four photos":** four tiles showing warm light, cool light, shade, and strong colours nearby.
   - Every tile is the same canonical garment, `lightingExample` = Light Summer's Soft White. It is a very light, low-chroma neutral, the kind of colour the Checker's lighting note says photos shift most.
   - Each tile gets a shift overlay: amber, blue, dark, or a spill from the red surround.

**Every tile is shifted, including "strong colors nearby".** The first draft left that tile unshifted. Browser review showed it read as "the real one", so it was changed. No tile presents the garment's true colour, and the caption says: **"The app sees only the photo, not the shirt itself."**

The Slice 1 honesty text is unchanged beside the visual:
- "cannot know the exact color of the garment";
- the V1.2 lighting note, which covers light and low-colour garments;
- the capture tip.

There is no correction, calibration, detection or "AI corrected" result, and a test forbids those words in the visual's copy.

## 7. Checker contextual entry

- **Link:** "Why can photo colors shift? →" / "ทำไมสีในรูปถึงเพี้ยนได้? →". It is a text link, only in the Checker's **Photo** mode, directly below the photo tools (the capture tip, and the result once a photo is checked).
- **Frozen code untouched:** it is rendered by `App.tsx` after `PhotoCheckerPanel`, so no V1.2 component or behaviour changed.
- **Where it opens:** Learn at `app.color-checker`, at the top, with focus on the `h1`.

## 8. Palette contextual entry

- **Link:** "How to wear More Considered colors →" / "วิธีใส่สีที่ต้องเลือกใช้สักนิด →". It sits after the More Considered tips in the Palette tab, and appears only in that section, once.
- **Where it opens:** Learn at `wear.harder`, focused on its `h1`, showing the reader's own More Considered colour straight away.

## 9. Lucky Color visual

The `lucky-flow` visual is three numbered steps, tagged "Illustration":

| Step | Label | What it says |
|---|---|---|
| 1 | **Color family** | "The Thai daily tradition picks it." Five tones of one family. |
| 2 | **Shade** | "Personal Color picks one that suits you." One tone ringed; the others fade. |
| 3 | **Placement** | "Personal Color picks where to wear it." The flat-lay, with that tone as the top. |

- **Caption:** "An example of how Daily works, not today's lucky color."
- **Tones:** the tones are illustration colours in CSS, not palette colours. Learn has no colour-family data, which lives in Daily and in colour naming, both off-limits. So the diagram shows the idea without claiming any family or shade.
- **No live Daily data:** no date, weekday, goal, today's colour or Daily import, and no personalisation (the registry says `none`).
- **Daily button:** the optional "Open Daily" action was **not** added. The takeaway already points to Daily in words, and the reader has no action slot per topic, which would have needed a topic-specific control.

## 10. Two-goal framing

The visual shows a single family and says nothing about combining. The two-goal explanation stays in text only: the Slice 1 sentence says combining two goals' colours is how the app works, not the tradition. A test forbids "combin", "two goals", "รวม" and "2 เรื่อง" in the visual's copy.

## 11. Metal-note presentation correction

Three canonical English metal notes address the reader:

| Type | Canonical note |
|---|---|
| Warm Spring | "Rich gold echoes **your** natural warmth" |
| Soft Summer | "Soft sheen suits **your** blended quality" |
| Clear Winter | "High shine mirrors **your** clarity" |

**On the reader's own type,** the note is shown word for word.

**On any other type, or without a result,** `typeOrientedNote()` swaps only the whole-word possessive "your" / "Your" for Learn's localized "this type's" / "This type's". For example: "Rich gold echoes this type's natural warmth".
- **Thai:** the rule is "ของคุณ" → "ของไทป์นี้". It currently changes nothing, because the Thai notes (from `translateMetalNoteThai`) never address the reader.
- **Canonical data:** unchanged. `palettes.ts`, `i18n/colors.ts` and the Palette screen show the original notes.
- **Why this approach:** it is one word-boundary rule plus one localized phrase, with no replacement table. A test re-audits all 24 notes in both languages, so a future note with "you" would fail.

## 12. Direct topic entry

```ts
export type LearnEntry = { kind: 'home' } | { kind: 'type'; subtype: Subtype } | { kind: 'topic'; topic: LearnTopicId }
```

- **Validation:** `learnTopic(value)` accepts only an id in the registry's `learnTopicOrder`, which is the seven P0 topics.
- **Rejected:** P1 ids, `types.detail`, `home`, arbitrary strings, `__proto__`, and non-strings.
- **Unknown topic:** Learn opens its home, with focus on the home `h1`, and never guesses.
- **Valid entry** (Result, Palette or Checker): the requested page opens at the top with focus on its `h1`. Nav and Welcome still open the home and leave focus alone.
- **Routing:** there is no URL routing, and only `App.tsx` sets an entry.

## 13. Back behaviour

A contextual entry starts Learn with an empty return trail, so **Back ("← Back to Color Guide") goes to the Learn home**, focused on its `h1`. This is the same as the Result entry in Slice 3.

It does not return to the Palette or Checker screen. The app has no cross-view history, and building one only for this was out of scope. The bottom nav, with Palette and Checker one tap away, is the way back.

Browser QA confirmed this at TH 320, EN 360 and EN 1280.

## 14. Personalization

| | Palette placement | More Considered | Checker | Lucky |
|---|---|---|---|---|
| With a result | the reader's canonical palette, tagged "Your colors · {type}" | the reader's More Considered[0] + Best[0] + Neutral[0] | fixed example for everyone | concept only |
| Without a result | Slice 1 example, tagged "Example colors · Soft Autumn" | Slice 1 example | same | same |

- **Inputs:** the visuals receive only the already-valid `LearnProfile`.
- **Nothing else is called or read:** no storage, classifier, scoring, subtype inference, Checker matching, or Daily logic.
- **Updates:** a profile appearing, changing or disappearing re-renders the colours at once (tested).

## 15. Visual system

The four illustrations share:
- **Frame:** one frame (`.learn-illus`): 1 px line border, 20 px corners, and the same pale paper as the Slice 3 figures.
- **Tag:** one small uppercase tag in English, sentence case in Thai.
- **Inner cards:** 14 px corners.
- **Drawing:** one garment drawing with a 1.5 px, round-joined line.
- **Swatches:** round swatches with a neutral inset hairline.
- **Caption:** one caption style, separated by a rule.

Canonical colours are never altered. The lighting casts and lucky tones are illustration colours, and are labelled "Illustration".

Layouts use em-based grids and one container query:
- **Checker tiles:** 2 × 2, or 4 across when the figure is at least 30 em wide.
- **More Considered:** two outfits side by side, stacking under large text.
- **Lucky flow:** three steps across from about 29 em.
- **Palette placement:** zones and roles side by side from 28 em.

## 16. Accessibility

- **Headings:** they are unchanged. Every visual is a `figure` with no headings of its own, so each topic still reads `h1` → `h2` levels (tested in both modes and languages).
- **Text equivalents:** every drawing (SVG, swatch, tone) is `aria-hidden`, and the visible text carries the whole lesson:
  - zone labels;
  - named role lists;
  - outfit captions;
  - mode descriptions;
  - tile labels;
  - numbered steps.
- **Meaning never by colour alone:**
  - the More Considered swatch is labelled, and its dashed ring is extra;
  - the lucky step's selection is described in words.
- **Links:** real buttons with descriptive names ("Why can photo colors shift?"), 48 px tall.
- **Focus:** it moves to the topic `h1` on direct entry, or to the home `h1` on fallback and on Back.
- **Motion:** none new; the existing reduced-motion rule still covers `page-enter`.
- **Text size:** all figure text is at least 12 px (browser-measured; §19).

## 17. All-12 personalized visual audit

`LearnGuides.test.tsx` B and C run all 12 types × TH/EN (48 cases). For each, it checks:
- every referenced colour is the palette's own object;
- the More Considered colour is in the type's `harder` list and in no other group;
- support colours are the type's Best[0] and Neutral[0];
- the metal is `metals[0]`;
- every role has a non-empty localized name;
- SVG fills equal the canonical colours in the right zone or outfit;
- no HEX, palette id, subtype id or topic id appears in text or attributes.

**Result: 48/48 pass.**

## 18. Metal wording audit

`LearnGuides.test.tsx` F renders every type's metals in all three modes, in both languages (72 renders):
- own type;
- browsed with another result;
- browsed without a result.

| | Notes | Needed re-wording | Result |
|---|---|---|---|
| English | 24 | **3** (Warm Spring, Soft Summer, Clear Winter: one note each) | own type word for word; browsed types contain no "you"/"your" |
| Thai | 24 | **0** | unchanged in every mode; no "คุณ" |

## 19. Responsive QA

The production build was driven in headless Chrome over CDP, with no dependency. Each capture recorded:
- page width against the emulated width;
- Learn elements beyond the viewport;
- clipped text;
- HEX or ids in text and attributes;
- targets under 44 px;
- heading sequence;
- SVGs outside their figure;
- figure text under 12 px;
- column counts.

| Topic | Captures | Result |
|---|---|---|
| Using your palette | profile TH 320, profile EN 360, general TH 360, EN 768, TH 430, EN 1280 | clean |
| More Considered | profile TH 320, profile EN 360, general EN 360, TH 768, EN 430, TH 1280 | clean |
| Color Checker | TH 320, EN 360, TH 768 (general), EN 1280 | clean; tiles 2 × 2 on phones, 4 across at 768+ |
| Lucky Color | TH 320, EN 360 (general), EN 768, TH 1280 | clean; steps stacked on phones, 3 across at 768+ |
| Palette → Learn | TH 320, EN 360, EN 1280 | one link, 48 px; lands on the topic `h1` at scroll 0; Back → home `h1` |
| Checker → Learn | TH 320, EN 360, EN 1280 | no link in Manual; link under the capture tip in Photo; lands on the topic `h1` at scroll 0 |

The runs recorded 0 console errors and 0 requests to other origins.

**QA found and fixed three issues:**
- the English illustration tag measured 11.84 px (raised to 12.8 px);
- the unshifted "strong colors nearby" tile (§6);
- the Lucky steps at 320 wasted a line on the step number (the number now floats beside the drawing).

## 20. 200 % text

200 % root text at 360 was tested for each new visual kind, in TH and EN (8 captures).
- **Reflow:**
  - zone labels move above the drawings;
  - the two outfits stack;
  - Checker tiles stay 2 × 2;
  - modes and lucky steps stack.
- **Inside the viewport:** no Learn element exceeds it, no drawing clips, and no text is under 12 px.
- **English page width:** 389 px, only from the existing header and nav. That is the same width as in Slices 2 and 3, and is left to Slice 5, as the brief requires.

## 21. Five-second readability

| Visual | What a reader should get in five seconds |
|---|---|
| Palette placement | "My Best colour goes on top by my face; Neutral and Accent go lower; here are my five colours by role." |
| More Considered | "Same colour: as a top by my face, or as a bag under a Best top. I can wear it; I move it." |
| Color Checker | "Manual: I choose. Photo: the app reads pixels, and one light shirt photographs four different ways." |
| Lucky Color | "Tradition gives the family → Personal Color picks the shade → and where it goes." |

All four passed on the captures without reading the surrounding paragraphs, so none was simplified further.

## 22. P1 evaluation

**Everyday Neutrals: RECOMMEND DROP FROM V1.4.**
- **What Slice 4 already covers:**
  - every type page names its five canonical Neutrals with swatches;
  - the placement visual teaches the Neutral's job (the base);
  - More Considered covers Neutrals such as Optic White or Jet Black where a type lists them.
- **What the topic would add:** its only unique value is sorting palette colours into white / black / grey / beige / navy families. That needs the guarded colour-naming module or name-based inference. The PO already found name-based inference fragile ("Soft Navy" names as charcoal), and the plan's Q1 decision protects the guard.
- **What real users need:** "Can I wear black?" is already answerable: a type lists Black as a Neutral or as More Considered, and Color Checker checks any black directly.
- **Conclusion:** there is no compelling evidence to change the V1.2 boundary. The guard was not modified.

**Same name, different shade: defer beyond V1.4.** The Lucky flow and the Checker lighting visual already teach "a family is not a shade". A cross-type "navy" or "pink" strip would need the same family grouping as Everyday Neutrals.

**Nearby-type comparison: defer beyond V1.4.**
- The overview already shows each type beside the other two in its season.
- A "nearest types" section would reuse classifier-style weighted distances in Learn, which is the coupling Learn has avoided.
- The completed P0 experience has no hole that these fill.

## 23. Tests

`LearnGuides.test.tsx` (123 tests):

| Section | What it checks |
|---|---|
| **A. Registry mapping** | Every topic × language draws exactly its registry kind; the four practical topics have distinct kinds; changing a topic's registry kind changes its drawing. |
| **B. Palette placement** | All 12 × 2 profile cases; general mode names the example type and never says "Your colors". |
| **C. More Considered** | All 12 × 2; general mode; no avoidance or re-grading words, no hidden titles. |
| **D. Color Checker** | Mode names and descriptions; the four tiles; the canonical garment in every tile; all tiles shifted; honesty vocabulary. |
| **E. Lucky** | Step order and text; no palette styles, dates or weekdays; family text from the tradition only; shade and placement from Personal Color; no combining. |
| **F. Metal notes** | All 12 × 2 × 3 modes; exactly 3 English re-wordings, 0 Thai, 24 notes. |
| **G. Contextual entries** | Palette → `wear.harder` with focus and the user's colour, Back → home; Checker Photo-only link → `app.color-checker` with Guide current; Thai links; **exactly three** contextual `openLearn` entries in `App.tsx`. |
| **H. Direct entry** | All 7 topics focus their `h1`; 6 invalid ids fall back to the home, focused. |
| **I. State** | Language switch keeps each practical topic; a profile appearing, changing or disappearing refreshes the colours. |
| **J. Accessibility** | Headings, decoration, no internals and named buttons, per practical topic × language × mode. |

`model.test.ts` S4 adds four tests: topic validation, the example metal and type, the lighting example, and `typeOrientedNote`.

## 24. Performance

| | Raw | Gzip |
|---|---|---|
| JS, Slice 3 | 459.04 kB | 135.96 kB |
| JS, Slice 4 | 470.02 kB | 138.54 kB |
| **JS delta** | **+10.98 kB** | **+2.58 kB** |
| CSS, Slice 3 | 59.35 kB | 12.90 kB |
| CSS, Slice 4 | 64.04 kB | 13.83 kB |
| **CSS delta** | **+4.69 kB** | **+0.93 kB** |

The JS gzip delta is well under the 10 kB investigation threshold. There is no dependency and no lazy loading.

## 25. Adversarial checks

21 mutations were each applied alone, run against the `src/learn` tests (which include the App-level tests), and restored from the saved original. A search afterwards found no mutation text left in `src/`, and the full suite passed again. **21/21 caught:**

| Mutation | Caught by |
|---|---|
| Visual kind mapped to the wrong component | A registry mapping; B/C |
| More Considered uses a Best colour | C (listed-only, fills); Slice 1 contract |
| Support colour from a non-support group | C (moved-outfit fills) |
| Checker visual says "true color" | D honesty vocabulary |
| Lucky visual: tradition picks the shade | E family/shade split |
| Lucky visual imports Daily | Slice 3 §F Daily boundary; UI import allow-list |
| Palette entry opens the wrong topic | G Palette entry |
| Invalid topic not validated | H invalid entry (crash) |
| Language switch returns home | I language; Slice 2–3 language tests |
| Profile change leaves a stale visual | I profile changes; B/C |
| Metal note says "your" on a browsed type | F metal audit; template test |
| Lighting tiles lose their text | D tiles |
| HEX exposed on a role swatch | B/C/J no internals |
| General mode says "Your colors" | B general |
| Palette link in the wrong section | G section check |
| A fourth contextual Learn link | G "exactly three" |
| Lighting tile shows the garment unshifted | D every tile shifted |
| Invalid entry leaves focus behind | H focus |
| Own-type metal note re-worded | F own type word for word |
| Visual chosen by topic id | Slice 3 §F topic-comparison boundary |
| Lucky flow shows a palette colour | E no palette styles |

## 26. Validation

- **`npm test`:** 53 files; **1,670 passed**, 1 known skip. The baseline was 1,543; the 127 new tests are 123 behaviour tests and 4 model tests. Three existing tests were updated to the new contracts: the Z file list, the personalisation contract (the example's metal and type) and the browsed-type metal notes.
- **Exhaustive quiz audit:** 177,147 / 177,147.
- **`npm run build`:** passes.
- **`git diff --check`:** clean.
- **V1.2 / V1.3 regressions:** the Color Checker, Photo Checker and Daily suites (15 files, 433 tests) pass unchanged. This includes the colour-naming guard (`colorNamesIntegration.test.tsx`) and the lighting-note test.
- **Offline and privacy:** Learn makes no network call and reads no storage (boundary tests). Browser QA recorded 0 requests to other origins.

## 27. Known limitations

1. **Back from a Palette or Checker entry** goes to the Learn home, not the originating screen (§13). Device back still leaves the app (plan Q3).
2. **200 % text / zoom:** the header and bottom nav overflow as before; this is Slice 5.
3. **The lucky diagram** uses one illustration tone family (green-ish) for every reader. It is labelled "Illustration" and "not today's lucky color", but a reader could still associate that hue with luck.
4. **The lighting tiles** are illustrations of typical shifts, not simulations of any camera.
5. **The optional "Open Daily" action** in the Lucky topic was not added (§9).
6. **The `season-strips` visual** for "What is Personal Color?" is still not drawn; that topic reads as text.
7. **Native Thai review** of all Learn copy, including the new visual labels, is still pending (plan Q4).
8. **The Welcome Daily-link ordering quirk** is unchanged (deferred polish).

## 28. Slice 5 handoff

- **Reflow:**
  - fix the header and bottom-nav overflow at 200 % text and zoom, which is the only remaining width issue on Learn pages;
  - re-run the Slice 3 and Slice 4 QA matrices afterwards.
- **Copy review:** a native Thai review of all Learn strings, including `visuals.*`, "ของไทป์นี้" and the two link labels, plus an English pass on the tags.
- **Decisions to confirm with the PO:**
  - the lucky diagram's illustration hue;
  - whether to add "Open Daily" (it needs a per-topic action slot in the reader, driven by registry metadata, not topic ids);
  - whether `season-strips` is worth drawing.
- **Budget audit:** budgets and screen-reader semantics across all topics; a contrast check of figure text on the pale figure background.
- **Keep:** the §F boundaries, the "exactly three contextual links" test, `learnTopic()` validation, and the rule that visuals map by kind only.
