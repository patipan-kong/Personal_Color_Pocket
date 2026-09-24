# V1.4 Slice 1 — Learn Content Foundation

**Status:** complete. This slice adds the typed, bilingual, data-driven content foundation for Learn. It has **no UI**: no screen, route, navigation, cards, rendered diagrams or contextual links. Nothing outside `src/learn/` imports it, so no user can see Learn yet.

Governing contract: [V1_4_LEARN_PLAN.md](V1_4_LEARN_PLAN.md). Sources: [V1_4_LEARN_RESEARCH.md](V1_4_LEARN_RESEARCH.md).

## 1. Entry state

- **Branch and HEAD:** `main` at `21ed744` "docs: plan v1.4 learn experience", after `06c059f` "fix: reject invalid persisted personal color subtype".
- **Tree and version:** clean working tree, 2 commits ahead of `origin/main`, package version 1.1.0.

**PO decisions applied:**
- **Q1:** Everyday Neutrals stays P1. There is no colour-naming access, the guard is unchanged, and nothing is classified by colour name.
- **Q2:** the navigation decision is deferred to Slice 2's real 320 px Thai test.

## 2. Files

All the new code is in `src/learn/`. No existing source file changed.

| File | Responsibility |
|---|---|
| `types.ts` | Content schema: topic, group, block, visual-intent and personalisation types; `LearnCopy`; `PaletteColorId`; dimension bands |
| `appCopy.ts` | Typed references to existing screen wording (`AppCopyRef`) and `resolveAppCopy` |
| `sources.ts` | Provenance: the L1–L12 register, internal sources, and the claim registry with truth kinds A–E |
| `registry.ts` | Stable P0 topic registry: groups and order, per-topic visual and personalisation, home featured cards, subtype-detail sections |
| `examples.ts` | Fixed example colours, as palette ids only: dimension endpoints and the no-profile outfit |
| `model.ts` | Pure derivations: bands, season groups and traits, naming quality, `subtypeGuide`, the personalisation contract |
| `content/en.ts`, `content/th.ts` | English and Thai `LearnCopy` |
| `content/index.ts` | `learnTranslations` |
| `index.ts` | Public surface for Slice 2 onward |
| `model.test.ts`, `content.test.ts`, `boundaries.test.ts` | 157 tests |

Docs:
- new: this file;
- updated: `V1_4_LEARN_PLAN.md` (status, the Q1/Q2 decisions, the §29 P1 note, and §34 marked done).

## 3. Content architecture

Content is data; rendering is Slice 2 onward. There are no React components, CSS, coordinates or colour values in content.

- **`LearnTopicCopy`:**
  - `title`;
  - `rowAnswer` (the home row line);
  - `answer` (Level 1);
  - `why` (Level 2 blocks);
  - `more` (Level 3 blocks, may be empty);
  - `takeaway` ("Try this").
- **`LearnBlock`** is one of four kinds:
  - `text` / `list`: Learn-authored prose. **Each block must name a `claim`** from `sources.ts`.
  - `app-copy`: a reference to existing screen wording, for example `palette.harderTips` or `daily.storyFamily`. It is resolved from `LocaleCopy` when rendered and never copied.
  - `palette-group`: a palette group's existing title and description (`LocaleCopy.palette.sections`), which the UI pairs with swatches.
- **Visual intent** lives in the registry, not in prose:
  - `season-strips`, `dimension-scales`, `subtype-grid`;
  - `palette-swatches`, `garment-placement`, `lighting-comparison`;
  - `null` for `app.lucky`, which the plan's inventory specifies as text plus a link.

**Where this differs from the plan's §22 proposal:**
- `reuse { copyKey }` became the typed `app-copy { ref }`.
- `swatches { paletteIds }` and `visual { visualId }` moved out of the per-language prose into `examples.ts` and `registry.ts`. Colour ids and visuals are language-independent, so keeping them in the prose files would have duplicated them in both languages.
- `palette-group` was added so that "Using your palette" renders the existing group wording.

## 4. Topic registry (P0 only)

| Group | Topic id | EN title | Visual | Personalisation |
|---|---|---|---|---|
| Color basics | `basics.what-is` | What is Personal Color? | season-strips | none |
| | `basics.dimensions` | Understanding color | dimension-scales | type markers |
| | `types.overview` | 4 seasons, 12 types | subtype-grid | "Your type" badge |
| Wearing color | `wear.palette` | Using your palette | garment-placement | own colours |
| | `wear.harder` | More Considered colors are not off-limits | garment-placement | own colours |
| Using the app | `app.color-checker` | Getting the most from Color Checker | lighting-comparison | checker link |
| | `app.lucky` | Lucky colors and Personal Color | — | none |

The subtype-detail template is described separately (`typeDetailSections`: header, position, best, neutrals, accents, harder, metals, formula).

The home features at most two topics:
- **with a profile:** `wear.palette` and `wear.harder`;
- **without a profile:** `basics.what-is` and `types.overview`.

"Your type" is a contextual entry into the same template, not a fourth group. P1 (everyday neutrals, same name/different shade, nearby types) and deferred topics are absent.

The internal id `wear.harder` stays, and users only ever see "More Considered" / "สีที่ต้องเลือกใช้สักนิด". The EN topic title follows the plan's wording. The dimensions topic uses the brief's "Understanding color" / "เข้าใจ 4 มิติของสี".

## 5. Subtype derivation

`subtypeGuide(subtype, language)` builds the whole template for any of the 12 types from canonical data at call time:
- **Identity:**
  - `season` from `seasonDefinitions`;
  - `copy` is `LocaleCopy.subtypes[subtype]` itself (name, secondary name, characteristics, summary);
  - `seasonName` comes from Learn copy.
- **Palette:**
  - `palette` is `getPalette(subtype)` itself;
  - `groups` are Best, Neutrals, Accents and More Considered, each with the palette's own array, the existing section title and description, and localised names (`colorDisplayName`);
  - `metals` have their names and notes (`metalDisplayNote`);
  - `moreConsideredTips` is `LocaleCopy.palette.harderTips` itself.
- **Derived:**
  - `position`: 4 dimension bands with localised labels;
  - `naming`: the quality the type is named for;
  - `formula`: Best[0] near the face, Neutral[0] as the base, Accent[0] in a small piece.

The subtype list is `subtypeOrder` itself, with no second list. Season groups and their order come from `subtypeOrder`, and the season sample is the first Best colour of each type (not a season palette). There is **no new per-subtype prose**; the subtype summary is the existing app copy.

## 6. Dimension bands

`dimensionBand(t)` implements the thresholds frozen in plan §15:

| t | Band |
|---|---|
| ≤ .20 | strong-low |
| ≤ .40 | lean-low |
| < .60 | middle |
| < .80 | lean-high |
| otherwise | strong-high |

Values outside 0–1 (and NaN) throw, so no band is ever guessed.

**Labels are localised:**

| Dimension | English | Thai |
|---|---|---|
| Temperature | Strongly cool / Leans cool / In between / Leans warm / Strongly warm | เย็นมาก … อุ่นมาก |
| Value | Strongly deep … Strongly light | เข้มมาก … อ่อนมาก |
| Chroma | Strongly soft … Strongly clear | นุ่มหม่นมาก … สดชัดมาก |
| Contrast | Very low contrast … Very high contrast | ตัดกันน้อยมาก … ตัดกันชัดมาก |

The plan's worked examples hold: Clear Spring temperature → "Leans warm"; Clear Winter temperature → "Leans cool"; Soft Summer chroma → "Strongly soft". No number is ever exposed.

**Two further derivations** back up claims in the prose:
- **`seasonTraits`:** a dimension counts for a season only if all three of its types sit on the same side of 0.5.
- **`namingQuality`:** the dimension where a type's target is farthest from 0.5. For all 12 types this matches the first word of the English name (Light, Deep, Warm, Cool, Clear or Soft), which is what makes the "named for its strongest quality" sentence true.

## 7. Palette reuse

Learn contains no HEX values, no palette colour data and no subtype target vectors. Colours are referenced by palette id (`PaletteColorId`, for example `soft-summer-best-3`) and resolved by `paletteColorById` to the canonical object itself.

**Fixed examples** (`examples.ts`):
- **Dimension endpoints:**
  - temperature: Raspberry Rose ↔ Warm Coral;
  - value: Deep Emerald ↔ Seafoam;
  - chroma: Smoky Blue ↔ Electric Blue;
  - contrast: a light, middle and dark stack from Soft Summer ↔ Clear Winter.

  Tests prove each id comes from a type at that end of the scale.
- **No-profile outfit:** Soft Autumn Best 1, Neutral 1, Accent 1 and More Considered 1. Tests prove all four ids belong to one type and to their proper groups. In particular, the More Considered colour is actually listed as harder for that type.

## 8. Seasons

The four one-line summaries are:

| Season | EN | TH |
|---|---|---|
| Spring | warm, clear, light to medium depth | สีโทนอุ่นที่สดชัด … |
| Summer | cool, soft, light to medium, low contrast | สีโทนเย็นที่นุ่มหม่น … |
| Autumn | warm, soft, medium to deep | สีโทนอุ่นที่นุ่มหม่น … |
| Winter | cool, clear, deeper, high contrast | สีโทนเย็นที่สดชัด … |

- A test checks, in both languages, that each summary names every quality its three types share (`seasonTraits`), never names the opposite, and says nothing about a dimension the types disagree on. For example, Spring and Autumn say nothing about contrast.
- The `types.overview` sentence "Spring and Autumn are warm … Summer and Autumn are softer" is rebuilt from `seasonTraits` in the test.
- There are no season palettes and no season pages.

## 9. Localisation

- **Separate copy:** `LearnCopy` is a separate typed object per language, next to the existing `LocaleCopy`. The global i18n architecture is unchanged.
- **Parity:** the `LearnCopy` type forces the same keys at compile time. At runtime, tests check:
  - identical field paths;
  - identical block structure per topic (kinds, claims, app-copy refs, list lengths);
  - no empty strings.
- **Thai is written in Thai:**
  - every Thai string contains Thai script;
  - the only Latin allowed is "Personal Color Pocket", "Personal Color", "Color Me Beautiful" and "Munsell";
  - no string is identical to its English counterpart;
  - there are no full stops, matching the existing Thai style.
- **Terms match the Thai app screens:** "เช็กสี" for the checker, "หน้าวันนี้" for Daily, and the palette group names used in the palette screen. Other systems' type names are transliterated (ไบรต์, ทรู), as the app's own names are.

## 10. Content budgets

**Counting rules:**
- **English:** whitespace-separated words.
- **Thai:** has no spaces between words, and no tokenizer was added. It is measured in **visible characters**: Thai consonants, independent and spacing vowels, Latin letters and digits. Tone marks and above/below vowels are not counted.
- **Thai calibration:** the app's existing parallel TH/EN copy averages 3.9 such characters per English word (409 words across 33 string pairs). Each Thai budget is therefore **the English budget × 5**, which is deterministic and allows for Thai phrasing without allowing bloat.

| Budget (plan §25) | EN limit | Largest EN | TH limit | Largest TH |
|---|---|---|---|---|
| Landing copy | 60 | 39 | 300 | 145 |
| Row answer | 20 | 13 | 100 | 55 |
| Level 1 answer | 45 | 32 | 225 | 106 |
| Takeaway | 20 | 16 | 100 | 59 |
| Visible (answer + why + takeaway, including reused app copy) | 250 | 163 | 1250 | 512 |
| Whole topic | 400 | 191 | 2000 | 699 |
| Subtype template prose | 80 | 63 | 400 | 221 |

## 11. Provenance

- Every authored `text`/`list` block names a claim in `learnClaims`. There are 15 claims, each with:
  - a truth kind (A–E, plan §26);
  - its sources (L1–L12, app modules, or internal docs);
  - a one-line maintainer summary.
- Tests require:
  - every claim to be used;
  - Thai and English to use the same claims in the same places;
  - every external (C) claim to cite the research register;
  - every register id to appear in `V1_4_LEARN_RESEARCH.md`;
  - every cited internal doc to exist.
- **History** (L1–L3) and **systems differ** (L4–L6) appear only in Level 3, and "systems differ" appears exactly once in `basics.what-is` and once in `types.overview`.
- Citations are not shown in the UI and nothing is fetched.

## 12. Personalisation contract

- **`learnProfileFrom(result)`:** returns `{ subtype, season }` or `null`.
  - The season comes from `seasonDefinitions`, not from the result object.
  - An unknown subtype returns `null`: Learn trusts the app's already-validated result but never renders an unknown type.
  - Learn never reads storage and does not repeat persistence logic.
- **`subtypeGuide(profile.subtype, language)`:** the user's type, palette and bands.
- **`outfitExample(profile | null)`:** the user's own formula plus their first More Considered colour, or the fixed general example (`personal: false`).
- **The app's job (Slice 2):** pass `result` in. Learn does not import app state.

## 13. Architectural boundaries (tested)

- **Imports:** Learn source may import only:
  - `domain/personalColor/{palettes,seasons,types}`;
  - `i18n`;
  - its own files.

  So there is no scoring, classifier, quiz, diagnostics, colour matching, colour naming, services, React or any package.
- **Runtime behaviour:** no `fetch`, XHR, WebSocket, beacon, URL, storage or dynamic import.
- **No stored data:**
  - no HEX, `rgb()` or `hsl()`;
  - the only decimals in Learn are `.2 .4 .5 .6 .8` in `model.ts` (the plan thresholds and the midpoint), so no target is copied;
  - no quoted subtype id anywhere in Learn source, so there is no second subtype list.
- **No UI yet:** no file outside `src/learn/` imports it, and it has no `.tsx`.

## 14. Adversarial checks

Each mutation was applied, the Learn tests were run, and the file was restored. All 20 were caught.

| Mutation | Caught by |
|---|---|
| Remove Clear Winter from `seasons.ts` | subtype integrity (3 tests) |
| Formula base Neutral → Accent | palette integrity (36) |
| Swap Accents/More Considered group order | palette integrity (24) |
| General More Considered example → a non-listed colour | general outfit example |
| `t <= .4` → `t < .4` | threshold boundary 0.4 |
| Remove the Thai `app.lucky` topic | registry and parity (9) |
| HEX in English prose | boundaries (colour values) and copy integrity |
| "Harder colors…" title | More Considered term |
| Import `analyzeQuiz` into `model.ts` | import boundary |
| Import `describeColor` into Learn | import boundary |
| Daily: "The tradition combines the colors of your two goals" | two-goal composition |
| Checker: "It recovers the true color of the garment" | checker honesty |
| "Every romantic type…" | personality check |
| Autumn summary "from light to deep" | season summary vs targets |
| `fetch('/x')` in Learn | network boundary |
| `['soft-summer']` list in the registry | no subtype list |
| `{ temperature: .31 }` in Learn | no copied targets |
| `import './learn'` in `App.tsx` | no Learn UI yet |
| An English takeaway in Thai copy | Thai language check |
| A 27-word takeaway | budgets |

## 15. Validation

- **`npm test`:** 50 files; **1,468 passed** (1,311 before + 157 new), 1 known skip.
- **Exhaustive quiz audit:** 177,147 / 177,147.
- **`npm run build`:** passes.
- **`git diff --check`:** clean.
- **V1.2/V1.3 regressions:** all pass unchanged. This includes the colour-naming guard (`colorNamesIntegration.test.tsx` still allows only `ColorResultCard.tsx` and the audit), the checker, photo, Daily and persistence tests.
- **No production screen changed:** no existing source, style, copy or asset file was modified; App, nav, Welcome, Quiz, Result, Palette, Checker and Daily render as before.

## 16. Bundle

| Asset | Slice 0 baseline | Slice 1 | Delta |
|---|---|---|---|
| JS | 410.59 kB / 123.01 kB gzip | 410.59 kB / 123.01 kB gzip | **0** |
| CSS | 47.53 kB / 10.72 kB gzip | 47.53 kB / 10.72 kB gzip | **0** |

Nothing imports Learn yet, so it is tree-shaken out of the production bundle.

**Forecast for Slice 2:** Learn built on its own, with the existing domain and i18n modules left out, is **39.5 kB raw / 10.4 kB gzip**. This probe was not whitespace-minified, so it is an upper bound. It is well under the ~30 kB gzip threshold, so **lazy loading is not needed**.

The claim registry (`learnClaims`, `learnSources`) is maintainer data. If the UI never imports it, it stays out of the bundle.

## 17. Known limitations

1. **Existing wording the checks don't cover.** The personality check applies to Learn-authored text, and Learn shows some existing app wording as-is:
   - the English Accents description ("confident color");
   - subtype characteristic words such as "Dramatic", "Bold", "Refined" and "Calm".

   They describe colours, but the PO may want them reviewed before Slice 3 shows the characteristic words on the type pages.
2. **Thai copy** needs native review before release (plan Q4).
3. **The Thai budget** is a proxy calibrated on existing copy, not a word count.
4. **Example ids are positional** (`…-best-3`). If a palette is reordered:
   - the tests still prove each example sits on the right end of its scale and in the right group;
   - but a pair could stop being a visually similar pair.
5. **The history line** names Itten and Color Me Beautiful only; the 12-type expansion (L3) is described without naming the book (research §5).
6. **Nearby types** (P1) and the **"See outfit examples"** link's destination are left to later slices; only the label exists.

## 18. Slice 2 handoff

- **Import everything from `src/learn` (`index.ts`):**
  - `getLearnCopy`, `learnGroups`, `learnTopicOrder`, `learnTopics`, `learnHomeFeatured`;
  - `learnProfileFrom`, `outfitExample`, `subtypeGuide`, `seasonGroups`;
  - `resolveAppCopy`, `paletteColorById`, `dimensionExamples`.
- **Render blocks by `kind`:**
  - `app-copy` through `resolveAppCopy(getCopy(language), ref)`; it may be a string or a list, as `palette.harderTips` is;
  - `palette-group` from `copy.palette.sections[group]` plus swatches.
- **Pass the app's `result`** through `learnProfileFrom`. Do not read storage.
- **Navigation:** decide the entry (Q2) by testing the real 5-item bottom nav at 320 px in Thai against the header fallback. Add the entry labels to `LocaleCopy` only, as plan §23 says.
- **Tests to update:** the boundary test "nothing outside `src/learn/` imports it" must be relaxed deliberately to allow only the Learn view and App wiring. The "no `.tsx`" check must be relaxed the same way.
- **Stay frozen:** the colour-naming guard, palettes, classifier, V1.2 and V1.3 behaviour. Add no ad hooks to Learn.
