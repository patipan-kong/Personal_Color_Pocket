# V2.0 AI Color Lab — Slice 0 (Four-Provider Vision Bake-off)

Status: **implemented, dev-only, not deployed.**

## 1. Purpose

An experimental, developer-only playground: the same photo and the same selected sample point,
analyzed independently by four AI vision providers (Gemini, OpenAI, Groq, DeepSeek), compared
side by side with the existing deterministic Photo Color Checker. It answers one question —
does AI vision add *context* beyond a raw pixel measurement (lighting, garment identification,
usability) — not "which provider is right." It does **not** replace, correct, or feed into the
production Photo Color Checker, personal-color scoring, or any recommendation.

## 2. Branch / base

- Branch: `feature/v2-ai-lab`
- Base: `feature/v1.5-ads-android` tip (`b0dc3dd`, docs-only), which itself sits on
  `main`/v1.2.0 (`3b382ad`) — `feature/v2-ai-lab` and `feature/v1.5-ads-android` pointed at the
  identical commit when this slice began (see `docs/V2_AI_LAB_BOUNDARY.md`, the earlier boundary
  note recorded during V1.5 Slice 0). V1.5 itself was untouched by this slice.

## 3. Architecture

Pure Vite + React SPA, no backend previously existed. This slice adds the smallest boundary that
(a) keeps all four provider API keys server-side and (b) has a real path to Vercel later, without
adding a framework or a second implementation to maintain:

```
api/_lib/handler.ts       <- the ONE request handler (key check, timeout, validation, envelope)
api/_lib/providers/*.ts   <- one adapter per provider (isolated, server-only)
api/_lib/{env,http,timeout,prompt,validate,validateRequest}.ts

api/ai-color/{gemini,openai,groq,deepseek}.ts
  -> Vercel-style (req, res) function files. Not deployed this slice; exist so the path to
     Vercel serverless functions is real, not aspirational. Each is a 4-line wrapper around
     handleAiColorRequest().

api/devServer.ts
  -> a Vite plugin (configureServer middleware) that mounts /api/ai-color/<provider> during
     `vite dev`, calling the exact same handleAiColorRequest(). One implementation, two hosts.
```

`vite.config.ts` loads `.env` via Vite's own `loadEnv()` (Node/config context only) and copies
just the four named keys into `process.env` — never through `define` or `import.meta.env`, so
they cannot reach the client bundle. Verified against the actual production `vite build` output
(see §Security below), not just by construction.

The client (`src/aiLab/*`) only ever calls `fetch('/api/ai-color/<provider>')` — same origin, no
provider SDK, no credential in scope.

## 4. Privacy distinction from the production Photo Checker

The production Photo Color Checker is local-only: the photo never leaves the device (unchanged
by this slice). The AI Lab is the opposite for the providers you actually run: pressing "Run all
providers" (or retrying one) sends the current photo to that provider's API. The AI Lab UI states
this explicitly and does not reuse the production "stays on this device" copy.

## 5. Canonical normalized contract

`src/domain/aiColorLab/contract.ts` (pure types, safe for both client and server):

```ts
interface NormalizedAiColorResult {
  provider: 'gemini' | 'openai' | 'groq' | 'deepseek'
  model: string
  perceivedColorName: string
  colorFamily: string
  temperature: 'warm' | 'neutral' | 'cool' | 'uncertain'
  value: 'light' | 'medium' | 'deep' | 'uncertain'
  chroma: 'muted' | 'medium' | 'clear' | 'uncertain'
  lighting: { condition: string; cast: 'warm' | 'neutral' | 'cool' | 'uncertain'; severity: 'low' | 'medium' | 'high' | 'uncertain' }
  sampleAssessment: { usable: boolean | 'uncertain'; issue: 'none' | 'highlight' | 'shadow' | 'mixed' | 'uncertain' }
  suitability: 'recommended' | 'workable' | 'more_considered' | 'uncertain'
  confidence: 'low' | 'medium' | 'high'
  reasoning: string
}
```

`suitability: 'more_considered'` intentionally reuses the app's own canonical term (the palette
group the UI calls "More Considered," never "Harder" — `i18n/en.ts` `palette.sections.harder.title`).
No numeric confidence percentages, per plan. The model is explicitly instructed never to claim it
recovered the garment's objectively true physical color (`api/_lib/prompt.ts`, `CANONICAL_INSTRUCTION`).

Errors use a separate, equally normalized envelope (`AiErrorInfo`: `kind`, `httpStatus`, a short
safe `message`) — see §Failure isolation.

## 6. Provider research (2026-09-25, verified live against official docs, not from training memory)

| Provider | Model used | Vision support | Structured output + vision |
|---|---|---|---|
| Gemini | `gemini-3.5-flash` | Yes, all current 3.x models | Not confirmed compatible by official docs (a documented case elsewhere returned 400 with responseSchema + image); adapter uses `responseMimeType: application/json` only, no schema, plus explicit JSON-shape prompt instructions |
| OpenAI | `gpt-5-mini` | Yes | Confirmed — `response_format: json_schema` (strict) documented as vision-compatible |
| Groq | `qwen/qwen3.8-27b` | Yes — **the only Groq model that accepts images**; Groq's fast Llama/gpt-oss lineup is text-only. Listed under Groq's Preview tier (evaluation-only, no production-stability guarantee) | Confirmed working with vision per Groq's own docs (`json_object` mode) |
| DeepSeek | `deepseek-flash` | Yes — **the only DeepSeek model that accepts images** (`deepseek-v4-pro` is text-only); vision GA'd 2026-08-21, ~5 weeks before this slice | Not documented either way; adapter uses `json_object` mode + explicit JSON-shape prompt instructions |

Sources (fetched live, not recalled): `ai.google.dev/gemini-api/docs/{image-understanding,structured-output,models}`,
`developers.openai.com/api/docs/{guides/images-vision,guides/structured-outputs,models/gpt-5-mini,pricing}`,
`console.groq.com/docs/{vision,models,deprecations}`, `api-docs.deepseek.com/{guides/vision,news/news260821,quick_start/error_codes}`.

All four adapters use plain `fetch()` — no provider SDK was installed (see §Dependencies).
Every adapter, regardless of what structured-output mode it requested, has its JSON response
re-validated server-side against the contract (`api/_lib/validate.ts`); nothing is trusted merely
because structured output was asked for.

## 7. Canonical prompt

One instruction, `api/_lib/prompt.ts`'s `CANONICAL_INSTRUCTION` + `buildCanonicalPrompt()`, used
verbatim by all four adapters (`api/_lib/providers/shared.ts`'s `promptFor` is just
`buildCanonicalPrompt`). Parity is asserted by a real fetch-body inspection test, not just an
import check — `api/_lib/prompt.test.ts` captures each adapter's actual outgoing request text and
asserts it equals `buildCanonicalPrompt(request)` byte-for-byte.

It asks the model for garment/object, perceived color family, temperature/value/chroma, ambient
lighting cast and severity, whether the sampled region is shadowed/highlighted/mixed/usable, and
suitability against the user's subtype if one is saved — explicitly not "what hex is this," and
explicitly forbidding a claim of recovering the true physical color.

## 8. Same input for all four providers

Every provider receives the same resized JPEG (`src/aiLab/imageEncode.ts`, re-encoding the exact
working-image pixels the existing photo pipeline already produced — no re-decoding of the
original file), the same deterministic sample context (hex, RGB, OKLab lightness, semantic color
name, sampling flags), and the same subtype context (or none). Provider-specific request syntax
differs (Gemini's `inline_data` vs. the other three's OpenAI-compatible `image_url`); the
*content* does not.

## 9. Deterministic baseline

Shown above the AI cards (`src/aiLab/DeterministicBaselineCard.tsx`), reusing the existing
engine functions unchanged: `samplePhotoRegion`, `matchPhotoColor`, `describeColor`,
`getSuitability` — no new color logic, no AI-derived correction of any deterministic value.
`src/aiLab/aiLabDeterministic.ts` composes them with an **optional** subtype (the production
`inspect.ts` requires one; the AI Lab does not, since it must work with no saved profile —
plan §27 forbids inventing one).

## 10. Failure isolation

Each provider is its own route (`/api/ai-color/<provider>`) and its own adapter; there is no
combined "call all four" backend request that could return one failing status for everyone.
`api/_lib/handler.ts`'s `runProviderSafely` always resolves to a well-formed outcome — a missing
key, a thrown adapter exception, a timeout, an HTTP error, or malformed JSON all become a typed
`AiErrorInfo`, never an unhandled rejection or a 500 that could be mistaken for "the whole feature
is down." Client-side, `aiLabState.ts`'s reducer keys every completion to the `runId` that started
it, so a stale response (superseded by a new Run All, or a provider that was never in flight) is
silently discarded rather than overwriting a newer or unrelated card.

Proven end-to-end (not just by construction) in `src/aiLab/AiColorLabView.test.tsx` — full
component render, mocked `fetch` — covering plan §31 Cases A–G: 4/4 success; a mixed
success/500/timeout run; malformed JSON isolated to one card; a missing key isolated to one card;
retry-one calling only that provider; a still-loading card not blocking completed ones; and a
stale response from a superseded run never overwriting the new run's result.

## 11. Timeout / retry

35s bound per provider (`api/_lib/timeout.ts`), combining the caller's signal with our own via
`AbortSignal.any`. A timeout becomes that provider's error card; it never cancels or delays the
other three. "Run all providers" and a per-card "Retry `<Provider>`" both exist — retry sends the
same current photo/sample only to that one provider (`AiColorLabView.tsx`'s `runProvider`), never
re-running the other three.

## 12. Env setup (names only)

`.env.example`:

```
OPENAI_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
DEEPSEEK_API_KEY=
```

`.env` / `.env.local` / `.env.*.local` are gitignored (confirmed: `.env` was never committed,
`git check-ignore` confirms it is ignored). No key value appears in source, tests, docs, error
messages, or the client bundle — verified by grepping the actual `vite build` output for every
key name and every provider endpoint URL (zero matches) and by a dedicated static audit,
`api/_lib/security.test.ts`.

## 13. Dev-only entry

`?debug=ai` in a **dev build** (`import.meta.env.DEV`), the same pattern the existing color
diagnostic panel uses (`?debug=color`). `App.tsx` returns `<AiColorLabView />` directly for this
case, before touching quiz/result state, BottomNav, or any other production view — normal
navigation never links to it, and the DEV check compiles the whole branch (and its import chain)
out of a production build.

## 14. Live API smoke (2026-09-25, one photo, one call per provider, no repeated credit burn)

| Provider | Model | Status | Latency | Usage | Result |
|---|---|---|---|---|---|
| Gemini | gemini-3.5-flash | success | ~12.7s | 1694 in / 198 out / 3694 total | Valid, schema-conformant result ("Salmon Pink", suitability: recommended) |
| OpenAI | gpt-5-mini | success | ~15.4s | 2683 in / 1102 out / 3785 total | Valid, schema-conformant result ("dusty rose / muted warm rose", suitability: more_considered) |
| Groq | qwen/qwen3.8-27b | success | ~1.7s | 2434 in / 272 out / 2706 total | Valid, schema-conformant result ("Dusty Salmon", suitability: workable) — fastest by a wide margin |
| DeepSeek | deepseek-flash | **malformed-response** | ~12.9s | n/a (error) | Vision + minimal JSON works in isolation (confirmed with a trivial follow-up call); with the full canonical multi-field prompt, the response did not parse/validate as our schema. Isolated to DeepSeek's own card; retryable; did not affect the other three. |

**No provider is declared a winner.** This is one image; provider selection needs a larger,
PO-reviewed set (plan §35). Production Photo Checker was not touched or re-routed.

## 15. Known limitations

- Groq's only vision model (`qwen/qwen3.8-27b`) is Preview-tier — availability/stability risk
  independent of this app.
- DeepSeek vision is ~5 weeks old at time of writing and, in this one live smoke run, did not
  reliably produce schema-conformant JSON for the full multi-field prompt (worked for a trivial
  one-field prompt). Retryable per-card; not marked UNSUPPORTED since it does have a working
  vision API, just an inconsistent structured-output result here.
- Gemini and DeepSeek's structured-output modes are not officially documented as vision-compatible;
  both adapters lean on prompt-instructed JSON + server-side validation rather than a provider-
  enforced schema.
- No cost accounting (plan §19 explicitly defers this) — usage tokens are shown as reported, cost
  is not computed.
- A Vite "configLoader: 'native'" deprecation warning appears for relative imports without file
  extensions across `api/**` and `src/domain/aiColorLab/contract.ts`; harmless today (current Vite
  major version), not yet fixed.

## 16. Recommended next experiment

Run the same bake-off across a larger, PO-curated set of real photos (different lighting,
skin tones, garments) and compare normalized results across providers systematically, before any
provider-selection decision. Consider whether DeepSeek's schema-adherence issue is prompt-size-
related (a shorter field set, or two calls instead of one) before concluding it is a hard
limitation.
