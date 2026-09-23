# V1.2 Slice 5d: Unified Color Checker Result Display

Status: **done in automated and headless-browser checks.** Real-phone QA and a Thai-speaker review are
still open. This slice changes presentation only: no matching engine, threshold, palette or pairing changed.

**Durable decision: Manual and Photo are two input methods for one Color Checker result experience.**

Files:
- **New in [colorChecker/](../src/colorChecker/):**
  - [resultView.ts](../src/colorChecker/resultView.ts): the view model
  - [ColorResultCard.tsx](../src/colorChecker/ColorResultCard.tsx): the shared card
  - [manualResult.ts](../src/colorChecker/manualResult.ts): the manual adapter
- **New in photoChecker/:** [photoResult.ts](../src/photoChecker/photoResult.ts), the photo adapter
- **[PhotoResultCard.tsx](../src/photoChecker/PhotoResultCard.tsx):** now only the photo live region and states around the shared card
- **[placement.ts](../src/domain/photoColor/placement.ts):** the plan table is keyed by intent. The photo output is byte-identical.
- **[App.tsx](../src/App.tsx):** `CheckerView` renders the shared card under the unchanged manual input
- **i18n:**
  - new `colorResult` section
  - `checker.sampleLabel` / `checker.why`
  - removed `checker.fit/estimate/outfitLabel/pairHeading` and `matchReason`
- **[styles.css](../src/styles.css):**
  - one `check-*` result style set
  - old `.match-*` / `.pairing-grid` rules removed

## 1. Real-user problem

During real-device review, the two Color Checker tabs looked like two products.
- **Photo** had the accepted 5c result: verdict → why → action → reference → placement → pairing.
- **Manual** still had the V1.1 card:
  - a huge "29% palette fit"
  - a technical rating pill
  - one explanation line
  - an "app estimate, not a scientific probability" disclaimer
  - a separate grid of pairing cards

## 2. Product decision

The input method may differ, but the result experience does not. Both tabs render the same card.
The differences are only:
- data that one engine actually has and the other does not
- source-specific notes, such as the photo caveat and warnings

## 3. Manual engine semantics (`checkColor`, unchanged)

**How the score is built:**
1. Take the nearest Best (2), Accent, Neutral and Harder colours by OKLab distance.
2. Compute the similarity `exp(-7.2·d)`.
3. Combine: `score = clamp(0.9·max(simBest, 0.94·simAccent, 0.9·simNeutral) + 0.07 − 0.3·simHarder)`.
4. Then apply two overrides:
   - a near-exact Harder match is capped at 0.55
   - a near-exact Best match is raised to at least 0.92

**Existing ratings and their V1.1 meaning:**

| Rating | Existing cut-off | V1.1 reason |
|---|---|---|
| Great Match | score ≥ 0.82 | "close to {Best}, one of your strongest palette colors" |
| Good Match | ≥ 0.66 | "similar color quality … should feel harmonious" |
| Wearable | ≥ 0.47 | "a little outside your core palette … pairing … balance" |
| Tricky | < 0.47 | "closer to {Harder} … may feel less effortless near your face" |

**Other outputs:**
- **`closestColors`:** the two nearest **Best** colours only.
- **`reason.referenceColor`:**
  - the nearest Best colour for Great and Good, even when an Accent or Neutral decided the score
  - `null` for Wearable
  - the nearest Harder colour for Tricky, even when that colour is far away (median OKLab distance 0.20; plan §10.1)
- **`pairWith`:** `pairingSuggestions`.
- **Measured on a 16³ sRGB grid:** Great 75, Good 1,853, Wearable 9,541, Tricky 37,683 (all subtypes). Every exact palette Neutral rates Great Match.

## 4. Photo engine semantics (unchanged)

`matchPhotoColor` is unchanged:
- lightness-tolerant OKLab distance
- five categories: near-face / neutral-base / related / away-from-face / outside
- `nearest` of any positive group, with its group
- `resembles` a Harder colour only when it is close
- `direction`, `descriptors`, `pairWith` and the sampling `warnings`

5c maps each category 1:1 to a verdict level (`getSuitability`).

## 5. Shared vs source-specific information

| Field | Manual | Photo |
|---|---|---|
| swatch + HEX | ✔ "Selected color" | ✔ "Color at this spot" |
| verdict + cue + tone | ✔ from rating | ✔ from category |
| small label | the rating (`copy.ratings`) | the category |
| why | manual reason per rating | photo reason (names the nearest colour) |
| action | shared template | shared template |
| palette reference | nearest **Best** colour, "Nearest of your Best colors" | nearest palette colour, "Similar color in your palette" + group |
| placement, pairing | shared renderer | shared renderer |
| "also close to {Harder}" note | – | ✔ when `resembles` |
| details (direction, descriptors) | – | ✔ |
| warnings, photo caveat | – | ✔ |
| score | kept in the domain, **not shown** | never existed |

## 6. Shared result view model

`ColorResultView`:
- **Text and identity:** `hex`, `sampleLabel`, `suitability`, `category {key,label}`, `why`
- **Reference:** `reference {kind: 'similar' | 'nearestBest', color, group | null}`
- **Photo-only slots:** `note | null`, `details[]`, `warnings[]`, `caveat | null`
- **Guidance:** `placement` (rows + pairing advice), `pairWith` (the engine's array, passed through)

It holds no domain objects beyond palette colours and no score. Translated sentences are built in the
adapters, never in a domain module.

## 7. Manual adapter

`toManualResultView(match, copy, presentation)`:
- **Verdict:** `getManualSuitability(rating)`, a fixed map.
- **Placement:** from `PLACEMENT[rating]` through `getPlacementGuide`.
- **Reason:** `checker.why[rating]`.
- **Reference:** `closestColors[0]` labelled `nearestBest`.
- **Passed through:** `pairWith`.

It never reads `score`. A source test forbids `.score`, numeric comparisons, `Math.`, distance, `checkColor` and palette access in the file.

## 8. Photo adapter

`toPhotoResultView(matched, copy, language, presentation)` holds the logic that used to be in
`PhotoResultCard`, moved unchanged:
- `getSuitability(category)`
- `getColorPlacement`
- the photo reason
- the resemblance note (hidden for weak)
- direction and descriptors
- warnings and the caveat

## 9. Shared component

`ColorResultSummary` holds the swatch, HEX, verdict, cue, label and screen-reader-only warnings. `ColorResultGuidance` holds
why → action → reference → note → placement → pairing → details → warnings → caveat.
- **Photo** puts the summary inside its existing `.photo-summary` live region, which also shows the instruction, pending and unavailable states.
- **Manual** uses `ColorResultCard`, which wraps the summary in its own `role="status"`.

The component has no mode branching and no engine calls. A test checks its imports and source.

## 10. Percentage decision

The manual percentage is **removed from the user-facing UI**, and so is its "not a scientific probability"
disclaimer. Their i18n keys (`checker.fit`, `checker.estimate`) are deleted after confirming they had no other use.

`score` is unchanged in `ColorMatchResult` and still frozen by the regression fingerprints. No star, score or
other number replaces it. This answers plan Q4.

## 11. Verdict mapping from existing manual ratings

| Existing rating (existing cut-off in `checkColor`) | Level | Cue | Tone | EN verdict |
|---|---|---|---|---|
| Great Match (≥ 0.82) | strong | ✨ | positive | Yes! Excellent for your Personal Color |
| Good Match (≥ 0.66) | good | ✓ | positive | This color works well for your Personal Color |
| Wearable (≥ 0.47) | conditional | △ | middle | Wearable, but not one of your strongest colors |
| Tricky (< 0.47) | weak | △ | negative | Not ideal near your face |

- **No new threshold.** The cut-offs are the engine's own, and the adapter maps only the rating string.
- **Tricky maps to weak, not outside.** Its V1.1 meaning is "less effortless near your face". The manual engine has no "outside
  your palette" rating, and none is fabricated: a test runs the whole 6³ grid × 12 subtypes and never sees `outside`.

## 12. Placement handling

`placement.ts` now keys its table by `PlacementIntent`:
- **Photo** maps each category 1:1 (`PHOTO_INTENT`). `getColorPlacement` output was verified to be JSON-identical to HEAD for all
  five categories × both presentations, and the 35 existing placement tests pass unchanged.
- **Manual** maps each rating to an intent:

  | Manual rating | Intent | Placement |
  |---|---|---|
  | Great Match | face | the photo near-face rows |
  | Good Match | harmonious | new: "wear it here" near the face and in larger pieces; "also works" in accessories |
  | Wearable | second-color | the photo related rows |
  | Tricky | below-face | the photo away-from-face rows |

`harmonious` exists because the photo `base` rows are neutral-specific. A Good Match coral is not a neutral.

## 13. Pairing handling

Each engine's `pairWith` is passed through untouched, and the shared card renders it as the same chips as Photo
(swatch + `colorDisplayName`, HEX in the tooltip). The old manual pairing-card grid is removed.

The framing ("Goes well with" or "If you like it, keep one of these near your face") comes from the placement intent.

## 14. Palette-reference handling

Same row, same chip and same style in both modes.
- **Photo:** "Similar color in your palette" / "สีใกล้เคียงในพาเลตต์ของคุณ". It shows the group for positive verdicts.
- **Manual:** "Nearest of your Best colors" / "สีเด่นในพาเลตต์ที่ใกล้ที่สุด", with no group.
  - **This deviates from the preferred single label, for honesty.** The manual engine only reports Best colours.
  - An exact Neutral (for example a Deep Winter black) rates Great Match, yet its nearest Best colour can be a
    completely different hue. Calling that "similar" would be false.
  - For the same reason, the manual reasons name no colour.
- **Every result that is not positive** adds "For comparison only" / "ไว้เปรียบเทียบเท่านั้น", so the reference never reads as a
  recommendation. The old "(ไว้เปรียบเทียบ)" label is gone.

## 15. i18n consolidation

- **New `colorResult`** (shared):
  - `verdicts`, `action`
  - `reference {similar, nearestBest, compare}`
  - `groups`, `placementHeading`, `tiers`, `areas`, `pairing`
  - Moved from `photoChecker` with the accepted 5c wording unchanged.
- **`photoChecker` keeps only photo copy:**
  - modes, picker and errors
  - categories, warnings, unavailable
  - photo `why`, `resembles`, direction, descriptors, caveat
- **`checker` keeps the manual input copy**, plus `sampleLabel` and `why` (one reason per rating).
- **Removed:** `fit`, `estimate`, `outfitLabel`, `pairHeading` and the top-level `matchReason`.
- **Consistency test:** neither section re-declares a shared key, and no shared string is duplicated under `checker` or `photoChecker`.

## 16. Accessibility

- **Same strategy in both modes:** only the summary (label, HEX, verdict, rating or category, and any warnings) is a live region.
  The guidance is not re-announced, and a new check replaces it (keyed).
- **Hidden decoration:** the cue and swatches are `aria-hidden`. Every swatch has its name or HEX beside it.
- **Structure:** the placement and pairing sections are labelled regions with headings.
- **Meaning never by colour alone:** every level has its own words and cue shape.
- **Manual change:** the old manual card was one big `aria-live` article that re-read everything, including the percentage.

## 17. Responsive behavior

Headless Chrome, 8 widths × EN/Women + TH/Men. Manual: strong, good, middle, poor and a same-HEX case. Photo:
near-face, related, outside and harder.

| Check | Result |
|---|---|
| Horizontal overflow | 0 everywhere |
| Chips, placement rows and action inside the card | yes, everywhere |
| Percentage anywhere | no |
| Verdict wrapping | 1–3 lines, natural |
| Manual layout | single column below the input; `max-width: 640px`, centred from 768 px |
| Photo layout | stacked below 900 px, side by side at 900 / 1024 / 1280 |
| Photo → Manual | shows the manual card again |

Pre-existing and unchanged: at 430 px, TH placement text "จุดเล็ก ๆ" can wrap before "ๆ".

## 18. Cross-mode QA

- **Unit and integration:**
  - the same HEX entered manually and tapped in a synthetic solid photo gives the same section order, HEX, reference row and pairing UI
  - Photo adds only details and the caveat
  - when both engines reach the same level, the verdict text and cue are identical (for example an exact Best colour: ✨ in both, EN and TH)
- **Browser:**
  - the computed styles of the verdict, label, reason, action, headings and chips are identical in both tabs (390 px)
  - screenshots compared: manual vs photo `#F3A45F` at 390, TH poor at 430, EN middle at 1280, TH photo related at 1024

## 19. Domain regressions

- **Existing freeze:** `colorMatch.regression.test.ts` (12 subtype fingerprints over 498 inputs of score, rating, closest, reason and pairings) is unchanged and passing.
- **New pre-change baseline:** 16 representative outputs captured at HEAD `eb46f35` before any UI change. They cover:
  - exact Best, Neutral, Accent and Harder colours
  - strong, middle and poor chromatic colours
  - the "≈29%" `#FFFFFF` and `#808080`
  - black and red
  - a second subtype

  Each is asserted to 9 decimals.
- **No mutation:** building a view neither mutates nor re-scores the result.
- **Photo:** the matcher, sampler and placement output are unchanged, and all 5a/5b/5c suites pass.

## 20. Known cross-engine differences (not fixed here)

Solid colours through both engines: 12 subtypes × (22 palette colours + a 6³ grid) = 2,856 cases.
- **Same level:** 771 (27%).
- **Same tone** (positive / middle / negative): 84%.
- **Main differences:**

  | Manual level | Photo level | Cases | Why |
  |---|---|---|---|
  | weak | outside | 1,515 | Manual has no outside level. Both are negative. |
  | weak | conditional | 312 | Photo's lightness-tolerant distance is kinder. |
  | conditional | strong | 93 | |
  | good | strong | 83 | Exact Accents are Good in Manual but near-face in Photo. |
  | strong | good | 24 | Exact Neutrals are Great in Manual but neutral-base in Photo. |

- **Examples at 390 px (Warm Spring):** `#F3A45F` is Manual ✓ good but Photo ✨ strong. `#FFFFFF` is weak in both.
- **Different verdict wording for the same HEX is expected.** The engines were designed differently (plan §10.1).
- **Aligning them is a separate product and domain decision (plan Q5).** Nothing was averaged, special-cased or re-thresholded.

## 21. Remaining V1.2 hardening work

- **Thai-speaker review:**
  - the new manual reasons
  - the reference labels ("สีเด่นในพาเลตต์ที่ใกล้ที่สุด", "ไว้เปรียบเทียบเท่านั้น")
  - the 5c copy
- **Real-phone QA of both tabs:**
  - the verdict is visible after Check / tap
  - VoiceOver and TalkBack announce one line per check
- **Q5:** decide whether Manual should adopt the photo classifier for typed HEX, or show the engine difference.
- **Slice 6:**
  - memory cleanup
  - focus management
  - privacy guard
  - the device matrix (HEIC, EXIF, 48 MP, offline)
  - Q1 / Q3
