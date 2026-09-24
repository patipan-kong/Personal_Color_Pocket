# V1.3 Slice 3 — Deterministic outfit recommendation engine

**Status:** complete. This is a local, pure domain engine. It creates a small semantic outfit structure only; it renders nothing and stores nothing.

## A–F. Entry state, API, model, and modes

| Item | Finding |
|---|---|
| Entry state | `main` at `8e5c6c691d6d62e17ab8bf2d854afbc7d96f4915`, clean tree, package `1.1.0`. |
| Files added | `src/domain/luckyColor/outfit.ts`, `src/domain/luckyColor/outfit.test.ts`, and this record. |
| Rule API | `recommendLuckyRuleOutfit(rule, subtype?)` accepts a real positive Slice 1 rule, rejects kalakini/malformed rules, and retains the canonical rule for provenance. |
| Family API | `recommendLuckyFamilyOutfit(family, subtype?)` is the composition-level entry point and supports the general 10-family audit. |
| Modes | `personalized` for a supplied valid subtype; `general` otherwise. |
| Slice 2 | Personalized mode calls `adaptLuckyColorToSubtype` exactly once and returns its exact adaptation unchanged. It does not repeat family mapping, candidate ranking, Harder handling, or lucky swatch naming. |

`LuckyOutfitRecommendation` contains `mode`, `luckyFamily`, `strategy`, `luckyPlacement`, optional canonical `luckyRule`, optional Slice 2 `adaptation`, and a unique-role `pieces` list. A piece is `top`, `bottom`, `shoes`, or `accessory`; its `colorRole` is `lucky`, `supporting-neutral`, or `supporting-personal-color`.

Exact personalized colours are `{ kind: 'palette', id, hex, paletteName, paletteCategory, name }`, where `name` is V1.2 `describeColor()` output. General colours are `{ kind: 'semantic' }` tokens only: `lucky-family`, `light-neutral`, or `neutral`; they contain no invented HEX, subtype, or Personal Color claim.

## G–P. Placement, support, general mode, and stable choices

| Slice 2 suitability | Strategy | Lucky role | Supporting top |
|---|---|---|---|
| `near-face` | `lucky-top` | top | — |
| `main-piece` | `lucky-main` | bottom, as the prominent non-near-face piece | subtype Best |
| `below-face` | `lucky-bottom` | bottom | subtype Best |
| `accessory` | `lucky-accessory` | semantic accessory | subtype Best |

`luckyPlacement` is an outfit-level value (`top`, `main-piece`, `below-face`, or `accessory`), deliberately separate from Slice 2’s Personal Color suitability. `main-piece` remains distinct from `below-face` in both this semantic field and `strategy`, even though the compact model represents both with the bottom role. The former is curated wearable prominence; the latter is explicitly a Harder/below-face accommodation.

Supporting selection is intentionally small and deterministic. For a lucky top, the engine uses the subtype’s second Neutral for bottom and last Neutral for shoes. When the lucky colour is not near-face, it uses the first Best for top and the last Neutral for shoes; an accessory fallback also uses the second Neutral for bottom. The selector excludes an exact lucky HEX and keeps shoes distinct from bottom. No support is drawn from Harder, and no optional accent is included: the lucky colour is already the visual accent.

`pairingSuggestions()` is **not used**. It is a distance-based Manual Checker helper whose target distance and candidate pools answer a different question from choosing calm outfit neutrals. V1.2 photo placement and presentation-specific style guides are likewise not used: Slice 2 suitability is the relevant placement authority, and Slice 3 has no presentation input.

General mode is always `lucky-top`: semantic lucky-family top, semantic light-neutral bottom, semantic neutral shoes. It is deliberately useful without implying a subtype-specific shade. Controlled date/goal variety is deferred; a date is unnecessary after the lucky rule is resolved, and a stable canonical outfit is clearer at this stage.

## H. Neutral palette audit

Every subtype has five curated, V1.2-named Neutral swatches. Palette order is existing curation, not generated ranking; it safely supplies the fixed bottom/shoe roles above.

| Subtype | Neutral structure (V1.2 structured names) |
|---|---|
| light-spring | Cream, Light Beige, Beige, Light Warm Gray, Navy |
| warm-spring | Cream, Beige, Light Brown, Brown, Navy |
| clear-spring | Off-White, Beige, Light Brown, Brown, Navy |
| light-summer | Off-White, Light Gray, Beige, Blue Gray, Navy |
| cool-summer | Off-White, Gray, Taupe, Deep Blue Gray, Charcoal |
| soft-summer | Light Gray, Warm Gray, Warm Gray, Cool Gray, Cool Charcoal |
| soft-autumn | Beige, Light Taupe, Light Brown, Warm Gray, Warm Charcoal |
| warm-autumn | Cream, Light Brown, Brown, Deep Olive, Warm Charcoal |
| deep-autumn | Cream, Brown, Brown, Deep Brown, Charcoal |
| deep-winter | White, Gray, Charcoal, Charcoal, Black |
| cool-winter | White, Light Gray, Charcoal, Navy, Black |
| clear-winter | White, Light Gray, Cool Gray, Navy, Black |

The audit found five neutrals per subtype, no missing support pool, and distinct bottom/shoe selections. White/gray/black-like supports remain subtype-owned palette colours; they are never asserted as a second lucky claim.

## L–R. Accessory fallback and complete audits

For Slice 2 accessory fallback, Slice 3 makes the lucky piece a distinct `accessory` with semantic `{ token: 'lucky-family', luckyFamily }`. It never promotes it to shoes and never invents an exact swatch. The top is curated Best; bottom and shoes remain curated Neutrals.

All 120 subtype × family personalized inputs returned complete recommendations. Strategy counts mirror Slice 2’s suitability outcome: `lucky-top` 59, `lucky-main` 24, `lucky-bottom` 23, and `lucky-accessory` 14. All 10 general families returned a three-piece semantic recommendation.

## S–V. Supporting colours and human review

Across the 120 personalized recommendations, 36 unique supporting palette swatches are used: only `best` for non-lucky near-face tops and `neutrals` for bottoms/shoes. No supporting swatch comes from Harder. The fixed neutral roles avoid same-role and bottom/shoe duplication; the engine avoids an exact selected lucky HEX.

Representative checks:

| Case | Outcome |
|---|---|
| Light Spring black | semantic lucky accessory; curated Best top and Neutral bottom/shoes, not a black shirt |
| Light Spring yellow / green | lucky Best top with quiet Neutral bottom/shoes |
| Warm Spring green / blue | lucky Best top; gray is a Harder/below-face bottom with Best top |
| Soft Summer orange / black | Harder lucky bottom; Best top protects the near-face area; pink is lucky Best top |
| Cool Summer red | Harder lucky bottom; yellow accessory fallback; blue lucky Best top |
| Soft Autumn purple / orange | semantic lucky accessory; blue lucky Best top |
| Deep Autumn white / pink | white is a Neutral main-piece bottom; pink is Harder/below-face; green is lucky Best top |
| Cool Winter orange / yellow / black | orange Harder bottom, yellow accessory fallback, black Neutral main-piece bottom |
| Deep Winter pink / green / white | pink/green lucky Best tops; white Neutral main-piece bottom |

The compact selection makes the lucky role unambiguous and keeps a curated Best near the face whenever the lucky colour cannot go there. No contrast engine was needed: curated Best and separated ordered Neutrals provide distinct, calm support choices in every audited case. A later visual/UI slice may make presentation-specific garment illustration decisions without changing this output.

## W–Z. Invariants, mutations, performance, and regression

Tests assert all 120 personalized and 10 general outputs; exactly one lucky role; preserved lucky family; exact Slice 2 lucky HEX/name when present; semantic no-HEX accessory fallback; subtype-palette membership of every exact personalized colour; no Harder near-face support; required top/bottom/shoes; unique garment roles; no general-mode palette/subtype data; deterministic repeated output; and explicit invalid family/subtype/rule failures.

Temporary source mutations were performed and restored for: marking support as lucky, unrelated lucky family, top placement for accessory fallback, foreign support HEX, Harder Best support, changed Slice 2 lucky HEX, subtype leakage into general mode, `Math.random`, omitted lucky role, and duplicate roles. Each made focused tests fail.

The 130-call audit executes in the focused Vitest test in well under a tenth of a second of test time. Full V1.2/Slice 1/Slice 2 regression tests remain green; no canonical rule, adaptation, palette, taxonomy, threshold, Manual Checker, Photo Matcher/Sampler, pairing helper, placement guide, or quiz code changed.

## AA–AB. Limits and Slice 4 handoff

This slice does not choose optional accents, exact general-mode swatches, garment nouns, presentation variants, UI copy, storage, date orchestration, or visuals. A later visual layer may add a small broad-family visual-token decision if it needs an exact generic accessory swatch; it must not be invented here.

Slice 4 should resolve an explicit local `Date` and goal through Slice 1, obtain an optional validated profile subtype, then call `recommendLuckyRuleOutfit(rule, subtype?)`. It should render `mode`, `luckyFamily`, `strategy`, `luckyPlacement`, source rule provenance where appropriate, and `pieces`. Palette pieces have exact HEX/V1.2 names; semantic pieces must be rendered as broad concepts. Slice 5 remains responsible for garment visuals.
