# Today Outfit Image Lab — Slice 0

## Purpose and boundary

This development-only experiment asks whether an AI Outfit Preview flat-lay makes an already-selected Today Outfit recommendation easier to understand. The preview is illustrative: it is not an exact rendering or photograph of the user's real garments, exact color reproduction, or virtual try-on. Open the existing Lab at `?debug=outfit`. There is no production navigation or production API route.

The source of truth is always:

`validated Today Outfit recommendation → selected wardrobe IDs → app-owned wardrobe facts → image request`

The image model is not a stylist. It cannot select or replace garments, change Personal Color or occasion, consume stylist reasoning, or mutate the structured recommendation. A failed image call affects only its preview card; the text recommendation remains valid and visible.

## Architecture

- `src/domain/todayOutfitImage`: image candidate catalog, strict request/result types, validation, and derivation from a successful Today Outfit selection.
- `api/_lib/outfitImagePrompt.ts`: pure deterministic prompt builder from validated facts only.
- `api/_lib/outfitImageProvider.ts`: Gemini-specific invocation, image-part extraction, MIME validation, and usage normalization.
- `api/_lib/outfitImageHandler.ts`: request validation, server-only key access, timeout, and normalized result boundary.
- `api/devServer.ts`: development middleware at `/api/ai-outfit-image/<candidate>`; no Vercel function or production configuration is added.
- `src/todayOutfit/TodayOutfitImageLab.tsx`: explicit generation, in-memory comparison, human review, and export.

`GEMINI_API_KEY` is read only by server code. The browser sends no arbitrary prompt and never receives a key or raw provider envelope.

## Candidates

Candidate definitions are centralized in `src/domain/todayOutfitImage/catalog.ts` and deliberately separate from text-stylist candidates:

| App candidate | Provider model | Intended bakeoff role |
| --- | --- | --- |
| `gemini-image-lite` | `gemini-3.1-flash-lite-image` | fastest and lowest-cost image candidate |
| `gemini-image-standard` | `gemini-3.1-flash-image` | general-purpose, higher-quality image candidate |

These stable IDs were verified against the official Google Gemini image-generation and model documentation on 2026-09-27. The adapter uses Google's documented `generateContent` image response (`inlineData`) and requests image-only, square (1:1), 1K output. On the legacy REST v1 `responseFormat.image` protobuf surface, those product-facing settings are sent as the wire enum values `ASPECT_RATIO_ONE_BY_ONE` and `IMAGE_SIZE_ONE_K`, not the human-friendly strings `1:1` and `1K`. It does not silently substitute another model when a model or account capability is unavailable.

The REST enum distinction was confirmed through manual integration testing. Sending the human-facing strings in `generationConfig.responseFormat.image` caused real HTTP 400 `INVALID_ARGUMENT` responses for both image models. The exact-request regression tests therefore preserve the protobuf wire enum values, and development-only provider diagnostics expose sanitized status, message, and field-violation details without logging keys, authorization headers, image data, or unrelated secrets.

## Manual generation and privacy

No image call occurs when a case, subtype, occasion, candidate, or text recommendation changes. Every call requires `Generate outfit preview`. Images remain only in current React session memory. There is no user/person photo, reference garment photo, persistence, cache, file write, or generated-image storage.

The prompt asks for one neutral-background fashion editorial flat-lay, visibly separated supplied pieces, close color fidelity using color names and HEX values, and no person, mannequin, hands, text, labels, logos, or extra accessories.

## PO evaluation and export

Each successful candidate preview has independent human review fields:

- visual quality: Good / Acceptable / Poor
- garment fidelity: Good / Acceptable / Poor
- color fidelity: Good / Acceptable / Poor
- outfit readability: Good / Acceptable / Poor
- constraint compliance: Pass / Fail
- would this preview help: Yes / Maybe / No
- optional note

There is no synthetic score, image-accuracy percentage, ranking, or automatic winner. Lite and Standard can be generated separately and displayed side by side for the same structured outfit.

The image export contains case ID, subtype, occasion, selected item facts, mode, candidate/provider/actual model, latency, reported usage, normalized status/error, `{ mimeType, generated }`, PO review, and timestamp. It excludes generated data URLs/base64 bytes, keys, raw provider responses, prompts, and source photos.

## Known limitations and deferred work

Generated images are probabilistic: garment count, exact garment shape, color fidelity, and prohibited details still require human review. HEX values ground the prompt but do not guarantee pixel-exact output. Provider usage metadata may be absent, and account/model availability is confirmed only by a manual live call.

Not included: wardrobe reference photos, image-to-image garment fidelity, user photos, identifiable people, virtual try-on, body/face consistency, weather, Lucky Color, shopping, production UI/navigation, persistence/caching, or generated-image storage.

## Manual feasibility findings

Gemini Image Lite (`gemini-3.1-flash-lite-image`) produced successful previews in 7531, 5480, 5002, and 5762 ms, an approximate mean of 5944 ms. Reported usage examples were approximately 1790–1832 tokens. The observed outputs generally provided readable editorial flat-lay compositions, clearly separated garments, broadly correct selected clothing categories, and colors useful for visualizing the outfit mood without requiring a person.

The output is not exact garment reproduction or a source of color truth, and garment styling and details may be synthesized. One observed generation inserted unwanted labels, text, and HEX content despite the prompt prohibiting text and labels. Generated content is therefore non-authoritative and useful only as an optional visualization step.

One manual Gemini Image Standard (`gemini-3.1-flash-image`) request hit the Lab's current 60-second timeout at approximately 60019 ms, so no usable comparison image was obtained in that run. This observation does not establish that Standard always needs more than 60 seconds, and the timeout is unchanged.

For the current prototype, Gemini Image Lite is the practical image candidate based on the successful observed generations of roughly 5–7.5 seconds. Gemini Image Standard remains experimental because the observed test exceeded the Lab timeout. This is a prototype decision, not a permanent provider lock-in.
