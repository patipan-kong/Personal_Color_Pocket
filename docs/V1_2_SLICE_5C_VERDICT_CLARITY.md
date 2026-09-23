# V1.2 Slice 5c: Photo Checker Verdict Clarity

Status: **done in automated and headless-browser checks. Real-phone QA and a Thai-speaker copy
review are still open.** This is a UX and copy correction to [Slice 5b](V1_2_SLICE_5B_PLACEMENT_GUIDANCE.md).
It changes interpretation and presentation only.

> **Extended by [Slice 5d](V1_2_SLICE_5D_UNIFIED_RESULT_DISPLAY.md):**
> - This card is now the shared Color Checker result for Manual and Photo.
> - Its classes are renamed from `photo-*` to `check-*`.
> - The shared copy moved to `colorResult`.
> - The nearest-colour label is now "Similar color in your palette". It adds "For comparison only" for results that are not positive.

Files:
- [suitability.ts](../src/domain/photoColor/suitability.ts) (new): the 1:1 category → verdict level map.
- [PhotoResultCard.tsx](../src/photoChecker/PhotoResultCard.tsx): verdict, reason and action come first.
- i18n: `verdicts`, `why`, `action` and `reference` were added. `placementHeading` now depends on the tone. Warnings, tiers and pairing copy were reworded ([types.ts](../src/i18n/types.ts), [en.ts](../src/i18n/en.ts), [th.ts](../src/i18n/th.ts)).
- [styles.css](../src/styles.css): verdict block and tone styling.
- [placement.ts](../src/domain/photoColor/placement.ts): label comments only. There is no logic change.
- Tests:
  - [suitability.test.ts](../src/domain/photoColor/suitability.test.ts) (5, new)
  - [PhotoResultCard.test.tsx](../src/photoChecker/PhotoResultCard.test.tsx) (37 → 70)
  - verdict assertions in [PhotoCheckerPanel.test.tsx](../src/photoChecker/PhotoCheckerPanel.test.tsx) and [checkerModes.test.tsx](../src/photoChecker/checkerModes.test.tsx)

## 1. Real-user feedback

People who used the photo checker could not quickly answer these questions:
- Is this colour good for my Personal Color?
- Is it one of my recommended colours?
- Is it only so-so, or should I keep it away from my face?
- Is it outside my palette?

The result felt neutral and ambiguous.

## 2. Why Slice 5b was ambiguous

- **The category was a small pill.** The card's first big block was "Where to wear it".
- **Every category was written to sound positive.** Slice 5b had a test that banned "avoid". Its outside copy read as
  "guidance, not a prohibition", and its care tier was "Use with care".
- **The result was only implied.** A poor match and a good match looked alike: both showed two placement rows and
  three pairing chips. The user had to infer suitability from which placement rows appeared.
- **"Closest in your palette" was ambiguous.** For a poor match it read like "this is one of your colours".

## 3. New hierarchy

**VERDICT → WHY → WHERE TO USE IT → WHAT TO PAIR IT WITH.** Card order:
1. Swatch and HEX
2. **Verdict**, the largest text on the card, with one small cue
3. The existing category, as a small secondary pill
4. **Why**: one sentence, then an **action** sentence (what to do with the colour)
5. The nearest palette colour: "In your palette", or "Nearest palette color, for comparison"
6. Placement. The heading now depends on the verdict tone (§6).
7. Pairing, as a rescue for weaker results
8. Direction and descriptors
9. Warnings
10. Photo caveat

The swatch, HEX, verdict and category are inside the live region. The reason and action are
directly below it, before any placement row.

## 4. Five verdict mappings

`getSuitability(category)` is a fixed lookup. It performs no calculation.

| Engine category | Suitability | Cue | EN verdict | TH verdict |
|---|---|---|---|---|
| near-face | strong | ✨ | Yes! Excellent for your Personal Color | ใช่เลย! สีนี้เหมาะกับ Personal Color ของคุณมาก |
| neutral-base | good | ✓ | This color works well for your Personal Color | สีนี้เข้ากับ Personal Color ของคุณดีเลย |
| related | conditional | △ | Wearable, but not one of your strongest colors | สีนี้ใส่ได้ แต่ยังไม่ใช่สีเด่นของคุณ |
| away-from-face | weak | △ | Not ideal near your face | สีนี้ไม่ค่อยเหมาะเมื่ออยู่ใกล้ใบหน้า |
| outside | outside | ✕ | This color is not recommended for your Personal Color | สีนี้ไม่ใช่สีที่แนะนำสำหรับ Personal Color ของคุณ |

The cue is `aria-hidden` and decorative. There is only one per result, and only ✨ is an emoji. The text is authoritative.

## 5. Positive / middle / negative semantics

`suitabilityTone`:

| Tone | Levels |
|---|---|
| positive | strong, good |
| middle | conditional |
| negative | weak, outside |

- **The tone drives restrained styling.**
  - Positive: wine text and a filled cue.
  - Middle: an outlined cue.
  - Negative: a grey cue and a muted category pill.
- **No traffic-light colours, no score, no stars, no percentage.**
- **Every state is readable from its words alone.** Tests check the wording, not the styling.

The intensity of the wording also steps down:

| Level | Tone of the wording |
|---|---|
| near-face | enthusiastic ("Yes!" / "ใช่เลย!") |
| neutral-base | confident |
| related | neutral and conditional |
| away-from-face | clear caution |
| outside | a clear negative recommendation |

## 6. Why vs placement

- **Why** answers "is it good for me, and why?" It uses only engine data: `nearest`, `resembles` and the category.
  - near-face and neutral-base are within the existing Close rule by definition. They say "very close to {nearest}", never "is" or "exactly".
  - related says its tone sits near the palette, but other palette colours flatter more.
  - away-from-face names the Harder colour it resembles, and the separate resemblance line is then hidden.
  - outside says it is outside the main recommended colours.
- **Action**: one sentence that tells the user what to do. It uses the first three examples of the first placement
  row (presentation-specific). For the weaker levels it also names the first `pairWith` colour for the face.
- **Placement** keeps the 5b rows, with a tone-dependent heading:

  | Tone | EN heading | TH heading |
  |---|---|---|
  | positive | "Where it works best" | "ใส่ตรงไหนดี" |
  | middle | "How to make it work" | "ใส่ยังไงให้ดูดี" |
  | negative | "If you still want to wear it" | "ถ้ายังอยากใส่สีนี้" |

- **Tier labels became conversational.** EN: Wear it here / Also works / Easiest here / Less ideal. TH: ใส่ได้เลย / ก็ใช้ได้ดี / ใช้ง่ายที่สุด / ไม่ค่อยเหมาะ.
- **Nearest colour:** a positive result shows "In your palette" with its group. Any other result shows "Nearest palette
  color, for comparison" with no group label, so the nearest colour is never presented as the user's own.

## 7. Outside handling

- **Verdict:** "This color is not recommended for your Personal Color" ✕.
- **Reason:** "It sits outside the main colors recommended for you."
- **Action:** "If you still love it, use it away from your face: bag, shoes or accessory. If it's a top, keep {pair} near your face to balance it."
- **Then** placement ("If you still want to wear it") and pairing ("If you like it, keep one of these near your face").

## 8. Away-from-face handling

- **Verdict:** "Not ideal near your face" △.
- **Reason:** "It is closer to {Harder colour}, a color that suits you better away from your face."
- **Action:** "If you like it, move it away from your face: skirt, trousers or shoes. Keep {pair} near your face instead."
  - Men get trousers, belt and shoes, never a skirt.
  - Thai: "ถ้าชอบสีนี้ ยังใช้ได้ ลองย้ายไปไว้กับ…แทน แล้วใช้สี “{pair}” ใกล้ใบหน้า จะเข้ากับคุณมากกว่า".

The rescue guidance comes after the verdict and never replaces it.

## 9. Pairing rescue guidance

`match.pairWith` is unchanged and still rendered exactly as returned.

| Levels | EN heading | TH heading |
|---|---|---|
| positive | "Goes well with" | "จับคู่ได้ดีกับ" |
| related, weak, outside | "If you like it, keep one of these near your face" | "ถ้าชอบสีนี้ ลองให้สีเหล่านี้อยู่ใกล้ใบหน้า" |

The weaker levels' body text says a palette colour nearer the face will suit the user better.
The heading framing is unchanged from 5b's `PairingAdvice`; only the words changed.

## 10. Photo uncertainty

- **The caveat is unchanged:** "Based on how the color appears in this photo."
- **Warnings now state the effect on reliability and how to double-check.** For example, "Strong light may make this
  color look lighter. Try another spot if you want to double-check."
- **The verdict is always shown, even with warnings.** Warnings are still announced in the live summary.

## 11. Accessibility

- **Live summary:** reads the sample label, HEX, verdict text, category and any warnings. The cue is `aria-hidden`.
- **Reason and action:** plain paragraphs outside the live region, so each tap is announced once.
- **Headings:** placement and pairing keep their labelled sections. The placement heading text follows the tone.
- **No colour-only meaning:** each tone has distinct words and a distinct cue shape (✨ ✓ △ ✕).

## 12. EN/TH copy

See §4 for the verdicts. Other copy notes:
- **English garment lists** are lower-cased mid-sentence ("top, blouse or scarf"). "T-shirt" keeps its capital.
- **Thai colour names in sentences are quoted** (สี “แทนโทนทอง”).
  - Found in browser QA: an unquoted colour name read as part of the sentence. แทนโทนทอง (Golden Tan) read as "instead of gold tone".
  - The display names themselves are unchanged.
- **The §12 brief line differs slightly.** "ถ้าชอบสีนี้ ให้ใช้สีจากพาเลตต์ของคุณใกล้ใบหน้ามากกว่า" is expressed as the pairing heading plus the
  body "ใช้สีจากพาเลตต์ของคุณใกล้ใบหน้ามากกว่า จะเข้ากับคุณกว่า", so "ถ้าชอบสีนี้" is not repeated twice in a row.
- **No harsh language.** A test bans never wear, looks bad, wrong colour, terrible, ugly, ห้ามใส่, ไม่สวย and สีผิด.
- **A Thai-speaker review is still required** before release.

## 13. Tests

**New suitability tests (5):**
- the 1:1 map
- the tone grouping
- RangeError on an unknown category
- agreement with the engine for every subtype × category
- a source audit: no distances, thresholds, scores or maths

**New and changed card tests:**
- **Verdicts**
  - all five verdicts, in EN and TH
  - all five are distinct, and neighbouring pairs differ (§23)
  - the cue sequence
- **Wording**
  - positive, middle and negative readings come from the wording (§24)
  - outside says "not recommended" / "ไม่ใช่สีที่แนะนำ" (§26)
  - near-face says "Excellent" / "เหมาะกับ Personal Color ของคุณมาก" (§27)
  - related reads as usable but not strongest (§28)
- **Real matches** (§25)
  - 12 subtypes × 5 categories through the real engine
  - representative Best, Neutral, Accent, related, Harder and outside colours
- **Card content**
  - the tone class
  - the reference wording
  - an action sentence in every category × presentation × language
  - the Thai away-from-face and outside rescue sentences
  - one cue per result
  - the verdict is inside the live region and the reason is not
  - the card only relabels the category
- **Replaced 5b tests:** the "never negative" tests now check the verdict comes first and nothing is harsh.

**Panel tests:** a verdict flips from positive to negative on a new tap, and only one verdict is shown.

**Mutation checks:** 9 of 9 caught.

## 14. No algorithm change

These are unchanged:
- **Photo pipeline:** sampling, OKLab, `openPhoto`, the image limits, coordinates and inspection
- **Matching:** the match distance, the Close / Related thresholds, the five categories and `pairWith`
- **Placement:** the placement inputs and rows
- **Everything else:** palettes, the quiz and the manual checker

`suitability.ts` imports only the category type.

## 15. Hardening entry criteria

- **Thai-speaker review** of the verdicts, reasons, actions and rescue copy.
- **Real-phone check at 320–430 px:**
  - the verdict and reason are visible below the photo right after a tap
  - VoiceOver and TalkBack read the verdict once per tap
- **The Slice 5a/5b device checklist:**
  - HEIC, EXIF and 48 MP photos
  - memory
  - offline use
  - no focus ring after a tap
- **Product check:** confirm the verdict strength is right on real outfits. If users find "not recommended" too strong for
  borderline colours, that is a copy decision, not a threshold change.
