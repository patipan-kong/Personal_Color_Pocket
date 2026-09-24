# V1.4 Learn — Personal Color Guide: Product Plan

**Status:** Slice 0 (product, content and information architecture) and Slice 1 (content foundation, [V1_4_SLICE_1_CONTENT_FOUNDATION.md](V1_4_SLICE_1_CONTENT_FOUNDATION.md)) are complete. Slice 2 is next. No Learn UI exists yet.

**PO decisions after Slice 0:**
- **Q1:** Everyday Neutrals stays P1. Learn gets no access to the colour-naming module, its guard is unchanged, and neutral families are never inferred from colour names. Revisit only in Slice 4, if P0 is complete and there is a product reason; dropping the topic is acceptable.
- **Q2:** the navigation entry is decided in Slice 2, by testing the real 5-item bottom nav at 320 px in Thai against the header fallback. Slice 1 made no navigation decision.

**Entry:** `828b229` (V1.3 closed), after the pre-V1.4 maintenance commit `06c059f` "fix: reject invalid persisted personal color subtype".

**Research and sources:** [V1_4_LEARN_RESEARCH.md](V1_4_LEARN_RESEARCH.md). Source IDs L1–L12 below refer to that register.

## 1. Product goal

Learn answers one question: **what should a user learn that makes Personal Color Pocket more useful in real life?** It helps a user to:
1. understand their result;
2. recognise the four colour characteristics the app reasons with;
3. use their palette on real clothes (what goes near the face, what goes lower, neutrals, accents, harder colours);
4. understand why the app's features (Palette, Color Checker, Daily) recommend what they do.

It must be useful **after** the quiz (personalised) and **before** it (general, with an optional quiz link).

## 2. Non-goals

Learn is not:
- a colour-science textbook or an encyclopedia;
- a beauty magazine, fashion blog or SEO content;
- an astrology guide;
- an AI chatbot or stylist.

V1.4 has none of the following:
- new recommendations, matching rules, classifier changes or palette changes;
- search or bookmarks, or quizzes inside Learn;
- makeup, hair, body-shape, gendered or celebrity guidance;
- remote content, a CMS, backend, analytics, ads or native work.

## 3. Target user questions → where they are answered

| Question | Answered in |
|---|---|
| What is Personal Color? | `basics.what-is` |
| What are the four seasons? Why 12 types? | `types.overview` |
| Warm/Cool, Light/Deep, Soft/Clear, Contrast? | `basics.dimensions` |
| What colours work for each type? What does my type mean? | `types.detail` (template × 12) |
| What are neutrals? Accents? Metals? How do I use them for tops, bottoms and accessories? | `wear.palette` |
| What are harder colours? Can I never wear them? Where do I put them? | `wear.harder` |
| What about white, black, grey, beige and navy? | `wear.everyday-neutrals` (P1) |
| Why can the same colour name look different? | `wear.same-name` (P1) |
| Why does a photo look different from the garment? How does Color Checker work? | `app.color-checker` |
| How do Daily lucky colours relate to Personal Color? | `app.lucky` |

Eighteen questions map onto nine topics plus one data-driven subtype template, so no question needs its own article.

## 4. Repository data audit

| Dataset | Source | Represents | Kind | Safe for Learn? | Coupling notes |
|---|---|---|---|---|---|
| Subtype set and season membership | `src/domain/personalColor/seasons.ts` (`seasonDefinitions`, `subtypeOrder`) | 12 subtypes, each with a season and a 0–1 target on 4 dimensions | Domain truth | Yes, read-only | The targets are classifier geometry: display them only as coarse positions (§15), never as scores. Learn must never import `scoring.ts` or `diagnostics.ts`. |
| Types | `src/domain/personalColor/types.ts` | `Season`, `Subtype`, `DimensionKey`, `PersonalColorResult`, `PersonalColorPalette` | Domain truth | Yes | — |
| Palettes | `src/domain/personalColor/palettes.ts` (`getPalette`) | Per subtype: 8 Best, 5 Neutrals, 5 Accents, 4 Harder, 2 Metals (with note) | Domain truth (curated) | Yes: the core of subtype detail | Reference colours by palette **id**, never by copied HEX or name. |
| Palette display names TH/EN | `src/i18n/index.ts` `colorDisplayName`; `src/i18n/colors.ts` | Localised palette names (264/264 have complete Thai) and metal notes | Presentation copy | Yes | — |
| Subtype copy | `LocaleCopy.subtypes` in `src/i18n/{en,th}.ts` | Name, secondary name, 3 characteristic words, 1-line summary | Presentation copy | Yes: detail header | The words are presentation, not measurements. |
| Palette section meanings | `LocaleCopy.palette.sections` | What Best, Neutrals, Accents, "More Considered" (Harder) and Metals are for | Presentation guidance | Yes, reuse verbatim or reference | Keep one source of wording. |
| Harder tips | `LocaleCopy.palette.harderTips` | Away from the face, smaller area, pair with a best colour, "none are forbidden" | Presentation guidance | Yes: the backbone of `wear.harder` | — |
| Dimension reasons | `LocaleCopy.reasonText` | Sentences per dimension × high/low × strength | Presentation copy (result-specific) | Partly: wording reference only | Phrased as "your answers…"; not reusable as general teaching. |
| Quiz concepts and visuals | `quiz.ts`, `quizVisuals.ts`, `LocaleCopy.quizQuestions` | 11 observations (undertone, metal, white, earth, cool colours, hair, eyes, contrast, intensity, clarity, depth) | Domain + copy | Concepts only | Learn must not re-teach or re-score the quiz. |
| Style guide / outfit combinations | `src/domain/personalColor/styleGuide.ts` | Per subtype × presentation: clothing categories and outfit combinations using the subtype's own palette colours | Presentation guidance | Link, don't duplicate | It is presentation-specific (women/men); Learn stays neutral and links to Palette → Examples. |
| Style example images | `styleExampleAssets.ts`, `public/img/personal-color/*` | Per-subtype outfit mood images | Presentation asset | Link only | They are gendered presentation assets; Learn does not embed them. |
| Result disclaimer | `LocaleCopy.result.disclaimer` | "guided estimate … not a diagnosis" | Presentation copy | Yes: sets the Learn tone | — |
| Placement vocabulary | `src/domain/photoColor/placement.ts` | Areas: near-face, larger pieces, base, layers, below-face, accents | Domain (V1.2) | Vocabulary only | Learn explains the idea; it does not run the placement table. |
| Photo lighting guidance | `photoColor/lightingGuidance.ts`, `LocaleCopy.photoChecker.captureTip / lightingNote / caveat` | Light near-neutral colours shift most; tips for even lighting | Domain + copy | Yes | — |
| Structured colour names | `src/domain/colorNames/colorNames.ts` | HEX → coarse family + light/deep, warm/cool, soft/bright modifiers (TH/EN) | Domain (V1.2) | **Guarded:** only `ColorResultCard.tsx` and the audit may import it (`colorNamesIntegration.test.tsx`) | Any Learn use needs a PO-approved guard change (§33, Q1). |
| Lucky-colour model | `src/domain/luckyColor/*`, `LocaleCopy.daily.framing / aboutBody / storyFamily / storyShade` | Lucky family from the Thai daily rule; Personal Color picks shade and placement | Domain + copy (V1.3, frozen) | Yes, copy reuse | Do not import Daily UI; do not restate the table. |

**Conclusion:** the existing data is sufficient to support P0 truthfully. No new palette, rule or colour is needed.

## 5. The current Personal Color model (verified in code)

**Four dimensions**, each normalised 0–1 (`DimensionKey`):

| Dimension | 0 means | 1 means | Colour-science term |
|---|---|---|---|
| `temperature` | cool (blue-based) | warm (golden) | undertone / hue temperature |
| `value` | deep | light | value / lightness (L7) |
| `chroma` | soft (muted) | clear (saturated) | chroma (L7) |
| `contrast` | low (blended) | high (distinct) | light-to-dark contrast in a person's colouring |

**Classification:**
- The quiz produces a dimension vector.
- `classify` picks the subtype whose target is nearest by weighted distance (temperature 1, value 0.5, chroma 1.05, contrast 0.85).
- The runners-up become `alternatives`.
- Confidence is shown as a label.

**12 subtypes in 4 seasons**, taken from `seasonDefinitions`. The names come from `LocaleCopy.subtypes`.

| Season | Subtypes (id → EN / TH) | Target ranges |
|---|---|---|
| Spring | `light-spring` Light Spring / ไลต์สปริง · `warm-spring` Warm Spring / วอร์มสปริง · `clear-spring` Clear Spring / เคลียร์สปริง | temperature .66–.94 (warm), chroma .62–.94 (clearer), value .57–.88 (lighter–medium) |
| Summer | `light-summer` Light Summer / ไลต์ซัมเมอร์ · `cool-summer` Cool Summer / คูลซัมเมอร์ · `soft-summer` Soft Summer / ซอฟต์ซัมเมอร์ | temperature .08–.31 (cool), chroma .14–.46 (softer), value .53–.88, contrast .22–.42 (low) |
| Autumn | `soft-autumn` Soft Autumn / ซอฟต์ออทัมน์ · `warm-autumn` Warm Autumn / วอร์มออทัมน์ · `deep-autumn` Deep Autumn / ดีปออทัมน์ | temperature .70–.94 (warm), chroma .13–.43 (softer), value .10–.45 (deeper) |
| Winter | `deep-winter` Deep Winter / ดีปวินเทอร์ · `cool-winter` Cool Winter / คูลวินเทอร์ · `clear-winter` Clear Winter / เคลียร์วินเทอร์ | temperature .05–.32 (cool), chroma .70–.97 (clear), value .06–.40 (deeper), contrast .78–.94 (high) |

Each subtype is named for its season plus its most defining quality: Light, Warm, Clear, Cool, Soft or Deep. The generic four-season summaries (Spring warm/light/clear; Summer cool/light/soft; Autumn warm/deep/soft; Winter cool/deep/clear) are **consistent with the app's data**. Learn may state them with the ranges' nuance:
- Summer and Spring run from light to medium, not only light;
- Clear Spring and Clear Winter sit close to neutral temperature.

Thai names are transliterations (for example ซอฟต์ซัมเมอร์), with the English name as `secondaryName`. **The app's model is a tonal-style 12-type system**, not Sci\ART naming and not the Korean tone system (research §3). Learn must not rename types.

## 6. Research methodology

See research §1: repository truth first, then primary or academic sources for general claims, with commercial pages used only to observe naming differences.

## 7. External source register

See the research register, L1–L12. The summary of use:

| Purpose | Sources |
|---|---|
| History | L1, L2, L3 |
| Systems differ | L4, L5, L6 |
| Colour vocabulary | L7 |
| Context changes appearance | L8 |
| Photo and lighting | L9, L10, plus the internal V1.2 Slice 5E/5F records |
| Evidence and humility | L11, L12, L5 |

## 8. Content principles

1. **Answer first:** Level 1 is the practical answer, readable in about 10 seconds.
2. **Show, then tell:** a swatch, scale or garment visual carries the concept, and the text is short.
3. **Every topic ends with a takeaway:** one "Try this" line the user can act on.
4. **App truth is referenced, not copied:** colours by palette id, and existing wording reused by key.
5. **Personalise where it adds meaning:** show the user's own colours, but every topic reads correctly without a profile.
6. **One template, twelve types:** subtype detail is data-driven; no hand-written subtype essays.
7. **Colour characteristics, never personality.**

## 9. Tone and claim boundaries

- **Terminology follows the visible app, not internal ids.** The `harder` group is shown to users as **"More Considered" / "สีที่ต้องเลือกใช้สักนิด"** (`palette.sections.harder.title`), and Learn uses exactly that label. "Harder" in this plan is the internal id only. The same goes for Best Colors, Neutrals, Accent Colors and Metals.

- **Voice:** friendly, calm, practical, and consistent with the existing result disclaimer ("a guided estimate … not a diagnosis").
- **Scoped phrasing:** "In Personal Color Pocket…", "Within this system…", "These shades are often used to…", "tends to", "usually".
- **Never claimed:** objective attractiveness, personality, diagnosis or scientific precision, exact cross-system equivalence, recovery of true photo colour, or supernatural effect (research §4).
- **Harder colours:** always framed as "take more thought", never "avoid" or "forbidden". This is existing copy.
- **Other systems:** acknowledged once in `basics.what-is` Level 3 and once in `types.overview` Level 3.

## 10. Information architecture

**Hypothesis simplified:** the proposed ten top-level sections become **three groups on one Learn home**. Seasons fold into the types overview, metals fold into palette use and subtype detail, and "Your Personal Color" becomes the personalised hero plus subtype detail.

```text
Learn home
├─ Your type (personalised hero) ─────────────► types.detail[your subtype]
│   or "Find your type" (no profile) ─────────► quiz (optional)
├─ Colour basics
│   ├─ basics.what-is        What is Personal Color?
│   ├─ basics.dimensions     The 4 colour dimensions
│   └─ types.overview        4 seasons, 12 types ──► types.detail[any subtype]
├─ Wearing colour
│   ├─ wear.palette          Using your palette (best · neutrals · accents · metals · placement)
│   ├─ wear.harder           Harder colours aren't forbidden
│   ├─ wear.everyday-neutrals  (P1)
│   └─ wear.same-name          (P1)
└─ Using the app
    ├─ app.color-checker     Checking a colour (manual vs photo, lighting limits)
    └─ app.lucky             Lucky colours + Personal Color
```

**Depth model:** each topic uses the same three levels.
1. **Level 1:** the answer, visible at once.
2. **Level 2:** "Why it works", visible below.
3. **Level 3:** "More detail", a native `<details>` that is collapsed by default.

There are no nested topic pages beyond `types.detail`.

## 11. Learn landing architecture

**With a profile:**
1. **Hero:** "Your type: Soft Summer", with the 3 characteristic words, a strip of 5 of the user's Best swatches, and a primary link "Learn about your type".
2. **Start here:** two featured cards chosen for usefulness, `wear.palette` and `wear.harder`, each personalised with the user's colours.
3. **Colour basics:** a compact list of 3 topics.
4. **Using the app:** a compact list of 2 topics.

**Without a profile:**
1. **Hero:** "Find the colours that suit you". Two lines, with a secondary quiz link that is optional and never blocks.
2. **Start here:** `basics.what-is` and `types.overview`.
3. The remaining groups, identical to the profile case.

**Layout rule:** at most two visually featured cards; everything else is a titled list row with a one-line answer. This avoids a wall of identical cards. The landing copy stays at or under 60 words, excluding titles.

## 12. Personalised Learn

**Source:** the current `result.subtype` from app state, already validated at the persistence boundary by `06c059f`. There is no separate Learn profile.

**What personalises:**
- the hero;
- the "Your type" badge on the user's card in `types.overview`;
- in `wear.palette` and `wear.harder`, examples drawn from the user's own `getPalette(subtype)` groups;
- in `basics.dimensions`, a marker showing where the user's **type** sits on each scale, from the subtype target;
- in `app.color-checker`, a link straight to the checker (it needs a profile).

**Decision: show the type's position, not the user's raw quiz scores.** The raw scores (`result.dimensions`) invite false precision and are not shown today. The markers come from the subtype target, banded (§15).

**No profile:** generic examples come from named palette ids across types. Each topic reads completely; the only call to action is an optional quiz link on the hero and in `types.detail`.

**Removing or retaking the profile** updates Learn immediately (it is derived state, as in Daily).

## 13. Season content model

**Decision: no separate season pages.** The app has no season-level palettes (palettes are per subtype), so a season page would need invented season colours. Seasons appear as the four group headings inside `types.overview`, each with:
- a one-line characteristic summary consistent with §5 (for example, Summer: "Cool, softer colours, from light to medium depth");
- a 3-swatch sample, taken from the first Best colour of each of its subtypes;
- its three subtype cards.

## 14. Subtype content model (one template, data-driven)

`types.detail[subtype]` contains, in this order:

| Section | Source | Kind |
|---|---|---|
| Name (TH/EN), secondary name, season | `LocaleCopy.subtypes`, `seasonDefinitions` | A + B |
| 3 characteristic words and 1-line summary | `LocaleCopy.subtypes` | B |
| "Where this type sits": 4 banded scales | `seasonDefinitions[subtype].target` → bands (§15) | A, derived |
| Best colours (8) | `getPalette().best` + `colorDisplayName` | A |
| Neutrals (5), with the existing section description | `getPalette().neutrals`, `palette.sections.neutrals` | A + B |
| Accents (5) | `getPalette().accents` | A |
| Harder (4), with the existing "not forbidden" framing and harder tips | `getPalette().harder`, `palette.harderTips` | A + B |
| Metals (2), with notes | `getPalette().metals`, `translateMetalNoteThai` | A |
| One simple outfit formula: "Best near your face · a Neutral as the base · an Accent in a small piece" | Product-authored pattern filled with this type's palette ids (the first of each group) | D over A |
| Nearby types | `alternatives`-style neighbours: the 2 nearest targets, same weights (P1) | A, derived |
| Link: "See outfit examples" → Palette › Examples (profile owner only) | Existing view | — |

- **Prose limit:** 80 words per subtype, beyond the existing copy. No personality language.
- **Colour characteristics** are shown through bands and swatches, not adjectives about the person.

## 15. Colour-dimension education (`basics.dimensions`)

- **Four horizontal scales:** Warm ↔ Cool, Light ↔ Deep, Clear ↔ Soft, High ↔ Low contrast.
- **Endpoint swatches** come from real palette ids, for example a warm Best colour against a cool Best colour of similar depth. The chosen ids are fixed in content, with a test that they exist.
- **One sentence per scale,** using L7 vocabulary:
  - value = how light or dark;
  - chroma = how vivid or muted, where grey is zero chroma;
  - temperature = golden or blue-based;
  - contrast = how different the lightest and darkest parts are.
- **Band mapping,** product-authored and frozen here, for target t on the 0–1 scale:

  | t | Band |
  |---|---|
  | ≤ .20 | strongly toward the 0 end |
  | ≤ .40 | leans toward the 0 end |
  | < .60 | in between |
  | < .80 | leans toward the 1 end |
  | otherwise | strongly toward the 1 end |

  Examples: Clear Spring temperature .66 → "leans warm"; Clear Winter temperature .32 → "leans cool"; Soft Summer chroma .14 → "strongly soft".
- **Text equivalent:** the band is always written as text, for example "Temperature: leans cool". It never uses numbers.
- **No interactive tools,** simulators or classifiers.

## 16. Practical outfit and colour education (`wear.palette`)

1. **Level 1:** "Put your Best colours near your face, build with Neutrals, add Accents in smaller doses." Shown with a simple SVG flat-lay (§20): top = Best, bottom = Neutral, small accessory = Accent.
2. **Level 2:** the purpose of each group, reusing `palette.sections.*.description`. Metals echo the palette's overall temperature and clarity (existing copy).
3. **Level 3:** the near-face / below-face idea. Tops, collars and scarves sit near the face; bottoms, shoes and bags sit away from it. It uses the V1.2 placement vocabulary as concepts only.
4. **Takeaway:** "Pick one Best colour for your top today."

## 17. Harder-colour education (`wear.harder`)

**Core message:** "Harder doesn't mean forbidden." This is existing copy (`palette.sections.harder.description`, `harderTips[3]`).

Four practical moves, the existing `harderTips` in order:
1. keep it away from the face;
2. use a smaller area;
3. pair it with a Best colour;
4. none are forbidden.

- **Visual:** the same outfit twice, first with the harder colour as the top and then as the bottom or bag, with a Best colour near the face.
- **Personalised:** the user's own 4 Harder swatches, labelled with their names.

The rule stays that **only listed Harder colours are harder**; an absent colour is "not in your palette", never "harder". There are no new matching rules.

## 18. Color Checker education (`app.color-checker`)

- **Level 1:** "Manual check compares a colour you enter with your palette; Photo check reads the colour from a photo." Both give the same kind of answer: how well the colour suits you and where to wear it (V1.2 Slice 5d).
- **Level 2 (honest photo limits):**
  - the camera records light, not paint (L9);
  - it guesses the lighting with white balance (L10);
  - shade, glare, exposure and nearby colours change the result (L8; V1.2 Slice 5E);
  - **very light, low-colour garments** (white, cream, pale grey) are the most affected (V1.2 Slice 5F).
- **Tips** reuse `photoChecker.captureTip`.
- **Must not claim:** that the checker recovers the garment's real or base colour, or corrects lighting. AI colour estimation is V2.
- **Takeaway:** "If a photo result looks off, try another evenly lit spot, or enter the colour manually."

## 19. Daily lucky-colour education (`app.lucky`)

**One short topic,** about 120 words:
- The **lucky colour family** comes from a Thai daily tradition for the chosen goal.
- **Personal Color** helps choose the **shade** and **where to wear it**. It never changes the family.
- Combining two goals in one outfit is **the app's** feature, not the tradition's.

Sources: reuse V1.3 frozen wording (`daily.framing`, `storyFamily`, `storyShade`, `aboutBody`) and link to Daily. There is no weekday table, no belief claims, no duplicated Daily UI and no astrology content.

## 20. Visual education strategy

| Concept | Visual | Implementation |
|---|---|---|
| Warm vs cool, light vs deep, soft vs clear | Paired swatches plus a scale with a marker | CSS swatches from palette ids; a CSS gradient bar |
| Contrast | Two three-swatch stacks (blended vs distinct) | CSS swatches from palette ids |
| Seasons and 12 types | 4 groups × 3 cards, each card with a 3-swatch strip | CSS |
| Neutral + accent, near-face vs below-face | A small flat-lay: top, bottom, accessory | Simple inline SVG shapes, Learn-local, neutral (non-gendered) silhouettes |
| Harder colour placement | The same flat-lay, with the harder colour moved lower | Same SVG |
| Same family, different shade (P1) | 3–4 swatches of one family from different palettes | CSS swatches from palette ids |
| Photo lighting | The same swatch under a warm tint, a cool tint and shade | A CSS overlay on one palette swatch, labelled "illustration" |

- **Excluded:** AI images, generated faces, photos and external image dependencies.
- **Reuse:** the V1.3 `GarmentArt` may be reused only as-is (import, never modify). If it doesn't fit, use a Learn-local SVG.

## 21. Navigation and discoverability

**Current state** (`src/App.tsx`):
- views are switched by state, with no router;
- the bottom nav (Daily · Colors · Palette · Checker) appears only with a result;
- without a result, the welcome page offers the quiz and a Daily text link.

**Recommendation:**
1. **Bottom nav, 5th item "Guide / คู่มือ"** for profile users, after Checker. Gate: it must fit at 320 px in Thai, with 44 px targets. If not, fall back to a header entry (open question Q3).
2. **Welcome page:** a secondary text link under the Daily link, for no-profile users.
3. **Exactly three contextual links**, each landing on a specific topic:
   - Result → "What does my type mean?" → `types.detail[subtype]`;
   - Palette › Harder section → `wear.harder`;
   - Checker photo caveat / lighting note → `app.color-checker`.
4. **No new link on Daily** in V1.4; its About section already explains. If added later, it is P1.

**Learn-internal navigation:**
- a `view: 'learn'` with its own `{ topic, subtype? }` state;
- a visible Back button on topic pages, since there's no URL history;
- a contextual link opens Learn at a target, and Back returns to Learn home.

Learn adds no ad placements: `adService` hooks stay as they are, and ads are V1.5.

## 22. Content storage architecture

| Option | Verdict |
|---|---|
| **Typed TypeScript content objects** (per locale) | **Chosen.** Type-checked, TH/EN parity enforced by types and tests, can reference palette ids and existing copy keys, no dependency, tree-shaken with the app. |
| Structured JSON | Loses types and cross-references; no benefit here. |
| Markdown (+ parser) | Needs a dependency or a hand-written parser; free-form prose invites bloat and makes id references and swatch blocks awkward. Rejected. |
| CMS / remote | Out of scope (§2). |

**Proposed shape (Slice 1):**
- **`src/learn/types.ts`:**
  - `LearnTopicId`;
  - `LearnBlock` = a union of `text` | `list` | `takeaway` | `swatches { paletteIds }` | `visual { visualId }` | `reuse { copyKey }`;
  - `LearnTopic { id, title, answer (L1), why (L2 blocks), more? (L3 blocks) }`;
  - `LearnCopy`.
- **`src/learn/content/en.ts`, `th.ts`:** `LearnCopy` objects.
- **`src/learn/model.ts`:** pure derivations, namely `dimensionBand`, `subtypeGuide(subtype)` built from `getPalette`, `seasonDefinitions` and existing copy, and season groupings.
- **`src/learn/index.ts`:** `getLearnCopy(language)`.

**Bundle:** Learn text is estimated at 25–40 kB raw for TH+EN (gzip much less). Slice 1 measures it. Only if the gzip delta exceeds about 30 kB is Learn lazy-loaded with `React.lazy` (built in, no dependency).

## 23. Localisation architecture

- The current `LocaleCopy` (one typed object per locale) scales for screen copy. Learn would roughly double it, so **Learn gets its own typed `LearnCopy`** in `src/learn/content/`, returned alongside `getCopy`.
- Only a few Learn entry strings (the nav label, the welcome link and the three contextual link labels) are added to `LocaleCopy`, because they live on existing screens.
- There is no global i18n rewrite. Thai and English are first-class, with parity enforced by the `LearnCopy` type plus a runtime test for non-empty strings and budgets. Thai copy uses Thai sentence style (no full stops, as in V1.3 Slice 6), and allowed English terms are listed: "Personal Color", `secondaryName`.

## 24. Accessibility plan

- **Headings:** one `h1` per Learn page; topics use `h2` for the levels and `h3` inside. The landing groups are `h2`.
- **Controls:**
  - topic rows are real links or buttons with descriptive names (no "Read more");
  - Level 3 uses native `<details>`/`<summary>` with a 44 px target and a focus ring;
  - Back is a real button.
- **Swatches:** every swatch has a visible or accessible name (palette display name). Meaning is never carried by colour alone: groups are labelled "Best", "Harder" and so on.
- **Diagrams:** each scale has a text equivalent ("Temperature: leans cool"). SVG flat-lays are `aria-hidden`, with a text caption listing each piece and its colour.
- **Reading and motion:**
  - line length ≤ ~65ch on desktop;
  - reflow at 200% text with no horizontal scroll, re-using the V1.3 em-based container-query approach where needed;
  - reduced motion respected, and no content revealed on hover only.
- **Language:** TH/EN wrapping is checked at 320–430 px, with long Thai words in headings allowed to wrap.

## 25. Content depth budget

| Unit | Budget (EN words; TH equivalent in meaning) |
|---|---|
| Learn landing copy (excluding titles) | ≤ 60 |
| Topic row one-line answer | ≤ 20 |
| Topic Level 1 answer | 1–3 sentences, ≤ 45 |
| Topic Levels 1 + 2 (visible) | ≤ 250 |
| Topic total including Level 3 | ≤ 400 |
| Subtype detail, new prose | ≤ 80 (everything else is data) |
| Takeaway | 1 sentence, ≤ 20 |

Budgets are enforced by a Slice 1 test that counts EN words and applies a TH character proxy.

## 26. Truth and ownership matrix

Truth sources:
- **A:** existing domain truth.
- **B:** existing presentation guidance.
- **C:** external educational source.
- **D:** product-authored explanation.
- **E:** a combination.

| Content | Truth | Owner / reference |
|---|---|---|
| Subtype list, season membership, dimension targets | A | `seasons.ts` |
| Subtype palettes, metals and notes | A | `palettes.ts`, `i18n/colors.ts` |
| Subtype names, characteristics, summaries | B | `LocaleCopy.subtypes` |
| Palette group meanings, harder tips | B | `LocaleCopy.palette` |
| Dimension bands and wording | E (A targets + D bands + C L7 vocabulary) | This plan §15 |
| What is Personal Color / history / systems differ | E (C L1–L6, L11, L12 + D) | Research register |
| 4-season summaries | E (A ranges + C L2 + D) | §5, §13 |
| Outfit formula, near/below face | E (B placement vocabulary + D) | §16 |
| Harder colours | B + D | §17 |
| Photo / checker limits | E (A V1.2 behaviour + B copy + C L8–L10 + D) | §18 |
| Lucky + Personal Color | E (A V1.3 domain + B V1.3 copy + D) | §19 |
| Everyday neutrals (P1) | A (palette membership) + D; classification needs PO approval | §33 Q1 |
| Same name, different shade (P1) | E (A palettes + C L8 + D) | — |

**Rule:** a Learn string may not state a colour fact that is not traceable to column A or B, and may not state a general claim that is not traceable to a research source or marked as product explanation (D).

## 27. Reuse matrix

| Topic | Existing module / data | Reuse directly | Derive presentation | New authored | External research |
|---|---|---|---|---|---|
| `basics.what-is` | `result.disclaimer` | Disclaimer tone | — | ~150 words | L1–L6, L11, L12 |
| `basics.dimensions` | `seasonDefinitions`, palettes | Swatch ids | Bands, markers | ~200 words | L7 |
| `types.overview` | `seasonDefinitions`, `subtypes` copy, palettes | Names, summaries | Season groups, swatch strips | 4 season lines + intro | L2, L3 (history only) |
| `types.detail` ×12 | palettes, subtypes copy, sections, harderTips, metals | All groups, notes, tips | Bands, formula fill, neighbours (P1) | Template labels (≤ 80 words) | — |
| `wear.palette` | `palette.sections`, placement vocabulary, palettes | Section descriptions | Personal examples | ~200 words | — |
| `wear.harder` | `palette.sections.harder`, `harderTips`, palettes | Tips, framing | Personal harder swatches | ~120 words | — |
| `wear.everyday-neutrals` (P1) | palettes (+ colorNames, guarded) | Swatches | Family lookup (needs approval) | ~150 words | — |
| `wear.same-name` (P1) | palettes | Swatches | Cross-type family strips | ~120 words | L8 |
| `app.color-checker` | `photoChecker.captureTip / lightingNote / caveat`, V1.2 5E/5F | Tips, note | — | ~200 words | L8, L9, L10 |
| `app.lucky` | `daily.framing / storyFamily / storyShade / aboutBody` | Wording | — | ~60 words | V1.3 Slice 0 record |

## 28. Final content inventory

Where a column below says "Yes", the topic is personalised with a profile, and every topic works without one.

| ID | TH title | EN title | Purpose / user question | Depth | Personalised | Data dependencies | External source | Visual | Priority |
|---|---|---|---|---|---|---|---|---|---|
| `home` | คู่มือสี | Color Guide | Where do I start? | ≤ 60 words | Yes (hero) | result, subtypes copy, palettes | — | Hero swatch strip | P0 |
| `basics.what-is` | Personal Color คืออะไร | What is Personal Color? | What is it, how reliable, why other apps differ | L1–L3 | No | disclaimer | L1–L6, L11, L12 | 4 season swatch strips | P0 |
| `basics.dimensions` | 4 มิติของสี | The 4 color dimensions | Warm/Cool, Light/Deep, Soft/Clear, Contrast | L1–L3 | Yes (type markers) | seasonDefinitions, palettes | L7 | 4 scales + swatches | P0 |
| `types.overview` | 4 ฤดู 12 ไทป์ | 4 seasons, 12 types | What are the seasons, why 12 | L1–L2 | Yes (your type badge) | seasonDefinitions, subtypes, palettes | L2, L3 | 4 × 3 grid | P0 |
| `types.detail` | {ชื่อไทป์} | {Type name} | What does my or another type mean; which colours | Template | Yes (default: yours) | palettes, subtypes, sections, harderTips, metals | — | Scales, swatch groups, formula | P0 |
| `wear.palette` | ใช้พาเลตต์ให้เป็น | Using your palette | Neutrals, accents, metals; tops, bottoms, accessories | L1–L3 | Yes | sections, palettes, placement vocabulary | — | Flat-lay SVG | P0 |
| `wear.harder` | สีที่ต้องเลือกใช้สักนิด ไม่ใช่สีต้องห้าม | More considered colors aren't off-limits | Can I wear them? Where? | L1–L2 | Yes | harder, harderTips | — | Flat-lay, moved lower | P0 |
| `app.color-checker` | ใช้ Color Checker ให้ได้ผล | Getting the most from Color Checker | How it works; why photos differ | L1–L3 | Yes (link to checker) | photoChecker copy, V1.2 behaviour | L8–L10 | Lighting-tint illustration | P0 |
| `app.lucky` | สีมงคลกับ Personal Color | Lucky colors and Personal Color | How Daily combines them | L1 (+L2) | No | V1.3 copy | V1.3 record | None (text + link) | P0 |
| `wear.everyday-neutrals` | ขาว ดำ เทา เบจ และกรมท่า | White, black, gray, beige and navy | Which versions suit my type | L1–L2 | Yes | palettes (+ guarded colorNames) | — | Per-type neutral strip | P1 |
| `wear.same-name` | ชื่อสีเดียวกัน แต่คนละเฉด | Same color name, different shades | Why "navy" or "pink" differ | L1–L2 | Yes | palettes | L8 | Cross-type family strip | P1 |
| `types.detail` neighbours | ไทป์ที่ใกล้เคียง | Nearby types | How is my type different from a close one | Section | Yes | seasonDefinitions | — | Mini comparison | P1 |

Thai titles are drafts and need native review (Q4).

## 29. P0 / P1 / deferred

**P0 (V1.4 must ship):**
- `home`;
- `basics.what-is`, `basics.dimensions`;
- `types.overview`, `types.detail` ×12;
- `wear.palette`, `wear.harder`;
- `app.color-checker`, `app.lucky`;
- navigation (bottom nav or header, welcome link) and the 3 contextual links.

**P1 (ship in V1.4 only if P0 is done and QA'd):** `wear.everyday-neutrals` (Q1 decided: no colour-naming access; Slice 4 at the earliest, or dropped), `wear.same-name`, nearby-type comparison.

**Deferred beyond V1.4:**
- search, bookmarks and saved articles;
- quizzes inside Learn;
- an interactive colour simulator, camera lessons, an AI stylist or chatbot;
- a wardrobe builder;
- makeup and hair guidance, body-shape styling, gender-specific guides, celebrity examples;
- a cross-system mapping table, a season-level palette;
- remote content, visual polish beyond the existing design language, ads (V1.5), native work.

## 30. V1.4 MVP definition

V1.4 is done when:
- Learn is reachable with and without a profile;
- the landing is personalised when a profile exists;
- all P0 topics exist in TH and EN within budget;
- every subtype has a data-driven detail page whose colours equal `getPalette` exactly;
- every colour fact traces to domain or copy truth, and every general claim to the research register;
- the three contextual links work;
- accessibility (§24) and large-text reflow pass;
- there is no network, dependency, AI, ads or native change, and no classifier, palette, V1.2 or V1.3 behaviour change.

## 31. Proposed slice plan

The starting hypothesis had 7 slices. Checker and Daily education are merged into the practical-guides slice, because each is one short topic plus a link. That leaves **6 slices**:

| Slice | Scope |
|---|---|
| 1 | **Content foundation:** `src/learn/` types, model derivations (bands, subtype guide, season groups), TH/EN `LearnCopy` for all P0 concept topics, truth, parity and budget tests. **No UI.** |
| 2 | **Learn home + navigation:** `view: 'learn'`, the landing (personalised and general), topic page shell (L1/L2/L3), Back, bottom-nav or header entry, welcome link; renders `basics.*` and `app.lucky`. |
| 3 | **Types:** `types.overview`, the `types.detail` template × 12, dimension scales and swatch components, the Result → "your type" contextual link. |
| 4 | **Practical and app guides:** `wear.palette`, `wear.harder` (flat-lay SVG), `app.color-checker` (lighting illustration), the Palette and Checker contextual links; P1 topics if approved and time allows. |
| 5 | **Polish, accessibility and content QA:** TH/EN copy review pass, large-text reflow, contrast, screen-reader semantics, budget audit, browser QA matrix. |
| 6 | **Hardening and closure:** independent audit, regression, bundle, privacy, docs. |

## 32. Implementation-readiness contracts

The following hold for every V1.4 slice:
- **Frozen:** V1.2 behaviour, the quiz, scoring and classifier, palettes, colour names (and the import guard), photo pipeline, the V1.3 domain and Daily UI, and the persistence format.
- **Scope:** no dependency, network, AI, ads or native changes.
- **Commits:** one per slice; no push, deploy, tag or version bump unless the PO says so.

| Slice | Likely production files | New structures | Tests required | Visual QA | Research dependency | Stop if |
|---|---|---|---|---|---|---|
| 1 | new `src/learn/{types,model,index}.ts`, `src/learn/content/{en,th}.ts` | `LearnCopy`, `LearnTopic`, `LearnBlock`, `dimensionBand`, `subtypeGuide` | parity; budgets; palette ids exist; no HEX literals in content; `subtypeGuide` equals `getPalette` for all 12; bands for all 12 × 4; Learn never imports scoring/diagnostics/colorNames; TH style checks | None | L1–L12 already registered | content would need a colour fact not in A/B; a dependency is needed |
| 2 | `src/App.tsx` (View union, nav, welcome link), new `src/learn/LearnView.tsx`, `styles.css`, `i18n/{types,en,th}.ts` (entry keys only) | Learn view state | nav with and without profile; Back; profile removal updates; 320 px Thai nav fit; no ad hook | 320–1280, 200% text | — | nav cannot fit and the header fallback is rejected |
| 3 | `src/learn/*` components, `styles.css`, Result link in `App.tsx` | Scale, SwatchGroup, TypeCard | colours equal palette for all 12; bands as text; personalised badge; no personality words | Full matrix incl. light swatches | — | subtype content would need new palette data |
| 4 | `src/learn/*`, Palette and Checker link sites in `App.tsx` / `colorChecker` | Flat-lay SVG | harder framing; "absent ≠ harder"; photo copy never claims true colour; three links land correctly | Matrix | L8–L10 | a topic would need a new matching rule; everyday neutrals without Q1 approval |
| 5 | copy, CSS | — | budgets; a11y semantics; reduced motion | Full stress matrix | Native Thai review (manual) | — |
| 6 | docs | — | full regression | Final matrix | — | any regression |

## 33. Risks and open questions

| # | Item | Proposed default |
|---|---|---|
| Q1 | `wear.everyday-neutrals` needs each palette colour's family (white/black/grey/beige/navy). That lives in the guarded `domain/colorNames`. | **Decided (PO, after Slice 0):** stays P1; no colour-naming access and no guard change; no classification by colour name (fragile: Soft Summer's "Soft Navy" names as charcoal). Revisit only in Slice 4 with a product reason, or drop. |
| Q2 | 5-item bottom nav at 320 px in Thai. | **Open by decision:** Slice 2 tests the real 5-item candidate at 320 px in Thai, then chooses bottom nav or header entry. |
| Q3 | No URL routing, so the device back button leaves the app. | In-app Back button; native back handling is deferred with native work. |
| Q4 | Thai copy quality. | Native Thai review before public release (manual checklist). |
| Q5 | Bundle growth. | Measure in Slice 1; lazy-load only if the gzip delta exceeds ~30 kB. |
| Q6 | Users meeting other systems' names (Bright Spring, Spring Warm Bright…). | One neutral sentence in `basics.what-is` Level 3; no mapping table. |
| Q7 | Showing raw quiz dimension values. | Not shown; type-target bands only (§12). |
| R1 | Scope creep into styling or makeup advice. | Budgets (§25) and the inventory (§28) are frozen; additions need the PO. |
| R2 | Duplicated truth drifting from palettes. | Id-only references plus tests (Slice 1). |

## 34. Slice 1 handoff

**Done.** Implemented in Slice 1; see [V1_4_SLICE_1_CONTENT_FOUNDATION.md](V1_4_SLICE_1_CONTENT_FOUNDATION.md) for the final shape and the few places it differs from the proposal in §22.

1. **Build** only `src/learn/` foundation files (§22), with **no UI** and no App, nav or CSS changes.
2. **Content:** write TH/EN `LearnCopy` for `home`, `basics.what-is`, `basics.dimensions`, `types.overview` (intro and 4 season lines), `types.detail` template labels, `wear.palette`, `wear.harder`, `app.color-checker` and `app.lucky`. Stay within §25, follow §9 and research §4, and reference colours only by palette id.
3. **Model:**
   - `dimensionBand(t)` with the §15 thresholds;
   - `seasonGroups()` built from `seasonDefinitions`;
   - `subtypeGuide(subtype, language)` returning the §14 sections from `getPalette`, `LocaleCopy.subtypes`, `palette.sections`, `harderTips` and metals, with nothing copied.
4. **Tests:** those listed for Slice 1 in §32.
5. **Validation:** `npm test`, the 177,147 audit, `npm run build`, `git diff --check`, and a record of the bundle delta.
6. **Frozen:** everything in §32. **Stop** if any Learn statement would need a colour fact that does not exist in the palettes or copy.
