# V1.3 Slice 0 — Daily Lucky Color Outfit: domain research and product specification

**Status:** complete enough to freeze Slice 1’s rule boundary. Research performed 2026-09-24. This is documentation only; it adds no runtime lucky-colour dataset.

## 1. Entry state

| Check | Observed |
|---|---|
| Branch | `main` |
| HEAD | `f8da2654c2f4668e3e844cd0c72e1da80c5af31f` (`chore: prepare v1.2 release candidate`) |
| Working tree before edit | clean |
| Package version | `1.1.0` |
| `origin/main..HEAD` | 0 commits (the supplied brief expected 15; HEAD itself matches) |

V1.2 physical/native release gates remain deferred and are out of scope.

## 2. Product problem and research method

The desired experience is a practical answer to “What should I wear today?”, not a large fortune table. Research therefore separated similarly named Thai systems before choosing data:

1. Read the V1.2 photo-checker, colour-name, and release-candidate records plus the actual subtype, palette, OKLab, pairing, placement, localization, presentation, and persistence code.
2. Search Thai and English terms for `สีมงคลประจำวัน`, `ทักษา`, weekday colours, `พุธกลางคืน`, and traditional category names.
3. Prefer a current established Thai publication with an explicit **daily** table; use a second established publication and the Taksa cycle explanation as corroboration; retain a conflicting lifestyle table as evidence that tables cannot be merged casually.
4. Treat Thai terminology as authoritative. English labels are explanations only.

This research concerns a cultural belief. It makes no causal or scientific claim.

## 3. Sources and source register

| ID | Source / date | System and relevant exact claim | Role |
|---|---|---|---|
| S1 | [Thai Rath: “สีเสื้อมงคล 2569 หมอไก่ พ.พาทินี”](https://www.thairath.co.th/horoscope/belief/2897832), published 2025-11-26 | Explicitly says it is a daily (`ประจำวัน`) table, a personal belief, and gives Work / Luck / Wealth / Kindness-approval / `กาลกิณี` for Sun–Sat. | Canonical direct daily table. |
| S2 | [KTC: “สีเสื้อมงคล 2569”](https://www.ktc.co.th/article/shopping/fashion/birthday-auspicious-color-timetable), page updated 2025-01-03 | Describes both traditional daily colours and birth-day dress choices. Its seven rows closely corroborate S1’s chosen family for Work, Luck, Money, kindness/love, and avoid colour, while often adding a second shade. | Established independent corroboration; not used to expand canonical rules. |
| S3 | [Sinsaebank: Taksa cycle and colour table](https://sinsaebank.com/lucky-colors/), undated page accessed 2026-09-24 | States the eight-position order and weekday-planet colour families; explains that Work, Luck, Money, and Support correspond to `เดช`, `ศรี`, `มูละ`, and `มนตรี`; says Wednesday night is a birth-time category. | Mechanism/terminology cross-check, not the canonical lifestyle authority. |
| S4 | [Fine Arts Department material: วันดี วันเสื่อม ฤกษ์ยาม](https://www.finearts.go.th/storage/contents/file/tLAfmFTcHRfxBwOCzDOqKJSib70N2XMtOinGyrMk.pdf), listed 2026-03-24 | Records traditional weekday colours, including Wednesday night as a separate Rahu-associated colour. | Primary cultural corroboration for weekday/Rahu context; does not supply the product’s goal table. |
| S5 | [Tune Protect: daily auspicious shirt table](https://www.tuneprotect.co.th/th/article/article.content_875), accessed 2026-09-24 | Explicit daily table but substantially different goal-colour assignments; acknowledges tables developed from birth-day colour beliefs. | Counterexample / disagreement record only. |

S1 is the provenance anchor for **every** canonical rule below. S2 supports the chosen colour family in every canonical row, but has extra colours in several cells; extras are not silently merged. S3 supplies the traditional category interpretation. URLs, dates (where published), wording, and disagreements are retained here so a later correction is auditable.

## 4. Systems found — do not merge them

| System | Input | What it does | V1.3 decision |
|---|---|---|---|
| Daily shirt-colour table | The weekday on which the outfit is worn | Modern, practical use of weekday/Taksa-associated colours, organized by a few desired life areas. S1 explicitly presents this as daily. | **Use.** It matches the hero experience. |
| Birth-day Taksa / Mahataksa | Person’s weekday of birth; Wednesday night can depend on birth time | Eight Thai astrological positions (`ภูมิ`) associated with planetary/day colours; stable for the person rather than changing each day. | Do not use as a hidden input. No birth date/time collection. |
| Annual zodiac / transiting-planet tables | Year plus zodiac/sign/ascendant | Tables published afresh each year and often also called lucky colours. | Exclude: a different system with inputs V1.3 does not have. |
| Modern lifestyle adaptations | Often label source-table positions Work, Money, Love, etc. and may add shades | Useful evidence of common vocabulary, but labels/extra shades vary. | Do not merge variants into a larger “consensus” table. |

The daily product uses the S1 seven-day reading only. It is **not** a claim that every online “สีมงคล” table agrees, nor a birth chart.

## 5. Traditional terms and supported product mapping

The Taksa positions are an eight-part system. Traditional meaning is retained internally; only four positions are both clear and repeatedly surfaced as daily garment goals.

| Traditional Thai | Meaning in this context | V1.3 Thai goal | English explanation | Product decision |
|---|---|---|---|---|
| เดช | power, authority, standing, influence | งาน | Work | Map carefully: daily sources label this as work/career, not a guarantee of promotion. |
| ศรี | auspiciousness, good fortune, favourable opportunity | โอกาสและโชคลาภ | Luck & opportunity | Keep the broader Thai meaning; “opportunity” prevents a gambling-only English reading. |
| มูละ | root, assets, property, resources/wealth | การเงิน | Money | Supported by the daily table’s wealth wording. |
| มนตรี | benefactor, patron, counsel, help from seniors/teachers/bosses | ผู้ใหญ่สนับสนุน | Mentor support | Do not turn it into generic romance. |
| บริวาร | people around one; dependants, followers, associates | — | — | Not a V1.3 selectable goal. |
| อายุ | life, health, longevity/wellbeing | — | — | Not a V1.3 selectable goal. |
| อุตสาหะ | diligence, endeavour, effort | — | — | Not a V1.3 selectable goal; do not conflate with Work/เดช. |
| กาลกิณี | adverse/inauspicious position in the belief system | — | — | Preserve as data/provenance, not a positive goal. |

**Love decision.** S2 sometimes groups `เมตตา, ความรัก`; S1 names `เมตตา-เอ็นดู`; neither makes romantic love an independent Taksa position. `มนตรี` is more exactly benefactor/support, while `บริวาร` is people around one. Mapping either to “Love” would falsify the traditional meaning. V1.3 therefore has no Love selector. It may be reconsidered only with a separately sourced, coherent romantic-colour system.

## 6. Weekday, Wednesday, and time model

Taksa uses eight planetary positions. Wednesday night is associated with Rahu in **birth-day** readings; S3 specifies 18:00–05:59 for that birth-time classification, and S4 corroborates the distinct Rahu/Wed-night tradition. It matters when calculating a person’s birth-day table.

S1’s chosen daily product table instead contains seven weekdays and one Wednesday row. Its Wednesday row already contains the grey Rahu-associated family where its category cycle calls for it; it does not require daily time-of-day input. Therefore:

- V1.3 has **seven** weekday values (`sun` through `sat`), with no `wed-night` runtime value.
- “Today” means the device’s local civil date/weekday. Recompute when the device reaches local midnight; refresh/reopen also recomputes it.
- There is no birth-date field, birth-time field, manual day picker, date history, timezone setting, server, or location lookup in V1.3.
- A traveller sees the day where their device is set. This is the simplest truthful client-only behaviour.

## 7. Comparison matrix and disagreements

Abbreviations: `W` Work/เดช, `L` Luck/ศรี, `M` Money/มูละ, `S` Support/มนตรี, `K` kalakini. A slash separates sources in the order **S1 Thai Rath / S2 KTC / S5 Tune Protect**. S5’s “Love” column is not a traditional Support column, so `—` means no comparable claim rather than agreement.

| Weekday | W | L | M | S | K |
|---|---|---|---|---|---|
| Sun | pink / pink-old rose / green-blue | green / green / pink | purple / black-purple / red | gray / gray-gold / — | blue / blue / blue |
| Mon | green / green / blue | purple / purple-dark gray / green | orange / orange-brown / purple | blue / blue / — | red / red-orange / red |
| Tue | purple / purple-dark gray / orange-pink | orange / orange-brown / gray-black | gray / brown-gray / yellow-gold | red / red-pink / — | white / white-yellow / white |
| Wed | orange / orange-brown / yellow-cream | gray / gray-gold / blue | blue / blue / green | yellow / yellow-white / — | pink / pink / pink |
| Thu | blue / blue / gold-white | red / red-old rose / red-pink | yellow / yellow-cream / blue | green / green / — | black / black-dark gray / purple |
| Fri | yellow / yellow-white / green | pink / pink / white-cream | green / green / blue | orange / orange-brown / — | gray / gray-gold / gray-black |
| Sat | gray / brown-gray / red | blue / blue / purple-black | red / red-peach / orange-gold | pink / pink-old rose / — | green / green / green |

### Agreement summary

- S1 and S2 agree on the selected core family for all 35 canonical cells. S2 frequently includes an additional adjacent shade (for example black with purple, or brown with orange); the canonical table selects S1’s single clear term.
- S3 shows why the first four categories map defensibly to `เดช`, `ศรี`, `มูละ`, and `มนตรี`: its planetary-cycle explanation produces the same family sequence used by S1/S2.
- The avoid sequence agrees between S1 and S2 on the chosen primary family. Their expansion differs for Tuesday/Thursday/Friday.

### Real disagreements

- S5 disagrees with S1/S2 in most positive-goal cells while retaining several avoid colours. It is a different modern daily adaptation, not a reason to average colours.
- S2’s `เมตตา, ความรัก` combines concepts that S1 calls `เมตตา-เอ็นดู`; neither establishes an independent romance category.
- Source shade wording differs: `เทา`, `เทาดำ`, `ดำ`, `ม่วง`, `น้ำเงิน`, and `ฟ้า` are sometimes broadened. This is why canonical rules retain broad family terms and do not contain HEX values.

## 8. Recommended canonical system and table

**System ID:** `thai-daily-shirt-color-taksa-7day`.

This is a product selection: S1’s directly labelled daily seven-day table, with S2 as corroboration and S3 as traditional terminology/mechanism support. S1 is the direct provenance for each row; S2 corroborates the selected family. The mapping from source columns to traditional categories is a documented product decision, not an asserted scientific fact.

| Weekday | Work / เดช | Luck & opportunity / ศรี | Money / มูละ | Mentor support / มนตรี | Stored only: กาลกิณี |
|---|---|---|---|---|---|
| Sunday | pink | green | purple | gray | blue |
| Monday | green | purple | orange | blue | red |
| Tuesday | purple | orange | gray | red | white |
| Wednesday | orange | gray | blue | yellow | pink |
| Thursday | blue | red | yellow | green | black |
| Friday | yellow | pink | green | orange | gray |
| Saturday | gray | blue | red | pink | green |

**Traceability rule:** Each table cell is one `LuckyColorRule` with `sourceIds: ['S1', 'S2']`, the relevant source terms (`สีชมพู`, `สีเขียว`, etc.), the traditional category above, and a knowledge-set version/review date. Do not infer any cell from a palette or reverse-engineer a new shade into the canonical table.

## 9. Avoid-colour decision

`กาลกิณี` is part of the chosen tradition and remains in the future data for transparent provenance. V1.3 chooses **A: do not show avoid colours in the primary experience** and does not use them as a hidden penalty. The positive goal family is already distinct from that row, so a penalty solves no practical outfit problem and would make a friendly product anxious.

A future optional educational disclosure may say that the tradition contains a `กาลกิณี` column, without fear-based claims or “must not wear” language. It is not a V1.3 outfit-card warning.

## 10. Canonical colour-family vocabulary

`white`, `yellow`, `pink`, `red`, `green`, `blue`, `purple`, `orange`, `gray`, `black` is the complete V1.3 rule vocabulary. It is deliberately compact: these are source-level families, not shade prescriptions. It preserves all S1 labels used by the table. `gray` means the source’s `เทา`; it does not automatically authorize black. `blue` covers the source term selected by S1 (`ฟ้า` / `น้ำเงิน` contextually) but its eventual wearable expression must remain recognizably blue.

## 11. Personal Color and outfit product rules

Lucky family has first priority for cultural fidelity. Personal Color chooses warmth, coolness, value, chroma, and placement; outfit practicality chooses the neutral companions. The adaptation ladder is:

1. strong subtype palette match in the canonical family, near face when appropriate;
2. an appropriate shade of that same family;
3. the family as a secondary/layer colour;
4. move it below the face; then
5. use it as a bag, shoe, scarf, belt, jewellery, or other accent.

All candidates poor near the face is a valid, useful result: say where to wear the lucky family and put a known-good palette colour near the face. Do not output “no recommendation,” and do not substitute an unrelated family.

The future outfit model should contain the selected rule, broad family, adaptation/placement rationale, a lucky-colour garment placement, bottom neutral, shoes, optional accent, and source IDs. It is a small outfit formula, not a fashion-stylist engine.

## 12. UX decisions

- **Goal selector:** one goal only: `งาน`, `การเงิน`, `โอกาสและโชคลาภ`, `ผู้ใหญ่สนับสนุน`. One selection is cognitively light and avoids arbitrary two-goal conflict resolution.
- **No profile:** show a general same-family colour and neutral outfit scaffold, then an optional Personal Color quiz CTA. Invalid/stale profiles take the same path; never block the daily view.
- **Date:** local device day, automatic midnight change. No future/past date browsing in V1.3.
- **Variety:** deterministic per local ISO date + goal + valid subtype + `datasetVersion`; identical input always yields the same outfit. When no profile exists, omit subtype from the seed. Presentation and locale cannot change the colour decision.
- **Visual:** a responsive garment-board card with CSS/SVG fills and accessible textual piece labels. It should use existing garment vocabulary and may select the existing women/men presentation examples; its colour logic stays identical. Use an inclusive neutral fallback if presentation preference is missing.
- **Source display:** a small “About today’s lucky colours” link/disclosure is the least-cluttered transparent option. V1.4 can hold source history, Taksa background, and an explanation of shade adaptation.

## 13. V1.2 reuse and V1.4 handoff

V1.2 reuse later: all 12 palette categories; `describeColor()` structured `family/group/value/temperature/chroma` output and bilingual display; OKLab conversion/distance; existing `pairingSuggestions`; placement intents and garment nouns; typed `LocaleCopy` localization; profile persistence; and presentation preference. None are modified in Slice 0.

Potential mismatches are intentional: V1.2 distinguishes Olive/Mint/Teal/Navy/Charcoal and source data does not. A later adapter must make those family-boundary decisions explicitly and test them. V1.2’s personal-colour category labels are not lucky-colour source evidence.

V1.4 handoff: Thai cultural background; full source/source-version list; explanation of Taksa positions and Wednesday-night birth context; how Personal Color changes shade/placement but not the lucky family; and any opt-in view of `กาลกิณี`. None belongs on the Daily Outfit card by default.

## 14. Edge cases and known uncertainties

| Case | Frozen handling |
|---|---|
| no/invalid profile | General recommendation + non-blocking CTA. |
| multiple family values in a source | Canonical table stores S1’s primary broad term; source extras remain notes, not combined runtime rules. |
| poor near-face fit | Same-family lower placement/accessory ladder. |
| two goals | Not supported in V1.3. |
| white/black rules | Treat as source families; choose subtype-friendly white/near-black expression and placement without renaming them. |
| broad/ambiguous term | Preserve the broad term; no HEX at the rule layer. |
| source conflict | Preserve source-specific data/provenance; do not average. S5 is not canonical. |
| midnight / locale | Device local weekday changes at midnight; locale changes labels only, not rule/result. |
| storage blocked | Do not persist goal; still compute today’s recommendation. |
| all shades poor near face | Accessory-only/below-face recommendation plus palette colour near face. |
| Wednesday ambiguity | Seven-day daily model; birth-time split intentionally excluded. |

Known uncertainty: no authoritative historical primary source was found that publishes this exact modern garment-goal matrix. The defensible claim is narrower: it is a widely published, current Thai daily belief table with an explainable Taksa relationship, not a timeless unanimous canon. This is documented in product disclosure language and provenance.

## 15. Proposed implementation slices and explicit freeze

1. Canonical knowledge/rule lookup and provenance tests.
2. Personal Color adaptation and placement ladder.
3. Outfit composition model.
4. Daily goal-selection/card UI.
5. Deterministic garment-board visual.
6. Localization, accessibility, date/storage edge cases, disclosure.
7. Hardening, real-use QA, and closure.

Frozen for Slice 1: S1-based seven-day table; four goals; no Love mapping; no Wednesday-night daily state; no visible avoid warning; broad family separation from shade adaptation; and local deterministic/no-backend operation.

**PO DECISION REQUIRED:** none before Slice 1. A future request to add Love, a birth-day mode, annual astrology, visible avoid colours, or two simultaneous goals is a new product decision and needs its own sourced specification.
