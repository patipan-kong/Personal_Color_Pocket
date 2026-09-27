# Today Outfit — Slice 0 architecture and lab

This slice is a development-only recommendation experiment. The stylist portion is text-only, with a separate optional AI Outfit Preview after an outfit has been selected. Open it in a Vite development build with `?debug=outfit`. It is not linked from production navigation and never calls a model automatically.

## Architectural boundary

The app owns the Personal Color subtype, palette data, supplied wardrobe IDs and colors, clothing categories, occasion, and deterministic `checkColor()` compatibility. The provider receives these facts as structured JSON and may reason about coordination, formality, near-face placement, and tradeoffs. Provider output contains no subtype or color fields, and the server rejects unknown output fields, invented IDs, category mismatches, duplicated slot assignments, and malformed required slots.

Existing architecture was classified as follows:

- Reused as-is: `Subtype`, `getPalette()`, `checkColor()`, server-only env handling, HTTP/timeout utilities, Vite dev middleware pattern, AI Lab review/export conventions, and the already-configured provider/model IDs.
- Reused after extraction: the provider/model catalog and common provider error/usage types moved from the color-specific contract into `src/domain/ai/providerCatalog.ts`; the AI Color Lab re-exports them for compatibility.
- Kept separate: Daily Lucky Color's `outfit.ts` and `outfitBoard.ts` are driven by lucky-family goals and semantic fallback colors; Photo/Color Lab prompts and adapters are image/color-analysis specific; production persistence and navigation are not used.
- New concepts: structured wardrobe items, item formality, closed occasions, outfit selection/result validation, deterministic outfit baseline, curated text cases, text-only provider adapters, PO review, and outfit export.

The final validated flow is:

```text
Personal Color / app-owned facts
        ↓
structured wardrobe + occasion
        ↓
text stylist
        ↓
validated selected wardrobe IDs
        ↓
optional explicit user action
        ↓
AI Outfit Preview
```

The app/domain owns subtype, wardrobe inventory, item IDs and categories, item colors/HEX/canonical identity where available, occasion, and deterministic Personal Color compatibility facts. The text stylist may coordinate only the supplied pieces, reason about occasion and formality, account for near-face importance, make compatibility tradeoffs away from the face, and explain the recommendation. It may not redefine subtype or palette facts, invent or mutate wardrobe items, or return unknown IDs.

The image model receives only the already-selected outfit facts. It may not select or intentionally substitute pieces, become a source of color truth, or change Personal Color facts. Its output is an illustrative preview rather than an exact representation of the user's real garments. Generation remains explicit, manual, and optional, and the text recommendation remains useful if image generation fails.

## Contracts

`WardrobeItem` contains only `id`, `name`, `category`, `color`, and `formality`. Categories are `top`, `bottom`, `outerwear`, and `shoes`. Color contains an app-owned name and HEX plus an optional canonical palette ID; when that ID is present, validation proves it belongs to the selected subtype and matches the HEX.

Occasions are `casual`, `casual-dinner`, `work`, `smart-casual`, `date`, `formal`, and `wedding-guest`, with optional secondary free-text context.

Recommendations are a discriminated union:

- `success`: category-specific IDs for required top, bottom, and shoes; nullable outerwear; nullable valid alternative; styling reasoning; Personal Color notes; qualitative confidence.
- `uncertain`: a bounded reason.
- `failure`: a bounded reason.

## Deterministic baseline

The baseline is intentionally narrow and reproducible. It ranks each slot independently using the existing `checkColor()` score, weights tops and outerwear more strongly because they are near the face, applies a small distance penalty from the occasion's broad formality target, and resolves ties by item ID. It uses outerwear for non-casual/non-casual-dinner occasions when supplied. Its alternative changes the first slot with another candidate.

It does not understand silhouette, fit, fabric, season/weather, dress-code culture, garment condition, personal taste, or aesthetic color coordination. Those omissions are displayed in every baseline result rather than hidden behind a synthetic fashion score.

## Provider architecture and security

Candidates currently configured in the repository are:

| Candidate | Provider | Model |
| --- | --- | --- |
| Gemini stronger candidate | Gemini | `gemini-3.5-flash` |
| Gemini low-cost candidate | Gemini | `gemini-3.5-flash-lite` |
| Efficient reasoning candidate | OpenAI | `gpt-5-mini` |
| Fast candidate | Groq | `qwen/qwen3.8-27b` |
| Baseline | App/domain | deterministic |

The text-only outfit adapters are isolated from the image/color adapters because their prompt and validation contract are different. They reuse the catalog, secrets, timeout, and HTTP patterns. Keys remain server-side. Existing variables are `GEMINI_API_KEY`, `OPENAI_API_KEY`, and `GROQ_API_KEY`; Slice 0 adds no new variable and does not modify Vercel configuration. The route is mounted only by the Vite development server in this slice.

## Lab workflow and export

The lab includes 19 curated cases covering easy and imperfect Personal Color choices, near-face versus below-face tradeoffs, mostly-neutral and all-compatible wardrobes, work/smart-casual/date/casual-dinner/formal/wedding-guest contexts, outerwear and shoe tradeoffs, white versus cream, near-black, coherence versus strongest compatibility, and multiple valid answers. Each case states what it tests; none declares a subjective ground truth.

The PO reviews outfit quality, Personal Color reasoning, and occasion fit as Good/Acceptable/Poor; constraint compliance as Pass/Fail; and comparison as AI better/Baseline better/Roughly equal, with an optional note. Export includes the exact input, candidate/provider/model, latency, structured result or error, validation, baseline, usage when supplied, review, and timestamp. It never includes raw provider envelopes, headers, keys, photos, or invented cost estimates.

## Manual text bakeoff findings

The manually observed candidates were Gemini Flash Lite (`gemini-3.5-flash-lite`), OpenAI (`gpt-5-mini`), Groq/Qwen (`qwen/qwen3.8-27b`), and the deterministic baseline. The first four comparable live cases produced these latencies:

| Candidate | Observed latency | Approximate mean |
| --- | --- | --- |
| Gemini Flash Lite | 1760, 1899, 1882, 1802 ms | 1836 ms |
| OpenAI | 12674, 8417, 10262, 5541 ms | 9224 ms |
| Groq/Qwen | 821, 609, 673, 717 ms | 705 ms |

All three AI candidates returned valid structured recommendations in the tested runs. Easy cases often converged with one another or with the deterministic baseline. In the Cool Summer warm-wardrobe trap, the AI candidates rejected the baseline's warmer near-face coral choice and preferred cream near the face.

OpenAI showed useful nuanced stylist reasoning in some cases, including choosing khaki rather than navy for a more relaxed date outfit, but its observed latency was materially higher. Groq/Qwen was consistently the fastest observed text candidate and made useful stylistic tradeoffs. Gemini Flash Lite was also fast and stable.

The PO review fields were not completed consistently, so no aggregate score or universal best model is claimed. These results are directional prototype evidence, not a formal benchmark. The established product preference is to favor lower latency and lower operating cost when recommendation quality is materially similar; this research did not establish verified comparative pricing, so it does not claim a cost winner.

For the current prototype, Groq/Qwen is the leading low-latency text candidate from the observed testing. Gemini Flash Lite remains a viable alternative, OpenAI remains available for comparison and research, and the deterministic baseline remains an important control and fallback reference. This is a prototype decision, not a permanent provider lock-in.
