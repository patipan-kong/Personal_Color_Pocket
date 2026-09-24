# Personal Color Pocket — V1.3 Daily Lucky Color Outfit: Plan

**Status:** Slice 2 Personal Color lucky-family adaptation is complete. Outfit composition, UI, and visuals remain unimplemented.

## Purpose and product boundary

V1.3 answers **“What should I wear today?”** It is a small, local, belief-aware outfit recommendation, not an astrology reference, a horoscope, a wardrobe manager, or an AI stylist.

The daily colour rule is cultural guidance. The product must say so in a light way and must never claim that a colour causes money, love, promotion, or any other outcome.

The recommendation has three separate jobs:

```text
Thai daily lucky-colour rule chooses the colour family
                    ↓
Personal Color chooses its most wearable expression
                    ↓
Outfit logic chooses placement and neutral companions
```

They must remain separate in code and copy. In particular, a lucky `green` rule is never silently replaced by blue because blue scores better for a subtype.

## Frozen product decisions

| Decision | V1.3 rule |
|---|---|
| Domain system | The 7-day **daily shirt-colour** table documented in `V1_3_SLICE_0_DOMAIN_RESEARCH.md`, whose four product categories correspond to Taksa positions. It is distinct from a person’s birth-day Taksa reading and from annual zodiac tables. |
| Goals | One goal: Work, Money, Luck & opportunity, or Mentor support. Love is not a V1.3 goal because the chosen source system has no independent traditional love position. |
| Weekday | Seven civil weekdays. Wednesday is one day; do not ask for time of birth or split daily Wednesday. |
| Avoid colours | Preserve `กาลกิณี` as provenance data, but do not show an avoid-colour warning or use it to make an outfit alarming in V1.3. |
| Date | Client/device-local calendar date and weekday; recompute at the device’s midnight. No backend, GPS, weather, location permission, notification, or manual date picker. |
| Personal Color absent | Give a general lucky-family outfit idea and a non-blocking quiz CTA. |
| Recommendation stability | Controlled variety is deterministic: seed from local ISO date, selected goal, subtype when valid, and knowledge-data version. It must not depend on locale or presentation. |
| Presentation | Colours and rule logic are presentation-neutral. The existing women/men preference can change only garment examples/visual silhouettes; use neutral examples when absent. |
| Visual | Deterministic CSS/SVG garment board, not generative imagery. No AI or image generation. |
| Transparency | A quiet “About today’s lucky colours” disclosure links to a short explanation/source note; the fuller explanation belongs in V1.4 Learn. |

## Future knowledge boundary (design only)

Slice 1 should add a small, immutable, versioned domain module rather than a generic astrology framework. The domain must preserve the source term and source IDs even when UI uses a simpler label.

```ts
type LuckyWeekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
type TraditionalCategory = 'dech' | 'sri' | 'mula' | 'montri' | 'kalakini'
type LuckyGoal = 'work' | 'money' | 'luck' | 'mentor-support'
type LuckyColorFamily =
  | 'white' | 'yellow' | 'pink' | 'red' | 'green'
  | 'blue' | 'purple' | 'orange' | 'gray' | 'black'

interface LuckyColorRule {
  weekday: LuckyWeekday
  traditionalCategory: TraditionalCategory
  goal: LuckyGoal | null // null only for kalakini
  colorFamilies: LuckyColorFamily[]
  sourceIds: readonly string[]
  sourceTermsTh: readonly string[]
  notes?: string
}

interface LuckyColorKnowledgeSet {
  datasetVersion: string
  systemId: 'thai-daily-shirt-color-taksa-7day'
  reviewedAt: string // ISO date, not a runtime clock
  sources: readonly LuckyColorSource[]
  rules: readonly LuckyColorRule[]
}
```

`sourceTermsTh` records wording such as `เทา` without pretending that it identifies one exact HEX. `colorFamilies` stays broad source-domain data. Personal Color shades belong to a separate adaptation layer. A correction changes `datasetVersion`, provenance, and tests together; it does not require account migration.

## Personal Color adaptation contract (design only)

1. Start with the canonical family selected by the daily rule.
2. Seek the strongest palette colour that still reads as that family. Prefer the user’s `best`, then a compatible `accent`; use V1.2 structured colour names and OKLab only to rank choices, not to rename the family.
3. If an appropriate same-family shade is wearable but less ideal near the face, keep the family and move it to a layer, bottom, bag, shoes, or accessory. Pair a subtype-friendly palette colour nearer the face.
4. If every candidate is poor near the face, return an explicit accessory-only or below-face recommendation. Never substitute an unrelated lucky family.
5. Use the subtype’s existing neutral palette for bottom/shoes/outer layer. Pairing is practical support, not a second lucky claim.

This is deliberately not `lucky colours ∩ best palette`. A user should never see “no lucky colour today” merely because their strongest near-face palette lacks the family.

## Recommendation shape (design only)

The UI should contain one calm result card:

- date/weekday and selected goal;
- “Today’s suggested colour” (the broad Thai/English family);
- a brief belief framing;
- outfit pieces: lucky-colour placement, a compatible bottom neutral, shoes, and optional accent;
- a compact explanation of Personal Color adaptation when a valid profile exists; and
- an optional source/about disclosure.

The engine may model `near-face`, `main-piece`, `below-face`, and `accessory` placement. It does not need garment recognition, a closet, shopping links, weather, or generated people. Existing V1.2 garment nouns, palette categories, pairing suggestions, and placement vocabulary are the intended inputs.

## UX and copy direction

Keep selection to one goal. Two goals cause conflicting families and turn a daily prompt into a negotiation; the user can change the selection immediately. Persisting the last local choice is acceptable in a V1.3-specific local key, but it is not a profile field and must be safe to ignore if storage is unavailable.

Suggested Thai / English copy:

| Moment | Thai | English |
|---|---|---|
| Goal prompt | วันนี้อยากเน้นเรื่องไหน? | What would you like to focus on today? |
| Framing | สีแนะนำวันนี้อ้างอิงความเชื่อเรื่องสีมงคล และปรับให้เข้ากับ Personal Color ของคุณ | Today’s colour is inspired by Thai lucky-colour traditions and adapted for your Personal Color. |
| No profile | เลือกโทนที่คุณชอบได้เลย หรือทำแบบทดสอบเพื่อรับคำแนะนำเฉดและตำแหน่งที่เข้ากับคุณ | Choose a shade you enjoy, or take the quiz for a more personal shade and placement. |
| Disclosure | เกี่ยวกับสีมงคลวันนี้ | About today’s lucky colours |

Do not say “will bring wealth,” “guarantees,” or use scientific-sounding validation. English explains Thai concepts; it never redefines them.

## Integration audit and reuse constraints

The existing application is local React/Vite with typed `LocaleCopy` objects for EN/TH, localStorage-backed quiz/profile state, and a separate women/men presentation preference. `PersonalColorResult` holds a validated `subtype`; a missing or invalid result must fall back to general guidance.

The 12 subtype palettes already expose `best`, `neutrals`, `accents`, `harder`, and `metals`. `colorMatch.ts` has deterministic nearest-colour and pairing support, while `photoColor/placement.ts` already distinguishes near-face, base, below-face, and accent placement without changing colour suitability by presentation. `styleGuide.ts` provides the current garment vocabulary and women/men example layouts. These are reuse candidates, not authorization to change V1.2 behaviour.

V1.2’s `describeColor()` returns a stable, local structured name `{ family, group, value, temperature, chroma, en, th }` using existing OKLab utilities. It can later make the adaptation explanation human-readable. Its 26 naming families are more detailed than this domain’s ten broad families: for example, `green` may later choose Green, Olive, or Mint only when the shade still reads as green; `blue` may use Blue or Navy; `gray` may use Gray/Charcoal only when it preserves the source’s grey meaning. Teal, coral, beige, brown, cream, and black must not be silently treated as a different lucky family just because they are palette-adjacent. No V1.2 taxonomy change is needed.

## Proposed slices

| Slice | Scope | Completion boundary |
|---|---|---|
| 0 | Domain research and product specification | This documentation and frozen decisions only. |
| 1 | Canonical knowledge module and deterministic weekday/goal rule lookup | **Complete:** versioned frozen provenance, seven-day/goal lookup, validation, and tests; no UI. |
| 2 | Personal Color adaptation | **Complete:** structured V1.2 family mapping, curated same-family candidate ladder, explicit accessory fallback, and exhaustive 120-combination tests. |
| 3 | Outfit recommendation composition | Small pure model for top/layer/bottom/shoes/accent using existing palettes and garment vocabulary. |
| 4 | Daily experience UI | Goal selector, today card, copy, local goal preference, no-profile CTA. |
| 5 | Deterministic outfit visual/card | CSS/SVG board and accessible text alternative; no generative asset. |
| 6 | Localization, accessibility, and edge cases | TH/EN parity, midnight refresh, source disclosure, storage/date failure paths. |
| 7 | Hardening and real-use QA | Rule provenance audit, visual review, regression and product closure. |

No production implementation is authorized by this plan alone.
