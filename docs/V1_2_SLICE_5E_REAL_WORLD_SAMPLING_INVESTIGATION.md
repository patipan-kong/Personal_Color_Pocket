# V1.2 Slice 5e — Real-World Photo Sampling Investigation

Status: **investigation only.** Written 2026-09-23 at `main` after `439f4f5` (Slice 5d).

- **No production behaviour changed.** The production bundle is byte-identical (§20).
- Plan: [V1_2_PHOTO_COLOR_CHECKER_PLAN.md](V1_2_PHOTO_COLOR_CHECKER_PLAN.md).
- Contracts studied: [Slice 1 sampling](V1_2_SLICE_1_SAMPLING_ENGINE.md), [Slice 2 matching](V1_2_SLICE_2_PHOTO_MATCH_ENGINE.md), [Slice 4 coordinates](V1_2_SLICE_4_INTEGRATION_COORDINATES.md), [Slice 5c/5d result display](V1_2_SLICE_5D_UNIFIED_RESULT_DISPLAY.md).

**Evidence** lives in `src/domain/photoColor/investigation/`, which is test-only (a test proves no app file imports it):

| File | Role |
|---|---|
| `lightModel.ts` | a minimal material × light → sRGB model, synthetic scenes, and an OKLab→sRGB inverse |
| `diagnostics.ts` | the point-diagnostic harness (§5) |
| `experiments.ts` | every matrix and experiment in this record |
| `report.ts` | prints every table in this record |
| `investigation.test.ts` | 31 assertions that pin the findings, plus the opt-in report |

To regenerate the tables, run `PHOTO_INVESTIGATION_REPORT=1 npx vitest run src/domain/photoColor/investigation`.

Category strings in the tables use one letter per subtype, in `subtypeOrder`:
- **Subtype order:** light-spring, warm-spring, clear-spring, light-summer, cool-summer, soft-summer, soft-autumn, warm-autumn, deep-autumn, deep-winter, cool-winter, clear-winter.
- **Letters:** N = near-face, B = neutral-base, R = related, A = away-from-face, O = outside.
- **"chg n"** is the number of subtypes whose category differs from the material under neutral light.

---

## 1. Triggering real-world observation

- **What the user tapped:** a T-shirt that looks white or very light cool-white to them, in an outdoor photo.
- **What the Photo Checker sampled:** **`#9FABB4`**, a visibly darker blue-grey (OKLab L 0.735, chroma 0.019, hue 240°).
- **What it showed:**
  - "Not ideal near your face", which is the `weak` level (`away-from-face`)
  - a cool blue-grey / muted palette comparison

**The question is not whether that verdict is right for `#9FABB4`, but why a garment that looks white produced `#9FABB4`.**

**The real photo was not available to this investigation.** It was not in the conversation or the repository. As required, it was not reconstructed from a screenshot. This record uses only the reported number (`#9FABB4`, seen by a person as white fabric) as motivation. Every image here is synthetic.

## 2. Scope and frozen production behaviour

**Frozen:**
- **Sampler:**
  - sampling radius 24
  - disc region
  - alpha ≥ 250
  - 20% L trim
  - sRGB mean
  - spread
  - `MIXED_SPREAD` 0.045
  - highlight (all channels ≥ 250)
  - shadow (all channels ≤ 5)
  - clipped fraction 0.35
  - OKLab conversion
- **Photo Match:** distance (kL 0.5, hue ramp), thresholds 0.045 / 0.085, the five categories, placement, suitability verdicts and pairings.
- **Everything else:** the image pipeline (1600 px working image), coordinate mapping, the Manual Checker, the quiz and the palettes.

**How the freeze is enforced:**
- `investigation.test.ts` re-asserts every sampler and matcher constant and the 1600 → 24 px radius.
- A mutation check confirmed each guard trips (§20).

**Not added:**
- no object or garment detection
- no white-balance correction
- no multi-tap
- no AI
- no dependency
- no UI

## 3. Current sampler semantics

`samplePhotoRegion` answers exactly one question: **"what is the typical colour of the pixels in this disc of this encoded photo?"**
- It takes every opaque pixel whose centre is within 24 working-image px (1,804 pixels for a full disc).
- It drops the darkest 20% and brightest 20% by OKLab L, then averages the remaining 60% in 8-bit sRGB.

That makes it robust to **local outliers**: specks, lint, a pinstripe, 15% glare plus 15% crease.

It is, by design, **blind to anything that affects the whole disc equally**:
- the light falling on the fabric
- a colour cast
- the camera's white balance or exposure

Those change every pixel together, so trimming cannot remove them, and they leave the disc just as uniform.

The harness recomputes the production estimator independently for all 21 fixtures and gets the same HEX (asserted).

## 4. Current warning semantics

| Flag | Actual rule | What it really means | Current user copy (EN) |
|---|---|---|---|
| `mixed` | RMS OKLab spread of the retained 60% > 0.045 | **The disc contains visibly different colours or lightnesses:** a print, a stripe, a boundary, or a shadow *edge* | "This spot mixes several colors…" |
| `highlight` | > 35% of opaque pixels have **all** channels ≥ 250 | **Clipped bright:** the sensor/encoder ran out of range | "Strong light may make this color look lighter…" |
| `shadow` | > 35% of opaque pixels have **all** channels ≤ 5 | **Clipped dark:** near-black crush | "Shadow may make this color look darker…" |

**`shadow` is option A in the brief, literally clipped near-black pixels. It is not a photographic-shadow detector** (§8).

The shadow copy ("Shadow may make this color look darker") describes ordinary shadow. That promises more than the rule can detect. `highlight` is likewise **clipping**, not "brightly lit" (§9).

## 5. Diagnostic methodology

**The harness.** `diagnosePoint(image, point, radius = sampleRadiusFor(image))` and `diagnoseTap(image, tap)` report:
- **Production numbers**, from calling the unchanged `samplePhotoRegion`:
  - the mapped point (unchanged Slice 4 `displayToImage`) and the radius
  - region, opaque and kept pixel counts
  - RGB, HEX, OKLab, spread, highlight and shadow fractions, and flags
- **Investigation-only numbers**, which are never fed back into production:
  - the same point at radii 3 / 6 / 12 / 24 / 36 / 48
  - the untrimmed mean, the per-channel median of the kept pixels, and the kept pixel with the median L
  - L percentiles P10–P90 and chroma P10 / P50 / P90
  - the darkest and brightest kept pixel
  - the median-vs-production ΔE
  - cast: chroma, hue, a rough tint family, mean B−R and G−(R+B)/2
  - a **relative-light context**: the share of pixels in the ring out to 4 × radius that are ≥ 0.10 L lighter with similar chroma

**The light model** (`lightModel.ts`) is `pixel = encode(clip(decode(material) × gain[channel] × intensity)) + noise`:
- "Material" is how the fabric renders under neutral normal light.
- Intensity models exposure or shade. Channel gains model an environmental cast.
- Noise is seeded ±4 per channel.

**It is not a camera simulation.** It has no tone curve, AWB, HDR, noise reduction or JPEG. It shows which failure modes exist and roughly how big they are. It does **not** claim to reproduce the real photo.

**Scenes** are 600 × 600 (radius 24 exactly as in production) or a 1200 × 600 "garment" (§13).

**"White"** in the experiments is `#F4F4F2`, a white T-shirt as a camera typically renders it without clipping. It is shown separately from pure `#FFFFFF`.

## 6. Multi-radius findings

| Scene | r 3 | r 6 | r 12 | r 24 (prod) | r 36 | r 48 |
|---|---|---|---|---|---|---|
| F: white in shade + sky (uniform) | #9EABB4 | #9FABB4 | #9FABB4 | **#9FABB4** | #9FABB4 | #9FABB4 |
| E, H, I, B, C, D (uniform light / cast) | identical at every radius | | | | | |
| J: white with folds (L at r) | 0.847 | 0.859 | 0.898 | **0.944** | 0.955 | 0.943 |
| K: white, navy edge 6 px away | #F4F4F2 | #F4F4F2 | #F4F3F2 | **#C1C4C9 mixed** | #AFB3BA mixed | #A6AAB2 mixed |
| L: white, skin edge 10 px away | #F4F4F2 | #F4F4F2 | #F4F4F2 | **#F1EDEA mixed** | #EBE1DA mixed | #E8DAD1 mixed |
| M4: soft shadow edge through tap | #CFD4D6 | #CFD4D6 | #CFD3D6 | **#CED3D5 mixed** | #CDD2D5 mixed | #CCD1D4 mixed |
| Garment "shade 1/2" | #9FABB4 at every radius | | | | | |

**Findings:**
- **Uniform light or cast does not depend on radius at all.** The white-in-shade sample is `#9FABB4` from r = 3 to r = 48. **No radius recovers white.**
- **Near a boundary, a smaller radius avoids contamination and a larger one adds it.** The production 24 px is where the `mixed` flag starts to fire, which is the intended behaviour.
- **In folds a small radius follows the local crease.** r = 3 on the fold was 0.10 L darker. The 24 px disc averages the folds, which is closer to the fabric overall.
- A boundary-contaminated white (K) produces another **blue-grey, `#C1C4C9`**. But it is flagged `mixed`, so a contaminated disc is distinguishable from the uniform shade case.

## 7. Patch-distribution findings

For the production 24 px region:

| Fixture | Prod HEX | Median RGB | ΔE(median, prod) | L P10 / P50 / P90 | Darkest … brightest kept |
|---|---|---|---|---|---|
| F: white in shade | #9FABB4 | #9FABB4 | 0.000 | 0.727 / 0.734 / 0.742 | #9FA9B1 … #9FAEB0 |
| D: real blue-grey | #9FABB4 | #9FABB4 | 0.000 | 0.728 / 0.734 / 0.742 | #9CAAB2 … #A2ADB0 |
| J: folds | #EDECEB | #F0F0EE | 0.011 | 0.851 / 0.957 / 0.970 | #D4D9D7 … #F5F4F0 |
| K: navy edge | #C1C4C9 | #F2F2F1 | 0.142 | 0.285 / 0.963 / 0.972 | navy … white |
| L: skin edge | #F1EDEA | #F3F3F2 | 0.016 | 0.722 / 0.964 / 0.973 | skin … white |
| M3: hard shadow edge | #C9D0D3 | #CAD0D3 | 0.001 | 0.729 / 0.851 / 0.971 | #9EAAB7 … #F4F5F1 |

**Findings:**
- **The shaded-white patch and a genuinely blue-grey patch have identical distributions.** Their percentiles match within 0.001 L, both are tight (P10–P90 = 0.015 L), and the median equals the trimmed mean. **Nothing inside the disc separates them.**
- **A median helps only where a minority of the disc is a different colour** (K, L). There it recovers the white (K: ΔE 0.142 → the median is white). But those cases already raise `mixed`.
- **For a shadow edge through the middle** (M3) the median is just as "between" as the mean.
- **Replacing the estimator would not touch the reported case.**

## 8. Shadow findings

- **The rule is all three channels ≤ 5 on more than 35% of pixels.** A uniform patch needs this much light (relative to normal light) before the flag fires:

  | Material | Highlight fires at ≥ | Shadow fires at ≤ |
  |---|---|---|
  | white #F4F4F2 | **1.07×** | **0.0018×** (~9 stops under) |
  | cream #F3E5C8 | 1.65× | 0.0019× |
  | beige #D6C2A4 | 2.56× | 0.0025× |
  | light pink #F2C6CF | 1.69× | 0.0019× |
  | light blue #B3CDE6 | 2.11× | 0.0021× |
  | navy #1F2A44 | never | 0.029× (~5 stops under) |
  | black #1C1C1E | never | 0.13× (~3 stops under) |
  | observed #9FABB4 | 2.75× | 0.0037× |

- **White fabric in open shade (0.45×), warm shade (0.55×) or even 0.1× light: `shadowFraction` = 0, no flag** (asserted).
- **The real white-shirt case could be clearly shadowed and would never trigger `shadow`.** Only near-black material that is badly underexposed crosses it.
- **Conclusion: `shadow` = "clipped dark".** Its current copy implies ordinary shadow detection, which it cannot do.

## 9. Highlight findings

- **Normally exposed white fabric only needs about 7% more light to clip**, so sunny photos of white clothes commonly raise `highlight`. Fixture A (`#FFFFFF`) raises it, and so do exposures of 1.2× and 1.4× of the white series.
- **"Brightly illuminated" is not clipped.** Cream at 1.4× (`#FFFFE8`) and light pink at 1.2× (`#FFD7E0`) are lighter than the material but raise **no** flag.
- **So `highlight` means "clipped bright".** The copy ("Strong light may make this color look lighter") is reasonable. But it fires often on genuinely white garments (where the clipped colour is roughly right) and misses unclipped over-lightening (where the colour is wrong).
- **Clipping also destroys chroma:** cream at 1.4× loses 0.011 of its chroma, and clipped cream reads as white.

## 10. Mixed-region findings

| Fixture | Spread | `mixed` |
|---|---|---|
| M1 uniform blue-grey | 0.007 | – |
| M2 white, smooth shade gradient (across 600 px) | 0.007 | – |
| M5 white, uniform blue cast | 0.006 | – |
| M6 white with grey folds | 0.025 | – |
| M4 white, soft (40 px) shadow edge through tap | 0.054 | ✓ |
| M3 white, hard shadow edge through tap | 0.113 | ✓ |
| M7 6 px white/rose check | 0.128 | ✓ |
| M8 4 px navy/cream stripe | 0.319 | ✓ |
| M9 white/navy boundary through tap | 0.337 | ✓ |
| K, L contamination 40% / 25% | 0.285 / 0.062 | ✓ |

**`mixed` catches:**
- prints and stripes
- boundaries
- shadow *edges* inside the disc

**`mixed` cannot catch** anything that shifts the whole disc equally:
- uniform shade
- uniform cast
- a gentle gradient
- soft folds

**A low-spread blue-grey patch is *consistent* and can still be *colour-cast relative to the physical object*.** `mixed` measures internal consistency, not truth.

## 11. Exposure matrix

Linear intensity × material: `ΔE_OK` vs the material under neutral light / subtypes changed.
- 0.7–1.4 is roughly ±½ stop of ordinary exposure error.
- 0.35–0.5 is roughly open shade.

| Material | 0.35 | 0.5 | 0.7 | 0.85 | 1.2 | 1.4 |
|---|---|---|---|---|---|---|
| white #F4F4F2 | 0.284 / 8 | 0.200 / 6 | 0.109 / 5 | 0.051 / 2 | 0.034 / 0 (→ #FFFFFF, highlight) | same |
| cream #F3E5C8 | 0.273 / 9 | 0.191 / 7 | 0.104 / 6 | 0.049 / 4 | 0.052 / 6 | 0.071 / 6 |
| beige #D6C2A4 | 0.244 / 7 | 0.170 / 9 | 0.093 / 8 | 0.044 / 4 | 0.051 / 5 | 0.097 / 5 |
| light pink #F2C6CF | 0.256 / 10 | 0.178 / 10 | 0.097 / 7 | 0.046 / 3 | 0.048 / 6 | 0.084 / 8 |
| light blue #B3CDE6 | 0.248 / 12 | 0.173 / 12 | 0.094 / 9 | 0.044 / 2 | 0.052 / 6 | 0.096 / 7 |
| navy #1F2A44 | 0.087 / 5 | 0.060 / 6 | 0.033 / 3 | 0.016 / 2 | 0.017 / 1 | 0.034 / 1 |
| black #1C1C1E | 0.068 / 2 | 0.049 / 2 | 0.026 / 0 | 0.013 / 0 | 0.013 / 2 | 0.026 / 6 |

**Findings:**
- **Photography alone crosses category boundaries for light colours.** A 15% underexposure (0.85×) already changes 2–4 of 12 subtypes for every light material, and half a stop (0.7×) changes 5–9.
- Light materials move 3–4× further than dark ones in OKLab for the same factor.
- **Shade (0.45–0.5×) moves white by ΔE ≈ 0.2.** That is 4× the matcher's "close" radius and 2.4× its "related" radius.

## 12. Colour-cast matrix

Subtypes changed (of 12) per cast. Modest ≈ ±7% on one channel pair, strong ≈ ±15–18%.

| Material | cool m / s | warm m / s | green m / s | magenta m / s | max ΔE |
|---|---|---|---|---|---|
| white | 0 / 1 | 1 / 2 | 0 / 0 | 0 / 3 | 0.043 |
| cream | 2 / 4 | 4 / 6 | 4 / 7 | 1 / 5 | 0.041 |
| beige | 3 / 4 | 3 / 4 | 1 / 3 | 2 / 5 | 0.036 |
| light pink | 4 / 4 | 2 / 4 | 0 / 5 | 7 / 8 | 0.037 |
| light blue | 2 / 5 | 4 / 7 | 2 / 3 | 1 / 2 | 0.037 |
| navy | 1 / 1 | 1 / 4 | 0 / 1 | 1 / 2 | 0.015 |
| black | 0 / 0 | 0 / 0 | 0 / 1 | 0 / 0 | 0.011 |

**Findings:**
- **A cast alone barely moves *white's* category.** The matcher ignores hue below chroma 0.01, so a strong cool cast gives `#E3F4FF` and changes one subtype.
- **Tinted light materials** (cream, pink, light blue) **are the cast-sensitive ones.** A strong cast changes 4–8 subtypes.
- **Neutral colours do acquire an apparent hue.** White under a strong cool cast has chroma 0.023 at hue 236°, and under strong warm light chroma 0.037 at 88°. Once chroma passes 0.02 the matcher weighs that hue fully.

**The white-shirt case combines both effects:**
- **A lightness drop does most of the damage.** ΔL −0.232 accounts for 0.232 of the total ΔE 0.233.
- **A cool cast adds a tint** (chroma 0.019, hue 240°). That turns "grey" into "blue-grey" and changes which palette colour it resembles.

## 13. Multi-point sensitivity

**The scene.** One nominal white garment (1200 × 600). Left to right:
- sunlit (1.08×)
- normal light with a mild cool ambient cast
- folds (down to 0.7×)
- a 60 px soft shadow edge
- open shade with skylight

| Tap | HEX | L | Spread | Categories |
|---|---|---|---|---|
| lit 1, lit 2 | #FEFCF7 | 0.991 | 0.006 | BABBBAAAABBB |
| normal 1, 2 | #F1F4F5 | 0.965 | 0.006 | BABBBAAAABBB |
| fold shadow | #D7DADB | 0.886 | 0.019 | ARRBBBAAARBB |
| between folds | #E8EBED | 0.938 | 0.017 | BABBBBAAABBB |
| fold slope | #DBDEDE | 0.898 | 0.026 | AABBBBAAABRB |
| shadow edge | #CDD3D7 | 0.863 | 0.037 | ARRBRBAAARBB |
| shade 1, 2 | **#9FABB4** | 0.735 | 0.007 | BARBBBROAABA |

- **One garment spans L 0.735–0.991 (ΔE up to 0.26)** and 4+ different category strings, **with no warning on any tap**. The largest spread, 0.037, is still under 0.045.
- **Finger jitter (±12 px):** 0 ΔE on even areas, lit or shaded. 0.015 on folds. **0.064 and 7 subtypes changed at the shadow edge.**
- **Sweep across the edge:** at 10 px steps, the category string changes 6 times between x = 800 and x = 840. Beyond that, it is stable again in the shade.

**Answer:** single-tap sampling is **stable to where the user taps within an evenly lit area**, and **very sensitive to which lighting zone they tap**.

## 14. Multi-tap experiments (offline only)

**Strategies** over three production samples:
- `single`: each tap on its own
- `meanRgb`
- `medianL`: the tap with the middle lightness, which is a real sample
- `oklabMean`
- `lightest`: the lightest tap without `highlight`

**Setup:**
- Each triple is scored against the material under neutral light, across all 120 triples of the 10 garment taps.
- "Agree" means the same category as the material, per subtype.

| Scene / material | single | meanRgb | medianL | oklabMean | lightest |
|---|---|---|---|---|---|
| white (median ΔE / agree) | 0.068 / 77% | 0.069 / 71% | 0.068 / 79% | 0.070 / 71% | **0.025 / 97%** |
| grey-beige #A39A8E | 0.048 / 65% | 0.049 / 55% | 0.048 / 64% | 0.051 / 54% | 0.018 / 78% |
| light blue #B3CDE6 | 0.059 / 58% | 0.057 / 64% | 0.059 / 69% | 0.059 / 64% | 0.022 / 75% |
| **strong sun (1.35×)**, grey-beige | 0.073 / 62% | **0.042** / 59% | 0.048 / 63% | 0.042 / 59% | **0.073 / 69%** (p90 0.073) |

**Named failure cases.** Cells show ΔE vs the material / subtypes changed. In these, `single` is the *first* tap, which is deliberately the good one.

| Case (3 taps) | meanRgb | medianL | lightest |
|---|---|---|---|
| one tap on a clipped highlight | 0.009 / 0 | 0.000 / 0 | 0.000 / 0 |
| one tap in deep shadow | **0.136 / 6** | 0.015 / 0 | 0.000 / 0 |
| one tap half on skin (flagged `mixed`) | 0.045 / 3 | 0.012 / 0 | 0.000 / 0 |
| patterned (stripe) | 0.302 / 8 | 0.302 / 8 | 0.292 / 7 |
| genuinely dark navy (lit / normal / shade) | 0.007 / 2 | 0.000 / 0 | **0.030 / 1** |
| genuinely muted grey-beige (lit / normal / shade) | 0.016 / 2 | 0.000 / 0 | **0.072 / 5** |
| **white, all three taps in the same shade** | **0.233 / 6** | **0.233 / 6** | **0.217 / 6** |

**Findings:**
- **Three taps do not help the reported case.** A user who taps the same shaded shirt three times gets three `#9FABB4`-like samples, and every strategy returns blue-grey.
- **Aggregation only helps when the taps *disagree*,** that is, when at least one tap lands in better light.
- `meanRgb` and `oklabMean` are pulled by any outlier (deep shadow, skin).
- `medianL` is the most robust to a single bad tap, but it only picks the "middle" lighting.
- `lightest` looks best here **only because this scene's brightest light (1.08×) is close to neutral** (§14.1).

### 14.1 The "lightest point" risk

Each row is three taps (normal, lit 1.35×, shade 0.6×) on non-white materials:

| Material | Lightest tap | ΔE vs material | Subtypes changed | medianL ΔE |
|---|---|---|---|---|
| mid grey #8C8C8C | #A1A1A1 | 0.069 | 5 | 0 |
| beige #CDB89A | #EAD2B0 | 0.083 | 7 | 0 |
| pastel lilac #C8B6D8 | #E5D0F7 | 0.085 | 4 | 0 |
| washed denim #7F9BB8 | #92B2D2 | 0.073 | **9** | 0 |
| muted olive #8A8B6A | #9E9F7A | 0.065 | 4 | 0 |

**"Take the lightest" is a whiteness assumption.** It is right only when the material is the brightest thing the light can make it. For grey, beige, pastel, denim and muted fabrics it systematically **lightens the material**: ΔE 0.065–0.085, changing up to 9 of 12 subtypes. It must not be adopted as a general rule.

## 15. White-balance analysis (evaluated, not implemented)

Correction applied to the sampled colour using statistics from the whole synthetic scene:

| Scene | None | Gray-world | White-patch |
|---|---|---|---|
| cream garment (80% of frame), neutral light (correct as is) | **ΔE 0 / 0** | #E2E1DF, 0.041 / **6** | **#FFFFFF**, 0.085 / 7 |
| white in shade + warm sunlit wall | #9FABB4, 0.233 / 6 | #9BACB8, 0.233 / 7 | #CBFFFF, 0.053 / 7 |
| white in shade filling the frame | #9FABB4, 0.233 / 6 | #AAAAAA, 0.229 / 5 | #FFFFFF, 0.034 / 0 |
| white, blue cast, with one specular highlight | #E7F4FE, 0.022 / 1 | #F3F3F3, 0.004 / 0 | #E7F4FE (no change) |

**Findings:**
- **Gray-world treats the garment's own colour as the cast.** A correctly photographed cream becomes grey and changes 6 subtypes.
- **It does not rescue the shaded white when anything else is in frame.**
- **White-patch "works" only when the garment is the brightest object.** In that case it assumes white and turns cream into `#FFFFFF`. It does nothing when a specular highlight is already at 255, and it over-corrects with a warm wall.

The brief's concerns apply too:
- A scene may contain no neutral object.
- A "white" garment may be cream.
- Coloured light may be intentional.
- The camera has already applied AWB, so a second guess compounds error.

**Decision stands (plan §12.1): no automatic global white-balance correction.** The evidence is against it, not merely inconclusive.

## 16. Candidate solutions

| Option | UX complexity | Implementation | Reliability for this case | Risk of making good samples worse | Mobile usability | V1.2 fit |
|---|---|---|---|---|---|---|
| **A.** Keep single tap; ship the capture tips and accurate warning copy | minimal | small: copy + one tips block (plan §12 tips were never shipped; see §18 Q12) | prevents some cases up front; cannot detect afterwards | none | good | **yes** |
| **B.** Optional "check another spot" and compare | low–medium: a second result and a comparison line | medium (panel state, two samples, copy) | helps when the second tap is in better light; not when both are in shade | low: informational | good | later / maybe |
| **C.** Required or offered 3 taps → robust sample | high: three taps before any answer | medium | **no gain for uniform shade** (§14); medianL helps against one bad tap | medium: `lightest` / mean strategies degrade good samples (§14, §14.1) | poor: three precise taps on a phone | no |
| **D.** Several nearby candidates to choose from | medium–high | medium | the user picks the colour they *believe*, which reintroduces bias; nearby candidates in uniform shade are all `#9FABB4` | low | cramped on phones | no |
| **E.** Sample-area (radius) control | medium | small | **none for this case**: the radius does not change a uniformly lit sample (§6) | medium: a small radius follows folds and noise | fiddly | no |
| **F.** "Photo lighting may change this colour" confirmation for suspicious samples | low: one extra line, no extra tap | small: a rule on the sample's own OKLab | it cannot *know*, but it targets exactly the susceptible class (light, low-chroma samples) | none: the verdict is unchanged | good | **yes** (as a non-blocking note, not a modal) |
| **G.** Relative-light diagnostics (context ring) | none visible (feeds F) | medium | catches a tap **in shade next to lit fabric of the same kind**; **blind to uniform shade**; **false alarm on two-tone garments** (§18 Q11) | medium: false hints | n/a | later, only as an extra signal for F |

## 17. Decision matrix

| Approach | Solves white-shirt case? | Reliability | UX cost | Eng. cost | New failure modes | Privacy impact | V1.2? | Later? |
|---|---|---|---|---|---|---|---|---|
| Current single tap | no | exact for the pixels; misleading for light neutrals in shade | none | none | – | none | as the base | – |
| Improved warning (tips + accurate copy + light-neutral lighting note) | **partly**: it cannot fix the colour, but tells the user why it may be off and what to do | honest; a heuristic trigger | low | low | a note on some genuinely light-neutral samples (about 20 of 216 curated positive colours for a tinted rule) | none | **yes** | refine with G |
| Optional second/third tap (compare) | only if a tap lands in better light | medium | medium | medium | two answers to reconcile | none (memory only) | no | **yes**, after real-photo data |
| Required 3-tap | **no** for uniform shade | low gain for the cost | high | medium | `lightest` lightens, `mean` is pulled by outliers | none | no | no |
| Radius control | no | none for uniform light | medium | low | noise and fold sensitivity at small radii | none | no | no |
| Automatic correction (gray-world / white-patch) | no or by accident | **harmful** (§15) | none visible | medium | corrupts correct colours (cream → grey / white) | none | **no** | only with a physical reference card |
| Object detection / segmentation | **no**: it finds the shirt, not the light on it | – | – | high (model, size) | identity errors; scope creep | high risk | **no** | out of scope |

## 18. Answers Q1–Q12

**Q1. Can the current sampler correctly return #9FABB4 from a region a human still perceives as a white shirt?**
**Yes.**
- A white T-shirt (`#F4F4F2`) in open shade at 0.45× light, with skylight (red gain 0.85, blue gain 1.14), renders as exactly `#9FABB4` in the light model. That is an ordinary shade/sky ratio.
- The pixels are indistinguishable from a genuinely blue-grey fabric in neutral light: same sample, same distribution, same categories, no warning (asserted).
- A person still sees "white" because human vision adapts to the scene's lighting and judges the shirt relative to its surroundings. The camera records the light that actually reached the sensor.

Diagnosis against the brief's list:

| Candidate cause | Finding |
|---|---|
| A. coordinate bug | Not indicated. Slice 4 mapping is unchanged and tested, and the marker shows the sampled disc. It cannot be excluded without the original photo. |
| B. sampler implementation bug | No. The independent recomputation matches, and a uniform disc returns its own colour at every radius. |
| C. local shadow / exposure | The dominant cause: ΔL −0.232 of ΔE 0.233. |
| D. environmental colour cast | A secondary cause: the cool tint (chroma 0.019, hue 240°) that makes it "blue-grey". |
| E. camera white balance / processing | Plausible contributor. AWB balanced for the sunlit scene leaves shade blue. It is not separable from D in one photo. |
| F. texture / folds | Not the cause. Folds move L by ≤ 0.1 and would show as spread. |
| G. user expectation mismatch | Yes, by definition. The product answers "the pixels", the user asks "the fabric". |
| H. warning-model weakness | Yes. No flag can fire (§8–10). |
| I. single-point limitation | Yes. More taps in the same light return the same colour (§14). |

**Q2. Would the current `shadow` warning normally catch an ordinary shadow on white fabric?**
**No.** It needs > 35% of pixels at ≤ 5 on all channels. White fabric would have to be darkened to 0.18% of normal light. It is a clipped-black detector.

**Q3. Would `mixed` catch a uniformly blue-cast white region?**
**No.** Spread is 0.006 against a threshold of 0.045. `mixed` measures internal consistency, and a uniform cast is perfectly consistent.

**Q4. How much can a nominal white/off-white garment move in OKLab under reasonable exposure/cast simulations?**
- **Exposure within ±½ stop (0.7–1.4×):** up to ΔE 0.109, almost all in L.
- **Casts alone:** ≤ 0.043.
- **Open shade (0.35–0.5×):** 0.20–0.28.
- **Shade plus skylight** (the reported case): 0.233.

For scale, the matcher's "close" radius is 0.045.

**Q5. Can those changes cross Photo Match categories?**
**Yes, routinely.**
- **White:** 0.85× changes 2 subtypes, 0.7× changes 5, shade changes 6–8.
- **Light tinted materials:** 3–12 subtypes.
- **The verdict itself can flip.** In the white-shirt case:
  - For **deep-winter and clear-winter**, the real white is `neutral-base` ("Easy neutral"), but `#9FABB4` is `away-from-face` ("Not ideal near your face").
  - For **warm-spring and deep-autumn**, both are `away-from-face`, so the verdict survives. The explanation changes: it resembles Blue Grey / Icy Lilac instead of Optic White / Pale Aqua.

**Q6. How sensitive is the current 24 px radius to tap position?**
- **Not at all within an evenly lit area:** ΔE 0 for ±12 px jitter.
- **Slightly on folds:** 0.015.
- **Highly near a lighting boundary:** 0.064 and 7 subtypes changed for ±12 px.

What matters is which *lighting zone* is tapped, not the exact pixel.

**Q7. Would a smaller radius solve the problem reliably?**
**No.**
- In uniform shade every radius from 3 to 48 returns `#9FABB4`.
- Smaller radii do avoid boundary contamination. But they also follow folds and noise: r = 3 was 0.10 L darker on a fold.

**Q8. Would a larger radius solve the problem reliably?**
**No.** It does not change a uniform patch, and near boundaries it adds contamination. It does raise `mixed` more often, which is correct.

**Q9. Does three-point sampling materially improve robustness?**
- **Not for the reported case:** three taps in the same shade still give blue-grey (ΔE ≥ 0.217 for every strategy).
- **Only against *one* bad tap** among good ones. There `medianL` is the most robust (deep shadow 0.015, skin 0.012).

It costs two extra precise taps and does not address the dominant failure.

**Q10. What are the important failure cases of three-point sampling?**
- All taps in the same wrong light: no gain.
- Mean strategies are pulled by one outlier: deep shadow 0.136 and 6 subtypes; skin contamination 0.045 and 3.
- Patterned fabric has no correct answer (ΔE ≈ 0.30 for all).
- `lightest` lightens genuinely dark or muted fabrics: grey-beige 0.072 and 5 subtypes; denim 9 subtypes.
- The result depends on how many taps land in each lighting zone.

**Q11. Can probable lighting problems be detected without pretending to know the physical garment colour?**
**Partly.**
- **Detectable:**
  - a tap in shade *next to* lit fabric of similar chroma (context-ring prototype: 23% lighter-similar pixels → hint)
  - clipping (the existing flags)
  - lighting edges inside the disc (`mixed`)
- **Not detectable:** uniform shade or cast over the whole garment. The pixels are identical to a real blue-grey (context share 0.00 in deep shade).
- **False alarms:** a genuinely two-tone garment (white panel beside grey) triggers the context hint.

What *can* be said honestly is a property of the sample: **light, low-chroma colours are the ones most distorted by lighting** (§11–12). That is a caution, not a detection.

**Q12. What is the smallest product change likely to improve V1.2 safely?**
**Copy and guidance only. No change to sampling or matching:**
1. **Ship the capture tips** that plan §12 already specifies but the panel never shows: daylight near a window, no filters, "tap a flat, evenly lit area, not folds, shadows or shine". Today only "Tap any color in the photo…" is shown.
2. **Add a non-blocking lighting note** on light, low-chroma samples (e.g. OKLab L ≥ ~0.6 and chroma < ~0.05; the exact rule to be fixed in that slice, from the sample's own OKLab, with no score). Example: "Light in the photo can make whites and light neutrals look darker or bluer. Try another spot on the same colour in brighter, even light." / "แสงในภาพอาจทำให้สีขาวและสีอ่อนดูเข้มหรือฟ้าขึ้น ลองแตะอีกจุดบนสีเดียวกันที่แสงสว่างและสม่ำเสมอ".
3. **Make the `shadow` / `highlight` copy match what the flags detect.** `shadow` detects "very dark, crushed areas", not shadow in general. The flag names stay.

This validates the §31 hypothesis: **a transparent prompt beats silent correction**, because no correction is reliable (§14–15) and the prompt harms no correct sample.

## 19. Recommended next step

**Recommended next implementation slice: Slice 5f — Photo lighting guidance.**
- **Scope:** the three items in Q12, copy/UI only, EN + TH, with tests.
- **Out of scope:** the sampler, the matcher, the thresholds, the verdicts, the radius, correction and multi-tap.
- **Also:** get **real photos** (white, cream, light blue, grey in daylight, shade and indoor light) through the harness **on device**. That data should decide whether Option B (compare a second spot) is worth building. Slice 6 hardening should follow 5f, not precede it.

## 20. What was explicitly NOT changed

**Explicitly NOT changed:**
- **Sampler:** production sampling, radius, trim, estimator, thresholds and flags.
- **Matcher:** matching, categories, placement, verdicts, pairings, copy and UI.
- **Pipeline and other features:** image pipeline, coordinates, Manual Checker, quiz, palettes.
- **Dependencies and data:** no dependency, no network, no persistence, no `.kilo`.
- **Photos:** no personal photo anywhere. All fixtures are generated from HEX values.

**Build equivalence.** `npm run build` before and after gives byte-identical `dist/` (same SHA-256 for `index.html`, `index-paHG59NT.js`, `index-ZoJtifIh.css` and all assets). `investigation/` is not imported by the app.

**Guard mutation check: 5 of 5 caught.** Each change made the investigation suite fail and was reverted:
- an app file importing `investigation/`
- `MIXED_SPREAD` 0.045 → 0.03
- `SHADOW_CHANNEL_MAX` 5 → 190
- trim 0.2 → 0.1
- `PHOTO_CLOSE_DISTANCE` 0.045 → 0.06
