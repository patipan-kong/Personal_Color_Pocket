# V1.3 Slice 4 — Daily Lucky Color Goal Selection + Recommendation UI

**Status:** complete. This is the first user-visible V1.3 slice; it orchestrates the frozen Slice 1–3 engines and adds no new lucky-color or Personal Color decisions.

## A–D. Entry state, files, navigation, and hierarchy

Entry was `main` at `5da8ef7bfd23c6af640a87fdf83f45756ef03c98` (`feat: add lucky color outfit recommendations`), package `1.1.0`, with a clean tree. The feature adds `src/dailyLuckyColor/DailyView.tsx`, `src/dailyLuckyColor/presentation.ts`, and `src/services/dailyLuckyColorGoal.ts`; updates `App`, locale copy/types, CSS, and focused tests.

The existing app is a one-page view state rather than a router. Daily is therefore a new `daily` view: a quiet welcome-screen link makes it available without a profile, while a profile adds it as the first bottom-navigation item. This preserves the existing navigation and makes the core daily feature discoverable. The compact hierarchy is: local today/weekday; four goals; broad lucky family; personal/general explanation; textual outfit pieces; then a quiet source disclosure. Slice 5 owns the garment-board visual.

## E–I. Goal, persistence, date, and rollover

There are exactly four single-select canonical goal IDs: `work`, `money`, `luck`, and `mentor-support`. The default is Work. The radiogroup updates the local recommendation immediately, supports arrows, has a visible check/border selection state, and never stores translated labels.

`personal-color-pocket:daily-lucky-color-goal:v1` is a small local preference, separate from the quiz/profile record. Storage failure and malformed values fall back to Work; no profile version or migration changes were made.

The UI owns `new Date()` through a small injectable clock boundary. It passes the explicit date to `getLuckyColorForDate()` and displays `luckyWeekdayForDate()`; those use the device-local civil day. It schedules one next-local-midnight refresh and rechecks on focus and visibility return, so sleep/resume and timer drift recover naturally. The selected goal remains unchanged through a day refresh. An invalid/throwing clock produces an explicit UI error instead of fabricating Sunday or a recommendation.

## J–Q. Recommendation presentation

A valid current subtype produces personalized mode through `recommendLuckyRuleOutfit(rule, subtype)`. The UI shows the source-level family separately from the exact Slice 2/3 curated shade and uses the returned V1.2 structured `en`/`th` name directly. It shows the profile subtype and translates placement into short friendly prose; it never exposes suitability tiers or raw domain enum values.

Missing or invalid subtype uses general mode: a broad family and semantic outfit structure remain useful, with a non-blocking existing-quiz CTA. No subtype or exact Personal Color HEX is invented. In accessory fallback, the lucky piece stays semantic, has a broad-family display token and a visible Lucky color badge, while exact supporting palette pieces remain Personal Color colors.

`LUCKY_FAMILY_DISPLAY_SWATCHES` is a complete deterministic ten-family mapping in `src/dailyLuckyColor/presentation.ts`. It is presentation-only—not knowledge data, palette data, a recommended shade, or input to slices 1–3/V1.2. The outfit summary has neutral Top, Bottom, Shoes, and optional Accessory labels. The one lucky role has a text badge, not color-only indication.

## R–U. Framing, disclosure, locale, accessibility

The hero explicitly frames the result as a Thai lucky-color tradition/cultural belief and makes no causal or scientific claim. The collapsed “About today’s lucky colors” disclosure says Personal Color changes shade/placement, not family, and links statically to the frozen Thai Rath S1 source with KTC corroboration; nothing is fetched at runtime. Long Taksa history and source comparison remain deferred to V1.4 Learn.

All new visible copy exists in typed EN and TH records. Locale changes presentation strings only: it retains goal ID, date, family, recommendation structure, and exact curated HEX. The implementation uses headings, a proper labeled `radiogroup`/`radio` state, arrow-key selection, native `details`, semantic buttons/links, text labels beside every swatch, existing visible focus styling, and existing reduced-motion handling.

## V–W. Responsive/browser and product review

CSS is mobile-first: the control grid uses two columns where space permits, a single column below 420px, and no fixed-width outfit text. At 360/430 the labels wrap, the CTA stays in general mode, and pieces remain stacked rows; the existing tablet (768) and desktop (1280) layout keeps the Daily page at a restrained 860px readable width. The in-app browser was used to verify the actual running general screen, all goal interactions, source disclosure, and EN→TH switch. Its automation surface did not expose exact viewport resizing, so 360/430/768/1280 are CSS/breakpoint inspections rather than claimed physical-device tests.

Representative engine/UI review covered Warm Spring Monday Work (personalized Green top), Soft Autumn Monday Luck (honest Purple accessory fallback), and no-profile Thursday Work/Money (general Blue/Yellow). The fixed Slice 1 table cannot produce every broad family from its four positive goals, so hypothetical black/white general cases remain a Slice 3/presentation token test rather than an invented UI route. In each reviewed live case the family, role badge, belief framing, and non-blocking general CTA are understandable without reading a long explanation.

## X–Z. Tests, mutations, regression, limits

Focused tests cover entry/navigation, four goals, Work default, immediate rules, persistence and malformed storage, local weekday/focus rollover, preserved goal, personalized/general/invalid-profile behavior, exact structured shade name, semantic accessory fallback, subtype refresh, EN/TH locale presentation, keyboard selection, disclosure, framing, and ten display tokens. Temporary source mutations were made and restored for: a fifth goal, a wrong goal click target, local-to-UTC weekday lookup, resetting goal in `refreshToday`, semantic fallback rendered as a palette shade, a fabricated subtype when profile is absent, locale-dependent family output, stale subtype memoization, removal of the lucky badge, and removal of belief framing. Each focused assertion failed for its targeted mutation.

Full regression runs are recorded with the commit. No Slice 1/2/3 or V1.2 engine file changed, and there is no backend, API, weather, location, AI, ad, dependency, native/APK, version, deployment, tag, or push work. A remaining limitation is that this slice is textual by design; it has no deterministic garment illustration, manual date picker, or long-form learning content.

## AA. Slice 5 handoff

Slice 5 should consume the frozen Slice 3 `pieces`, `colorRole`, `strategy`, `luckyPlacement`, exact palette colors, and Slice 4 semantic-family token/badge labels to build a deterministic accessible garment board. It may improve silhouettes and visual hierarchy, including justified presentation-specific visuals, but must not change the rule, curated shade, placement, supports, or general/accessory truthfulness.
