# V1.3 Slice 4.1 — Multi-Goal Lucky Color Selection

**Status:** complete. This is a contract extension between the historical Slice 4 Daily UI and Slice 5's visual garment board. It supports one or two equally weighted daily goals and does not change the frozen Slice 1 knowledge table, Slice 2 adaptation ladder, or V1.2 palette data.

## A. Entry state

The implementation started from `main`, clean at `c19a753c109091b22a557dbd8d456b233a811c55` (`feat: add daily lucky color experience`), package version `1.1.0`. No pre-existing edits were present.

## B. Files changed

- `src/domain/luckyColor/outfit.ts` — smallest Slice 3 composition extension: one/two-rule orchestration, claims, provenance, role assignment, generic accessory slots, and same-family collapse.
- `src/domain/luckyColor/multiGoal.test.ts` — focused composition, exhaustive, order, collapse, and regression audits.
- `src/services/dailyLuckyColorGoal.ts` and its test — scalar-to-array local preference migration and sanitization.
- `src/dailyLuckyColor/DailyView.tsx` and its test — multi-select controls, dual claims, badges, profile/general rendering, and rollover/locale coverage.
- `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/th.ts` — compact max-two and provenance copy.
- `src/styles.css` — selected-state, dual-claim, and compact badge layout only; no garment-board redesign.
- `docs/V1_3_SLICE_4_1_MULTI_GOAL.md` and `docs/V1_3_DAILY_LUCKY_COLOR_PLAN.md`.

No Slice 1/2 files, V1.2 files, package/dependency files, or native files changed.

## C–E. Selection contract and third-click behavior

The available goals remain exactly `work`, `money`, `luck`, and `mentor-support`. The UI always contains one or two selected IDs:

- clicking an unselected goal adds it when one is selected;
- clicking a selected goal removes it when two are selected;
- clicking the only selected goal leaves it selected;
- clicking a third goal replaces the oldest selected ID, so `work + money` → `money + luck`.

Both selected controls use the same `aria-pressed` and visual selected state. There is no primary/secondary label, number, or traditional-goal priority.

## F–G. Persistence and composition API

`personal-color-pocket:daily-lucky-color-goal:v1` remains local-only. New writes are JSON arrays of one or two canonical IDs. A prior scalar (`money`, or a JSON string) is read as one selected goal. Invalid IDs are removed, duplicates are removed, only the first two valid entries are retained, and an empty result becomes `['work']`. No profile schema is touched.

The new domain entry point is:

```ts
recommendLuckyGoalsOutfit({ rules: readonly LuckyColorRule[], subtype?: Subtype })
```

It accepts exactly one or two positive Slice 1 rules. Each rule is looked up independently before composition. `LuckyGoalsOutfitRecommendation` exposes `selectedGoals`, canonical `luckyRules`, `luckyFamilies`, and `luckyClaims`. A claim contains the family, all goal/rule provenance for that family, its independent Slice 2 adaptation, original suitability, resolved placement, and the generic piece role/slot. Single-rule calls delegate to the unchanged `recommendLuckyRuleOutfit` path and retain the same legacy fields and pieces.

## H. Single-goal compatibility

The composition entry point was compared with `recommendLuckyRuleOutfit` for all 7 weekdays × 4 goals × 12 subtypes (336 personalized cases), plus 7 × 4 (28 general cases). Family, Slice 2 adaptation, selected HEX/name, placement, strategy, supports, pieces, and accessory fallback remain equal. Existing Slice 3 tests continue to pass.

## I–K. Dual composition, conflicts, and tie-break

Two selected goals resolve two independent canonical rules. Distinct families remain two claims; no RGB/OKLab averaging, gradient, third family, or family substitution occurs. Slice 2 adapts each family independently.

Personalized role resolution ranks only Slice 2 suitability (`near-face`, `main-piece`, `below-face`, `accessory`). A stronger near-face adaptation receives the top when possible; the next main/below-face claim receives the bottom; remaining claims use generic indexed accessory slots. Thus both-near-face becomes top + bottom, near-face + accessory becomes top + accessory, two below/main claims become bottom + accessory, and two accessory fallbacks become accessory slot 1 + accessory slot 2. Shoes remain supporting/neutral. If suitability ties, `LUCKY_COLOR_FAMILIES` order is the deterministic non-semantic tie-break. It controls placement only and never indicates goal importance.

## L. Same-family collapse findings

The frozen 7 × 4 Slice 1 table currently produces **0 same-family pairs** among the six unordered daily pairs on every weekday: all 42 dual selections are distinct-family selections. The composition layer still groups same-family rules. Such a pair returns one family visual/claim with both goal IDs and both rule records, never two duplicate swatches or garment roles.

The generated 42-distinct family-pair distribution was:

```text
pink+purple 1, pink+green 2, pink+gray 2, green+purple 2, purple+gray 2,
green+gray 1, green+orange 2, green+blue 2, purple+orange 2, blue+orange 2,
blue+purple 1, red+purple 1, orange+gray 2, red+gray 2, red+orange 1,
yellow+orange 2, blue+gray 2, yellow+blue 2, yellow+gray 1, red+blue 2,
yellow+red 1, yellow+green 2, red+green 1, yellow+pink 1, pink+orange 1,
pink+red 1, pink+blue 1.
```

There were 0 duplicate role/slot placement conflicts in the 42 production dual selections.

## M–O. Personalized, general, and accessory behavior

Personalized mode keeps each family, candidate HEX, V1.2 structured name, suitability, and fallback state. If a family has no honest curated candidate, its lucky claim remains a semantic broad-family accessory; no personalized HEX is fabricated. If both families fall back, both semantic accessory claims remain represented with indexed generic slots.

General mode has no subtype, curated shade, or exact personalized HEX. Distinct families use semantic broad-family tokens for top and bottom; same-family provenance uses one semantic family token. The quiz CTA remains non-blocking.

Supporting colors continue to come only from the existing subtype `best`/`neutrals` palettes. Supporting pieces have `supporting-personal-color` or `supporting-neutral`, never `lucky`. Shoes remain neutral/supporting.

## P–Q. UI result presentation and badges

The result shows one family row for a single/collapsed claim or two equal family rows for distinct claims. Each row lists its localized goal provenance. The text-first outfit summary identifies each lucky piece and uses compact localized badges such as `Lucky color · Work` / `สีมงคล · งาน`; supporting pieces are separately labeled. Slice 5 can consume `luckyClaims`, including goal IDs/rules, family, exact palette color through the piece, semantic fallback, suitability, placement, and role/slot without inferring relationships.

## R–S. Accessibility and responsive verification

Multi-select controls are native buttons with `aria-pressed`, visible focus, equal selected styling, and arrow-key focus navigation. The compact “Choose up to 2” / “เลือกได้สูงสุด 2 เรื่อง” note makes the limit understandable without relying on color. Goal and family labels are textual, and semantic fallbacks are not color-only.

The mobile-first grid remains two columns where space permits and one column below the existing 420px breakpoint. The browser check exercised a running Daily page, two selected states, dual result rows, dual badges, source disclosure, and EN→TH switching. The available browser automation surface did not expose exact viewport resizing, so 360/430/768/1280 are recorded as CSS breakpoint inspections rather than physical-device claims.

## T. Cultural-honesty boundary

The frozen Thai Rath/KTC source links and Slice 0/1 source model are unchanged. The About copy explicitly distinguishes independent source rules from the product composition: the tradition supplies each daily category; the product lets a user select up to two goals and compose those colors into one outfit. It makes no causal, scientific, or traditional claim that Thai sources prescribe combining two goals.

## U–Y. Generated audits

- **70 weekday selections:** 7 × (4 singles + 6 unordered pairs) all resolve. The 42 dual selections are all distinct-family under the frozen table; 0 same-family collapses and 0 role conflicts were observed.
- **504 personalized dual selections:** 7 × 6 × 12 all return. Both goals and both rule provenances remain present; every lucky family is retained exactly once; selected curated colors stay in the originating subtype palette; accessory fallbacks stay semantic; no unrelated family or harder-color promotion is introduced.
- **42 general dual selections:** 7 × 6 all return with semantic-only colors and no subtype claims/HEX values.
- **Order independence:** every weekday/pair in general mode and every weekday/pair/subtype in personalized mode returns the same canonical recommendation for A+B and B+A. UI history is not domain order.
- **Single regression:** 336 personalized and 28 general single-goal recommendations match the pre-extension engine fields and pieces.

These checks are production-logic tests in `src/domain/luckyColor/multiGoal.test.ts`, not manually enumerated claims.

## Z. Mutation testing

Temporary mutations were applied and restored without committing them. Focused tests caught each of the requested failure classes: allowing zero; allowing three; dropping the second claim; using input/click order as domain order; blending the second general family; marking a support shoe lucky; fabricating a fallback HEX; resetting the second goal on refresh; dropping the second goal on locale change; breaking scalar persistence migration; making composition depend on the first input rule; and duplicating a same-family visual instead of collapsing provenance.

## AA–AD. Validation

The final gate is recorded after the documentation and test updates:

```text
npm test
npx vitest run src/domain/personalColor/scoringAudit.test.ts
npm run build
git diff --check
```

The focused multi-goal suite includes the 70/504/42/order/single audits above. The pre-existing quiz audit remains 177,147/177,147.

## AE–AF. Privacy, dependencies, and documentation

The feature is local-only and adds no backend, network/API, AI, weather/location, ads, dependency, account, or native/APK behavior. The storage key contains only canonical goal IDs. This record and the plan update are the only new Slice 4.1 documentation.

## AG. Slice 5 handoff

Slice 5 should render `LuckyGoalsOutfitRecommendation` directly. Use `luckyClaims` for each family and its goal provenance, `claim.adaptation` for exact selected HEX/name or null semantic fallback, `claim.suitability` and `claim.placement` for placement explanation, and `claim.pieceRole`/`pieceSlot` to map the claim to `pieces`. Use `pieces[].colorRole` to distinguish lucky from supporting colors. Do not infer priority from array order, goal type, or garment role; the arrays are canonical deterministic presentation order only.

The visual board remains out of scope here. No final garment illustrations, major hero redesign, or animation polish were added.

## AH–AJ. Commit and final confirmations

The commit, final status, and all validation counts are reported with the implementation handoff. The final state must confirm: exactly four goals; one minimum/two maximum; third-click oldest replacement; no goal priority; order-independent domain composition; both distinct families preserved; same-family collapse supported; both rule provenances preserved; no blending/derived family/unrelated substitution; no invented fallback HEX; old scalar preference readable; goals survive midnight and locale; missing profile supports dual general mode; no fake subtype; single-goal stability; no Slice 1/2/V1.2 changes; no final garment board/major redesign; no AI/backend/network/ads/weather/dependency/native work; no push/deploy/tag/version bump.
