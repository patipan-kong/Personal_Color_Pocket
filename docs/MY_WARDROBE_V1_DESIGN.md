# My Wardrobe V1 — product and domain design

Status: design only. No production implementation is included in this slice.

## 1. Repository audit

### Entry state

- Branch: `feature/v2-ai-lab`
- HEAD: `d04586f02cee3f242ef4b0b13d02536482c5b87b`
- Upstream: `origin/feature/v2-ai-lab`, synchronized at audit time
- Worktree: clean before this document was created

### Production navigation and Today

`App.tsx` has five primary bottom-navigation destinations after a Personal Color result exists: Today, My Colors, Palette, Color Checker, and Guide. Today is the existing `daily` view rendered by `DailyView`. It is also reachable from the welcome screen without a saved Personal Color result. There is no Profile or Settings screen. My Wardrobe should therefore be a secondary screen entered from Today, not a sixth bottom-navigation destination.

Today is currently deterministic and local. `DailyView` reads the device-local date, resolves one or two selected Lucky Color goals into app-owned rules, optionally adapts them to the saved subtype, and renders an editorial garment board. It does not know about owned clothing, occasions, or AI. The experimental Today Outfit Lab is reachable only through the development-only `?debug=outfit` gate and its routes exist only in the Vite development middleware.

### Lucky Color flow

The source domain is already well separated:

1. `getLuckyColorForDate(date, goal)` resolves an app-owned `LuckyColorRule`.
2. `adaptLuckyColorToSubtype(family, subtype)` resolves a canonical palette shade and placement suitability when an honest match exists.
3. `recommendLuckyGoalsOutfit` composes one or two already-resolved rules.
4. `buildOutfitBoardModel` presents those facts without recalculating them.

The four existing goals are `work`, `money`, `luck`, and `mentor-support`, with complete Thai/English labels.

There is one deliberate conflict with the new product rule. `dailyLuckyColorGoal.ts` defaults to `work`, sanitizes an empty list back to `work`, and `DailyView` prevents deselecting the last goal. Production Today must replace that behavior with a real empty selection. Because the old key was automatically populated, an old `['work']` value cannot reliably be treated as an intentional preference.

### Profile and persistence

The app has no account or cloud profile. It uses defensive, versioned `localStorage` services:

- `personal-color-pocket:v1`, with internal schema version 2, stores quiz answers, Personal Color result, and quiz step.
- `personal-color-pocket:presentation:v1` stores the women/men presentation preference.
- `personal-color-pocket:daily-lucky-color-goal:v1` stores one or two Lucky Color goals.
- `personal-color-pocket:language` stores the language.

Storage failures are non-fatal. The Personal Color service validates versions and migrates the older quiz model. Retaking the quiz clears the quiz/profile record only. Wardrobe data should use its own key so a profile retake never deletes owned clothing.

The women/men value is a presentation preference, not a garment-ownership or identity constraint. Today’s lucky logic is gender-neutral. Existing style examples vary the displayed garment examples, but the underlying color suitability does not. My Wardrobe must use one shared taxonomy; presentation preference may only influence ordering or examples.

### Color capabilities and identity

The repository already provides the required color foundation:

- `normalizeHex()` validates and normalizes arbitrary HEX.
- `checkColor(hex, subtype)` deterministically evaluates any valid HEX, including colors outside the ideal palette.
- `describeColor(hex)` derives stable English and Thai generic names for arbitrary HEX.
- `getPalette(subtype)` returns canonical colors with stable IDs, English names, and HEX values.
- `CanonicalColorLabel` displays a canonical color in Thai with the English canonical name retained as a secondary label.
- Color Checker supports a browser color picker and manual HEX.
- Photo Checker loads a local photo, lets the user tap a region, samples locally, and discards the photo when the panel closes. Its base pipeline sends nothing over the network and persists nothing. Its separate AI fallback is explicit and is not needed for wardrobe color entry.

A canonical identity means a specific palette ID plus its exact canonical HEX. An arbitrary sampled or user-picked HEX is still valid wardrobe data, but it must not be presented as canonical unless that identity is explicitly established.

### Existing clothing vocabularies

The experimental wardrobe uses `top`, `bottom`, `outerwear`, and `shoes`, plus a three-level formality. Existing production style examples also contain shirt, polo, T-shirt, blouse, trousers, chinos, jeans-like generic bottoms, skirt, dress, jacket, cardigan, loafers, sneakers, shoes, bags, scarves, belts, and accessories. Women’s examples include dresses while men’s examples do not, but the vocabulary and suitability engines are shared.

No clothing or wardrobe persistence exists outside the experimental Today Outfit files. The existing Daily board is semantic inspiration, not owned inventory.

### What to reuse, generalize, or keep experimental

Reuse as-is:

- Personal Color subtype, palette, HEX normalization, `checkColor`, and generic color naming
- canonical color localization/display rules
- Lucky Color source rules and adaptation functions
- language and presentation-preference infrastructure
- defensive versioned `localStorage` conventions
- local photo decode/sampling primitives for a later color-entry enhancement
- server-only credentials, normalized errors, timeouts, and strict response validation patterns

Generalize before production use:

- extract a production wardrobe domain instead of importing the Lab contract
- add garment type and one-piece support
- derive a provider-safe styling context from stored wardrobe records
- extend outfit selection validation to support separates or one-piece outfits
- make Lucky Color selection truly optional and resolve it before constructing stylist input
- separate owned-item and free-inspiration request/result contracts

Keep experimental:

- Lab UI, bakeoff cases, reviews, JSON exports, and dev-only routes
- prototype provider selection controls
- the deterministic baseline until it supports the production taxonomy and edge cases
- Image Lab comparison UI and its session-only research records

## 2. Product definition

My Wardrobe V1 answers one narrow need: “Tell the app what clothes I own so Today can recommend an outfit I can actually wear.” It is not a general closet-management product. V1 has no shopping, wear history, laundry state, social features, analytics, virtual try-on, or automatic garment recognition.

The smallest useful inventory records garment identity, what kind of garment it is, its primary color, and enough formality information for occasion matching. Personal Color compatibility is derived at recommendation time and is never persisted on the item.

## 3. Production wardrobe model

Recommended persisted shape:

```ts
interface WardrobeRecordV1 {
  id: string
  garmentType: GarmentType
  color: {
    hex: string
    canonicalColorId?: string
  }
  formality: 'casual' | 'smart-casual' | 'formal'
  customName?: string
}
```

`slot` is a required domain concept but should be derived from the closed garment-type definition rather than stored twice:

```ts
interface GarmentTypeDefinition {
  id: GarmentType
  slot: 'top' | 'bottom' | 'one-piece' | 'outerwear' | 'shoes'
  defaultFormality: 'casual' | 'smart-casual' | 'formal'
}
```

This prevents impossible records such as `garmentType: 'skirt'` with `slot: 'top'`. The provider-safe view may include both `slot` and `garmentType` after deriving and validating them.

Formality is stored as a resolved value because two garments of the same type can genuinely differ. The UI preselects the type’s default and lets the user override it, so it is required data without becoming a required question in the common path.

The automatic display name is derived in the active language from color plus garment type, for example “Coral polo” or “กางเกงขายาวสีกรมท่า”. `customName` is only an override. Do not send a user-entered custom name to an AI provider; structured type and color are sufficient and avoid unnecessary personal text and prompt-injection surface.

### Field matrix

| Field/concept | Decision | Reason |
| --- | --- | --- |
| `id` | REQUIRED V1 | Stable app-owned identity used by edits and owned-outfit results. |
| `garmentType` | REQUIRED V1 | Needed for useful recommendations, display, prompt facts, and default formality. |
| `slot` / category | REQUIRED V1, derived | Needed for outfit construction and filtering; derive from type instead of persisting duplicate state. |
| primary `color.hex` | REQUIRED V1 | Deterministic naming, Personal Color evaluation, Lucky Color matching, and display all depend on it. |
| `color.canonicalColorId` | OPTIONAL V1 | Preserves honest canonical identity when the user chose a palette color; absent for arbitrary colors. |
| `formality` | REQUIRED V1 with inferred default | Needed for occasion fit; normal users need not answer unless overriding the default. |
| `customName` | OPTIONAL V1 | Useful for “office navy blazer”; an automatic localized name covers the common case. |
| generic color name | DERIVED, do not store | `describeColor(hex)` already produces bilingual names and avoids stale copies. |
| Personal Color compatibility | DERIVED, do not store | Recompute with `checkColor` against the current subtype. |
| photo | DEFER | Not required for recommendation and changes storage/privacy complexity. |
| notes | DEFER | Free text is not required by the stylist and adds provider/privacy risk. |
| pattern | DEFER | Useful for advanced coordination but not necessary to prove V1 value. |
| material | DEFER | Nice-to-have nuance with high input cost. |
| fit/silhouette | DEFER | Subjective and taxonomy-heavy. |
| season/weather suitability | DEFER | Weather is out of scope and “season” is ambiguous in Thailand. |
| brand | DEFER | Not needed for outfit reasoning. |
| favorite | DEFER | A preference/ranking enhancement, not inventory foundation. |
| availability/laundry | DEFER | Creates operational closet management. |
| wear history | DEFER | Creates tracking and analytics scope. |
| `createdAt` / `updatedAt` | DEFER | Not needed for V1 behavior; collection order is sufficient. Add only with a concrete sync/audit need. |

## 4. Slot and garment-type taxonomy

Production needs both concepts, but only garment type is persisted. One-piece is necessary because the current product already presents dresses and a top-plus-bottom-only result cannot represent them.

| Slot | Compact V1 garment types |
| --- | --- |
| `top` | `t-shirt`, `polo`, `shirt`, `blouse`, `knit-top`, `other-top` |
| `bottom` | `trousers`, `chinos`, `jeans`, `skirt`, `shorts`, `other-bottom` |
| `one-piece` | `dress`, `jumpsuit`, `other-one-piece` |
| `outerwear` | `jacket`, `blazer`, `cardigan`, `coat`, `other-outerwear` |
| `shoes` | `sneakers`, `loafers`, `flats`, `heels`, `boots`, `sandals`, `formal-shoes`, `other-shoes` |

This is one taxonomy for all users. Presentation preference may reorder common choices, but it must not hide or invalidate a type. “Other” requires a short custom name and an explicit formality selection.

The production owned-outfit result must become a discriminated selection instead of requiring top and bottom in every result:

```ts
type OwnedOutfitBase =
  | { kind: 'separates'; topId: string; bottomId: string }
  | { kind: 'one-piece'; onePieceId: string }

interface OwnedOutfitSelection {
  base: OwnedOutfitBase
  outerwearId: string | null
  shoesId: string
}
```

Every ID is validated against the submitted inventory and its derived slot. Accessories remain deferred.

## 5. Color-entry design

The add form should offer three progressively disclosed paths:

1. **Basic colors** — the default fast path. Show a compact app-owned grid of common generic swatches. Selecting one stores its HEX with no canonical ID. The bilingual generic name is derived with `describeColor`.
2. **My Palette** — show the saved subtype’s canonical swatches using `CanonicalColorLabel`. Selecting one stores exact HEX plus `canonicalColorId`.
3. **Exact color** — open the existing browser color picker plus manual HEX input. Store normalized HEX with no canonical ID.

Photo sampling should be a V1.1 enhancement, not a condition for inventory launch. When added, reuse the local `openPhoto` and sampling pipeline in a small reusable color-source control: select or photograph one garment, tap a representative region, confirm the sampled color, store only the normalized HEX, and discard the image. Do not invoke the existing paid AI photo fallback for wardrobe entry.

The four evaluated methods therefore resolve as follows:

- Canonical palette picker: V1, canonical identity retained.
- Generic color/basic swatches or exact picker: V1, no canonical identity.
- Existing Color Checker/photo sampling: reuse its local primitives in V1.1; do not deep-link and copy results manually as the primary UX.
- Photograph garment and sample: same V1.1 local sampling path; no garment recognition.

Canonical IDs remain optional. If a stored canonical ID becomes unknown or no longer matches its HEX after a future data migration, preserve the HEX and drop only the invalid ID. A profile/subtype change never invalidates the garment itself: suitability is recomputed against the new subtype.

## 6. Photo policy

**Recommendation: My Wardrobe V1 has no persisted item photos.**

- No-photo inventory has the lowest onboarding friction, stays within current `localStorage`, remains private/local, and supplies every fact required by the text stylist.
- Optional photos would improve recognition and browsing but require IndexedDB or native filesystem storage, image resizing, quota/error handling, deletion guarantees, backup policy, and new privacy copy.
- Required photos would make quick entry impossible and exclude users who do not want to photograph their clothes.

Without a photo, a wardrobe card uses a garment-type icon/silhouette, a large real HEX swatch, the automatic/custom name, type label, and optional formality badge. This is enough to distinguish items in a filtered list.

An ephemeral photo used only to sample color is not an item photo. Reference photos for image-to-image preview are a third, separate future feature.

## 7. Add-item UX

Use one mobile sheet/page rather than a long wizard. The common path should take three choices and roughly 10–20 seconds:

1. Tap **+ เพิ่มเสื้อผ้า**.
2. Choose “What is it?” from garment-type chips grouped by slot. Selecting the type derives slot and preselects formality.
3. Choose color from **Basic colors** or **My Palette**. “Exact color” is secondary.
4. Review the generated localized name and tap **Save** or **Save & add another**.

An “More details” disclosure contains the custom-name override and formality override. Do not ask for a name or formality in the common path. For an `other-*` type, expand those fields because the app cannot infer them honestly.

After saving, retain the last slot group only when the user chose “Save & add another”; clear type and color so the app never creates an accidental duplicate. A duplicate action from an existing item can copy type/formality/name while requiring confirmation of color.

## 8. Bulk onboarding

The empty state should frame a small usable target, not ask users to catalog everything: “Start with 5–8 pieces you wear often.” Show coverage for a complete look: tops or one-pieces, bottoms when needed, and shoes; outerwear is optional.

V1 accelerators:

- persistent **Save & add another** action
- fast basic-color grid and palette swatches
- remember the current slot group during a repeated-add session
- duplicate an item for the same garment in another color
- category coverage/progress, not a fake completion percentage
- optional “Add your basics” checklist that opens preselected garment types but never creates items the user has not confirmed

Do not seed a starter wardrobe. A template may suggest common items, but every record must represent something the user confirms they own.

Keep three future photo problems separate:

- One-garment photo → suggest type/color → user confirms: plausible V1.1/V2 assistive entry.
- Multi-garment or closet photo → detect and separate many items: materially harder computer vision and correction UX; later V2 research.
- Reference garment photos for AI Outfit Preview: generation fidelity/storage problem, not onboarding recognition.

## 9. Wardrobe management UX

Entry point: Today → My Wardrobe source → **จัดการเสื้อผ้าของฉัน**. A secondary Profile/Settings entry should be added only if the product later gains a real Profile/Settings screen; none exists today.

The screen contains:

- title and total item count
- primary Add action
- horizontal filters: All, Tops, Bottoms, One-pieces, Outerwear, Shoes
- compact two-column cards on normal phones, one column at large text sizes
- card actions for Edit and Delete; deletion requires confirmation or immediate Undo
- empty state with the 5–8-piece suggestion and Add action
- filtered empty states that point directly to adding that slot

At 10 items the grid is directly scannable. At 30 items category filters keep lists short. At 100 items the same filters, stable automatic-name sorting, and item counts remain usable; search is not justified for V1 but becomes a V1.1 candidate if real usage reaches that scale. Do not add analytics, outfit history, or wardrobe statistics.

## 10. Persistence

Use a dedicated versioned `localStorage` envelope:

```ts
interface StoredWardrobeV1 {
  version: 1
  items: WardrobeRecordV1[]
}
```

Suggested key: `personal-color-pocket:wardrobe:v1`.

This matches the current private/local architecture and is sufficient for 100 metadata-only items. Implement `loadWardrobe`, `saveWardrobe`, and schema validation in a dedicated service. Invalid records should be skipped individually where safe so one damaged item does not erase the entire wardrobe. Normalize HEX on load. Reject duplicate IDs. Preserve unknown-version data by treating it as unreadable rather than overwriting it until the user makes a new successful save.

Wardrobe persistence must be independent of quiz/profile clearing. A subtype change triggers no wardrobe migration; it only changes derived compatibility. Storage-blocked/full behavior should keep the current session usable and surface a concise “could not save” state rather than silently promising persistence.

Do not use IndexedDB or a server for metadata-only V1. If item photos are later approved, add a separate media repository keyed by item ID using IndexedDB on web and evaluate Capacitor filesystem behavior on Android. Do not put base64 photos in `localStorage`.

## 11. Today integration

Evolve the existing Today page; do not create another primary destination.

Recommended order:

1. **วันนี้อยากเสริมเรื่องไหนเป็นพิเศษ?** — zero to two optional Lucky Color focuses.
2. **วันนี้แต่งตัวไปไหน?** — occasion.
3. **จัดลุคจาก** — **เสื้อผ้าของฉัน** or **ไอเดียลุคใหม่**.
4. Generate recommendation.
5. Render structured text result.
6. Optionally render **✨ ดู AI Outfit Preview** after a valid result.

Keep the current stable occasion IDs for the first production contract, with user-facing Thai labels:

| ID | Suggested Thai label |
| --- | --- |
| `casual` | วันสบาย ๆ |
| `casual-dinner` | ไปกินข้าวแบบสบาย ๆ |
| `work` | ไปทำงาน |
| `smart-casual` | กึ่งทางการ / สมาร์ตแคชชวล |
| `date` | ไปเดต |
| `formal` | งานทางการ |
| `wedding-guest` | ไปงานแต่ง |

The IDs map cleanly enough for V1. The Thai copy should include short examples during usability review because `casual-dinner`, `date`, and `smart-casual` can overlap. Do not add free-text occasion context in the first production pass; the closed choice is faster, easier to validate, and avoids unnecessary prompt text.

## 12. Lucky Color integration contract

The app resolves date, goals, source rules, families, canonical adaptation, and deterministic wardrobe-family matches. The stylist never calculates astrology or changes a lucky family.

Recommended provider-safe fact:

```ts
interface OutfitLuckyPreference {
  goals: LuckyGoal[]               // one or two goals that resolved to this family
  family: LuckyColorFamily         // app-owned rule result
  adaptedColor: null | {
    canonicalColorId: string
    hex: string
    suitability: 'near-face' | 'main-piece' | 'below-face' | 'accessory'
  }
  priority: 'soft'
}
```

Two goals that resolve to the same family become one preference with both goals, preserving provenance without duplicating a color request. With no Personal Color result, `adaptedColor` is null and the broad family remains honest. With zero selected goals, `luckyPreferences` is an empty array and no Lucky Color engine is called.

For My Wardrobe mode, the app may add `luckyFamilyMatches` to each provider-safe item by running the existing deterministic family classifier on its HEX. This is derived request context, never stored item data.

Decision hierarchy:

1. hard inventory validity and required outfit slots
2. occasion appropriateness and basic outfit coherence
3. Personal Color, especially near the face
4. Lucky Color as an optional soft preference

If a Lucky Color preference is not honestly satisfiable from the wardrobe, the result says so briefly rather than inventing an item or choosing an inappropriate outfit.

Migration rule: introduce a new Lucky selection schema/key whose default is `[]`. Do not automatically import the old v1 `['work']`, because the app wrote that value without proving the user chose it. This one-time reset is the only reliable way to enforce “no forced default.”

## 13. My Wardrobe and Free Inspiration separation

These are separate domain modes, not a boolean that weakens validation.

### My Wardrobe

- request contains validated owned items
- result contains only validated item IDs
- app rejects unknown IDs, wrong slots, duplicate assignments, or impossible base combinations
- compatibility and Lucky Color matches are deterministic annotations
- no item may be invented

### Free Inspiration

- request contains subtype/palette facts when available, occasion, and optional app-resolved Lucky Color preferences
- request contains no owned-item IDs
- result contains conceptual pieces, never claims ownership
- AI chooses from a closed garment-type taxonomy and supplied color references

Conceptual result:

```ts
type InspirationColorRef =
  | { kind: 'canonical'; canonicalColorId: string }
  | { kind: 'generic-family'; family: ColorFamily }

interface InspirationPiece {
  slot: WardrobeSlot
  garmentType: GarmentType
  color: InspirationColorRef
  description?: string
}

type FreeInspirationSelection =
  | { kind: 'separates'; top: InspirationPiece; bottom: InspirationPiece; outerwear?: InspirationPiece; shoes: InspirationPiece }
  | { kind: 'one-piece'; onePiece: InspirationPiece; outerwear?: InspirationPiece; shoes: InspirationPiece }
```

The app validates slot/type combinations and canonical IDs. A generic family is an app-owned semantic concept, not an AI-authored HEX measurement. Personal Color subtype, canonical palette, occasion, and Lucky Color facts remain deterministic. Garment coordination, type selection, and the explanation are generative. Shopping products and links remain out of scope.

## 14. AI Outfit Preview placement

Show the preview action only after a text recommendation has passed validation. It is never automatic, never blocks text, and never replaces the structured result.

- My Wardrobe copy: **ดูภาพไอเดียของลุคนี้** with a nearby note that the image is illustrative and may not match the user’s actual garments.
- Free Inspiration copy: **ดู AI Outfit Preview**; still label color/details as illustrative.

My Wardrobe preview receives only normalized selected type/slot/color/formality facts, not the full wardrobe, custom names, photos, or stylist reasoning. Free Inspiration preview receives only the validated conceptual pieces. Failure leaves the text result untouched with Retry available.

Gemini Image Lite is the practical prototype candidate from observed research. Production enablement still needs cost/quota/privacy review. Do not silently fall back to another image model. Standard remains experimental; do not change timeout based on one observed run.

## 15. Empty, failure, and edge states

| State | Required behavior |
| --- | --- |
| Wardrobe empty | Explain the 5–8-piece quick start; offer Add item and Free Inspiration. Do not call owned-mode AI. |
| Missing coverage | Name the missing requirement. A usable outfit needs shoes plus either top+bottom or one-piece. Offer Add and Free Inspiration. Outerwear is optional. |
| No strong Personal Color match | Use the best owned, occasion-appropriate option; keep stronger colors near the face when possible; explicitly explain the compromise. Never call owned clothes “wrong.” |
| No Personal Color result | Allow occasion + wardrobe/free inspiration with general color reasoning; offer the quiz without blocking Today. |
| Zero Lucky focuses | Omit lucky preferences entirely; recommend from Personal Color, occasion, and selected source. |
| One or two Lucky focuses | Resolve in app and pass as soft structured preferences. Explain when no owned item can satisfy one. |
| Free Inspiration | Do not require wardrobe coverage and do not imply any proposed garment is owned. |
| Text provider failure | Keep prior valid result if present; otherwise offer Retry and a clearly labeled deterministic basic recommendation when the production fallback supports the new contract. Never show an unvalidated provider payload. |
| Malformed provider result | Reject it at the server/domain boundary and use the same safe failure path. |
| Image failure | Preserve the complete text recommendation and show a local preview error/Retry only. |
| Storage blocked/full | Keep session edits, identify that they were not saved, and allow retry/export later rather than silently losing trust. |
| Canonical ID becomes stale | Preserve normalized HEX; remove/downgrade only the canonical identity. |

The experimental deterministic baseline is not production-ready unchanged: it lacks one-piece support, Lucky Color facts, and richer coordination. It can be generalized into a transparent basic fallback in a later implementation slice.

## 16. Privacy and storage

- Wardrobe metadata stays on the device in V1. It is accessible to the app origin and may be subject to browser/OS backup behavior; users should be told there is no account sync and clearing app data can remove it.
- No garment photos are stored in V1.
- Future local color-sampling photos are ephemeral and should be discarded after confirmation.
- Future AI photo analysis requires an explicit action and clear disclosure that an image leaves the device; it must not be implied by local Photo Checker behavior.
- Today Previews stay session-only unless the user explicitly saves a Look. The separate Saved Outfits feature may copy an existing successful Preview into its IndexedDB Blob repository; wardrobe metadata and localStorage never contain image bytes.
- Text AI receives only minimum structured wardrobe facts required for recommendation. Do not send custom names, raw storage envelopes, profile answers, or unrelated metadata.
- Image AI receives only the selected outfit facts, never the whole wardrobe or user photos by default.
- API keys remain server-only; normalized errors remain safe for the browser.

## 17. MVP and deferred matrix

| Capability | My Wardrobe V1 | Today Outfit Production V1 | V1.1 / V2 |
| --- | --- | --- | --- |
| Metadata-only local inventory | Required | Consumed by owned mode | Cloud sync only if accounts exist later |
| Shared slot/type taxonomy incl. one-piece | Required | Required | Expand only from real needs |
| Basic, palette, exact HEX color entry | Required | Deterministic evaluation | Photo sampling V1.1 |
| CRUD, filters, count, quick repeated add | Required | Link from Today | Search if scale justifies it |
| Item photo | No | No | Optional photo after storage/privacy design |
| Occasion selector | — | Required | Context/free text only if validated need |
| Lucky Color 0–2 optional | — | Required | More explanation/personalization later |
| My Wardrobe result by IDs | — | Required | Reference-photo fidelity later |
| Free Inspiration separate result | — | Required | Manual matching/shopping later |
| Deterministic safe fallback | — | Required | Improve coordination with evidence |
| AI Outfit Preview | — | Not required for core release | V1.1 optional explicit action |
| One-item photo recognition | No | No | V1.1/V2 research |
| Multi-item closet recognition | No | No | Later V2 research |
| Weather | No | No | V2 |
| Wear history/favorites | No | No | V2 only if product evidence supports it |
| Laundry/availability | No | No | V2, likely separate product scope |
| Shopping integration | No | No | V2 |
| Virtual try-on | No | No | Separate future product/research track |

## 18. Recommended implementation slices

### Slice 1 — production wardrobe domain and persistence

- Scope: taxonomy, persisted record, derived slot/name/formality helpers, color identity validation, versioned local persistence.
- Likely files: new `src/domain/wardrobe/*`, new `src/services/wardrobePersistence.ts`, focused tests.
- Tests: valid/invalid type-slot definitions, color normalization/canonical integrity, bilingual derived names, migrations, corrupt storage, duplicate IDs, blocked storage.
- Risk: low; no UI or AI calls.

### Slice 2 — My Wardrobe CRUD and rapid onboarding

- Scope: secondary screen, empty state, cards, filters, add/edit/delete, Save & add another, automatic names/default formality.
- Likely files: new `src/wardrobe/*`, i18n types/copy, `App.tsx` secondary-view wiring, styles, UI tests.
- Tests: mobile/large-text semantics, add/edit/delete, other-type requirements, filtering, storage failure, no bottom-nav item.
- Risk: medium UI/state work; no AI calls.

### Slice 3 — Today input shell and Lucky Color migration

- Scope: change goal selection to true 0–2, new copy, occasion selector, source selector, wardrobe coverage state; retain current deterministic Daily result until explicit generation.
- Likely files: `DailyView`, Lucky goal persistence service, i18n, new Today input state/domain helpers, tests.
- Tests: zero/one/two goals, deselect to zero, old v1 default reset, source/occasion state, no automatic calls.
- Risk: medium because it changes existing Today behavior; no provider call required during tests.

### Slice 4 — My Wardrobe recommendation contract and production text path

- Scope: provider-safe facts, separates/one-piece selection, strict ID validation, soft Lucky preferences, generalized deterministic fallback, server production route and one selected provider behind normalized errors.
- Likely files: production `todayOutfit` domain modules distinct from or replacing reusable Lab pieces, API handler/route, Today result UI, security/boundary tests.
- Tests: invented IDs, wrong slots, duplicate items, no Lucky override, insufficient inventory blocks calls, provider failure fallback, secrets absent from client.
- Risk: high contract/security/provider cost; AI calls exist in production but tests remain mocked.

### Slice 5 — Free Inspiration contract and text path

- Scope: separate request/result, closed garment types and canonical/generic color refs, distinct UI copy, no owned-ID semantics.
- Likely files: new inspiration domain/handler or clearly discriminated production modules, Today result rendering, tests.
- Tests: never emits/accepts wardrobe IDs, validates color refs, deterministic facts cannot be redefined, source switching does not leak prior results.
- Risk: medium-high generative validation; AI involved, no shopping.

#### Slice 5 closeout — 2026-09-28

- Implemented as a separate Inspiration request/result contract and production endpoint. It sends occasion, optional subtype, finite garment/color candidates, and optional structured Lucky soft preferences; it never sends wardrobe records or IDs. Provider failure uses the validated deterministic Inspiration fallback and the same app-owned presentation.
- Manual PO smoke testing passed for Inspiration + casual + Lucky 0 and Inspiration + work + selected Lucky. Conceptual pieces were understandable, occasion and Personal Color were represented, Lucky remained secondary, the result read as an idea rather than owned clothing, and the feature worked independently of wardrobe inventory.
- PO testing also found that changing Lucky could expose the historical Lucky color/outfit board: request-fingerprint invalidation ran after render, then the idle branch rendered `EmptyLuckyResult`, `TodayColors`, or `OutfitBoard`. The closeout fix treats fingerprint-mismatched result/loading state as idle during the same render and production Today no longer auto-renders those legacy components. Their domain/components remain covered for possible future use; Lucky remains an optional 0–2 input to explicit recommendation generation.

### Slice 6 — local photo color entry enhancement

- Scope: extract a reusable local photo-sampling control and return confirmed HEX to wardrobe add/edit; no item-photo persistence and no AI fallback.
- Likely files: reusable photo/color component, wardrobe color input, existing photo pipeline tests plus integration tests.
- Tests: image discarded, no network/storage, confirmed HEX only, cancellation/stale results.
- Risk: medium browser/device behavior; no provider calls.

### Slice 7 — optional AI Outfit Preview production placement

- Scope: explicit preview button after valid text result, minimal selected facts, illustrative copy, session-only image, normalized failure.
- Likely files: production image request adapter from validated owned/inspiration results, API route, Today result UI, tests.
- Tests: never automatic, text survives failure, no full wardrobe/custom names/photos sent, no persistence, exact Gemini REST enum regression.
- Risk: high cost/latency/privacy and provider availability; live smoke testing only when separately authorized.

## 19. Risks and unresolved product decisions

1. Confirm the compact garment-type labels and default formality table with Thai users; the domain shape is ready, but wording and ordering need usability review.
2. Confirm that one-piece outfits are in the first release. This design recommends yes because existing production vocabulary already includes dresses; excluding them would create a gender-skewed contract.
3. Approve the one-time reset of old Lucky Color v1 selections to empty. It is necessary because the previous automatic `work` default cannot be distinguished from user intent.
4. Decide whether the initial production text provider is Groq/Qwen or Gemini Flash Lite after verified pricing, quota, privacy, and operational review. Prototype latency alone is not a permanent provider decision.
5. Define the production deterministic fallback quality bar before relying on it during provider failure.
6. Decide whether 100 items is a supported tested ceiling or simply an expected usable scale; persistence validation should still set a finite defensive maximum.
7. Decide whether Free Inspiration ships in the same release as owned mode or immediately after it. The contracts must remain separate either way.
8. Review provider disclosure/privacy copy for sending structured garment facts, subtype, occasion, and Lucky Color preferences.

## 20. Frozen boundaries

- No new primary Today Outfit or My Wardrobe navigation tab.
- No automatic AI call on input changes.
- No invented owned items.
- No duplicated Personal Color compatibility in storage.
- No forced canonical identity for arbitrary colors.
- No item photo requirement or persistence in V1.
- No cloud account/database without a separate product decision.
- No shopping, history, laundry, social wardrobe, automatic closet recognition, or virtual try-on.
- Text recommendation remains useful without image generation.
