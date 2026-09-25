# V1.4 Slice 5 — Final Polish, Accessibility & Release Readiness

**Status:** complete. **V1.4 development is closed.** This slice added no Learn feature. It:
- fixed the app-wide header and bottom-nav overflow under large text and zoom;
- reviewed all Learn Thai copy and the English Learn copy;
- replaced the lucky diagram's single green family with a neutral multi-hue token;
- audited contrast, focus, screen-reader output, non-colour cues and touch targets;
- re-ran every V1.4 audit and the V1.2/V1.3 regressions.

This is **not** a public release: version 1.1.0, no tag, no push, no deploy.

**Governing plan:** [V1_4_LEARN_PLAN.md](V1_4_LEARN_PLAN.md). **Previous slices:** [1](V1_4_SLICE_1_CONTENT_FOUNDATION.md), [2](V1_4_SLICE_2_LEARN_HOME_NAV.md), [3](V1_4_SLICE_3_TYPE_GUIDE.md), [4](V1_4_SLICE_4_PRACTICAL_GUIDES.md).

## 1. Entry state

`main` at `43fedac` "feat: add v1.4 practical color guides", clean, version 1.1.0, 6 commits ahead of `origin/main`. This matched the brief. All six V1.4 docs were read and the production build was measured before any edit (§4).

## 2. PO decisions applied

| Decision | Applied |
|---|---|
| A. Everyday Neutrals | **Dropped from V1.4.** Not implemented; the colour-naming guard is unchanged. |
| B. Same name, different shade | **Deferred** beyond V1.4. |
| C. Nearby-type comparison | **Deferred** beyond V1.4. |
| D. Lucky illustration | The family step is now an abstract multi-hue token (§9). Presentation only: no Daily data, no family classification, no new rule. |
| E. Open Daily button | Not added. |
| F. "What is Personal Color?" illustration | Not added; the topic stays text. |

## 3. Files changed

| File | Change |
|---|---|
| `src/styles.css` | Header wrap; phone nav reflow (container queries) and the ≤ 250 px un-fixed nav; page space for the nav's real height; lucky family token; Thai type-name parts; card marker as text; Welcome Daily-link order; darker ink on the three Learn links; HEX-field focus ring; em-sized Welcome badge; Result title floor; wrapping palette swatch names. |
| `src/App.tsx` | `BottomNav` measures its own height (`ResizeObserver`) into `--bottom-nav-height` on the app shell, and removes it when it unmounts. |
| `src/learn/ui/LearnGuides.tsx` | The lucky family step draws the token instead of the green tones. |
| `src/learn/ui/LearnVisuals.tsx`, `LearnType.tsx`, `LearnHome.tsx` | `TypeName`: a Thai type name is rendered as its two parts, each kept whole. |
| `src/learn/content/{en,th}.ts` | Thai review edits; the lucky family label in both languages. |
| `src/learn/ui/LearnRelease.test.tsx` | New: 30 release-invariant tests (§22). |
| `src/learn/ui/LearnView.test.tsx`, `LearnTypes.test.tsx` | Three Thai heading assertions check the heading's text instead of its jsdom-computed name (§8). |

No domain, palette, target, classifier, colour-naming, Color Checker or Photo Checker engine, Daily, persistence, service, i18n, package, native or `public/` file changed.

## 4. Header at 200 % (fix)

**Before** (production build, Learn home with a profile): at 200 % text the header's switchers pushed the page to **342 px** (TH 320), **389 px** (EN 320 and 360), **476 px** (TH 430) and **523 px** (EN 430). Nothing wrapped.

**Fix:** the header row may wrap.
- `.brand-bar` and `.header-actions` wrap, with row gaps.
- The brand takes only the space the switchers leave, up to its natural width (`flex: 1 1 0; max-width: max-content`). So at normal text the brand name still wraps inside the one-row header exactly as before, and the row itself wraps only when even the shortest brand no longer fits.
- Switcher labels never break mid-word (`ผู้หญิง` used to split as `ผู้/หญิง`).

No control was hidden, shrunk or clipped. At normal text the header is still **70 px** on phones and **88 px** on desktop at every tested width, in both languages. At 200 % text it grows to two or three rows (129–183 px): the brand, then the switchers, right-aligned.

## 5. Bottom nav at 200 % (fix)

**Before:** at 200 % text English "Palette" and "Color Checker" overflowed their buttons, and the nav pushed the page to 389–523 px. At 200 % zoom (a 160–215 CSS px layout) the five items shrank to **38.6–43.2 px** wide, under 44 px.

**Fix** (phones, ≤ 760 px):
- **Size in label ems:** the nav holds the label font size and is a size container, so its width is measured in label-sized ems. That measure shrinks as text grows.
- **Normal text (≥ 23 em):** the unchanged five-across row: 52.8 × 57 px at 320, 60.8 × 57 at 360, 74.8 × 57 at 430. Every Thai label stays on one line, as in Slice 2.
- **Larger text:** two per row, and the fifth item takes the whole last row. From 200 px wide the icon sits beside the label (items 138–193 × 48–68 px); below that, above it (items 58–85 × 57 px).
- **≥ ~150 % zoom (layout under 250 CSS px):** the wrapped nav would cover about half the screen, so it joins the end of the page instead of floating over it (WCAG technique C34). All five items remain, full size.
- **Page space:** the shell keeps room for the nav's measured height (`max(118px, nav + 45px)`), so a two- or three-row nav never hides the end of a page. At normal text the space is 118 / 130 px, as before.

**Not used:** horizontal scrolling, clipped or abbreviated labels, hidden items, a menu, or a smaller font. Labels wrap only at word boundaries. Thai labels needed no wrapping at all at 200 %; English "Color Checker" and "My Colors" wrap at the space.

**Desktop:** the desktop pill nav at 768 and 1280 px, 200 % text, fits (632–724 px wide); no change was needed.

## 6. Shell reflow matrix

Measured on the production build in headless Chrome: page width against the intended width, header and nav controls beyond it, overlapping controls, labels outside their buttons, nav targets under 44 px, and nav scrolling.

| | 320 | 360 | 430 | 760 | 768 | 1280 |
|---|---|---|---|---|---|---|
| Normal, TH / EN | pass / pass | pass / pass | pass / pass | pass / pass | pass / pass | pass / pass |
| 200 % text, TH / EN | pass / pass | pass / pass | pass / pass | pass / pass | pass / pass | pass / pass |
| 200 % zoom, TH / EN | pass / see note | pass / pass | pass / pass | pass / pass | pass / pass | pass / pass |

Both the Learn home (with a profile, so with the nav) and Welcome (without) were checked in every cell: 72 shell cases.

**Note:** EN 320 px at 200 % zoom is a 160 CSS px layout. The shell passes, but the Learn home's featured cards are 3 px wider than the page ("Considered" is one unbreakable word). That is content, below WCAG 1.4.10's 320 CSS px reflow requirement.

## 7. Thai copy review

Every Thai string Learn shows was read in place:
- Learn Home, groups and topic rows;
- all seven topics at every level, and the takeaways;
- type-page labels, dimension names and bands;
- visual tags, labels and captions;
- the Back labels, and the Result, Palette and Checker links.

**The goal:** natural product Thai, not a translation. **The limit:** no change to domain meaning, subtype or palette truth, Checker limitations or lucky-colour meaning. No semantic ambiguity was found, so nothing needed escalating.

| Where | Before | After | Why |
|---|---|---|---|
| Home lede | …ช่วยให้**ใส่สีของคุณ**และใช้แอปได้คล่องขึ้น | …ช่วยให้คุณแต่งตัวด้วยสีที่เข้ากับตัวเอง และใช้แอปได้คล่องขึ้น | literal "wearing your colors" |
| General hero | …แล้วทำแบบทดสอบเมื่อพร้อม เพื่อดูสีของคุณเองในหน้านี้ | จะเริ่มจากพื้นฐานก่อนก็ได้ พร้อมเมื่อไรค่อยทำแบบทดสอบ แล้วสีของคุณจะแสดงในหน้านี้ | English clause order |
| What is PC · evidence | คนส่วนใหญ่มักจับคู่…ไปในทางเดียวกัน | ผู้คนมักเลือก…ให้เข้ากับสีผิวแต่ละแบบได้ค่อนข้างตรงกัน | awkward; "fairly consistently" kept |
| What is PC · systems | ชื่อที่เห็นจากที่อื่น | ชื่อไทป์ที่เห็นจากที่อื่น | clearer subject |
| What is PC · takeaway | เชื่อสิ่งที่คุณเห็นในกระจก | เชื่อสายตาตัวเองเวลาส่องกระจก | idiomatic |
| Value | สว่างหรือมืด | อ่อนหรือเข้ม | light-level words used for colour |
| Contrast | ส่วนที่สว่างที่สุด… | ส่วนที่อ่อนที่สุด… | same |
| Bands, not scores | …บนสเกลทั้ง 4 คู่มือนี้บอกตำแหน่งนั้นเป็นคำ | …บนสเกลทั้ง 4 ซึ่งคู่มือนี้บอกเป็นคำ | run-on read as "all four guides" |
| Dimensions · more | ช่วงสีของตัวคุณ | อันเดอร์โทนของผิว และความต่างของสีผิว ผม และดวงตา | vague; now says what the English says |
| 12 types · systems | ทรูแทนวอร์ม**และ**คูล | ทรูแทนวอร์ม**หรือ**คูล | matches "Warm or Cool" |
| Palette answer | อุปกรณ์ตกแต่ง | ชิ้นส่วนโลหะบนเสื้อผ้าหรือกระเป๋า | read as home décor; means hardware |
| Palette · placement | สีที่อยู่ใกล้ใบหน้ามีผลต่อการมองเห็นใบหน้ามากที่สุด | สีจะมีผลกับใบหน้ามากที่สุดเมื่ออยู่ใกล้ใบหน้า | literal |
| More Considered · listed only | เฉพาะสี…เท่านั้นที่นับเป็นกลุ่มนี้ | สีที่นับเป็นกลุ่มนี้มีเฉพาะสีที่อยู่ในรายการ… | word order |
| Placement label | ใส่ต่ำลงหรือในชิ้นเล็ก | ใส่ให้ต่ำลงหรือเป็นชิ้นเล็ก | grammar |
| Checker · manual | กำหนดสีที่ต้องการเช็กได้โดยตรง | คุณเลือกสีที่จะเช็กเอง | formal; now matches the English |
| Lucky · family | กลุ่มสี / …เป็นผู้กำหนด | **กลุ่มสีมงคล** / กำหนดตามความเชื่อสีมงคลประจำวันของไทย | Daily's own term; no personified "ผู้กำหนด" |

**Terminology audit (consistent, now test-pinned where stable):**
- **Names:** Personal Color (Latin, as the app); คู่มือ (nav) inside คู่มือสี (title, Back, Welcome); ไทป์ของคุณ (hero, marker, Result link); ลักษณะสี.
- **Palette groups:** สีที่เข้ากันที่สุด · สีกลาง · สีแต้ม · สีที่ต้องเลือกใช้สักนิด · สีโลหะ, exactly the Palette screen's titles, also inside the formula lines.
- **Dimensions:** อุณหภูมิสี · ความอ่อน-เข้ม · ความสด · ความตัดกัน.
- **Placement and Daily terms:** ใกล้ใบหน้า / ต่ำกว่าใบหน้า; กลุ่มสีมงคล · เฉด · ตำแหน่งที่ใส่, matching Daily's `familyLabel` and `storyShade`.

**Thai wrapping:** long type names used to break mid-syllable in the 12-type cards (ซอฟต์ออ/ทัมน์, เคลียร์วิน/เทอร์), and the "Your type" card clipped ซอฟต์ซัมเมอร์. §10 fixes both.

## 8. English copy review

Targeted pass over Learn wording, terminology, captions and browsed-type wording:
- **Changed:** the lucky family label, "Color family" → **"Lucky color family"**, which is Daily's own label.
- **Checked, no change needed:**
  - **Captions:** "The app sees only the photo…" and "An example of how Daily works, not today's lucky color" do not overclaim.
  - **More Considered:** the wording has no avoidance language.
  - **Formula:** "near your face" is placement advice for whoever wears it, not a claim about the reader's type.
- **Metal notes:** re-audited (§17).

The product's voice was not rewritten.

## 9. Lucky visual correction

The family step no longer shows five green tones. It shows **one round token split evenly into six hues, ringed as chosen**: "a family is chosen", without saying which, and favouring no hue.
- **Label and text:** the step's label ("Lucky color family" / "กลุ่มสีมงคล") and "The Thai daily tradition picks it." carry the meaning. The token is `aria-hidden`, so a screen reader hears only the words.
- **Steps 2 and 3:** unchanged, as the PO allowed. They still show how a family becomes one wearable shade and where it goes, in illustration tones.
- **No coupling:** no palette colour, date, weekday, goal, Daily import or colour-family data.

Tests pin that the family step has no tone chips, tone classes or inline colour, and that the token's CSS has at least six distinct hues in equal segments.

## 10. Visual polish

**Learn Home:** reviewed at 320–1280 px in both languages and modes. The hero, the two featured cards and the grouped rows read as an editorial page. No change was needed beyond the shell.

**4 seasons / 12 types:**
- **Thai names:** a Thai type name is a compound (ซอฟต์ + ซัมเมอร์). It is now rendered as its two parts, each kept whole, so the only wrap is between them. The rendered text and Chrome's accessible name are exactly the name; no `<wbr>` or added character is used, because a `<wbr>` made Chrome read "ซอฟต์ ซัมเมอร์". English names are untouched.
- **"Your type" marker in a card:** now a plain text line (the card keeps its stronger border), so it wraps like text instead of widening a narrow Thai card. The pill badge stays on the type page and in the legend.
- **Browser check:** all 12 Thai names at 320, 360 (normal and 200 %) and 430 (200 %). No part split, nothing wider than its card, and every name exact in Chrome's accessibility tree.

**Type page:** the rhythm reads as a lookbook: cover strip → name → qualities → scales → the palette groups in falling visual weight → metals → formula → action. The same Thai-name rule applies to its title. No accordions were added: no usability problem justified hiding the palette.

**Practical guides:** the four visuals share one frame, tag, caption and line weight (Slice 4). No other visual changed.

**Global text fixes found by the 200 % pass:**
- the Welcome "12" badge is sized in em, so its caption no longer spills;
- the Result title's minimum size is capped by the screen width (identical at normal text, 320–760 px), so "Clear Winter" fits the hero at 200 % text;
- palette swatch names wrap instead of being cut to "…". At normal text only one name ever wrapped: Cool Summer's น้ำตาลอมชมพูกุหลาบ at 430 and 1280 px, which was previously cut. It now shows in full.

## 11. Contrast audit

WCAG 2 contrast was computed for **2,017 text runs in 45 states**:
- **Learn pages:** Learn home, every topic with Level 3 open, and the user's type page, for four seasons in both languages;
- **Entry screens:** Result, Palette, and Checker › Photo;
- **General mode:** the general Learn home.

Each run's colour was composited over its real background stack.

| Element | Lowest ratio | Needs |
|---|---|---|
| Learn body and answer text | ≥ 5.71 | 4.5 |
| Secondary text (lede, notes, season summaries, group descriptions) | 5.71 | 4.5 |
| Visual tags and captions | 6.15 | 4.5 |
| Type-card secondary names | 6.25 | 4.5 |
| Active nav item (white on the season accent) | 4.91 | 4.5 |
| "Explore My Palette" | 4.91 | 4.5 |
| Result / Palette / Checker links into Learn | pass (fixed) | 4.5 |
| Focus ring `#197a78` against page / cream / white | 4.54 / 4.94 / 5.13 | 3 (non-text) |

- **Fixed:** the three links into Learn used the season accent, which for **Spring** is 4.34:1 on the page. They now use the season's darker `--accent-ink`, which passes in every season.
- **Result:** **0 failures on any Learn or V1.4 element.**
- **Not changed (pre-existing V1.0–V1.3):**
  - 30 runs on the Result hero's tinted panel (eyebrow, traits, match pill, summary);
  - the Spring accent on V1.x eyebrows, section numbers and "Retake quiz";
  - text drawn on a canonical swatch in the Palette selection tile.

  They are outside V1.4, and the swatch colours may not change. Recorded for a future pass.

## 12. Focus audit

Headless Chrome tabbed through seven surfaces: Welcome, the Learn home, the overview, the user's type page, Result, Palette and Checker › Photo. Each surface was checked for every stop.

- **Result:** every stop had a visible ring of at least 2 px, 0 missing. Controls covered:
  - bottom nav, the Welcome Learn and Daily links;
  - Learn rows and cards, the 12 type cards, "More detail" and Back;
  - the Result, Palette and Checker links, "Explore My Palette" and "Retake quiz".
- **Card-wide hit areas:** they draw the ring on the card (`:has(:focus-visible)`), the only places an outline is removed from a control.
- **Found and fixed (V1.2 styling):** the Color Checker's HEX input had `outline: none` with no replacement. Its field now draws the same ring as the photo picker.

A test pins the complete list of outline removals and their replacements.

## 13. Screen-reader audit

Chrome's computed accessibility tree was read for:
- the Learn home in both modes;
- the overview and a browsed type page (Deep Winter);
- the four practical topics and the dimensions topic.

Findings:
- **Headings:** one `h1` per page, then `h2` sections and `h3` items, with no skips. Group landmarks are named by their heading.
- **Decoration:** no drawing, swatch, scale track, token or cover strip is exposed. **0 exposed images, 0 unnamed buttons, 0 HEX values.**
- **Your type:** the marker reads "Soft Summer, Your type" inside the card's button name.
- **Palette groups:** each reads as its heading followed by a list of colour names.
- **Scales:** each position is its band in words ("Temperature — Leans warm").
- **Contextual links:** they read on their own ("Why can photo colors shift?", "How to wear More Considered colors", "Learn about your type"). Back names its destination ("Back to Color Guide", "Back to 4 seasons, 12 types").
- **Figures:** each is a figure whose words carry the lesson. No ARIA was added.

**Minor, unchanged:** English group headings are uppercase through CSS, and Chrome exposes them in capitals ("START HERE"). Screen readers read these as words.

## 14. Non-colour cues

| Place | Cue besides colour |
|---|---|
| Your type | the words "Your type" (card line, page and legend badge), plus a stronger card border |
| Dimension position | band text on every scale; the filled segment is also taller |
| Palette roles | named group headings and colour names; role labels in the placement list |
| More Considered comparison | captions "Near your face" / "Lower and smaller, with a Best color on top" and "The same color in both outfits…" |
| Lucky flow | numbered steps with labels; the chosen shade is described in words and also drawn larger with a ring |
| Nav current page | `aria-current` and a filled pill |

No lesson needs two hues told apart.

## 15. Touch targets

Measured in the browser at phone widths:

| Control | Size |
|---|---|
| Bottom nav, normal text | 52.8–74.8 × 57 |
| Bottom nav, wrapped | ≥ 58 × 48 |
| Learn rows | 320 × 96–118 |
| Featured cards | 320 × 171–193 |
| Type cards | 101 × 83–104 |
| Back | 164–193 × 44 |
| Contextual links | 48 px tall |
| "More detail" | 47 px |
| Hero and type-page actions | 53 px |

Nothing decorative was enlarged.

**Pre-existing and unchanged (not V1.4):**
- the header's Women/Men and TH/EN switchers are 32 px tall (above WCAG 2.2's 24 px minimum);
- the Quiz's image-zoom buttons are 36 px;
- Daily's source links are inline text links.

## 16. Contextual navigation and Back

Browser-tested at TH 320, EN 360 and EN 1280:

| Entry | Lands on | Focus | Scroll | Links on that screen |
|---|---|---|---|---|
| Result → "Learn about your type" | the user's type page, Guide current | `h1` | 0 | 1 |
| Palette › More Considered → "How to wear…" | More Considered topic | `h1` | 0 | 1 |
| Checker › Photo → "Why can photo colors shift?" | Color Checker topic | `h1` | 0 | Manual 0 / Photo 1 |
| Daily | — | — | — | 0 |

- **Links:** exactly three contextual entries exist, a test enforces the count, and none is dead or stale.
- **Back:** after a contextual entry, Back goes to the **Learn home**, focused on its `h1`. This is the documented simple contract; no cross-app history was built.
- **Phone / browser back:** it can still leave the app, because there is no URL history (plan Q3). This is not a V1.4 blocker.

## 17. Welcome ordering decision

**Fixed.** On phones the V1.3 Daily link had no `order` in Welcome's reordered layout, so it rendered alone above the eyebrow and title. That led the page with a secondary link, and it put the visual order out of step with the keyboard order: quiz → Daily → Guide.

The fix is one CSS line, presentation only: the Daily link takes the same slot as the Guide link. The order is now eyebrow → title → picture → lede → quiz → Daily → Guide → privacy note, on phones and desktop alike. Daily's behaviour is unchanged.

## 18. Responsive QA

**Core app:** Welcome, Quiz, Result, Palette, Checker, Daily and the Learn home, at 320, 360, 430, 768 and 1280 px, TH and EN (70 captures).
- **Horizontal overflow:** none on any screen.
- **Other flags:** pre-existing V1.0–V1.3 items only: the 32 px switchers, the 36 px quiz zoom buttons, Daily's inline links, and Daily's visually hidden "(opens in a new tab)" text, which the probe misreads as clipped.

**Learn:** the home, dimensions, overview and the four practical topics, at the five widths in alternating language and profile/general mode (35 captures). Also nine type pages: Light Spring, Clear Spring, Soft Summer, Deep Autumn, Deep Winter, Clear Winter, Warm Spring and Cool Summer (the longest Thai colour names) and Clear Winter TH.
- **Result:** 44 Learn captures, 0 issues: no overflow, clipping, HEX, raw ids, small targets or heading faults.
- **Clean run:** 0 console errors and 0 requests to other origins.

## 19. 200 % text and zoom QA

**At 200 % text, TH and EN at 360:** Welcome, Result, Palette, Checker, Daily, the Learn home, the overview, a type page and the four practical topics.
- **No horizontal overflow on any page.**
- **Learn:** 0 issues.
- **After the fixes in §10:** the Result title fits and swatch names wrap.

**At 200 % zoom (a 180 CSS px layout), TH and EN:**
- **Shell:** the header wraps and the nav is un-fixed at the end of the page.
- **Learn:** all Learn pages pass.
- **Pre-existing V1.0–V1.3 content that remains wider than 180 CSS px:**
  - the Result hero, whose fixed-size colour fan is wider than the column;
  - the Palette page heading and section heading (EN);
  - the Checker's HEX field (16 px wide);
  - Daily's goal chips (+2/+11 px).

  All are below WCAG 1.4.10's 320 CSS px requirement, and none comes from the shell.

## 20. All-12 audit

**In the browser**, all 12 types in TH and EN were opened from the overview and returned with Back (24 pages). Each page:
- had the correct title and season;
- had a summary and four band texts;
- had palette counts 8 / 5 / 5 / 4 / 2, and metal notes;
- had three named formula colours;
- had no HEX, raw ids or empty strings;
- had ordered headings and no overflow at 360.

**Result: 24/24.** The jsdom suites also re-check every colour against `getPalette` and every band against the canonical targets.

## 21. Content budget, boundaries, offline

- **Budgets:** the Slice 1 budget tests pass after the copy edits, with no new tokenizer. The Thai edits lengthened no topic past its budget; the longest topics are unchanged in structure.
- **Boundaries** (`boundaries.test.ts`, unchanged):
  - Learn imports only the palette, seasons and type modules, i18n and its own files;
  - the UI imports only React, the Learn barrel and types;
  - no classifier, scoring, colour naming, Daily, services, storage or network;
  - palettes and targets stay single-source.
- **Offline and privacy:**
  - no `fetch`, XHR, WebSocket, beacon, storage, analytics or location code in Learn;
  - the browser runs recorded **0 requests to other origins**;
  - the one new runtime call, a `ResizeObserver` in the nav, only measures layout.

## 22. Tests

`LearnRelease.test.tsx`, 30 tests:

| Section | What it pins |
|---|---|
| A. Shell reflow | Header and nav wrap, never scroll or clip; five-across at normal text, two per row otherwise; every nav target ≥ 44 px; un-fixed below 250 px; the page reserves the measured nav height and releases it on unmount; em-sized Welcome badge |
| B. Focus | The global ring; the exact list of outline removals, each with its replacement; the HEX-field ring |
| C. Lucky | The family step has no tone, tone class or inline colour; the token has ≥ 6 equal hues; the label is Daily's term (TH/EN) |
| D. Thai names | All 12: the parts kept whole, text unchanged; English untouched; card marker wraps as text |
| E. Welcome and links | Daily and Guide links follow the quiz button on phones; the Learn links use the darker ink |
| F. Terminology | Guide / Your type / palette groups / placement and Daily terms consistent (TH/EN); no light-level words in the Thai dimensions |

**Updated:** three existing Thai heading assertions now check the heading's text. jsdom reports no `display` for a span, so its accessible-name algorithm puts a space between the name's two parts. Chrome does not, as verified in its accessibility tree (§10).

## 23. Adversarial checks

26 mutations were applied one at a time, run against the `src/learn` tests (which include the App-level tests), then restored from the saved original. A hash of the sources afterwards matched exactly. **26/26 caught:**

| Mutation | Caught by |
|---|---|
| Header stops wrapping (overflow returns) | A header |
| Nav stops wrapping (Thai labels squeezed or clipped) | A nav |
| Wrapped nav target 36 px | A targets |
| Type-card focus ring removed | B |
| HEX-field focus ring removed | B |
| Garment SVG exposed as an image | Slice 4 decoration tests |
| "Your type" marker loses its words | Slice 3 marker tests |
| Lucky family back to green tones | C |
| Lucky token reduced to one hue | C |
| Checker caption claims true-colour recovery | Slice 4 honesty vocabulary |
| More Considered caption says "Avoid" | Slice 4 no-avoidance test |
| Browsed metal note says "your" | Slice 4 metal audit |
| A fourth contextual Learn link | "exactly three" |
| A P1 topic in the registry | registry and topic validation |
| Learn imports colour naming | boundaries |
| Learn imports Daily | boundaries |
| HEX on a palette chip | all-12 template |
| A Thai topic goes missing | parity |
| Invalid direct topic not validated | invalid-entry tests |
| Welcome Daily link back above the title | E |
| Thai type names unsplit | D |
| Learn links lose the darker ink | E |
| Nav height no longer reserved | A |
| Zoomed nav floats again | A |
| Thai copy reverts to สว่าง/มืด | F |
| Lucky label drifts from Daily's term | C |

Layout itself (widths, wrapping, targets) is guarded by the browser QA, which found and led to every fix in §4–§10.

## 24. Performance

| | Raw | Gzip |
|---|---|---|
| JS, Slice 4 | 470.02 kB | 138.54 kB |
| JS, Slice 5 | 470.98 kB | 138.84 kB |
| **JS delta** | **+0.96 kB** | **+0.30 kB** |
| CSS, Slice 4 | 64.04 kB | 13.83 kB |
| CSS, Slice 5 | 65.57 kB | 14.21 kB |
| **CSS delta** | **+1.53 kB** | **+0.38 kB** |

Well under the 5 kB gzip investigation threshold. No dependency.

## 25. Validation

- **`npm test`:** 54 files; **1,700 passed**, 1 known skip (Slice 4: 1,670; +30 new).
- **Exhaustive quiz audit:** 177,147 / 177,147.
- **`npm run build`:** passes.
- **`git diff --check`:** clean.
- **V1.2 / V1.3 regressions:** Color Checker, Photo Checker, Daily, lucky-colour, colour-naming, photo-colour and services suites: **31 files, 1,114 tests pass** (1 known skip). This includes the colour-naming guard and the lighting-note tests.
- **Frozen areas:** the domain, Photo Checker, Color Checker, Daily, services, i18n, package and native files have no diff.

## 26. Release-readiness matrix

| Feature | Status | Evidence | Known limitation |
|---|---|---|---|
| Learn discovery | PASS | Guide nav item (profile), Welcome link (no profile); nav tests; §16 | No-profile users have no bottom nav (V1.3 rule) |
| Learn Home | PASS | Profile and general modes, TH/EN, 320–1280; §18 | — |
| 7 P0 topics | PASS | Registry and parity tests; each opens and reads at L1–L3; §18 | — |
| 12 types | PASS | All-12 browser audit 24/24; all-12 jsdom template | — |
| Type personalisation | PASS | Marker, hero and end action tests; §13 | — |
| Dimension education | PASS | Bands recomputed from targets; band text; §13 | — |
| Palette education | PASS | Placement visual, all 12 × 2 (Slice 4) | — |
| More Considered | PASS | Listed-only, no-avoidance tests; mutation caught | — |
| Checker education | PASS | Honesty vocabulary; all tiles shifted | Tiles illustrate typical shifts, not a camera |
| Lucky education | PASS | §9; C tests; no Daily import | Shade and placement steps use one illustration hue family |
| 3 contextual entries | PASS | "Exactly three" test; §16 | Back returns to the Learn home; phone back can leave the app |
| TH/EN | PASS | Parity tests; §7–§8; terminology tests | Thai reviewed in-house, not by a separate native reviewer |
| Responsive | PASS | §18: 162 captures, Learn 0 issues | — |
| Large text | PASS | §4–§6, §19 | V1.x content at 180 CSS px zoom (§19) |
| Accessibility | PASS | §11–§15 | V1.x contrast items and 32 px header switchers (pre-existing) |
| Offline / privacy | PASS | Boundary tests; 0 external requests | — |
| Performance | PASS | +0.30 kB JS gzip | — |
| V1.2 regression | PASS | Checker / Photo / colour-naming suites unchanged and passing | — |
| V1.3 regression | PASS | Daily and lucky-colour suites passing; Daily logic untouched | Welcome Daily link moved in layout only (§17) |

## 27. Final V1.4 scope

**Shipped in V1.4:**
- the P0 Learn experience: the Learn home, 7 P0 topics, the 12-type overview and one data-driven type page for all 12 types;
- dimension scales and four practical visuals;
- the Guide nav item, the Welcome link and three contextual entries;
- TH/EN, and large-text reflow for the whole app shell.

**Deferred:**
- same name, different shade;
- nearby-type comparison;
- phone/browser history architecture;
- the V2 AI ideas.

**Dropped from V1.4:** Everyday Neutrals.

Also not built, by PO decision: an Open Daily button, and a "What is Personal Color?" illustration.

## 28. Known limitations

1. **Back:** after a contextual entry, Back goes to the Learn home. The phone or browser Back can leave the app (no URL history; plan Q3).
2. **Pre-existing V1.0–V1.3 items, not changed:**
   - contrast on the Result hero's tinted panel;
   - the Spring accent on V1.x eyebrows, section numbers and "Retake quiz";
   - text on a canonical swatch in the Palette selection tile;
   - the 32 px header switchers and 36 px quiz zoom buttons;
   - some V1.x content wider than a 180 CSS px (200 % zoom) layout.
3. **Lucky flow:** the shade and placement steps still use one illustration tone family, as the PO allowed. The family step no longer does.
4. **Screen readers:** English group headings are exposed in capitals (CSS uppercase).
5. **Thai review:** this pass was an in-house product review. A separate native reviewer before public launch is still worthwhile.
6. **Physical devices:** the Thai nav headroom at 320 px (Slice 2) and the large-text layouts have been verified in desktop Chrome emulation only, not yet on a physical Android device.

## 29. Deployment handoff (Vercel)

- **Build:** `npm run build` (`tsc -b && vite build`). Output: `dist/`. It is a static SPA with no environment variables, backend or API.
- **Routing:** there is no URL routing (views are state-based), so no rewrites are needed. The repository has no `vercel.json`; Vercel's Vite preset (build `npm run build`, output `dist`) fits.
- **Assets:** everything is served from `dist/` and `public/`. No runtime calls go to other origins.
- **Before deploying:** the PO decides the version number (still **1.1.0**) and tag. `main` is **7 commits ahead of `origin/main`** after this slice's commit; the user pushes.
- **Smoke test after deploy:**
  - Welcome → Guide;
  - quiz → Result → "Learn about your type";
  - Palette → More Considered link;
  - Checker › Photo link;
  - Daily;
  - TH/EN switch;
  - one page at 200 % text.
- **Not part of this handoff:** native / APK work.
