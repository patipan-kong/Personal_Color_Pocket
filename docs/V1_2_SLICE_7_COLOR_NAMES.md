# V1.2 Slice 7 — Human-readable Color Names

**Status: engineering complete. Physical QA pending (carried over from Slice 6). READY FOR PHYSICAL QA, not release-ready.**

The Color Checker result now names the colour in plain English and Thai, for example **Light Gray · เทาอ่อน**. The exact
HEX stays underneath it as a quiet technical detail. The name is derived from the HEX alone by one small, pure, local
function. No engine, threshold, verdict, palette or photo behaviour changed.

---

## 1. Product problem

Real use (Slice 6 record §39) confirmed that exact HEX is the wrong primary identity for most users:
- **It is technical.** `#D0D1D5` means nothing to most people.
- **It is more precise than a photo justifies.** Three taps on one light suit gave `#C6CACF`, `#D9DCDF` and `#D0D1D5`,
  which are three different pixels of one garment under the same light.
- **It makes a stable recommendation look unstable.** Three different codes read as three different colours.

Users need to know what colour this is, how it suits their Personal Color, and how to wear it. The HEX answers none
of those.

## 2. Scope

**In scope:**
- a deterministic, local HEX → semantic name engine (`src/domain/colorNames/colorNames.ts`)
- the bilingual name in the shared result card
- HEX demoted to secondary
- the Photo sample label changed to "Color seen in this photo"
- tests, a development-only audit module, and this record

**Out of scope, and unchanged:** quiz, subtypes, the Manual scorer and ratings, the Photo sampler and matcher and all
their thresholds, OKLab, palettes, placement, pairing, verdict mapping, lighting guidance, the image pipeline, file and
pixel limits, HEIC, and the Slice 6 follow-ups.

## 3. Entry state

| Check | Value |
|---|---|
| Branch | `main` |
| HEAD | `ad9c950f9b7f0001df37f0ee3fe7aab1150fa614` ("chore: harden photo color checker") |
| Working tree | clean |
| Ahead of `origin/main` | 13 |
| Slice 6 status | READY FOR PHYSICAL QA, not release-ready |

## 4. Frozen behaviour

**Proof method.** A before/after fingerprint over 478 HEX values × 12 subtypes: all 258 palette colours, a 6×6×6 RGB
lattice, the suit samples, `#9FABB4`, white and black. Each HEX was checked as a solid photo and as a two-colour split
photo, which triggers `mixed`.

**What the fingerprint covers:**
- `checkColor`
- `inspectPhotoPoint` (sample, flags and match)
- `getSuitability`
- `getPhotoLightingGuidance`
- `getColorPlacement` (women and men)
- `toManualResultView` and `toPhotoResultView`, in EN and TH, with `sampleLabel` excluded because it changed on purpose

**Size:** 17,208 rows. The warnings exercised were `mixed` ×5,268, `highlight` ×36 and `shadow` ×36.

**Result:** the SHA-256 on a pristine `ad9c950` worktree equals the one on this tree:
`a22385422d29501e976d80c6947759a44304d3b233613f81e6ee3e5a7e60ce8d`.

The existing freeze tests also pass unchanged:
- the Manual regression snapshot
- the quiz audit
- the 5d, 5f and 6 suites

## 5. Design principles

1. **Two levels of precision.** HEX is the measurement; the name is the everyday interpretation. They are
   deliberately different.
2. **One naming function, no source.** `describeColor(hex)` takes only a HEX. It never knows about:
   - Manual or Photo
   - subtypes or palettes
   - a matcher
   - the DOM, storage or the network
3. **Stable before precise.** Neutral and near-neutral colours are protected by chroma gates sized from measured sRGB
   noise, so camera noise does not rename a colour.
4. **Small vocabulary.** There are 26 families and a few modifiers. The whole sRGB cube (16,777,216 colours) uses
   76 distinct names.
5. **Names describe the colour, not the garment.** In Photo the label says "Color seen in this photo".
6. **Naming thresholds are naming-only.** No matcher or scoring constant was reused or changed.

## 6. Taxonomy

The taxonomy has 26 families in 12 basic groups. The group is used for stability auditing and future reuse.

| Group | Families | EN | TH |
|---|---|---|---|
| white | white, off-white, cream | White, Off-White, Cream | ขาว, ออฟไวท์, ครีม |
| gray | gray, blue-gray, charcoal | Gray, Blue Gray, Charcoal | เทา, เทาอมฟ้า, เทาชาร์โคล |
| black | black | Black | ดำ |
| brown | beige, taupe, brown | Beige, Taupe, Brown | เบจ, เทาอมน้ำตาล, น้ำตาล |
| red | red, burgundy | Red, Burgundy | แดง, แดงไวน์ |
| orange | coral, orange, peach | Coral, Orange, Peach | ส้มคอรัล, ส้ม, พีช |
| yellow | yellow, mustard | Yellow, Mustard | เหลือง, เหลืองมัสตาร์ด |
| green | olive, green, mint | Olive, Green, Mint | เขียวมะกอก, เขียว, เขียวมิ้นต์ |
| teal | teal | Teal | เขียวหัวเป็ด |
| blue | blue, navy | Blue, Navy | ฟ้า / น้ำเงิน, กรมท่า |
| purple | purple, lavender | Purple, Lavender | ม่วง, ม่วงลาเวนเดอร์ |
| pink | pink | Pink | ชมพู |

**How it was derived:**
1. All 258 unique palette colours (12 subtypes × Best / Neutrals / Accents / Harder, metals excluded) were dumped with
   OKLab L, C and h.
2. The dump was read alongside the 140 CSS reference colours.
3. The result was checked against a 6,380-colour synthetic corpus and all 16.7 M sRGB colours.

## 7. Naming grammar

- **English:** `[Value] [Chroma] [Temperature] Family`, with at most one of value or chroma on a chromatic family.
  Examples: *Light Cool Gray*, *Deep Brown*, *Soft Blue*, *Bright Red*.
- **Thai:** `family + value + chroma + temperature`, in natural Thai order. Examples: *เทาอ่อนอมเย็น*, *น้ำตาลเข้ม*,
  *ฟ้าหม่น*, *แดงสด*.
- **Modifier precedence:** on chromatic families, **Bright** beats **Light/Deep**, which beats **Soft**. So names never
  stack, as in "Light Soft Pink". The longest EN names are three words (*Light Blue Gray*, *Light Warm Gray*).

## 8. Neutral handling

Neutrals are decided by OKLab chroma C against two lightness-dependent gates.

**The gates:**

| Gate | Below it | Value |
|---|---|---|
| Neutral / temperature `neutralChroma(L)` | a grey has no Warm/Cool | 0.015 at L ≥ 0.6, rising to 0.022 at L ≤ 0.2 |
| Hue `tintChroma(L)` | no hue name at all (white, off-white, grey, charcoal, black) | 0.022 at L ≥ 0.85, rising to 0.036 at L ≤ 0.35 |

**How they were sized:** from the largest OKLab chroma that RGB noise creates on a pure grey.

| Grey | L | ±2 | ±4 | ±8 |
|---|---|---|---|---|
| `#101010` | 0.17 | 0.010 | 0.021 | 0.041 |
| `#404040` | 0.37 | 0.009 | 0.017 | 0.034 |
| `#808080` | 0.60 | 0.008 | 0.015 | 0.031 |
| `#C0C0C0` | 0.81 | 0.007 | 0.014 | 0.028 |
| `#F8F8F8` | 0.98 | 0.007 | 0.014 | 0.025 |

**Why not a lower gate.** A gate of 0.0045 is what would label all three suit samples "Cool". With it, **every** grey
from `#282828` to `#F8F8F8` has both "Warm" and "Cool" neighbours under ±2 RGB noise (53 of 53). With the chosen gates,
zero greys get any warm/cool label under ±2 or ±4 noise. See §21.

**Neutral bands by lightness:**

| Band | Lightness |
|---|---|
| White | L ≥ 0.98 |
| Off-White | 0.93–0.98 |
| Gray | 0.45–0.93 (Light at ≥ 0.75) |
| Charcoal | 0.23–0.45 |
| Black | < 0.23 (also any L < 0.12, and L < 0.20 with C < 0.06) |

**Muted warm and blue colours stay neutral-like** (C < 0.045):
- cream: L ≥ 0.88, hue 20–110°
- beige: L 0.72–0.88
- taupe: L 0.40–0.72, hue 355–110°
- brown: darker than taupe
- blue gray: hue 200–290°, L 0.48–0.88
- dark and faintly blue: a cool charcoal below C 0.028, navy above

**Investigated anchors:**

| Colour | Example | Name |
|---|---|---|
| white | `#FFFFFF` | White |
| off-white | `#F7F6F2` | Off-White |
| cream | `#FFF0CF` | Cream |
| ivory | `#FFF3D6` | Cream |
| ivory | `#FFF7E8` | Off-White |
| light grey | `#D3D3D3` | Light Gray |
| medium grey | `#808080` | Gray |
| charcoal | `#404040` | Charcoal |
| charcoal | `#36454F` | Cool Charcoal |
| black | `#111111` | Black |
| beige | `#D8BA91` | Beige |
| taupe | `#8D6F73` | Taupe |
| taupe | `#A49586` | Light Taupe |
| brown | `#7B4C31` | Brown |

## 9. Hue families

Hue boundaries are not equal sectors; several depend on lightness. The OKLab hue arcs are:

| Hue | Family |
|---|---|
| 345°–12° | pink (burgundy if L < 0.45) |
| 12°–40° | red, or coral if L ≥ 0.64 and C < 0.22. Dusty colours (L ≥ 0.55, C < 0.10) are pink; pale salmon (L ≥ 0.75, 28–40°) is peach. Dark and 12–30° is burgundy. |
| 40°–72° | orange, or peach if L ≥ 0.75 and C < 0.15. Brown if dark or muted. |
| 72°–92° | mustard (L < 0.76), yellow above it. Brown if muted and dark. |
| 92°–125° | olive (L < 0.76, and up to 135° when L < 0.55); yellow below 115° when light |
| 125°–178° | green, or mint if L ≥ 0.75 and C < 0.10 |
| 178°–218° | teal |
| 218°–285° | blue, or navy if L < 0.40, or L < 0.48 with C < 0.12 |
| 285°–325° | purple, or lavender if L ≥ 0.70 and C < 0.12 |
| 325°–345° | purple if L < 0.52, else pink |

**Hue walks.** Each walk goes once round the circle; the arcs are contiguous and in the expected order.

| Slice | Families, in order |
|---|---|
| L 0.65, C 0.12 | pink → coral → orange → mustard → olive → green → teal → blue → purple |
| L 0.50, C 0.10 | pink → red → brown → mustard → olive → green → blue → purple |
| L 0.80, C 0.08 | pink → peach → beige → yellow → green → mint → teal → blue → lavender |
| L 0.35, C 0.08 | burgundy → brown → olive → green → navy → purple |

## 10. Special families

Each candidate was kept only if it earned a place: users understand it, it clearly improves the result, it classifies
stably, it has a natural Thai name, and it occurs in the palette corpus.

| Candidate | Decision | Why |
|---|---|---|
| Cream | **kept** | 4 palette colours. Natural in both languages (ครีม). |
| Ivory | merged into Cream / Off-White | Not distinct enough to name separately. ไอวอรี่ is less clear than ครีม. |
| Beige | **kept** | 7 palette colours. เบจ is common. |
| Taupe | **kept** | 2 palette colours plus muted mid-tones. TH is descriptive: เทาอมน้ำตาล. |
| Olive | **kept** | 10 palette colours. เขียวมะกอก. |
| Navy | **kept** | 8 palette colours. กรมท่า is the standard Thai word. |
| Burgundy / Wine | **kept** (Burgundy) | 7 palette colours. TH is แดงไวน์. |
| Coral | **kept** | 8 palette colours. TH is ส้มคอรัล. |
| Peach | **kept** | 6 palette colours. พีช. |
| Mint | **kept** | 3 palette colours. เขียวมิ้นต์. |
| Teal | **kept** | 24 palette colours. เขียวหัวเป็ด; light teal is ฟ้าอมเขียว. |
| Lavender | **kept** | 4 palette colours. ม่วงลาเวนเดอร์. |
| Mustard | **added** | 6 palette colours. Without it they became "Brown" or "Light Brown". |
| Off-White, Charcoal, Blue Gray | **added** | Neutral anchors in the brief. Common garment words. Stable. |
| Sage, Turquoise, Plum, Mauve, Camel, Khaki | rejected | Folded into Soft Green, Light Teal, Soft Purple, Soft Pink, Light Brown and Beige/Yellow. |

## 11. Value modifiers

"Light" and "Deep" are relative to the family.

| Family | Light (L ≥) | Deep (L <) |
|---|---|---|
| red | – | 0.52 |
| orange | – | 0.60 |
| peach | 0.86 | – |
| yellow | 0.90 | – |
| olive | 0.66 | 0.48 |
| green | 0.76 | 0.50 |
| mint | 0.88 | – |
| teal | 0.72 | 0.50 |
| blue | 0.72 | 0.52 |
| purple | – | 0.45 |
| lavender | 0.86 | – |
| pink | 0.78 | 0.55 |
| brown | 0.60 | 0.40 |
| taupe | 0.62 | 0.48 |
| beige | 0.84 | – |
| gray | 0.75 | – (Charcoal instead) |
| blue gray | 0.72 | 0.55 |

## 12. Temperature modifiers

"Warm" and "Cool" are used only for **Gray** and **Charcoal**; every other family already implies its temperature. A
grey needs C ≥ `neutralChroma(L)` to get one:
- **Warm:** hue within 65° of 55° (yellow, orange and red tints)
- **Cool:** hue within 60° of 245° (blue tints)
- **Neither:** green and purple tints

Hue distance is circular.

## 13. Chroma modifiers

**Soft** (C < 0.075) and **Bright** (C ≥ 0.18) are used only for red, coral, orange, yellow, green, teal, blue, purple
and pink. Peach, mint, lavender, navy, burgundy, olive, mustard and the neutrals imply their chroma.

## 14. English language rules

- Everyday garment words in Title Case: *Light Cool Gray*, *Soft Blue*, *Deep Olive*, *Burgundy*.
- American spelling, to match the app ("Color", "Gray").
- No technical terms: no OKLab, chroma, sector, or "Low-Chroma Yellow-Red". A test enforces the pattern
  `^[A-Z][a-z]+(-[A-Z][a-z]+)?( …){0,2}$` for every name.

## 15. Thai language rules

- Thai order: the colour first, then อ่อน / เข้ม, หม่น / สด, อมอุ่น / อมเย็น (เทาอ่อนอมเย็น).
- Thai script only. A test enforces `^[฀-๿]+$` for every name.
- All 76 names across the full sRGB space were reviewed by hand.

**Intentional EN/TH differences, for natural Thai:**

| EN | TH | Why |
|---|---|---|
| Blue (L ≥ 0.58) | ฟ้า | Thai splits blue by lightness, where English uses one word. |
| Blue (L < 0.58) | น้ำเงิน | Same split. |
| Light Teal | ฟ้าอมเขียว | เขียวหัวเป็ดอ่อน is unnatural for aqua. |
| Navy | กรมท่า | Standard Thai word, not เนวี่. |
| Burgundy | แดงไวน์ | Clearer than เบอร์กันดี. |
| Taupe | เทาอมน้ำตาล | โทป is not widely understood. |
| Olive | เขียวมะกอก | Not โอลีฟ. |

**A native Thai review is still pending**, as part of the Slice 6 release gate.

## 16. Tone-line decision

**Decision: A, name only.** The name already carries the value, temperature and chroma words that matter, and only
when they are meaningful.

**Rejected:**
- **B** (a separate tone line such as "Light · Cool · Soft") repeated the name.
- **C** was also rejected.
- Photo results already show a "Color character: Light · Soft" line from the matcher's descriptors (5b, unchanged). A
  second tone line would appear twice and crowd the verdict.

**Where the tone lives instead:**
- in the structured fields (`value`, `temperature`, `chroma`)
- bilingual only for the primary name, as required
- no tone words duplicated in two languages

## 17. API

```ts
describeColor(hex: string): ColorName | null   // null for anything that is not a HEX
interface ColorName {
  hex: string; family: ColorFamily; group: ColorGroup
  value: 'light' | 'deep' | null; temperature: 'warm' | 'cool' | null; chroma: 'soft' | 'bright' | null
  en: string; th: string
}
```

**Also exported:**
- `COLOR_FAMILIES` and `FAMILY_GROUP`
- the gate helpers `neutralChroma` and `tintChroma`
- `hueInArc`
- the named constants

**Properties:**
- pure and deterministic
- no DOM, source, subtype or network
- accepts `#abc`, lowercase, or a missing `#`
- the only import is the existing `colorUtils` OKLab maths
- the structured fields keep it from being a string-only dead end (§34)

## 18. Manual integration

Manual passes through the shared `ColorResultCard` → `ColorResultSummary` → `ColorNameLine`, with no Manual-specific
code. The Manual adapter (`manualResult.ts`) is unchanged, and the label stays "Selected color" / "สีที่เลือก". Manual
shows no photo caveat.

## 19. Photo integration

Photo uses the same shared summary, with no Photo-specific naming code. The adapter (`photoResult.ts`) is unchanged.

The Photo sample label changed from "Color at this spot" / "สีของจุดนี้" to **"Color seen in this photo" /
"สีที่เห็นในรูปนี้"**, so the name reads as the colour in the photo, not the garment's true colour (plan §12). The
existing caveat and the 5f lighting note are unchanged, and nothing is repeated.

## 20. HEX presentation

**Before:**
```
[swatch]  COLOR AT THIS SPOT
          #D0D1D5            ← bold, 1.05rem
```

**After (EN UI):**
```
[swatch]  COLOR SEEN IN THIS PHOTO
          Light Gray · เทาอ่อน   ← name 1.05rem, primary bold, second language muted
          #D0D1D5                ← 0.8rem monospace, muted
△ Wearable, but not one of your strongest colors   ← verdict stays the largest text
```

**TH UI:** `เทาอ่อน · Light Gray`. Locale controls the order; both languages are always present. HEX is kept, not
hidden, and there is no settings toggle.

## 21. Observed suit acceptance case

| Tap | OKLab L / C / h | Name |
|---|---|---|
| `#C6CACF` | 0.837 / 0.0082 / 254° | **Light Gray · เทาอ่อน** |
| `#D9DCDF` | 0.893 / 0.0052 / 248° | **Light Gray · เทาอ่อน** |
| `#D0D1D5` | 0.861 / 0.0056 / 275° | **Light Gray · เทาอ่อน** |

**All three share one identity.** No HEX is hard-coded; they fall below the neutral gate.

**This is the documented equivalent of the brief's ideal "Light Cool Gray".** Their blue cast (C ≤ 0.008) is under
every tested noise-safe gate. Calling them "Cool" would require a gate of about 0.0045, which labels every grey both
"Warm" and "Cool" under ±2 RGB noise (§8).

**Around them:**
- ±2 RGB: 100% of 78 neighbours keep the exact name.
- ±4 RGB: 91% keep it exactly and 100% stay the Gray family. The only change is Light Gray → Light Cool Gray.

## 22. Nearby-colour stability

The audit compares every RGB neighbour at ±δ on any channel combination (up to 26 per colour). It is implemented in
`colorNamesAudit.ts` and enforced in `colorNames.test.ts` §I.

**Definitions:**
- **Unrelated jump:** two hue groups that are not neighbours in the taxonomy, or a true neutral (C < 0.010, the audit's
  own fixed definition) that gains a hue name.
- **Warm↔Cool:** a tinted grey that reverses temperature.

| Set | ±RGB | Colours | Pairs | Same name | Same family | Same group | Same value | Same temperature | Same chroma | Warm↔Cool | Unrelated |
|---|---|---|---|---|---|---|---|---|---|---|---|
| palette | 2 | 258 | 6581 | 93.8% | 96.7% | 97.3% | 97.0% | 98.5% | 98.1% | 0 | 0 |
| palette | 4 | 258 | 6581 | 86.9% | 92.0% | 93.5% | 94.1% | 96.8% | 96.3% | 0 | 0 |
| palette | 8 | 258 | 6581 | 73.4% | 81.6% | 84.7% | 88.3% | 94.9% | 92.7% | 0 | 22 |
| synthetic | 2 | 6380 | 149024 | 94.7% | 96.5% | 97.2% | 97.9% | 99.6% | 98.6% | 0 | 0 |
| synthetic | 4 | 6380 | 149024 | 89.8% | 93.5% | 94.8% | 95.8% | 99.1% | 97.3% | 0 | 0 |
| synthetic | 8 | 6380 | 149024 | 78.8% | 86.8% | 89.4% | 91.6% | 97.2% | 94.7% | 0 | 1306 |
| grays | 2 | 30 | 780 | 97.9% | 98.2% | 99.0% | 99.7% | 100.0% | 100.0% | 0 | 0 |
| grays | 4 | 30 | 780 | 96.2% | 97.1% | 98.5% | 99.0% | 100.0% | 100.0% | 0 | 0 |
| grays | 8 | 30 | 780 | 70.9% | 85.4% | 89.1% | 93.7% | 86.2% | 97.6% | 0 | 61 |
| suit | 2 | 3 | 78 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 0 | 0 |
| suit | 4 | 3 | 78 | 91.0% | 100.0% | 100.0% | 100.0% | 91.0% | 100.0% | 0 | 0 |
| suit | 8 | 3 | 78 | 59.0% | 80.8% | 87.2% | 92.3% | 78.2% | 100.0% | 0 | 10 |

**At ±2 and ±4 there are zero unrelated jumps and zero warm↔cool reversals in every set.**

At ±8, a single channel moved 8 levels on a grey produces a visible tint, so the jumps there are gate crossings into a
*soft/light* name of the tinted hue, never a far family:
- Gray → Soft Green
- Light Gray → Light Pink / Lavender
- Charcoal → Deep Purple

Examples like "Light Cool Gray → Deep Orange" never occur, and the test suite would fail if one did.

## 23. Palette audit

All 258 unique palette colours are named; see Appendix A.

**Family counts:** pink 36, brown 24, teal 24, blue 17, green 15, gray 14, red 12, purple 12, olive 10, charcoal 9,
orange 9, coral 8, navy 8, beige 7, burgundy 7, yellow 7, mustard 6, peach 6, black 5, blue gray 4, cream 4, lavender 4,
off-white 3, mint 3, taupe 2, white 2. That is 62 distinct names.

**Checks:**
- **Keyword check (automated):** each palette name's colour word must match the assigned group. For example
  "…Navy" → blue/gray, "…Mustard" → yellow, "…Pink" → pink/purple.
- **Reviewed by eye:**
  - no wrong family
  - no strange Thai
  - no modifier stacking
  - no taxonomy hole (every family is used)

**Fixes made during design:**

| Palette colour | Named before the fix | Named now | Fix |
|---|---|---|---|
| Deep Mustard / Soft Mustard | Brown | Mustard | lower brown chroma for yellows |
| Muted / Dusty Mauve | Taupe | Soft Pink | the taupe arc stops at 355° |
| Icy Blue | Light Blue Gray | Light Blue | a pale faint blue is a blue |
| `#000080` | Bright Blue | Navy | any very dark blue is navy |
| CSS charcoal `#36454F` | Navy | Cool Charcoal | faint dark blue below C 0.028 |

**Accepted boundary names:**
- Espresso `#46372C` and Soft Espresso → Charcoal (C 0.028, below the dark hue gate)
- Soft Navy `#455462` → Navy
- Aubergine Brown → Deep Brown
- Clay Pink → Soft Pink
- Camel → Light Brown

## 24. Synthetic corpus

- **Lattice:** a 6,380-colour deterministic corpus (every 15 RGB levels, the full neutral axis, and 310 near-neutral
  offsets). All 26 families occur. It is in the canonical suite.
- **Exhaustive:** all **16,777,216** sRGB colours were checked once:
  - 0 invalid, empty, `undefined` or NaN names
  - every family valid
  - 26 families and 76 distinct EN/TH names
  - deterministic
- **Largest families** in the exhaustive run: green 4.2 M, purple 2.1 M, blue 2.1 M, pink 1.9 M. The smallest are
  off-white 16 k and white 2 k.

## 25. Boundary behaviour

Pinned in tests at ±2° either side:

| Boundary | Where | Pinned examples |
|---|---|---|
| pink ↔ coral / red | 12° | 10° pink / 15° coral at L 0.65; 10° pink / 14° red at L 0.5 |
| coral ↔ orange | 40° | |
| orange ↔ yellow (mustard) | 72° | |
| olive ↔ green | 125° | |
| mint ↔ teal | 188° | |
| teal ↔ blue | 218° | |
| blue ↔ purple | 285° | |
| purple ↔ pink | 325° | |

**Lightness-dependent boundaries:**
- purple ↔ pink at 325–345°: `oklch(0.45, 0.15, 335°)` is Purple and `oklch(0.65, 0.15, 335°)` is Pink. `#800080` is
  Bright Purple and `#FF00FF` is Bright Pink.
- dark magentas: dark 330–350° colours sit between Burgundy and Deep Purple (wine and plum). The audit treats red ↔
  purple (dark) and brown ↔ purple (dark and muted, as with aubergine) as neighbouring groups.

**0° / 360°:**
- `hueInArc` is circular.
- Families at 358°, 359°, 0°, 1° and 2° are equal at four L/C slices.

**Accepted slivers:**
- At L ≈ 0.8, C ≈ 0.08 a 4° "Yellow" band (112–115°) sits between Beige and Green.
- Blue in Thai switches ฟ้า ↔ น้ำเงิน at L 0.58, while EN stays "Blue".

## 26. Accessibility

- The name is real text in the live summary. The swatch stays `aria-hidden`.
- **Announced once.** The second-language name is visual only (`aria-hidden`, with the correct `lang`). A screen reader
  hears: sample label → name in the page language → HEX → verdict → category → warnings. It does not hear two names or
  a tone line. The existing concise live-region strategy is unchanged.
- No new heading, landmark or focus stop.
- A test checks that the Thai name is spoken exactly once and the English name not at all in the TH UI.

## 27. Responsive QA

**Method:** headless Chrome over CDP against the production build. This is the Slice 6 harness, not committed.
- **Widths:** 320, 360, 390, 430, 768, 900, 1024 and 1280, each in **EN / Women** and **TH / Men**.
- **Manual cases:**
  - positive Coral `#E9785D`
  - middle Blue `#2E86AB`
  - negative Soft Pink `#9B738A`
  - short Red `#C94636`
  - long *Light Lavender · ม่วงลาเวนเดอร์อ่อน* `#DAD7F2`
  - long *Light Blue Gray · เทาอมฟ้าอ่อน* `#B0C4DE`
  - suit `#D0D1D5`
- **Photo:** a real encoded 4000×3000 stripes PNG. Its stripes give:
  - ✨ Coral, △ Blue, ✕ Deep Purple
  - △ + lighting note (Off-White and Cool Gray)
  - △ + highlight (White), △ + shadow (Gray)
  - ✕ + mixed (Light Blue)
- **Portrait:** a 3000×4000 photo with three of the cases.

**Result: 288 states, 0 problems.** For each state the harness checked:
- page overflow 0 px
- verdict first
- sections and chips inside the card
- name and HEX not clipped and inside the summary
- name and HEX above the verdict
- name font < verdict font, HEX font < name font
- second language `aria-hidden`

**Wrapping:** names wrap to at most 2 lines at 320–390 px and stay on 1 line from 430 px. Thai breaks at word
boundaries (ม่วง / ลาเวนเดอร์อ่อน). Side by side from 900 px, unchanged.

**Screenshots** (EN 320 / 390 / 900 / 1280, TH 360 / 390 / 1024), reviewed by eye: the verdict dominates, the name
reads as the colour identity, and the HEX is quiet.

**Verdicts and warnings** were identical to the Slice 6 responsive run.

## 28. Performance

- **Throughput:** about 860,000 names per second on the synthetic corpus, and about 690,000 per second across all
  16.7 M colours, including building each HEX string. That is roughly 1–1.5 µs per name.
- **Per render:** the card names one colour.
- **No cost elsewhere:** no lookup table, dependency, image work or network.

**Bundle cost:** JS +4.72 kB raw / +1.77 kB gzip versus Slice 6, and CSS +0.26 / +0.06 kB (§32).

## 29. Privacy

The naming engine receives a HEX string only. It has no access to the File, PixelSource, file name, storage or
network, and a source-scan test forbids those identifiers. No privacy behaviour changed.

## 30. Dependencies

None added. There is no colour-name, CSS-colour, Pantone or translation library.

## 31. Mutation evidence

Each mutation was applied to the real source, the named tests were run and expected to fail, and the file was restored
byte-for-byte (verified). **18 / 18 caught.**

| Mutation | Tests failing |
|---|---|
| shift pink ↔ coral/red boundary 12° → 20° | 5 |
| shift blue ↔ purple boundary 285° → 300° | 6 |
| disable the hue (neutral) gate | 21 |
| disable the warm/cool gate | 10 |
| swap Warm / Cool labels | 3 |
| remove a Thai name (grey) | 7 |
| English word left in Thai | 7 |
| force every grey to blue | 17 |
| non-circular hue arcs (no 0/360 wrap) | 13 |
| no dark hue gate | 2 |
| stack value + chroma modifiers | 3 |
| Thai blue never น้ำเงิน | 1 |
| Manual and Photo use different naming paths | 2 |
| EN UI shows only one language | 7 |
| second language read aloud (not aria-hidden) | 2 |
| locale does not control order | 3 |
| HEX back as the emphasised identity | 3 |
| name suppresses the 5f lighting note | 2 |

The first attempt at the blue ↔ purple mutation (moving blue's end to 300°) was an **equivalent mutant**, because the
purple arc is tested first, so the change did nothing. It was replaced by moving purple's start, which the tests catch.

## 32. Regression proof

- **Domain before/after fingerprint:** identical (§4).
- **Same-HEX invariant:** a test sends the same HEX through Manual and then Photo in the real App, for 6 colours × EN/TH.
  The rendered name line and HEX are identical. A source scan proves `describeColor` is called in exactly one place (the
  shared card, from `hex`), and no adapter or input method imports it.
- **Lighting guidance:** `#F4F4F2` still shows the 5f note, `#FFFFFF` the highlight warning, and `#050505` the shadow
  warning. Manual shows no photo guidance.
- **Existing tests changed:** 4, all for the intended hierarchy change:
  - the summary text now includes the name
  - the source-import allow-list gains `colorNames`
  - HEX is a `span`, not a `strong`
  - the Photo summary includes the name
- **Canonical suite:** `npm test` ×3 and the quiz audit are recorded in the commit report.

## 33. Known limitations

- **Photo names describe the photo, not the fabric.** A white shirt in shade is named Cool Gray (`#9FABB4`). The 5f
  note stays.
- **Boundary colours can alternate between neighbouring names** across taps: Light Gray ↔ Light Cool Gray, Soft Pink ↔
  Pink, Blue ↔ Light Blue. The group almost always holds (≥ 94% at ±4). Exact-name agreement is not guaranteed at a
  real boundary.
- **±8 RGB can cross the hue gate** on greys, into soft or light tints (§22).
- **Manual and Photo can still disagree on the verdict** for the same HEX (Slice 6 limitation). Slice 7 gives them the
  same *name* only.
- **No Warm/Cool on very faint casts** (C < 0.015–0.022). That is deliberate (§8).
- **Coverage gaps:** a few everyday words are not in the vocabulary (Khaki, Sage, Plum, Mauve, Turquoise, Camel). They
  map to the nearest family.
- **Thai wording needs native review** (release gate).

## 34. V1.3 reuse note

The vocabulary is reusable as a common consumer colour language: `family`, `group` and the three modifiers are
structured, and EN/TH strings come from one grammar.

Nothing lucky-colour related was added: no day-of-week data, no rules and no V1.3 architecture. A later feature can call
`describeColor(hex)` or use the `ColorFamily` vocabulary directly.

## 35. Physical QA status

**Unchanged from Slice 6, all PENDING:**
- 48–50 MP Android
- real iPhone HEIC
- TalkBack
- VoiceOver
- native Thai review (which now also covers the colour names)

The physical matrix is to be run once, against this final V1.2 UX.

- **Add to the matrix:** on one garment, tap about 5 points (Slice 6 §28). **PASS** if the colour *name* stays the same
  or moves only to an adjacent name, such as Light Gray ↔ Light Cool Gray.

**Status: READY FOR PHYSICAL QA.** Not ready for V1.2 release.

---

## Appendix A — Palette colour names (development only; not shipped)

Every unique HEX across the 12 subtypes' Best / Neutrals / Accents / Harder, grouped by family.

| Family | HEX | Palette name | EN | TH | Used in |
|---|---|---|---|---|---|
| white | `#FAFAF8` | Pure White | White | ขาว | deep-winter neutrals |
| white | `#FFFFFF` | Optic White | White | ขาว | warm-spring harder, soft-summer harder, soft-autumn harder, warm-autumn harder, cool-winter neutrals, clear-winter neutrals |
| off-white | `#F4F3F0` | Soft White | Off-White | ออฟไวท์ | cool-summer neutrals |
| off-white | `#F7F6F2` | Soft White | Off-White | ออฟไวท์ | light-summer neutrals |
| off-white | `#FFF7E8` | Clear Ivory | Off-White | ออฟไวท์ | clear-spring neutrals |
| cream | `#E8D6B4` | Ecru | Cream | ครีม | warm-autumn neutrals |
| cream | `#E9D8B7` | Warm Cream | Cream | ครีม | deep-autumn neutrals |
| cream | `#FFF0CF` | Cream | Cream | ครีม | warm-spring neutrals |
| cream | `#FFF3D6` | Warm Ivory | Cream | ครีม | light-spring neutrals |
| beige | `#BBAA91` | Warm Stone | Beige | เบจ | clear-spring neutrals |
| beige | `#C7A578` | Light Camel | Beige | เบจ | light-spring neutrals |
| beige | `#C7ACA9` | Rose Beige | Beige | เบจ | light-summer neutrals |
| beige | `#D2C2A6` | Oat | Beige | เบจ | soft-autumn neutrals |
| beige | `#D8BA91` | Warm Beige | Beige | เบจ | deep-winter harder |
| beige | `#D9B47D` | Honey Beige | Beige | เบจ | warm-spring neutrals |
| beige | `#DCCDB2` | Oatmeal | Light Beige | เบจอ่อน | light-spring neutrals |
| taupe | `#A49586` | Mushroom | Light Taupe | เทาอมน้ำตาลอ่อน | soft-autumn neutrals |
| taupe | `#8D6F73` | Rose Brown | Taupe | เทาอมน้ำตาล | cool-summer neutrals |
| brown | `#735043` | Cocoa | Brown | น้ำตาล | clear-spring neutrals |
| brown | `#7B4C31` | Warm Brown | Brown | น้ำตาล | cool-winter harder |
| brown | `#82624A` | Warm Cocoa | Brown | น้ำตาล | warm-spring neutrals |
| brown | `#856441` | Dark Camel | Brown | น้ำตาล | deep-autumn neutrals |
| brown | `#8B633F` | Tobacco | Brown | น้ำตาล | deep-autumn neutrals |
| brown | `#965F35` | Cognac | Brown | น้ำตาล | warm-autumn neutrals |
| brown | `#9D482B` | Burnished Rust | Brown | น้ำตาล | deep-autumn best |
| brown | `#A8603D` | Cinnamon | Brown | น้ำตาล | warm-autumn best |
| brown | `#A95D48` | Adobe | Brown | น้ำตาล | soft-autumn accents |
| brown | `#493227` | Dark Chocolate | Deep Brown | น้ำตาลเข้ม | light-summer harder |
| brown | `#4A3327` | Chocolate | Deep Brown | น้ำตาลเข้ม | deep-autumn neutrals |
| brown | `#533A43` | Aubergine Brown | Deep Brown | น้ำตาลเข้ม | deep-autumn best |
| brown | `#643B2C` | Mahogany | Deep Brown | น้ำตาลเข้ม | deep-autumn best |
| brown | `#B08A63` | Camel | Light Brown | น้ำตาลอ่อน | soft-autumn neutrals |
| brown | `#B28452` | Camel | Light Brown | น้ำตาลอ่อน | cool-summer harder |
| brown | `#B58A55` | Camel | Light Brown | น้ำตาลอ่อน | warm-autumn neutrals |
| brown | `#B58B5F` | Camel | Light Brown | น้ำตาลอ่อน | clear-winter harder |
| brown | `#B66F5D` | Terracotta Rose | Light Brown | น้ำตาลอ่อน | soft-autumn best |
| brown | `#B67B43` | Caramel | Light Brown | น้ำตาลอ่อน | clear-spring neutrals |
| brown | `#B78A59` | Camel | Light Brown | น้ำตาลอ่อน | deep-winter harder |
| brown | `#B88C5A` | Camel | Light Brown | น้ำตาลอ่อน | cool-winter harder |
| brown | `#BA8B54` | Golden Tan | Light Brown | น้ำตาลอ่อน | warm-spring neutrals |
| brown | `#C77D5B` | Spiced Peach | Light Brown | น้ำตาลอ่อน | soft-autumn best |
| brown | `#C88B69` | Dusty Apricot | Light Brown | น้ำตาลอ่อน | soft-autumn best |
| gray | `#667078` | Slate | Cool Gray | เทาอมเย็น | soft-summer neutrals |
| gray | `#6E7D8B` | Blue Grey | Cool Gray | เทาอมเย็น | warm-spring harder |
| gray | `#777E8B` | Cool Grey | Cool Gray | เทาอมเย็น | clear-winter neutrals |
| gray | `#7C7478` | Cool Taupe | Gray | เทา | deep-winter neutrals |
| gray | `#A89FA0` | Cool Taupe | Gray | เทา | cool-summer neutrals |
| gray | `#B9BEC6` | Silver Grey | Light Gray | เทาอ่อน | cool-winter neutrals |
| gray | `#D5D8DB` | Pearl Grey | Light Gray | เทาอ่อน | light-summer neutrals |
| gray | `#D9DCE2` | Ice Grey | Light Gray | เทาอ่อน | clear-winter neutrals |
| gray | `#DDD7D1` | Oyster | Light Gray | เทาอ่อน | soft-summer neutrals |
| gray | `#B9ADA0` | Warm Dove | Light Warm Gray | เทาอ่อนอมอุ่น | light-spring neutrals |
| gray | `#766F64` | Warm Pewter | Warm Gray | เทาอมอุ่น | soft-autumn neutrals |
| gray | `#796A68` | Cool Cocoa | Warm Gray | เทาอมอุ่น | soft-summer neutrals |
| gray | `#8E8278` | Mushroom | Warm Gray | เทาอมอุ่น | clear-spring harder |
| gray | `#A79B95` | Mushroom | Warm Gray | เทาอมอุ่น | soft-summer neutrals |
| blue-gray | `#71899A` | Smoky Blue | Blue Gray | เทาอมฟ้า | soft-summer best |
| blue-gray | `#728895` | Smoky Blue | Blue Gray | เทาอมฟ้า | clear-spring harder |
| blue-gray | `#8D9FAC` | Blue Grey | Blue Gray | เทาอมฟ้า | light-summer neutrals |
| blue-gray | `#596D7E` | Slate Blue | Deep Blue Gray | เทาอมฟ้าเข้ม | cool-summer neutrals |
| charcoal | `#22232A` | Ink | Charcoal | เทาชาร์โคล | deep-winter neutrals |
| charcoal | `#383A42` | Charcoal | Charcoal | เทาชาร์โคล | deep-winter neutrals |
| charcoal | `#3D414A` | Cool Charcoal | Charcoal | เทาชาร์โคล | cool-winter neutrals |
| charcoal | `#3E3A34` | Warm Charcoal | Charcoal | เทาชาร์โคล | deep-autumn neutrals |
| charcoal | `#414249` | Charcoal | Charcoal | เทาชาร์โคล | light-spring harder |
| charcoal | `#4A4A52` | Soft Charcoal | Charcoal | เทาชาร์โคล | cool-summer neutrals |
| charcoal | `#455462` | Soft Navy | Cool Charcoal | เทาชาร์โคลอมเย็น | soft-summer neutrals |
| charcoal | `#46372C` | Espresso | Warm Charcoal | เทาชาร์โคลอมอุ่น | warm-autumn neutrals |
| charcoal | `#58483D` | Soft Espresso | Warm Charcoal | เทาชาร์โคลอมอุ่น | soft-autumn neutrals |
| black | `#08090B` | Black | Black | ดำ | clear-winter neutrals |
| black | `#090A0D` | Black | Black | ดำ | cool-winter neutrals |
| black | `#0A0A0C` | Black | Black | ดำ | deep-winter neutrals |
| black | `#0B0B0D` | Jet Black | Black | ดำ | soft-summer harder |
| black | `#111111` | Black | Black | ดำ | light-spring harder, light-summer harder |
| red | `#B31335` | Blue Red | Bright Red | แดงสด | cool-winter accents |
| red | `#C5113E` | Bright Ruby | Bright Red | แดงสด | clear-winter best |
| red | `#C51F3A` | True Red | Bright Red | แดงสด | cool-winter best |
| red | `#D01B3F` | Blue Red | Bright Red | แดงสด | clear-winter accents |
| red | `#DB4C3D` | Tomato Red | Bright Red | แดงสด | warm-spring accents |
| red | `#EE3F3B` | Poppy | Bright Red | แดงสด | clear-spring accents |
| red | `#9D3428` | Chili Red | Deep Red | แดงเข้ม | deep-autumn accents |
| red | `#A50F3D` | Ruby | Deep Red | แดงเข้ม | deep-winter accents |
| red | `#A83F32` | Brick Red | Deep Red | แดงเข้ม | warm-autumn best |
| red | `#B94B32` | Paprika | Red | แดง | warm-autumn accents |
| red | `#C94636` | Tomato Red | Red | แดง | cool-summer harder |
| red | `#DC5B56` | Geranium | Red | แดง | warm-spring best |
| burgundy | `#581B33` | Black Cherry | Burgundy | แดงไวน์ | deep-winter best |
| burgundy | `#613845` | Warm Plum | Burgundy | แดงไวน์ | deep-autumn accents |
| burgundy | `#671D38` | Burgundy | Burgundy | แดงไวน์ | light-spring harder |
| burgundy | `#69434F` | Warm Aubergine | Burgundy | แดงไวน์ | warm-autumn best |
| burgundy | `#6E1F3A` | Burgundy | Burgundy | แดงไวน์ | deep-winter best |
| burgundy | `#712F32` | Oxblood | Burgundy | แดงไวน์ | deep-autumn best |
| burgundy | `#77363A` | Warm Burgundy | Burgundy | แดงไวน์ | warm-autumn accents |
| coral | `#F05264` | Hot Coral | Bright Coral | ส้มคอรัลสด | clear-spring accents |
| coral | `#F15B4E` | Flame Coral | Bright Coral | ส้มคอรัลสด | clear-spring best |
| coral | `#FF5E66` | Neon Coral | Bright Coral | ส้มคอรัลสด | soft-summer harder |
| coral | `#E9785D` | Warm Coral | Coral | ส้มคอรัล | warm-spring best |
| coral | `#ED7966` | Light Poppy | Coral | ส้มคอรัล | light-spring best |
| coral | `#F06F61` | Sunlit Coral | Coral | ส้มคอรัล | light-spring accents |
| coral | `#F28B70` | Melon | Coral | ส้มคอรัล | light-spring accents |
| coral | `#FF775D` | Electric Peach | Coral | ส้มคอรัล | clear-spring accents |
| orange | `#B36D25` | Amber | Deep Orange | ส้มเข้ม | deep-autumn accents |
| orange | `#B5572F` | Burnt Orange | Deep Orange | ส้มเข้ม | light-summer harder |
| orange | `#B9572D` | Rust | Deep Orange | ส้มเข้ม | warm-autumn best |
| orange | `#C4662E` | Pumpkin | Orange | ส้ม | cool-summer harder |
| orange | `#D06A2C` | Pumpkin | Orange | ส้ม | warm-autumn best |
| orange | `#E66D2E` | Orange | Orange | ส้ม | cool-winter harder |
| orange | `#E86F3D` | Persimmon | Orange | ส้ม | warm-spring best |
| orange | `#F07828` | Bright Orange | Orange | ส้ม | soft-summer harder |
| orange | `#F48A45` | Papaya | Orange | ส้ม | warm-spring accents |
| peach | `#E8A991` | Soft Peach | Peach | พีช | clear-winter harder |
| peach | `#ED9B50` | Golden Apricot | Peach | พีช | warm-spring best |
| peach | `#F0A07C` | Peach | Peach | พีช | deep-winter harder |
| peach | `#F3A45F` | Fresh Apricot | Peach | พีช | light-spring best |
| peach | `#F6A987` | Peach Bloom | Peach | พีช | light-spring best |
| peach | `#FF9B73` | Clear Peach | Peach | พีช | clear-spring best |
| yellow | `#EDE38A` | Cool Lemon | Light Yellow | เหลืองอ่อน | light-summer best |
| yellow | `#F1E885` | Cool Lemon | Light Yellow | เหลืองอ่อน | deep-autumn harder |
| yellow | `#F2EE8F` | Icy Lemon | Light Yellow | เหลืองอ่อน | clear-winter best |
| yellow | `#E9A824` | Marigold | Yellow | เหลือง | warm-spring accents |
| yellow | `#F0C83E` | Daffodil | Yellow | เหลือง | warm-spring best |
| yellow | `#F5D46F` | Buttercup | Yellow | เหลือง | light-spring best |
| yellow | `#F7CE36` | Sunshine | Yellow | เหลือง | clear-spring best |
| mustard | `#9E7624` | Deep Mustard | Mustard | เหลืองมัสตาร์ด | deep-autumn best |
| mustard | `#AE8A42` | Soft Mustard | Mustard | เหลืองมัสตาร์ด | soft-autumn accents |
| mustard | `#AF842C` | Mustard | Mustard | เหลืองมัสตาร์ด | light-summer harder |
| mustard | `#B58A28` | Mustard | Mustard | เหลืองมัสตาร์ด | deep-winter harder |
| mustard | `#C18B23` | Ochre | Mustard | เหลืองมัสตาร์ด | warm-autumn accents |
| mustard | `#C3972E` | Golden Mustard | Mustard | เหลืองมัสตาร์ด | warm-autumn best |
| olive | `#4C542D` | Dark Olive | Deep Olive | เขียวมะกอกเข้ม | deep-autumn best |
| olive | `#655C3B` | Olive Brown | Deep Olive | เขียวมะกอกเข้ม | warm-autumn neutrals |
| olive | `#929B78` | Warm Sage | Light Olive | เขียวมะกอกอ่อน | soft-autumn best |
| olive | `#68724D` | Lichen | Olive | เขียวมะกอก | soft-autumn accents |
| olive | `#737B38` | Olive Leaf | Olive | เขียวมะกอก | warm-autumn best |
| olive | `#758237` | Avocado | Olive | เขียวมะกอก | warm-autumn accents |
| olive | `#788058` | Moss | Olive | เขียวมะกอก | soft-autumn best |
| olive | `#807A2F` | Golden Olive | Olive | เขียวมะกอก | cool-winter harder |
| olive | `#88772F` | Golden Olive | Olive | เขียวมะกอก | cool-summer harder |
| olive | `#8C8A58` | Soft Olive | Olive | เขียวมะกอก | soft-autumn best |
| green | `#00735E` | Emerald | Deep Green | เขียวเข้ม | cool-winter best |
| green | `#07594A` | Deep Emerald | Deep Green | เขียวเข้ม | deep-winter best |
| green | `#275039` | Bottle Green | Deep Green | เขียวเข้ม | deep-autumn accents |
| green | `#2E5238` | Forest | Deep Green | เขียวเข้ม | deep-autumn best |
| green | `#008067` | Cool Emerald | Green | เขียว | cool-winter accents |
| green | `#00835E` | Emerald Green | Green | เขียว | clear-winter best |
| green | `#29A55F` | Kelly Green | Green | เขียว | clear-spring best |
| green | `#379C75` | Jade | Green | เขียว | warm-spring accents |
| green | `#579D8C` | Sea Green | Green | เขียว | cool-summer best |
| green | `#6EBA3A` | Acid Green | Green | เขียว | clear-winter accents |
| green | `#75B96B` | Leaf Green | Green | เขียว | light-spring accents |
| green | `#78A94A` | Apple Green | Green | เขียว | warm-spring best |
| green | `#8CC63E` | Lime Leaf | Light Green | เขียวอ่อน | clear-spring accents |
| green | `#72968A` | Eucalyptus | Soft Green | เขียวหม่น | soft-summer best |
| green | `#8E9B83` | Muted Sage | Soft Green | เขียวหม่น | clear-winter harder |
| mint | `#86C9B8` | Cool Mint | Mint | เขียวมิ้นต์ | light-summer accents |
| mint | `#92CFC2` | Seafoam | Mint | เขียวมิ้นต์ | light-summer best |
| mint | `#93D6AE` | Mint Leaf | Mint | เขียวมิ้นต์ | light-spring best |
| teal | `#006A69` | Jewel Teal | Deep Teal | เขียวหัวเป็ดเข้ม | deep-winter accents |
| teal | `#125B5E` | Deep Peacock | Deep Teal | เขียวหัวเป็ดเข้ม | deep-autumn accents |
| teal | `#126C6B` | Peacock | Deep Teal | เขียวหัวเป็ดเข้ม | warm-autumn accents |
| teal | `#16483F` | Pine | Deep Teal | เขียวหัวเป็ดเข้ม | deep-winter best |
| teal | `#1F5851` | Pine Teal | Deep Teal | เขียวหัวเป็ดเข้ม | deep-autumn best |
| teal | `#276B62` | Forest Teal | Deep Teal | เขียวหัวเป็ดเข้ม | warm-autumn best |
| teal | `#29BDB5` | Clear Turquoise | Light Teal | ฟ้าอมเขียว | light-spring accents |
| teal | `#36C9D0` | Bright Aqua | Light Teal | ฟ้าอมเขียว | clear-spring best |
| teal | `#6FD3CF` | Aqua Glass | Light Teal | ฟ้าอมเขียว | light-spring best |
| teal | `#C7E8E5` | Pale Aqua | Light Teal | ฟ้าอมเขียว | deep-autumn harder |
| teal | `#3E6D70` | Petrol Blue | Soft Teal | เขียวหัวเป็ดหม่น | soft-autumn accents |
| teal | `#4E817B` | Muted Teal | Soft Teal | เขียวหัวเป็ดหม่น | soft-summer accents |
| teal | `#4F7B74` | Muted Teal | Soft Teal | เขียวหัวเป็ดหม่น | soft-autumn best |
| teal | `#7B9798` | Blue Sage | Soft Teal | เขียวหัวเป็ดหม่น | soft-summer best |
| teal | `#007C7A` | Jewel Teal | Teal | เขียวหัวเป็ด | clear-winter accents |
| teal | `#00A5AC` | Turquoise | Teal | เขียวหัวเป็ด | clear-winter best |
| teal | `#08788A` | Blue Teal | Teal | เขียวหัวเป็ด | cool-winter best |
| teal | `#087E8B` | Cobalt Teal | Teal | เขียวหัวเป็ด | clear-spring best |
| teal | `#15AEB7` | Caribbean Blue | Teal | เขียวหัวเป็ด | clear-spring best |
| teal | `#168E92` | Bright Teal | Teal | เขียวหัวเป็ด | warm-spring accents |
| teal | `#237F89` | Peacock Blue | Teal | เขียวหัวเป็ด | warm-spring best |
| teal | `#278174` | Cool Emerald | Teal | เขียวหัวเป็ด | cool-summer accents |
| teal | `#2CA8A0` | Warm Turquoise | Teal | เขียวหัวเป็ด | warm-spring best |
| teal | `#3C8D91` | Cool Teal | Teal | เขียวหัวเป็ด | cool-summer best |
| blue | `#168AAD` | Azure | Blue | ฟ้า | clear-spring accents |
| blue | `#477CB5` | French Blue | Blue | น้ำเงิน | cool-summer accents |
| blue | `#709BCC` | Cornflower | Blue | ฟ้า | light-summer accents |
| blue | `#7E84C7` | Bluebell | Blue | ฟ้า | light-summer accents |
| blue | `#164AC0` | Cobalt | Bright Blue | น้ำเงินสด | clear-winter accents |
| blue | `#1756C4` | Electric Blue | Bright Blue | น้ำเงินสด | clear-winter best |
| blue | `#2767DC` | Electric Blue | Bright Blue | น้ำเงินสด | soft-autumn harder |
| blue | `#174AA8` | Sapphire | Deep Blue | น้ำเงินเข้ม | cool-winter accents |
| blue | `#234A9B` | Royal Blue | Deep Blue | น้ำเงินเข้ม | deep-winter accents |
| blue | `#234EB3` | Cobalt | Deep Blue | น้ำเงินเข้ม | cool-winter best |
| blue | `#5D638E` | Blueberry | Deep Blue | น้ำเงินเข้ม | cool-summer best |
| blue | `#77BDE0` | Warm Sky | Light Blue | ฟ้าอ่อน | light-spring best |
| blue | `#91C5DD` | Sky Blue | Light Blue | ฟ้าอ่อน | light-summer best |
| blue | `#9CA9D6` | Periwinkle | Light Blue | ฟ้าอ่อน | light-summer best |
| blue | `#D8EAF3` | Icy Blue | Light Blue | ฟ้าอ่อน | warm-autumn harder |
| blue | `#58788A` | Storm Blue | Soft Blue | น้ำเงินหม่น | soft-summer accents |
| blue | `#668CAD` | Denim Blue | Soft Blue | ฟ้าหม่น | cool-summer best |
| navy | `#17243F` | Ink Navy | Navy | กรมท่า | deep-winter best |
| navy | `#172B55` | True Navy | Navy | กรมท่า | clear-winter neutrals |
| navy | `#173F5F` | Clear Navy | Navy | กรมท่า | clear-spring neutrals |
| navy | `#182D54` | Midnight Blue | Navy | กรมท่า | deep-winter best |
| navy | `#1E2C4D` | Navy | Navy | กรมท่า | cool-winter neutrals |
| navy | `#314C5A` | Warm Navy | Navy | กรมท่า | warm-spring neutrals |
| navy | `#465D73` | Soft Navy | Navy | กรมท่า | light-spring neutrals |
| navy | `#485B75` | Soft Navy | Navy | กรมท่า | light-summer neutrals |
| purple | `#7042BB` | Clear Violet | Bright Purple | ม่วงสด | clear-winter best |
| purple | `#4E2D78` | Royal Purple | Deep Purple | ม่วงเข้ม | deep-winter best |
| purple | `#5731A4` | Royal Purple | Deep Purple | ม่วงเข้ม | clear-winter best |
| purple | `#5D3598` | Royal Purple | Deep Purple | ม่วงเข้ม | cool-winter best |
| purple | `#633C8A` | Amethyst | Deep Purple | ม่วงเข้ม | deep-winter accents |
| purple | `#6942A6` | Violet | Purple | ม่วง | cool-winter accents |
| purple | `#7164A8` | Iris | Purple | ม่วง | cool-summer accents |
| purple | `#7356B4` | Blue Violet | Purple | ม่วง | warm-autumn harder |
| purple | `#9867C7` | Warm Violet | Purple | ม่วง | clear-spring best |
| purple | `#66506B` | Soft Aubergine | Soft Purple | ม่วงหม่น | soft-summer accents |
| purple | `#7D5C72` | Muted Plum | Soft Purple | ม่วงหม่น | soft-summer best |
| purple | `#8D7892` | Heather | Soft Purple | ม่วงหม่น | soft-summer best |
| lavender | `#A894C7` | True Lavender | Lavender | ม่วงลาเวนเดอร์ | cool-summer best |
| lavender | `#C9A5D1` | Soft Orchid | Lavender | ม่วงลาเวนเดอร์ | light-summer best |
| lavender | `#DAD7F2` | Icy Lavender | Light Lavender | ม่วงลาเวนเดอร์อ่อน | light-spring harder |
| lavender | `#DDD8EE` | Icy Lilac | Light Lavender | ม่วงลาเวนเดอร์อ่อน | deep-autumn harder |
| pink | `#A92373` | Magenta | Bright Pink | ชมพูสด | cool-winter best |
| pink | `#C12678` | Fuchsia | Bright Pink | ชมพูสด | cool-winter best |
| pink | `#C12B7A` | Cool Fuchsia | Bright Pink | ชมพูสด | soft-autumn harder |
| pink | `#C7197A` | Magenta | Bright Pink | ชมพูสด | clear-winter accents |
| pink | `#D32683` | Hot Pink | Bright Pink | ชมพูสด | cool-winter accents |
| pink | `#E02582` | Hot Pink | Bright Pink | ชมพูสด | clear-winter best |
| pink | `#87536D` | Mulberry | Deep Pink | ชมพูเข้ม | soft-summer accents |
| pink | `#9A5275` | Plum Rose | Deep Pink | ชมพูเข้ม | cool-summer best |
| pink | `#9D266F` | Deep Fuchsia | Deep Pink | ชมพูเข้ม | deep-winter accents |
| pink | `#A3204C` | Cranberry | Deep Pink | ชมพูเข้ม | deep-winter best |
| pink | `#B73E65` | Cranberry | Deep Pink | ชมพูเข้ม | cool-summer accents |
| pink | `#BC3575` | Cool Fuchsia | Deep Pink | ชมพูเข้ม | warm-spring harder |
| pink | `#E8B9D2` | Icy Pink | Light Pink | ชมพูอ่อน | cool-winter best |
| pink | `#EAB6C5` | Powder Pink | Light Pink | ชมพูอ่อน | light-summer best |
| pink | `#F1C6D3` | Baby Pink | Light Pink | ชมพูอ่อน | deep-autumn harder |
| pink | `#F2DDE8` | Icy Pink | Light Pink | ชมพูอ่อน | soft-autumn harder |
| pink | `#F4A6B7` | Petal Pink | Light Pink | ชมพูอ่อน | light-spring best |
| pink | `#9E5E79` | Soft Berry | Pink | ชมพู | soft-summer best |
| pink | `#B06F7D` | Antique Pink | Pink | ชมพู | soft-summer accents |
| pink | `#B84D91` | Magenta Rose | Pink | ชมพู | cool-summer accents |
| pink | `#C85E82` | Raspberry Rose | Pink | ชมพู | cool-summer best |
| pink | `#C875B2` | Pink Orchid | Pink | ชมพู | light-summer accents |
| pink | `#D47BA0` | Blue Pink | Pink | ชมพู | cool-summer best |
| pink | `#D8789A` | Light Raspberry | Pink | ชมพู | light-summer best |
| pink | `#DB7185` | Golden Rose | Pink | ชมพู | light-spring accents |
| pink | `#DC7486` | Watermelon | Pink | ชมพู | light-summer accents |
| pink | `#DC8FB6` | Cool Pink | Pink | ชมพู | warm-autumn harder |
| pink | `#927383` | Muted Mauve | Soft Pink | ชมพูหม่น | clear-spring harder |
| pink | `#9B738A` | Cool Mauve | Soft Pink | ชมพูหม่น | warm-spring harder |
| pink | `#9F6670` | Old Rose | Soft Pink | ชมพูหม่น | soft-autumn accents |
| pink | `#A78796` | Dusty Mauve | Soft Pink | ชมพูหม่น | clear-winter harder |
| pink | `#A8819A` | Mauve Mist | Soft Pink | ชมพูหม่น | soft-summer best |
| pink | `#A9838C` | Dusty Rose | Soft Pink | ชมพูหม่น | clear-spring harder |
| pink | `#B77F79` | Clay Pink | Soft Pink | ชมพูหม่น | soft-autumn best |
| pink | `#B9828F` | Dusty Rose | Soft Pink | ชมพูหม่น | soft-summer best |
| pink | `#DDA4B5` | Rosewater | Soft Pink | ชมพูหม่น | light-summer best |
