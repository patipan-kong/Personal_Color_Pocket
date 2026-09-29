# Today Outfit Production — AI Outfit Preview design

## Status and product goal

This is the Slice 6A implementation design. It changes no production behavior.

The production flow is:

`Today inputs → explicit text recommendation → validated selected outfit → explicit AI Outfit Preview → illustrative flat-lay`

The structured recommendation remains the source of truth. The image model is a visualizer only: it must not select, improve, replace, add, or remove garments. This feature is not exact garment rendering, wardrobe-photo reproduction, virtual try-on, or a fitting simulation.

## Repository evidence and provider decision

The development-only Image Lab is split across these areas:

- `src/domain/todayOutfitImage/catalog.ts`: two Lab candidate IDs and their Gemini model IDs.
- `src/domain/todayOutfitImage/contract.ts`: a strict, separates-only Lab request/result contract and derivation from the old Lab recommendation.
- `api/_lib/outfitImagePrompt.ts`: deterministic flat-lay prompt from the validated Lab request.
- `api/_lib/outfitImageProvider.ts`: Gemini REST `v1` `generateContent`, image extraction, MIME/base64 checks, usage normalization, safe error classification, and development-only sanitized provider diagnostics.
- `api/_lib/outfitImageHandler.ts`: method/body/request checks, server-only key gate, 60-second timeout, and safe response envelope.
- `api/devServer.ts`: DEV-only `/api/ai-outfit-image/<candidate>` route.
- `src/todayOutfit/outfitImageApi.ts`: browser transport and basic response checks.
- `src/todayOutfit/TodayOutfitImageLab.tsx`: manual generation, candidate selector, in-memory comparison, and PO review.
- `src/todayOutfit/outfitImageExport.ts`: metadata/review export that deliberately excludes image bytes.
- Focused domain, prompt, provider, UI, export, and boundary tests preserve these behaviors.

The recorded evidence remains:

- Gemini Image Lite, `gemini-3.1-flash-lite-image`: four successful manual generations at approximately 7531, 5480, 5002, and 5762 ms; directional mean approximately 5944 ms. The images were useful editorial flat-lays with generally separated/readable garments, broadly represented categories, and useful illustrative colors. They were not exact garment reproductions; details were synthesized and color was not measurement truth. One image added unwanted labels/text/HEX despite explicit constraints.
- Gemini Image Standard, `gemini-3.1-flash-image`: one observed request timed out at approximately 60019 ms. This does not establish that Standard always takes more than 60 seconds.
- The Gemini legacy REST `v1` `generationConfig.responseFormat.image` wire values are `ASPECT_RATIO_ONE_BY_ONE` and `IMAGE_SIZE_ONE_K`. The human-facing strings `"1:1"` and `"1K"` caused real `400 INVALID_ARGUMENT` responses and must not return to the REST request.

Based only on this repository evidence, production prototyping should use Gemini Image Lite. Standard remains Lab-only/experimental. There is no automatic provider or model fallback.

Create one production configuration boundary, analogous to `ownedOutfitConfig.ts`:

```ts
// api/_lib/outfitPreviewConfig.ts
export const OUTFIT_PREVIEW_PROVIDER = Object.freeze({
  provider: 'gemini' as const,
  model: 'gemini-3.1-flash-lite-image',
})
```

The production UI and request must not contain a selector. The square/1K REST constants should live in shared server-only Gemini image transport code and remain protected by exact-request tests. Keep the existing 60-second image timeout initially; changing it needs operational evidence, not the single Standard observation.

## Trusted recommendation facts

### Owned result

After validation, `OwnedOutfitRecommendation` contains:

- either `selection.kind: 'separates'` with `topId`, `bottomId`, nullable `outerwearId`, and `shoesId`, or `selection.kind: 'one-piece'` with `onePieceId`, nullable `outerwearId`, and `shoesId`;
- bounded provider reasoning, which production presentation does not render verbatim.

`validateOwnedOutfitRecommendation` proves every selected ID exists in the submitted `OwnedOutfitRequest`, belongs to the required slot, is not reused in another slot, and forms exactly one valid base shape. Each matching `OwnedWardrobeFact` supplies trusted-for-this-client-request `id`, `slot`, `garmentType`, normalized `hex`, `formality`, Personal Color compatibility, and Lucky-family matches.

The facts originated in locally parsed `WardrobeRecordV1` records. Those records also may have `color.canonicalColorId` and `customName`, but the Owned recommendation request deliberately excludes both. Preview does not need either. It also does not need formality, compatibility, Lucky matches, reasoning, the unselected wardrobe, or IDs after resolution.

### Inspiration result

After validation, `InspirationOutfitRecommendation.outfit` contains exactly one of:

- separates: `top`, `bottom`, nullable `outerwear`, and `shoes`;
- one-piece: `onePiece`, nullable `outerwear`, and `shoes`.

Each `InspirationPiece` has a closed-taxonomy `garmentType` and either an allowed canonical Personal Color ID or an allowed generic wardrobe-color ID. Validation proves the garment type belongs to its structural slot and the color identity was supplied in the request's finite allowlist.

`resolveInspirationColor` resolves canonical IDs through the app palette catalog and generic IDs through `BASIC_WARDROBE_COLORS`. It returns an app-owned HEX and app-owned color description. Provider-authored prose is not required.

## Normalized production preview input

Use one origin-agnostic, discriminated contract. Structural fields already identify slots, so duplicating a `slot` string inside each piece would add mismatch risk.

```ts
interface OutfitPreviewInput {
  readonly version: 1
  readonly mode: 'flat-lay'
  readonly outfit:
    | {
        readonly kind: 'separates'
        readonly top: PreviewPiece
        readonly bottom: PreviewPiece
        readonly outerwear: PreviewPiece | null
        readonly shoes: PreviewPiece
      }
    | {
        readonly kind: 'one-piece'
        readonly onePiece: PreviewPiece
        readonly outerwear: PreviewPiece | null
        readonly shoes: PreviewPiece
      }
}

interface PreviewPiece {
  readonly garmentType: GarmentType
  readonly color: { readonly hex: string }
  readonly visualDescription?: PreviewVisualDescription
}
```

`garmentType` is the authoritative semantic garment identity. The optional `visualDescription` is a finite app-owned rendering hint, never provider prose and never a second recommendation. It may clarify the presentation of the same selected type (for example, `sandals` as `men's casual sandals`) but cannot authorize a different garment.

This is smaller and safer than the Lab input. It contains no origin/mode-of-recommendation flag, alternate garments, full wardrobe, IDs, custom names, formality, Personal Color subtype or candidate palette, Lucky facts, occasion, reasoning, previous prompt prose, provider, model, or free-form prompt. The server derives a short English provider-facing garment label from `GARMENT_DEFINITIONS` and a safe color label from the normalized HEX via `describeColor`. The only additional wording is selected from the closed app-owned visual-description mapping.

The contract accepts exactly three or four pieces. It rejects unexpected fields, an unknown type, a type in the wrong structural slot, malformed/non-normalized HEX, an invalid base shape, or any attempt to include a prompt.

## Mapping to preview input

### Owned → Preview

1. Start only from a client-validated recommendation and the exact `OwnedOutfitRequest` against which it was validated.
2. Resolve each selected ID in the request's `wardrobe` facts, preserving the recommendation's separates/one-piece shape and nullable outerwear.
3. Copy only `garmentType` and normalized `hex` into the corresponding preview piece. Do not derive a gender presentation hint: Owned inventory is explicit user data and remains authoritative even when it differs from profile gender.
4. Validate the completed preview input before enabling/calling preview.

Garment type supplies the slot through `getWardrobeSlot`. Canonical identity is unnecessary because the actual selected HEX is already authoritative for the card and sufficient to ground the illustration. `customName` is unavailable at this boundary by design and must not be recovered from the persisted record. Formality is useful while choosing an outfit but gives the visualizer room to reinterpret a selection, so omit it after selection.

An arbitrary user-entered Owned HEX is useful and safe as a normalized color datum. It is not executable prose. The server can prove only that it is a valid normalized HEX paired with a known garment type; with no server wardrobe database, it cannot prove that the color describes a real owned item.

### Inspiration → Preview

1. Start only from a client-validated Inspiration recommendation and its exact `InspirationOutfitRequest`.
2. Preserve its separates/one-piece shape, exact garment types, and exact outerwear presence.
3. Resolve every canonical/generic color identity with `resolveInspirationColor` and copy only its app-owned HEX.
4. For presentation-sensitive unisex types only, resolve a finite app-owned visual description from the request's already-validated explicit gender. `null` produces no hint and never defaults to women.
5. Reject mapping if any identity cannot resolve, then validate the completed preview input.

Canonical/generic color and visual-description resolution happen before provider invocation. The provider receives neither color identities nor alternatives; the prompt names only the already-selected type, resolved color, and an optional constrained presentation hint for that same type. It therefore has no structured opportunity to swap a shirt for a polo, trousers for a skirt, shoes, outerwear presence, or a color identity.

### Visual-presentation taxonomy audit

- Sufficiently unambiguous as-is: T-shirt, polo, shirt, knit top, trousers, chinos, jeans, shorts, and sneakers.
- Gender-restricted by taxonomy already: blouse, skirt, dress, flats, and heels. Existing Inspiration validation remains the authority.
- Unisex but presentation-sensitive: jumpsuit; jacket, blazer, cardigan, and coat; loafers, boots, sandals, and formal shoes. Explicit-gender Inspiration may attach an app-owned men's/women's description.
- Too generic to improve without inventing semantics: every `other-*` category. These receive no hint.

Historical Saved Preview images are immutable local artifacts. This mapping does not rewrite or automatically regenerate them.

### One-piece handling

The old Lab assumes top + bottom and cannot be reused as the production contract. Production must render:

- separates: top + bottom + optional outerwear + shoes;
- one-piece: onePiece + optional outerwear + shoes.

Never synthesize top/bottom placeholders for a one-piece result. Prompt enumeration follows the discriminated branch exactly.

## API and realistic trust boundary

Add `POST /api/today-outfit/preview`, following the existing production Today Outfit route convention. Add matching Vite development middleware and a Vercel-style `api/today-outfit/preview.ts` entry point.

The browser sends only `OutfitPreviewInput`. The server:

1. accepts POST and a bounded JSON body;
2. performs exact-field and structural validation;
3. builds the complete server-owned prompt;
4. calls only `OUTFIT_PREVIEW_PROVIDER` under one timeout;
5. validates/normalizes the provider image response;
6. returns only the app-owned production envelope.

Recommended response:

```ts
type OutfitPreviewApiResponse =
  | { readonly ok: true; readonly result: { readonly mimeType: SupportedImageMimeType; readonly imageDataUrl: string } }
  | { readonly ok: false; readonly error: { readonly kind: SafePreviewErrorKind; readonly message: string } }
```

Do not expose provider/model selection, usage, latency, raw HTTP status/details, safety/debug envelopes, headers, stacks, or raw responses to the browser. Development server logs may keep the existing sanitized status/message/field-violation diagnostics, never keys, headers, or image/base64 data.

Direct resolved facts are the realistic boundary. A signed or reconstructable recommendation identity would require server-held wardrobe/recommendation state or a signing lifecycle that does not exist in this local-first app. Signing a client-originated fact would not make it true. The server can enforce syntax, closed garment types, exact slot structure, normalized HEX, finite count, and absence of unexpected fields/prompt text. It cannot prove that Owned facts match physical clothing or local storage, nor that a semantically valid request was produced by the current UI. That limitation is acceptable because the response is an optional non-authoritative illustration, not an ownership or color claim.

## Server-owned prompt policy

Build the prompt only from validated structural fields and server-derived labels. It should say, unambiguously:

- create one clean realistic fashion-editorial flat-lay on a simple neutral background;
- show exactly the supplied garments, once each, separately and clearly;
- use the supplied garment categories/types and colors as closely as practical;
- do not redesign, improve, recommend, substitute, add, or remove pieces;
- include outerwear only if supplied;
- no person, face, body, mannequin, or hands;
- no text, labels, captions, typography, HEX text, watermarks, or logos;
- no accessories, props, jewelry, bags, or unlisted garments.

Do not include occasion: after selection it is unnecessary context and could encourage re-styling. Also omit source mode, Personal Color, Lucky goals, reasoning, wardrobe IDs/names, profile, photos, and all alternatives.

The existing Lab prompt is useful policy evidence but should be replaced for production because it consumes item names, subtype/occasion, and a separates-only contract.

## Fidelity and unwanted text

Prompt constraints reduce risk but do not guarantee compliance. V1 should not add OCR or automatic rejection: the repository has one unwanted-text observation, not evidence that an OCR pipeline would reliably improve the product. Keep the image explicitly illustrative, keep structured garment cards/swatches visible as the authority, and offer a manual retry that creates one new request.

The generated pixels are never a Personal Color measurement and do not replace HEX, canonical names, or app-owned recommendation facts. A retry may still differ and must not be described as correcting the structured recommendation.

## UX, copy, retry, and accessibility

Place the action inside both Owned and Inspiration result cards, after the piece list and reasoning. It appears only when a valid preview input can be derived. The text recommendation stays visible throughout loading, success, and failure. Success renders the square image directly below the action; failure shows a local preview error only.

Recommended terminology and copy:

| Purpose | Thai | English |
| --- | --- | --- |
| Feature label | `AI Outfit Preview` | `AI Outfit Preview` |
| Initial button | `✨ ดูลุคนี้เป็นภาพ` | `✨ Preview This Look` |
| Loading | `กำลังสร้างภาพตัวอย่าง…` | `Creating preview…` |
| Regenerate after success | `✨ สร้างภาพใหม่` | `✨ Generate Another Preview` |
| Retry after failure | `ลองสร้างภาพอีกครั้ง` | `Try Preview Again` |
| Shared color/source-of-truth note | `ภาพนี้เป็นเพียงตัวอย่าง โปรดอ้างอิงประเภทเสื้อผ้าและสีจากรายการด้านบน` | `Illustrative preview only; use the garment list and colors above as the reference.` |
| Owned detail note | `สร้างจากประเภทและสีของเสื้อผ้าที่เลือก รายละเอียดอาจไม่เหมือนชิ้นจริงทุกจุด` | `Based on the selected garment types and colors. Details may differ from your actual items.` |
| Inspiration detail note | `แสดงภาพจากไอเดียลุคที่เลือกไว้แล้ว ไม่ใช่คำแนะนำลุคใหม่` | `Visualizes the selected look idea; it does not create a new recommendation.` |
| Safe failure | `ยังสร้างภาพตัวอย่างไม่ได้ คำแนะนำลุคด้านบนยังใช้ได้` | `The preview could not be created. Your outfit recommendation is still available above.` |

Do not automatically retry. Disable the action during the request and guard duplicate submission. One click creates one provider call. On success, regeneration is a new explicit click that replaces the current in-memory image; on failure, retry is a new explicit click.

Use a localized, app-owned alt description assembled from the exact structured pieces, garment labels, and color names, for example `AI Outfit Preview: cream shirt, navy trousers, white sneakers.` Do not ask the image model for alt text. Announce loading with `role="status"`/a polite live region, expose failure with `role="alert"`, preserve clear retry button semantics, and never make the preview the sole representation of the recommendation.

## State, staleness, and lifetime

Preview state must live at the same App/session level as `todayRecommendation`, not solely inside `DailyView`, because `DailyView` unmounts while visiting My Wardrobe and the existing Inspiration recommendation deliberately survives that navigation.

Key preview state to a source key containing:

1. the production recommendation request fingerprint; and
2. a deterministic fingerprint of the normalized preview input.

The second part prevents an image from surviving when a repeated text request with the same inputs returns a different outfit. Treat a mismatched loading/result state as idle in the same render, then clear it in an effect, matching the existing no-flash recommendation pattern.

Clear/abort preview when the valid structured recommendation clears or its source key changes due to Lucky, occasion, source, relevant Personal Color, or an Owned wardrobe mutation that changes the Owned request/result. An unrelated wardrobe mutation must not change an Inspiration fingerprint, recommendation, or preview. A locale switch changes neither fingerprint; keep the image while UI copy and alt text relocalize, with no provider call.

Hold at most one in-memory Preview per Look. A successful image has no regeneration action. Today Preview state remains session-scoped, but an explicit **Save This Look** action may copy that existing image into the Saved Outfit image repository. Saved image binary data uses IndexedDB and is referenced from structured Saved Outfit metadata by an opaque `previewImageId`; image data URLs never enter localStorage. Saving never generates an image.

## Privacy, response size, memory, and logging

The provider payload contains only the server-owned prompt derived from selected `garmentType` + normalized `hex` facts and, where present, the validated app-owned visual description. Do not send full wardrobe, wardrobe IDs, custom names, formality, Lucky goals, Personal Color subtype/palette, occasion, reasoning, quiz answers, raw profile data, photos, localStorage contents, or recommendation source.

A data URL is acceptable for this session-only V1 because the current proven adapter and `<img>` path already use it and no persistence/export is required. Base64 has encoding overhead, and browser JSON parsing plus React state may briefly retain more than one string copy. The repository records 1K output and MIME/usage/latency but no actual encoded byte sizes, so do not claim a typical byte count.

Safeguards for implementation:

- retain only one in-memory image per Look, never an image-generation history;
- do not place image data in recommendation metadata, localStorage, analytics, exports, errors, console logging, or snapshots; explicit Saved Outfit image copies are Blob records in the dedicated IndexedDB repository;
- never stringify/log full provider or client success envelopes;
- keep the MIME allowlist (`image/png`, `image/jpeg`, `image/webp`) and strict base64 checks;
- add a documented finite provider-image size guard after selecting a defensible limit from provider/runtime evidence; do not silently accept unbounded base64;
- abort stale requests and discard late responses;
- return `Cache-Control: no-store` as current JSON helpers do.

## Mobile and layout

Keep the existing result card width and two-column piece grid on desktop. Add one full-width preview region after reasoning. The square image should be `width: 100%`, `height: auto`, `max-width` around the existing readable card column (approximately 520–560 px), centered, with a modest radius/background. At narrow and approximately 430 px widths it should shrink within the card padding; actions may stack and remain full-width. Apply `min-width: 0`, `max-width: 100%`, and overflow-safe text. Do not widen or redesign the Today page.

## Lab reuse matrix

| Existing Lab area | Decision | Production treatment |
| --- | --- | --- |
| Candidate/model catalog | Keep Lab-only | Production imports one fixed server-only config, never the Lab catalog. |
| Lab request/result contract | Keep Lab-only | Replace with the origin-agnostic separates/one-piece production contract. |
| Request derivation | Production replacement | Add explicit Owned and Inspiration mappers from validated facts. |
| Prompt builder | Production replacement | Preserve useful constraints, remove names/subtype/occasion, add one-piece support. |
| Gemini REST endpoint/body | Generalize/extract | Share a server-only Gemini image transport and exact square/1K enum request shape. |
| Provider adapter | Generalize/extract | Reuse MIME/base64 parsing, error classification, and sanitized diagnostics behind thin Lab/production wrappers. |
| Timeout helper | Reuse cancellation primitive | `withTimeout` owns one timer/signal/deadline; the Preview handler races provider work against that application deadline and retains the 60-second constant. |
| Response parsing | Generalize/extract | Share provider parsing; production response omits model/usage/latency. |
| Error normalization | Generalize/extract | Keep safe app-owned categories/messages; raw diagnostics remain DEV server-only. |
| DEV route | Keep Lab-only | Add a separate fixed production `/api/today-outfit/preview` route. |
| Browser API module | Production replacement | Fixed endpoint, strict production response validation, no candidate. |
| Lab UI/comparison | Keep Lab-only | Production gets one explicit CTA and one latest preview. |
| PO review fields | Keep Lab-only | No review controls in production. |
| Export | Keep Lab-only | Production adds no export and never serializes image bytes. |
| Tests | Generalize plus retain | Keep Lab regressions; add production contract/mapping/API/prompt/UI/security coverage. |

## Proposed production file boundaries

Likely additions:

- `src/domain/todayOutfitProduction/previewContract.ts`: normalized input/result types, exact validator, and input/source fingerprint.
- `src/domain/todayOutfitProduction/previewInput.ts`: pure Owned and Inspiration mapping functions.
- `src/domain/todayOutfitProduction/previewPresentation.ts`: localized-alt fact assembly only if it keeps `DailyView` small; it must remain image/provider-free.
- `src/services/outfitPreview.ts`: fixed production endpoint and safe client response validation.
- `api/_lib/geminiImageProvider.ts`: extracted low-level Gemini REST request, image parsing, enum handling, and sanitized diagnostics shared with the Lab.
- `api/_lib/outfitPreviewConfig.ts`: the one replaceable production provider/model choice.
- `api/_lib/outfitPreviewPrompt.ts`: production server-owned prompt.
- `api/_lib/outfitPreviewProvider.ts`: fixed config wrapper over shared Gemini image transport.
- `api/_lib/outfitPreviewHandler.ts`: production validation/key/timeout/response boundary.
- `api/today-outfit/preview.ts`: production route entry.

Likely modifications:

- `api/_lib/outfitImageProvider.ts`: become a thin Lab wrapper over the extracted Gemini transport without behavior/request-shape regression.
- `api/devServer.ts`: mount the fixed production preview route.
- `src/dailyLuckyColor/DailyView.tsx`: render the preview control within both validated result cards.
- `src/App.tsx`: own session preview state across navigation.
- `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/th.ts`: add the approved copy.
- `src/styles.css`: scoped result-card preview layout.
- focused tests alongside each module plus existing Today/App suites.

Production code must not import `TodayOutfitImageLab`, PO review/export modules, or the Lab candidate catalog.

## Implementation test plan

### Domain and mapping

- Owned separates and one-piece map selected request facts exactly.
- Inspiration separates and one-piece resolve and map exact conceptual facts.
- Outerwear null/present is preserved.
- Owned arbitrary normalized HEX is accepted.
- Inspiration canonical and generic identities resolve to the catalog HEX.
- Mapping output contains no unselected wardrobe facts, IDs, custom names, formality, compatibility, Lucky data, subtype, occasion, reasoning, or prompt.
- Missing selected Owned fact or unresolved Inspiration color fails closed.

### Contract and API

- Accept exact valid three-/four-piece shapes.
- Reject malformed base, wrong slot/type, too many/missing pieces, invalid or non-normalized HEX, unknown garment type, prompt field, source/model selector, display string, and every unexpected field.
- Reject non-POST, invalid JSON, and oversized body without provider invocation.
- Key missing, timeout, network/provider error, malformed provider image, and thrown exception return safe normalized failures.
- Success returns only MIME + data URL; response is `no-store` and excludes provider metadata.

### Prompt and provider

- Prompt contains each exact selected garment type and supplied HEX exactly once, including one-piece and nullable outerwear cases.
- Prompt contains no Lucky goal, subtype, occasion, wardrobe ID, custom name, formality, reasoning, recommendation source, or client prose.
- Prompt contains explicit no-person/no-mannequin/no-hands/no-text/no-label/no-HEX-text/no-logo/no-accessory and no-redesign/add/substitute constraints.
- Both Lab candidates retain the exact `v1` request body with `ASPECT_RATIO_ONE_BY_ONE` and `IMAGE_SIZE_ONE_K` after extraction.
- Production uses only the fixed Lite model/config and has no selector/fallback.
- Provider diagnostics redact keys and image/base64 content.

### UI and state

- CTA absent before a valid recommendation and present for valid Owned/Inspiration results.
- Rendering, locale change, input change, and text recommendation success never auto-call image generation.
- One explicit click makes one call; loading disables duplicate calls and announces progress.
- Text result remains visible during loading/failure/success.
- Success renders one preview and explicit regenerate; regenerate replaces it.
- Failure preserves the recommendation and offers explicit retry; no automatic retry.
- Lucky/occasion/source/relevant Personal Color changes clear preview immediately.
- A new/different recommendation under the same inputs clears preview through the normalized-input fingerprint.
- Owned relevant wardrobe mutation clears recommendation and preview.
- Inspiration unrelated wardrobe mutation/navigation preserves both.
- Locale change preserves image, relocalizes copy/alt, and makes no call.
- One-piece and outerwear-present alt text/layout are correct in Thai and English.

### Security, privacy, and persistence

- Gemini key and production model/config remain server-only and absent from the client bundle.
- No generic prompt endpoint or client prompt field exists.
- No production model selector or Lab import exists.
- No base64/data URL enters localStorage, export, analytics, logs, recommendation JSON, or snapshots. Explicitly saved Preview bytes are decoded into an IndexedDB Blob with minimal metadata and referenced by ID.
- Full wardrobe, IDs, names, photos, quiz/profile, subtype, Lucky, occasion, and reasoning never reach the image provider.
- MIME/base64/finite-size response boundaries are tested.

## Slice 6B implementation record

Slice 6B implements the backend/domain boundary without production UI wiring. The normalized contract and pure mappers are in `previewContract.ts` and `previewInput.ts`; the latter revalidates both the exact recommendation request and recommendation before resolving only the selected garment types and normalized colors. The exact structural branches are enforced rather than accepting an item array: separates contain three garments without outerwear or four with it, while one-piece outfits contain two physical garments without outerwear or three with it (the one-piece fills both base-clothing roles). This is the concrete interpretation of the design's bounded complete-outfit requirement and creates no synthetic top/bottom placeholders.

The reusable low-level boundary is `api/_lib/geminiImageProvider.ts`. It owns only Gemini REST `v1` transport, the exact square/1K protobuf enum values, MIME/base64 parsing, usage parsing needed by the Lab, error classification, and sanitized development diagnostics. `outfitImageProvider.ts` is now a thin Lab wrapper and retains its existing request/result contract. Production has separate fixed boundaries in `outfitPreviewConfig.ts`, `outfitPreviewPrompt.ts`, `outfitPreviewProvider.ts`, and `outfitPreviewHandler.ts`, with the Vercel entry at `api/today-outfit/preview.ts` and matching development middleware route. `src/services/outfitPreview.ts` is transport-only and is intentionally not imported by `DailyView` or `App` in this slice.

The production response implements the approved `{ ok, result/error }` envelope. Success contains only MIME and image data URL; failure contains only an app-owned safe kind and message. Production config is fixed to Gemini Image Lite with a 60-second timeout and has no selector or fallback.

No image-size maximum was introduced. Structural MIME/base64 validation remains in place, and selecting a finite byte limit remains an explicit Slice 6D operational follow-up after an authorized smoke test provides defensible response-size evidence. No provider/platform limit was weakened.

## Slice 6C implementation record

Slice 6C wires the validated Slice 6B contract into the production Today result cards without changing the provider architecture. `App` owns one `TodayPreviewState` beside the existing Today input and recommendation state, so a successful preview survives an ordinary visit to My Wardrobe or another app view while the exact recommendation remains valid. It remains runtime-only: refresh/remount loses it, invalidation releases it, and regeneration replaces rather than accumulates the image.

The recommendation session result now retains the exact validated Owned or Inspiration request snapshot that produced it. `DailyView` passes that request/recommendation pair through the Slice 6B mapper; it does not reconstruct Preview facts from current wardrobe state or hand-build a payload. Preview state is matched against both the recommendation request fingerprint and the normalized Preview-input fingerprint. Changes to Lucky, occasion, source, relevant Personal Color, a visible recommendation, its mapped input, or an Owned wardrobe request invalidate it. Inspiration is independent of wardrobe storage, so an unrelated wardrobe mutation/navigation preserves both its recommendation and Preview. Locale is presentation-only: it preserves the image and relocalizes controls, helper copy, and app-owned structured alt text without another request.

The Preview action sits after the structured pieces and app-owned reasoning in both result cards. Loading keeps the recommendation visible and uses a polite status; success shows one square illustration (maximum 550px) plus the shared authority note and source-specific expectation; failure is a local alert with explicit retry. Initial generation, retry, and regeneration are click-only. The component aborts on a changed context or unmount and also discards a late response by generation/context key. No automatic retry exists.

Final production copy uses the approved CTA/loading/regenerate/retry/helper strings. Owned supporting copy is `Garment details may differ from your actual items.` / `รายละเอียดของเสื้อผ้าในภาพอาจต่างจากของจริง`; Inspiration copy is `This preview visualizes the look idea selected above.` / `ภาพนี้แสดงไอเดียลุคที่เลือกไว้ด้านบน`. Alt text is derived locally from the exact normalized garment types and HEX-derived app color descriptions, supports separates/one-piece and optional outerwear, and never describes unobserved pixels or includes HEX.

The production UI imports the fixed browser Preview service and client domain mappers only. It has no provider/model selector, prompt field, Lab dependency, persistence, export, analytics, OCR, image moderation heuristic, byte display, or image history.

## Slice 6D.1 timeout/settlement correction

The first authorized Lite production smoke request exposed a closeout-blocking
settlement defect: one Preview request remained loading for at least 112.8
seconds after the recorded start, although `OUTFIT_PREVIEW_TIMEOUT_MS` is
60,000 ms. No second provider call was made. Static tracing established that
the shared `withTimeout` helper only aborted its signal; the Preview handler
directly awaited `runOutfitPreviewProvider`. A provider/fetch implementation
that observes abort but does not settle can therefore leave the handler
promise pending indefinitely. This behavior is shared by the Vite development
route and the production-function entry because both call the same handler;
it is not a route-specific response bug.

The corrected ownership is explicit: `withTimeout` creates the single
application timer, abort signal, and timer-backed deadline promise. The
Preview handler races provider work against that deadline. When it wins, the
signal is aborted before the normalized timeout failure response is written.
`Promise.race` keeps late provider
resolve/reject handlers attached, so late settlement cannot produce an
unhandled rejection or a second response. The shared Gemini transport remains
timeout-free and still accepts the signal for cancellation; the Image Lab
continues using its existing handler behavior. No provider/model, prompt,
REST enum, image-size, or 60-second duration change was made.

Deterministic fake-timer coverage now covers success and provider failure
before the deadline, a provider that ignores abort, a provider that never
settles, late reject/resolve after timeout, exact 60,000 ms configuration, and
caller abort normalization. The Preview UI test proves a mocked timeout keeps
the text recommendation visible and exposes only the explicit localized Retry
action. No client deadline was added: the browser already passes an
AbortController for stale/unmounted requests, and there is no existing shared
bounded-fetch convention to reuse; a separate network/proxy safety deadline
remains an operational follow-up, not a substitute for the server deadline.

## Slice 6D.3 live-route integration trace

The second production smoke remained in the loading state for more than 101
seconds, but an immediately-following Image Lab control generation using
Gemini Image Lite (`gemini-3.1-flash-lite-image`) succeeded in approximately
4,006 ms with `image/jpeg` output and no obvious unwanted text or labels. This
shifts the investigation away from Gemini availability/model latency and
toward the production route/runtime boundary.

The browser smoke used the Vite development origin at `localhost:5176`.
Port 5176 was owned by a Node process started on 2026-09-27 23:43, before the
Slice 6D.1 changes to `api/_lib/timeout.ts` and
`api/_lib/outfitPreviewHandler.ts` on 2026-09-29. `vite.config.ts` mounts
`api/devServer.ts` as middleware, with no proxy or alternate API base; the
Preview POST is therefore handled by that long-running middleware process.
The process must be restarted for backend module changes to be loaded; the
existing process was stale for both production smoke requests.

The current source was verified independently through a fresh Vite HTTP
harness with a server-side-only injected provider. The harness makes no
network calls and covers both an immediate fixture success and a never-settling
provider at a short test deadline. Both complete the actual
`/api/today-outfit/preview` HTTP route, finalize the response, and settle the
client service. Lifecycle events are bounded metadata only (correlation token
and elapsed milliseconds); no provider body, prompt, key, wardrobe data, or
image bytes are logged. Production remains fixed at a 60-second deadline and
the production provider/model/prompt/REST request are unchanged. No third
Gemini call was made.

## Slice 6D.5 StrictMode Preview state correction

**Reinterpretation of the three smokes.** The three production smokes (>112.8 s,
>101.2 s, and >125 s on a confirmed-fresh process) were recorded above as
requests that "remained pending" or "remained in the loading state". The
observations were of the browser Preview UI. No Network-tab evidence
distinguished an HTTP request that was still pending from a request that had
completed while the UI stayed in `loading`, so the earlier "HTTP hung"
reading was **not proven**. Those historical notes are kept unchanged.

**Hypothesis and proof.** An independent source audit (no live calls) found no
mechanism preventing the 60 s server deadline from settling and instead
hypothesised a client defect. A StrictMode regression proved it before any fix:
`OutfitPreview` rendered under `<StrictMode>` with a mocked service stayed in
`loading` after the mocked request resolved (success, normalized timeout,
duplicate-click, and locale cases all failed pre-fix). A temporary probe
showed the mocked request had settled while the parent state went
`idle > idle > loading > loading` and never advanced. The probe was deleted.

**Exact mechanism.** `mountedRef = useRef(true)` was cleared in the cleanup of an
effect whose setup never restored it. `src/main.tsx` renders `<App/>` in
`<StrictMode>`, and in development React runs setup → cleanup → setup, so
`mountedRef.current` was permanently `false`. After any response,
`generate()` reached `if (!mountedRef.current || …) return` and skipped
`onStateChange`, discarding the settled result. The browser Preview UI
therefore remained in `loading` beyond the deadline, showing neither success
nor the normalized timeout. Production builds do not double-invoke effects, so
this was a development-only symptom; the component tests did not use StrictMode,
which is why they passed.

**Minimal fix.** The effect setup now sets `mountedRef.current = true`; the
cleanup is unchanged (mark unmounted, bump `generationRef`, abort). StrictMode
and the mounted guard remain. The new StrictMode tests also cover
final-unmount late success/failure being ignored, stale context discard,
duplicate-click prevention, locale change, and no request on mount/remount.

**Unchanged.** The server deadline (60 000 ms), `timeout.ts`, handler, provider,
shared Gemini transport, model, prompt, and REST config were not modified. No
additional live provider call occurred in this slice; the production live-call
count remains 3. Whether the earlier smokes also had a server-side issue is
unknown until a further authorized smoke, ideally with Network evidence.

## Inspiration gender constraint

**Bug.** A Men profile received New Look Ideas with high heels. The selected profile gender
(`presentationPreference`: `'women' | 'men' | null`, owned by `App`) was only used for style-example
imagery. It was never passed to `DailyView`, the Inspiration request always carried the full 28-type
taxonomy (`allowedGarmentTypes`, validated to be exactly that list), and the taxonomy had no
applicability metadata, so the gender was lost at the App → DailyView boundary and nothing downstream
could constrain it.

**Rule.** For Inspiration only, the explicit selected profile gender is a hard garment-validity
constraint. It is never inferred from name, subtype, wardrobe, occasion, or Lucky Color. `null` (no
selection) excludes nothing. **Owned mode is exempt:** garments the user saved stay eligible regardless of gender.

**Centralized applicability.** `GARMENT_DEFINITIONS` in `src/domain/wardrobe/taxonomy.ts` gained `audience`
(`'women' | 'men' | 'unisex'`) as the single source of truth, with `allowedGarmentTypesForGender(gender)` and
`isGarmentAllowedForGender(type, gender)` derived from it. Explicit women-only entries: blouse, skirt, dress,
flats, heels. There are no men-only entries; everything else (including jumpsuit and all `other-*`) is unisex.
This classification is a product decision that can be revised in that one table.

**Request.** `InspirationOutfitRequest` replaces `allowedGarmentTypes` with `gender: 'women' | 'men' | null`
(required; missing or unknown values are rejected, and a client-supplied `allowedGarmentTypes` is now an
unsupported field). The server derives the taxonomy from `gender`. No names, photos, or other profile data were added.

**Provider and validation.** The prompt sends `gender` and only `allowedGarmentTypesForGender(gender)` and states that
applicability is a hard validity constraint. `validateInspirationOutfitRecommendation` rejects any piece outside the
derived set (Men + heels is invalid). The provider treats it as `malformed-response`, the client service rejects it
again, and `DailyView` then uses the deterministic fallback.

**Fallback.** All seven occasion templates use only unisex garment types (separates, and one-piece via jumpsuit), and
tests assert every occasion × {men, women, none} is valid. The fallback still self-validates and returns null if a
template ever became invalid for a gender.

**Staleness.** `gender` is part of the Inspiration request, hence of its fingerprint. Changing it immediately hides the
existing Inspiration result and its Preview (the Preview is keyed by the recommendation fingerprint), calls no provider,
and requires an explicit Generate. Owned fingerprints do not include gender and are unchanged. The Preview input
remains garment types plus normalized HEX only; gender is not added to Preview.

## Recommended implementation sequence

### Slice 6B — domain, shared transport, and production API

Add the normalized contract/mappers, extract the proven Gemini transport without changing Lab behavior, add fixed production config/prompt/provider/handler/route, and complete domain/API/security/exact-request tests. No production UI and no live call.

### Slice 6C — result-card UX and session state

Add App-scoped preview state, explicit CTA/loading/success/failure/regenerate behavior, localized copy/alt text, staleness rules, responsive CSS, and UI/integration tests. Calls remain mocked during automated verification.

### Slice 6D — authorized manual smoke, polish, and closeout

After separate authorization and provider/privacy/quota readiness, make exactly one Lite manual generation first. Review latency, category/count fidelity, colors, unwanted text/logos/accessories, mobile/desktop layout, retry/failure copy, memory behavior, and sanitized diagnostics. Fix only evidenced issues, run full verification/security scans, then seek commit approval.

## Unresolved decisions before production enablement

1. PO approval of the recommended TH/EN copy above.
2. Operational approval for Gemini Image Lite production quota, cost, privacy/provider disclosure, and acceptable-use handling. Repository evidence supports feasibility but not price claims.
3. A defensible maximum accepted provider image byte size. The current repository has no measured encoded-size evidence.
4. Whether preview should remain when navigating to other non-Wardrobe app sections. This design preserves it in session while its exact recommendation remains valid; refresh still clears it.
5. Whether release analytics are needed. Default is none; any future analytics must exclude prompts, garment facts, and image/base64 data.
