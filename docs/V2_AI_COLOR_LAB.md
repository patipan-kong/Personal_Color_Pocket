# V2.0 AI Color Lab — Slice 0 (Bake-off) + 0.1 (Grounding Fix) + 0.2 (Model Bake-off)

Status: **implemented, dev-only, not deployed.** Active bake-off: **four candidates across three
providers** — Gemini Flash, Gemini Flash-Lite, OpenAI, Groq (DeepSeek was evaluated in Slice 0 and
removed in Slice 0.1 — see §15; Gemini Flash-Lite was added as a challenger candidate in Slice 0.2
— see §22-28).

## 1. Purpose

An experimental, developer-only playground: the same photo and the same selected sample point,
analyzed independently by AI vision candidates, compared side by side with the existing
deterministic Photo Color Checker. It answers one question — does AI vision add *context* beyond
a raw pixel measurement (lighting, garment identification, usability) — not "which provider is
right." It does **not** replace, correct, or feed into the production Photo Color Checker,
personal-color scoring, or any recommendation.

Slice 0 ran this bake-off across four providers (Gemini, OpenAI, Groq, DeepSeek). Slice 0.1
removed DeepSeek after it failed structured-output validation live, and fixed a grounding bug
where every provider received the full photo with no indication of which point the user had
actually selected — see §15-19 for the full audit, fix, and live-smoke results. Slice 0.2 (this
update) turned the fixed three-provider lab into a genuine **task-specific model-selection
bake-off**: it split "provider" into "provider + model candidate" (Gemini now offers Flash and
Flash-Lite), added PO review controls, a session summary, latency/cost measurement, and a
Flash-vs-Flash-Lite comparison — see §22-28. It does **not** choose a model; the PO does, from the
evidence this slice exposes (plan §25).

## 2. Branch / base

- Branch: `feature/v2-ai-lab`
- Base: `feature/v1.5-ads-android` tip (`b0dc3dd`, docs-only), which itself sits on
  `main`/v1.2.0 (`3b382ad`) — `feature/v2-ai-lab` and `feature/v1.5-ads-android` pointed at the
  identical commit when this slice began (see `docs/V2_AI_LAB_BOUNDARY.md`, the earlier boundary
  note recorded during V1.5 Slice 0). V1.5 itself was untouched by this slice or by Slice 0.1.

## 3. Architecture

Pure Vite + React SPA, no backend previously existed. This slice adds the smallest boundary that
(a) keeps all provider API keys server-side and (b) has a real path to Vercel later, without
adding a framework or a second implementation to maintain:

```
api/_lib/handler.ts       <- the ONE request handler (key check, timeout, validation, envelope)
api/_lib/providers/*.ts   <- one adapter per PROVIDER (isolated, server-only)
api/_lib/{env,http,timeout,prompt,validate,validateRequest}.ts

src/domain/aiColorLab/contract.ts
  -> AI_CANDIDATES: Record<AiCandidateId, { provider, model, label }> (Slice 0.2, §22): the ONE
     place a candidate's exact model id is spelled out. A provider adapter is now called with a
     `model` PARAMETER instead of a hardcoded constant, so one adapter can serve more than one
     candidate (Gemini Flash and Gemini Flash-Lite both call api/_lib/providers/gemini.ts, with
     different model ids) without being duplicated.

api/ai-color/{gemini-flash,gemini-flash-lite,openai,groq}.ts
  -> Vercel-style (req, res) function files, one per CANDIDATE. Not deployed this slice; exist so
     the path to Vercel serverless functions is real, not aspirational. Each is a 4-line wrapper
     around handleAiColorRequest(candidateId, ...). (api/ai-color/deepseek.ts and
     api/_lib/providers/deepseek.ts were deleted in Slice 0.1 -- see §15.)

api/devServer.ts
  -> a Vite plugin (configureServer middleware) that mounts /api/ai-color/<candidateId> during
     `vite dev`, calling the exact same handleAiColorRequest(). One implementation, two hosts.
```

`vite.config.ts` loads `.env` via Vite's own `loadEnv()` (Node/config context only) and copies
just the three named provider keys into `process.env` — never through `define` or
`import.meta.env`, so they cannot reach the client bundle. Verified against the actual production
`vite build` output (see §Security below), not just by construction. One key (`GEMINI_API_KEY`)
now authenticates two candidates (Flash and Flash-Lite); no new key was introduced for Slice 0.2.

The client (`src/aiLab/*`) only ever calls `fetch('/api/ai-color/<candidateId>')` — same origin,
no provider SDK, no credential in scope.

## 4. Privacy distinction from the production Photo Checker

The production Photo Color Checker is local-only: the photo never leaves the device (unchanged
by this slice). The AI Lab is the opposite for the candidates you actually run: pressing "Run all
candidates" (or retrying one) sends the current photo to that candidate's provider API. The AI Lab
UI states this explicitly and does not reuse the production "stays on this device" copy.

## 5. Canonical normalized contract

`src/domain/aiColorLab/contract.ts` (pure types, safe for both client and server):

```ts
interface NormalizedAiColorResult {
  provider: 'gemini' | 'openai' | 'groq'
  model: string
  targetAssessment: { objectType: string; objectDescription: string; targetMatched: boolean | 'uncertain' } // Slice 0.1, §18
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

| Candidate | Provider | Model used | Vision support | Structured output + vision |
|---|---|---|---|---|
| Gemini Flash | Gemini | `gemini-3.5-flash` | Yes, all current 3.x models | Not confirmed compatible by official docs (a documented case elsewhere returned 400 with responseSchema + image); adapter uses `responseMimeType: application/json` only, no schema, plus explicit JSON-shape prompt instructions |
| Gemini Flash-Lite | Gemini | `gemini-3.5-flash-lite` | Yes (verified Slice 0.2, §23) | Same as Gemini Flash — same adapter code path, `model` is a parameter |
| OpenAI | OpenAI | `gpt-5-mini` | Yes | Confirmed — `response_format: json_schema` (strict) documented as vision-compatible |
| Groq | Groq | `qwen/qwen3.8-27b` | Yes — **the only Groq model that accepts images**; Groq's fast Llama/gpt-oss lineup is text-only. Listed under Groq's Preview tier (evaluation-only, no production-stability guarantee) | Confirmed working with vision per Groq's own docs (`json_object` mode) |
| ~~DeepSeek~~ | ~~DeepSeek~~ | ~~`deepseek-flash`~~ | Evaluated in Slice 0: yes, the only DeepSeek model that accepts images, but vision was ~5 weeks old at the time | **Removed in Slice 0.1** (§15) — the live smoke run consistently produced JSON that did not validate against the contract for the full canonical prompt, unlike the others. Historical record only; no longer an active provider. |

No model IDs changed in Slice 0.1 or Slice 0.2 for Gemini Flash, OpenAI, or Groq (plan §3: freeze
the existing candidates unless a capability problem is found — none was). Gemini Flash-Lite is a
genuinely new candidate added in Slice 0.2, not a replacement for Gemini Flash — both run side by
side (§22-26).

Sources (fetched live, not recalled): `ai.google.dev/gemini-api/docs/{image-understanding,structured-output,models,models/gemini-3.5-flash-lite,pricing}`,
`developers.openai.com/api/docs/{guides/images-vision,guides/structured-outputs,models/gpt-5-mini,pricing}`,
`console.groq.com/docs/{vision,models,deprecations}`, `api-docs.deepseek.com/{guides/vision,news/news260821,quick_start/error_codes}`.

All active adapters use plain `fetch()` — no provider SDK was installed (see §Dependencies).
Every adapter, regardless of what structured-output mode it requested, has its JSON response
re-validated server-side against the contract (`api/_lib/validate.ts`); nothing is trusted merely
because structured output was asked for.

## 7. Canonical prompt

One instruction, `api/_lib/prompt.ts`'s `CANONICAL_INSTRUCTION` + `buildCanonicalPrompt()`, used
verbatim by every active adapter (`api/_lib/providers/shared.ts`'s `promptFor` is just
`buildCanonicalPrompt`) — `promptFor` never takes a model, so Gemini Flash and Gemini Flash-Lite
necessarily receive identical prompt text, by construction (Slice 0.2 plan §6, §22 C). Parity is
asserted by a real fetch-body inspection test, not just an import check — `api/_lib/prompt.test.ts`
captures each adapter's actual outgoing request text (and, since Slice 0.1, its outgoing image
payload too) and asserts both equal `buildCanonicalPrompt(request)` / `request.imageDataUrl`
byte-for-byte, for both Gemini candidate model ids.

It asks the model to first identify the garment/object under the marked target (Slice 0.1, §16-18),
then report perceived color family, temperature/value/chroma, ambient lighting cast and severity,
whether the sampled region is shadowed/highlighted/mixed/usable, and suitability against the
user's subtype if one is saved — explicitly not "what hex is this," and explicitly forbidding a
claim of recovering the true physical color or reporting the marker graphic's own color.

## 8. Same input for all four candidates

Every candidate receives the same annotated JPEG (`src/aiLab/imageEncode.ts`, re-encoding the exact
working-image pixels the existing photo pipeline already produced — no re-decoding of the
original file — with a target marker burned in at the selected point, Slice 0.1 §17), the same
deterministic sample context (hex, RGB, OKLab lightness, semantic color name, sampling flags), and
the same subtype context (or none). This is a single `AiColorAnalysisRequest` object, built once
per sample point (`buildAiColorRequest`) and reused unchanged across all four `callAiColorCandidate`
calls — Gemini Flash and Gemini Flash-Lite are given the exact same `imageDataUrl` string, not two
independently-encoded copies (Slice 0.2 plan §5, §22 D). Provider-specific request syntax differs
(Gemini's `inline_data` vs. the other two's OpenAI-compatible `image_url`, and the model id in
Gemini's URL); the *content* does not — verified by `api/_lib/prompt.test.ts`'s parity test (which
now covers both Gemini candidate model ids) and `AiColorLabView.test.tsx`'s client-level parity
check that Gemini Flash's and Gemini Flash-Lite's actual outgoing request bodies are identical
apart from the URL.

## 9. Deterministic baseline

Shown above the AI cards (`src/aiLab/DeterministicBaselineCard.tsx`), reusing the existing
engine functions unchanged: `samplePhotoRegion`, `matchPhotoColor`, `describeColor`,
`getSuitability` — no new color logic, no AI-derived correction of any deterministic value.
`src/aiLab/aiLabDeterministic.ts` composes them with an **optional** subtype (the production
`inspect.ts` requires one; the AI Lab does not, since it must work with no saved profile —
plan §27 forbids inventing one).

## 10. Failure isolation

Each candidate is its own route (`/api/ai-color/<candidateId>`) and resolves to its own adapter
call (`handler.ts`'s `runProviderSafely` looks up `{ provider, model } = AI_CANDIDATES[candidateId]`);
there is no combined "call all four" backend request that could return one failing status for
everyone. `runProviderSafely` always resolves to a well-formed outcome — a missing key, a thrown
adapter exception, a timeout, an HTTP error, or malformed JSON all become a typed `AiErrorInfo`,
never an unhandled rejection or a 500 that could be mistaken for "the whole feature is down."
Client-side, `aiLabState.ts`'s reducer keys every completion to the `runId` that started it, so a
stale response (superseded by a new Run All, or a candidate that was never in flight) is silently
discarded rather than overwriting a newer or unrelated card. Slice 0.2's Gemini Flash and Gemini
Flash-Lite candidates are two fully independent calls through the same adapter and the same key —
one failing (auth, rate-limit, malformed output) never affects the other's card.

Proven end-to-end (not just by construction) in `src/aiLab/AiColorLabView.test.tsx` — full
component render, mocked `fetch` — covering plan §31 Cases A–G (now exercised across all four
active candidates) plus Slice 0.2's Case E (one Gemini candidate fails, the other succeeds): 4/4
success; a mixed success/500 run; malformed JSON isolated to one card; a missing key isolated to
one card; retry-one calling only that candidate; a still-loading card not blocking completed ones;
and a stale response from a superseded run never overwriting the new run's result. Slice 0.1 added
a dedicated check that Run All fires exactly three requests and none of them targets `deepseek`;
Slice 0.2 updated this to four requests, still none targeting `deepseek`, and added a handler-level
test (`api/_lib/handler.test.ts`) proving the two Gemini candidates resolve to their own distinct
model ids and stay isolated when mocked to fail independently.

## 11. Timeout / retry

35s bound per candidate (`api/_lib/timeout.ts`), combining the caller's signal with our own via
`AbortSignal.any`. A timeout becomes that candidate's error card; it never cancels or delays the
others. "Run all candidates" and a per-card "Retry `<Candidate>`" both exist — retry sends the
same current photo/sample only to that one candidate (`AiColorLabView.tsx`'s `runCandidate`), never
re-running the others. Run All fires all four candidates in parallel, including both Gemini
candidates that share one key/account — never serialized just because two candidates share a
provider (Slice 0.2 plan §21); a 429 on one is reported on that one card only, with manual Retry
(no automatic repeated retries that could burn credits, plan §21).

## 12. Env setup (names only)

`.env.example`:

```
OPENAI_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
```

`DEEPSEEK_API_KEY` was removed from `.env.example` in Slice 0.1. A developer's local `.env` may
still have it set from Slice 0 — it is simply never read (`vite.config.ts`'s `AI_LAB_KEYS` no
longer includes it); nothing requires deleting it locally.

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

## 14. Slice 0 live API smoke (historical, 2026-09-25, one photo, one call per provider, no repeated credit burn)

| Provider | Model | Status | Latency | Usage | Result |
|---|---|---|---|---|---|
| Gemini | gemini-3.5-flash | success | ~12.7s | 1694 in / 198 out / 3694 total | Valid, schema-conformant result ("Salmon Pink", suitability: recommended) |
| OpenAI | gpt-5-mini | success | ~15.4s | 2683 in / 1102 out / 3785 total | Valid, schema-conformant result ("dusty rose / muted warm rose", suitability: more_considered) |
| Groq | qwen/qwen3.8-27b | success | ~1.7s | 2434 in / 272 out / 2706 total | Valid, schema-conformant result ("Dusty Salmon", suitability: workable) — fastest by a wide margin |
| DeepSeek | deepseek-flash | **malformed-response** | ~12.9s | n/a (error) | Vision + minimal JSON works in isolation (confirmed with a trivial follow-up call); with the full canonical multi-field prompt, the response did not parse/validate as our schema. Isolated to DeepSeek's own card; retryable; did not affect the other three. |

No provider was declared a winner from this one image. This table is kept as the historical
Slice 0 record; DeepSeek's result here is the reason it was removed in Slice 0.1 (§15).

## 15. Slice 0.1 — DeepSeek removal

**Decision:** remove DeepSeek from the active AI Color Lab bake-off.

**Why:** the PO's first real-world test (§16) surfaced a grounding problem across all four
providers, and DeepSeek additionally failed structured-output validation on the live canonical
prompt in the Slice 0 smoke test (§14) — vision worked in isolation for a trivial prompt, but not
reliably for the full multi-field contract. The PO decided DeepSeek was no longer worth carrying
in this experiment.

**What was removed:** `api/_lib/providers/deepseek.ts`, `api/ai-color/deepseek.ts`,
`deepseek`/`DEEPSEEK_API_KEY` from `AI_PROVIDER_IDS`, `api/_lib/env.ts`, `api/_lib/handler.ts`'s
adapter table, `vite.config.ts`'s `AI_LAB_KEYS`, `src/aiLab/providerLabels.ts`,
`src/aiLab/aiLabState.ts`'s initial state, `.env.example`, and every DeepSeek-only test case. A
PO's local `.env`/`.env.local` may still have `DEEPSEEK_API_KEY` set from Slice 0 — nothing reads
it any more, and nothing required deleting it. **DeepSeek's real key value was never read, printed,
or logged by this removal.**

**What was kept:** this document's Slice 0 record of DeepSeek's research and live-smoke result
(§6, §14) — it was genuinely evaluated, not written out of history.

Verified by `api/_lib/security.test.ts`'s new "DeepSeek is no longer an active provider" check
(no adapter file, no route file, no `DEEPSEEK_API_KEY=` in `.env.example`, no `'deepseek'` string
in the contract) and `src/aiLab/AiColorLabView.test.tsx`'s "DeepSeek removal" suite (no DeepSeek
card renders; Run All fires exactly three requests and none targets `deepseek`).

## 16. Slice 0.1 — Grounding audit

**The PO's first real-world test** (a photo of two people: a man wearing a cream/ivory shirt on
the left, a woman wearing a pink shirt on the right, cloudy sky background; sample marker placed
on the man's sleeve/shirt) produced inconsistent interpretations:

| Provider | Interpreted target |
|---|---|
| Gemini | Correct — the man's cream/ivory shirt |
| OpenAI | Wrong — the cloudy sky |
| Groq | Wrong — the woman's pink shirt |
| DeepSeek | Failed structured-output validation (§14) |

**Audit of the request pipeline** (traced before any code was changed, per plan §5) found the
exact cause: the image sent to every provider (`src/aiLab/imageEncode.ts`'s pre-Slice-0.1
`encodeImageForAiLab`) was the full working-image pixels re-encoded as JPEG — **with no
indication whatsoever of which point had been selected**. No pixel coordinates, no normalized
coordinates, no percentages, no textual description, nothing. The only thing resembling
"grounding" was the deterministic sample's hex/name/OKLab-lightness, sent as prose explicitly
labeled "context only, not a target to repeat" — which told a provider what the deterministic
engine measured, but never *where* in the photo it measured it.

Meanwhile, the sample marker the user sees on screen (`.photo-marker` in
`src/photoChecker/PhotoSurface.tsx`) is a pure CSS-positioned `<span>` overlay, positioned via
`imageToDisplay`/`imageLengthToDisplay` on top of the canvas — never drawn into the canvas pixels
that `getContext('2d').putImageData(...)` paints, and therefore never present in the JPEG that
`canvas.toDataURL(...)` produces. **The visible marker never reached the AI at all** (plan §5
audit question 9, confirmed yes).

Coordinate-space check: the selected point (`ImagePoint`, working-image pixel space) is the exact
same space `samplePhotoRegion` used for the deterministic sample and the exact same space the
canvas that gets encoded is painted in (`PixelSource` from the same `openPhoto` pipeline output).
There was no resize/orientation/CSS-vs-image mismatch to find — the bug was not a wrong
coordinate, it was the complete ABSENCE of any coordinate reaching the request at all (plan §5
audit question 1-10; questions 1, 2, 3, 9 all confirmed the gap, question 10 confirmed not
applicable — no resize/crop discrepancy exists between the sampled point and the encoded image).

**Root cause:** with no target information at all, each provider had nothing to ground on but
overall visual salience across the whole photo — so each one silently picked whatever looked most
interesting to it (a face/garment, the sky, a different person's brighter-colored shirt) instead
of the region the user actually tapped. This fully explains the observed inconsistency; it does
not require assuming anything about individual provider quality.

## 17. Slice 0.1 — Grounding fix

Per plan §8's fix order (A: coordinate bug, B: prompt wording, C: visual marker, D: crop/context),
A did not apply (there was no coordinate bug to correct — there was no coordinate at all). B alone
was judged insufficient: this app's own canonical prompt already told providers "the marked
region," implying a marker existed, but none existed — no amount of *wording* fixes that, since
there was no marker to describe accurately. Plan §8 also states a visual marker is preferred over
provider-specific prompt hacks when text coordinates cannot be relied on; given that vision models
are well known to be inconsistent at precise text/percentage-coordinate grounding on arbitrary
photos, and this app had zero grounding signal to begin with, C (visual marker) was selected
directly, paired with a genuinely necessary prompt update (since the prompt now needs to describe
the marker that C introduces). D (crop) was not used — plan §10 explicitly warns against losing
surrounding context needed to tell garment from skin/sky/background/another person, which the
original PO photo needed (two people, two shirts, one sky) to be distinguishable at all.

**The fix (`src/aiLab/imageEncode.ts`, `encodeAnnotatedImageForAiLab`):** burns a small ring +
center dot (magenta-red `#ff2d55` with a white halo, visible against both dark and light fabric)
onto an AI-only copy of the canvas, centered at the EXACT same `ImagePoint` the deterministic
sampler used, with a radius derived from the same `sampleRadiusFor` value — no separate coordinate
representation, so no room for a transform bug. The full, uncropped working image is still sent
(plan §10's context requirement). This function is called only from `src/aiLab/buildRequest.ts`;
it never touches the original uploaded image, the production Photo Checker's canvas, or the pixel
buffer the deterministic sampler reads (`src/aiLab/imageEncode.test.ts` proves the source buffer
is byte-identical before and after).

**The canonical prompt (`api/_lib/prompt.ts`)** now explicitly describes the marker, states "The
marked target is authoritative," instructs the model to first identify the garment/object under
it using the surrounding photo for context, and explicitly says not to switch to another person,
garment, the sky, or the background even if a different area looks more salient — and not to
report the marker graphic's own color as the garment's color. This is one shared instruction,
unchanged per-provider (plan §18: no `if provider === 'groq'` style coaching); parity is asserted
in `api/_lib/prompt.test.ts`.

No model IDs were changed to make this work (plan §4) — the existing three models already
supported image input; the gap was entirely in what was sent, not in model capability.

## 18. Target-assessment contract

`NormalizedAiColorResult.targetAssessment` (`src/domain/aiColorLab/contract.ts`):

```ts
interface AiTargetAssessment {
  objectType: string          // e.g. "shirt", "fabric swatch"
  objectDescription: string   // e.g. "cream short-sleeve shirt worn by the man on the left"
  targetMatched: boolean | 'uncertain'
}
```

Server-side validated with the same reject-not-coerce rigor as every other field
(`api/_lib/validate.ts`; `api/_lib/providers/shared.ts`'s `modelOutputJsonSchema()` for OpenAI's
strict mode) — `targetMatched` must be exactly `true`, `false`, or the string `"uncertain"`, never
coerced from anything else; a missing or malformed `targetAssessment` fails that provider's
response as `malformed-response`, isolated to that one card (plan §22 F/G), exactly like any other
invalid field, and is never derived from the provider's name or patched after the fact (plan §12).

**`targetMatched` is diagnostic, never proof** (plan §13) — a provider can be confidently wrong.
`ProviderCard.tsx`'s `TargetSection` always shows `objectType` and `objectDescription` next to
`targetMatched`, near the top of a successful card, so the PO can visually judge grounding rather
than trusting a boolean alone.

An optional, collapsed **"AI input preview"** (plan §23, `AiColorLabView.tsx`) shows the exact
annotated image bytes that were sent to every provider, so the PO can directly verify the marker
landed on the intended point before even reading a card.

## 19. Slice 0.1 live API smoke (2026-09-25, three providers, one call each, no repeated credit burn)

No photo-of-a-person test asset exists in this repository (the PO's original screenshot was not
available to this session, per plan §24, which forbids fabricating a reproduction). The closest
representative asset already in the repo, `public/color-draping.png` (a real production image: nine
adjacent fabric swatches of different colors, folded and fanned on a maroon background, plus
jewelry), was used instead — it presents the same core grounding challenge as the PO's photo
(several visually competing, adjacently-placed colors) even though it is not literally a garment
on a person. The sample point was placed on the cream/ivory swatch's flat top panel, between the
burgundy swatch (left) and the tan/camel swatch (right) — a direct analogue of the original
man's-cream-shirt-vs-woman's-pink-shirt adjacency test.

Deterministic sample at the chosen point: `#c7b19d` (warm light beige/cream).

| Provider | Model | Status | Latency | Target identified | targetMatched | Perceived color |
|---|---|---|---|---|---|---|
| Gemini | gemini-3.5-flash | success | ~9.6s | "fabric drape — the cream-colored folded fabric swatch, positioned third from the right, between the berry-red and the camel-brown fabrics" | true | cream (white) |
| OpenAI | gpt-5-mini | success | ~12.1s | "folded fabric sample — light cream/beige folded fabric, second from the right in the row of fabric swatches near the upper-right of the image" | true | light warm beige / cream |
| Groq | qwen/qwen3.8-27b | success | ~2.1s | "fabric swatch — a cream or ivory-colored silk-like fabric swatch positioned in the middle-upper right section of a diagonal array of colorful textile samples, sitting between a fuchsia/purple swatch and a camel/brown swatch" | true | Cream (Neutral) |

All three now correctly identify the intended swatch, correctly locate it relative to its actual
neighbors, agree with each other and with the deterministic hex on the color family (cream/beige),
and report `targetMatched: true` — a marked improvement over the Slice 0 grounding failures (§16).
**No provider is declared a winner** — this is one image; provider selection needs a larger,
PO-reviewed set (§21). Production Photo Checker was not touched or re-routed.

**A genuine bug was found and fixed during this smoke run, unrelated to grounding:** OpenAI's
first two calls returned perfectly valid, schema-conformant JSON that `api/_lib/validate.ts`
nonetheless rejected as `malformed-response`. Root cause: `lighting.condition` (a free-text
lighting description, e.g. "studio-like indoor, soft directional light with subtle highlights
along the folds") shared an 80-character `LABEL_MAX` cap with genuinely short label fields
(`perceivedColorName`, `colorFamily`); once the strengthened prompt led models to write more
naturally, that description routinely exceeded 80 characters and was rejected even though it was
valid. Diagnosed with a throwaway script that called the real running adapter and printed only
the (non-secret) model output text, never a key value. Fixed by giving `lighting.condition` the
same wider `PHRASE_MAX` (240 chars) already used for `targetAssessment.objectDescription` — a
provider-neutral fix to the one shared validator, not a provider-specific patch; it does not
relax any enum or shape check, only a length cap that was demonstrably too tight for a real field.
Re-run after the fix: all three providers succeeded (table above).

## 22. Slice 0.2 — Provider vs. candidate architecture

**Why:** the PO ran ~10 real requests after Slice 0.1 and observed grounding was now solid, Groq
was fastest, Gemini second, OpenAI slowest, all three produced plausible color interpretation, and
Gemini Flash appeared materially more expensive than the other two — but there wasn't yet evidence
to choose a default model. Slice 0.2 turns the lab into a real model-selection bake-off and adds
Gemini Flash-Lite as a cheaper challenger, without changing the grounding fix, the prompt, the
deterministic engine, or the existing three model ids (plan §1-3, §6).

**The refactor:** a PROVIDER (one API key, one adapter, one endpoint shape) may now expose more
than one CANDIDATE model. `src/domain/aiColorLab/contract.ts`:

```ts
export const AI_CANDIDATE_IDS = ['gemini-flash', 'gemini-flash-lite', 'openai', 'groq'] as const
export type AiCandidateId = typeof AI_CANDIDATE_IDS[number]
export const AI_CANDIDATES: Record<AiCandidateId, { provider: AiProviderId; model: string; label: string }> = {
  'gemini-flash': { provider: 'gemini', model: 'gemini-3.5-flash', label: 'Gemini Flash' },
  'gemini-flash-lite': { provider: 'gemini', model: 'gemini-3.5-flash-lite', label: 'Gemini Flash-Lite' },
  openai: { provider: 'openai', model: 'gpt-5-mini', label: 'OpenAI' },
  groq: { provider: 'groq', model: 'qwen/qwen3.8-27b', label: 'Groq' },
}
```

This is the ONE place a candidate's model id is spelled out. Every adapter's `runProvider` now
takes `model: string` as a third parameter instead of a hardcoded `export const MODEL` — Gemini
Flash and Gemini Flash-Lite are the SAME adapter module (`api/_lib/providers/gemini.ts`) called
with two different model ids; the adapter was not duplicated (plan §4: "Keep architecture small").
`api/_lib/handler.ts` resolves `candidateId -> { provider, model }` via `AI_CANDIDATES`, checks the
PROVIDER's key (`hasKey(provider)` — Gemini's one key covers both its candidates), and calls that
provider's adapter with that candidate's model. Routing (`api/devServer.ts`, `api/ai-color/*.ts`)
is one route per CANDIDATE, not per provider — `/api/ai-color/gemini-flash`,
`/api/ai-color/gemini-flash-lite`, `/api/ai-color/openai`, `/api/ai-color/groq`.

Client-side, `src/aiLab/aiLabState.ts`'s reducer is keyed by `AiCandidateId`; `ProviderCard.tsx`
renders one card per candidate using `AI_CANDIDATES[candidateId].label` ("Gemini Flash", "Gemini
Flash-Lite", "OpenAI", "Groq"). `NormalizedAiColorResult` itself is unchanged (still
`provider` + `model`, no new `candidateId` field) — the candidate layer lives entirely client-side
and in routing; the server-returned contract this slice's task depends on (plan §6, §17) was
deliberately left frozen.

## 23. Slice 0.2 — Gemini Flash-Lite capability verification

Verified live against current official Gemini API docs before any code was written (plan §3 — "Do
NOT silently guess model IDs"), 2026-09-25:

| Question | Answer | Source |
|---|---|---|
| Exact current model id | `gemini-3.5-flash-lite` | `ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite`, `ai.google.dev/gemini-api/docs/models` |
| Image input support | Yes — "supports text, image, video, audio, and PDF inputs" | same |
| Structured output support | Yes — listed alongside Flash | same |
| Same Gemini API/key as Flash | Yes (same `generativelanguage.googleapis.com` API, same `GEMINI_API_KEY`; not a separate product) | `ai.google.dev/gemini-api/docs/models`; confirmed live in the Slice 0.2 smoke test (§28), which succeeded using the existing `GEMINI_API_KEY` with no new key |
| Availability | GA as of 2026-07-21, no retirement date set as of 2026-09-25 | `docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash-lite` |
| Usage metadata | Same `usageMetadata` shape as Flash (`promptTokenCount`/`candidatesTokenCount`/`totalTokenCount`) — confirmed live in §28, not just documented | `ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite`; §28 |
| Pricing | Standard tier: $0.30 / 1M input tokens, $2.50 / 1M output tokens (USD) | `ai.google.dev/gemini-api/docs/pricing`, read 2026-09-25 |

Gemini Flash-Lite was judged available and suitable, so the documented fallback (Gemini 3.1
Flash-Lite) was not needed. No model id in this table was recalled from training data — every row
was fetched live during this slice.

## 24. Slice 0.2 — Cost methodology

`src/aiLab/pricing.ts`'s `CANDIDATE_PRICING` records each candidate's official STANDARD-tier, USD,
per-1M-token pricing, its source URL, and the date it was read (plan §13: "Record the pricing
source/date"):

| Candidate | Input $/1M | Output $/1M | Source | As of |
|---|---|---|---|---|
| Gemini Flash | $1.50 | $9.00 | `ai.google.dev/gemini-api/docs/pricing` | 2026-09-25 |
| Gemini Flash-Lite | $0.30 | $2.50 | `ai.google.dev/gemini-api/docs/pricing` | 2026-09-25 |
| OpenAI (`gpt-5-mini`) | $0.25 | $2.00 | `developers.openai.com/api/docs/pricing` | 2026-09-25 |
| Groq (`qwen/qwen3.8-27b`) | $0.80 | $4.00 | `console.groq.com/docs/models` | 2026-09-25 |

`estimateCostUsd(candidateId, usage)` returns `null` — never a fabricated number — whenever the
provider did not report both `inputTokens` and `outputTokens` for that call; the UI then shows
"Cost unavailable" rather than a guess (plan §13, tested in `src/aiLab/pricing.test.ts` and
`bakeoffSummary.test.ts`). Every place a cost figure is shown (`ProviderCard.tsx`,
`FlashLiteComparison.tsx`, `SessionSummary.tsx`, the JSON export) labels it "(estimated)" —
this is PROJECTED cost calculated from provider-reported token usage against a published price
list, never an amount that was actually billed (plan §13: some provider dashboards show projected
cost even for accounts not enrolled in billing — this app makes the same distinction). No live FX
conversion was introduced; every candidate's pricing is already published in USD, so none was
needed for this POC.

## 25. Slice 0.2 — PO review & session summary

**PO review is the quality ground truth, not an automatic score** (plan §9-10, §25). After a
successful candidate result, its card shows a lightweight `<fieldset>` (`ProviderCard.tsx`'s
`PoReviewControls`): Target (Correct/Wrong/Unsure), Color interpretation (Good/Acceptable/Wrong),
Lighting interpretation (Good/Acceptable/Wrong), and an optional free-text note. Every field starts
unset; an unset field is simply not counted anywhere, never defaulted to a verdict. Reviews are
stored keyed by `` `${candidateId}:${runId}` `` (`src/aiLab/aiLabState.ts`'s `reviewKey`), so a
retry (new `runId`) starts a fresh, unreviewed run without disturbing the previous run's review
(tested in `aiLabState.test.ts` and `bakeoffSummary.test.ts`). The app never infers agreement
between candidates' own enums (e.g. two candidates both saying "warm/light/muted") as a quality
signal, and never uses `targetMatched` or the model's own `confidence` as ground truth (plan §10).

**Session bake-off summary** (`src/aiLab/SessionSummary.tsx` + `bakeoffSummary.ts`) accumulates
across every run in the browser session — every photo, every sample point, every candidate, not
just the currently-displayed run (plan §11, §19). It is session-local, in-memory only
(`aiLabState.ts`'s `history`/`reviews`, kept across a `reset` action that only clears the visible
cards) — nothing is persisted, nothing survives a page reload, no backend database was added. Per
candidate it shows: runs, successful, failed, target correct/wrong/unsure counts, color
good/acceptable/wrong counts, lighting good/acceptable/wrong counts, median latency
(`src/aiLab/stats.ts`'s `median` — preferred over mean so one slow outlier doesn't skew the
figure, plan §12), summed usage totals, and summed estimated cost. **There is no weighted
composite score and no automatic rank anywhere in this module or its tests** — `summarizeCandidate`
only counts and sums (plan §11, §25).

A **JSON export** (`src/aiLab/exportBakeoff.ts`, "Export results (JSON)" button) is built from an
explicit field allowlist, never a spread of the full outcome — `raw` (the provider's full response
envelope) and `imageDataUrl` are never included, so no future field addition could silently leak
photo bytes or a provider envelope into an exported file (plan §19; proven directly in
`exportBakeoff.test.ts` by including a fake base64/key-shaped string inside a mocked `raw` field
and asserting it never appears in the serialized export).

## 26. Slice 0.2 — Gemini Flash vs. Flash-Lite comparison

The specific sub-question plan §14 asks — "does Flash-Lite retain enough quality for this narrow
task that the additional cost of Flash is unnecessary?" — is deliberately not answered by this
slice's code. `src/aiLab/FlashLiteComparison.tsx` renders a dedicated two-column table (Gemini
Flash vs. Gemini Flash-Lite, same run) showing target identification, temperature/value/chroma,
lighting, latency, usage, estimated cost, and PO review side by side, so the comparison is easy to
inspect — but it computes nothing, ranks nothing, and recommends nothing. The one-image live smoke
in §28 shows Flash-Lite matching Flash's target identification and color-dimension calls while
being both faster and cheaper on that single run; this is evidence, not a proof, and the plan is
explicit that the PO's own manual, larger bake-off (§27) is what actually answers this question.

## 27. Slice 0.2 — Recommended manual bake-off test set

Per plan §18, a recommended manual set of ~15-20 PO-supplied real photos (not bundled into this
repository — private photos stay off the repo entirely), aiming for this diversity:

- cream/off-white, true white, black, gray, beige/brown, pastel, saturated warm color, saturated
  cool color, low-chroma color
- indoor warm lighting, cool indoor lighting, overcast outdoor, direct sunlight, shadow, backlight
- multiple people in one photo; two similar (but not identical) colors on nearby garments

The PO should use the same sample point for every candidate within a run (the app already
guarantees this — §8), review each candidate's target/color/lighting per plan §9-10, and only then
read the session summary (§25) and the Flash-vs-Flash-Lite table (§26) before choosing a default.

## 28. Slice 0.2 live API smoke (2026-09-25, four candidates, one call each, no repeated credit burn)

Same substitute image as the Slice 0.1 smoke (§19) and the same reasoning for using it: no
photo-of-a-person test asset exists in this repository, so `public/color-draping.png` (fabric
swatches) was reused rather than fabricating a reproduction (plan §24). Same sample point as §19.

| Candidate | Model | Status | Latency (server-measured) | Usage | Target identified | Perceived color | Est. cost |
|---|---|---|---|---|---|---|---|
| Gemini Flash | gemini-3.5-flash | success | 8.7s | 1980 in / 249 out / 3104 total | "fabric swatch — a folded cream-colored fabric swatch, positioned diagonally between a rich berry/burgundy swatch and a camel-brown swatch" | cream (white) | $0.00521 |
| Gemini Flash-Lite | gemini-3.5-flash-lite | success | 4.2s | 1980 in / 249 out / 2229 total | "fabric swatch — a cream or ivory colored fabric swatch folded neatly among a row of colored fabric swatches" | cream (neutral) | $0.00122 |
| OpenAI | gpt-5-mini | success | 10.5s | 3007 in / 842 out / 3849 total | "folded fabric swatch — light cream/ivory fabric swatch (second from the right) in a row of folded textile samples" | light warm cream / ivory / beige | $0.00244 |
| Groq | qwen/qwen3.8-27b | success | 2.1s | 2722 in / 294 out / 3016 total | "fabric swatch — a folded, cream/beige colored fabric swatch located in the upper section, between a magenta/burgundy swatch and a brown swatch" | Cream (Beige/Tan) | $0.00335 |

All four succeeded, all four correctly identified the same swatch with `targetMatched: true`, and
all four agreed on temperature/value/chroma (warm/light/muted) — consistent with, and confirming,
the PO's own ~10-request observation that Groq is fastest and OpenAI is slowest. On this single
run, Gemini Flash-Lite was both faster and cheaper than Gemini Flash while identifying the same
target. **No candidate is declared a winner** — this is one image; the PO's own larger, reviewed
bake-off (§27) is what actually decides a default (plan §25).

## 29. Known limitations

- Groq's only vision model (`qwen/qwen3.8-27b`) is Preview-tier — availability/stability risk
  independent of this app.
- DeepSeek was removed in Slice 0.1 (§15) after failing structured-output validation live; it is
  no longer an active provider or a limitation to track going forward.
- Gemini's structured-output mode is not officially documented as vision-compatible; its adapter
  leans on prompt-instructed JSON + server-side validation rather than a provider-enforced schema.
  This applies equally to Gemini Flash and Gemini Flash-Lite.
- The grounding fix (§17) has been validated on one representative image type (fabric swatches,
  §19, §28), not yet the PO's original two-person photo or a larger set — it should be
  re-verified against a real garment-on-a-person photo as part of the PO's manual bake-off (§27).
- `targetMatched` and the model's own `confidence` are self-reported and only diagnostic (§18,
  §25) — neither is an independent grounding or quality proof, just a reviewable signal shown
  alongside the object description and the PO's own review.
- Cost figures are PROJECTED from provider-reported usage against a published price list, not
  actual billing data (§24) — treat them as directional, not as an exact invoice forecast, and
  re-verify against each provider's own billing dashboard before any budget-sensitive decision.
- The session bake-off summary is in-memory only and is lost on page reload; the JSON export
  (§25) is the only way to keep a session's results, and it must be saved manually by the PO.
- Only one live-smoke image was used for Slice 0.2 (§28); the PO's own ~15-20 photo manual
  bake-off (§27) is what this slice's evidence is meant to feed into, not a substitute for it.
- A Vite "configLoader: 'native'" deprecation warning appears for relative imports without file
  extensions across `api/**` and `src/domain/aiColorLab/contract.ts`; harmless today (current Vite
  major version), not yet fixed.

## 30. Recommended next experiment

Run the PO's own manual, PO-reviewed bake-off across the ~15-20 photo set recommended in §27,
including the original two-person/two-garment scenario that motivated Slice 0.1, using the session
summary (§25) and the Flash-vs-Flash-Lite table (§26) to compare candidates systematically. Only
after that manual review should a default model be chosen — this slice deliberately stops short of
recommending one (plan §25).

## 31. Slice 0.3B — AI-assisted normalization contract spike (2026-09-25, design only, not wired in)

Contract/design spike, not integration. Question: how could AI vision evidence safely influence
the deterministic photo pipeline (`samplePhotoRegion` → `matchPhotoColor` → `getSuitability`)
without replacing or duplicating it? Entry state: branch `feature/v2-ai-lab`, HEAD `a638210`,
clean tree — no contradiction found before starting.

**Architecture finding.** The spike's own proposed diagram (AI sitting *between* sampling and
classification) turned out not to match what the evidence supports. `NormalizedAiColorResult`
(§5) has never returned a numeric color — `temperature`/`value`/`chroma` are coarse bins, a Slice
0 decision (§14 of the original plan: "no claim of recovering the garment's true physical color").
Turning those bins into a numeric correction applied before `matchPhotoColor` would require
inventing an unvalidated bin→number mapping — exactly the fake precision Slice 0 already rejected.
So the boundary sits **after** classification, not between sampling and matching: AI evidence can
only *annotate* an already-computed deterministic result, never feed into its math.

**Contract** (`src/domain/photoColor/aiNormalization.ts`, spike code, not called from the app):
- `AiColorNormalization` — the observational subset of `NormalizedAiColorResult` (`targetAssessment`,
  `perceivedColorName`, `colorFamily`, `temperature`, `value`, `chroma`, `lighting`,
  `sampleAssessment`, `confidence`), picked field-by-field so a future field must be explicitly
  triaged in or out. `suitability` and `reasoning` are excluded — they are the AI's own personal-
  color opinion and must never reach the one production classifier.
- `deriveSampleAdvisory(sample, normalization)` — returns `{ caveat, reasons }` only, never a
  color/category field. `target-mismatch` and `sample-unusable` are trusted directly from AI (pixel
  sampling has no equivalent signal). A `lighting-cast-corroborated` reason requires the
  **deterministic** sampler to have *already* flagged the region (`mixed`/`highlight`/`shadow`,
  see `sampling.ts`) — AI corroborates existing uncertainty, it never manufactures doubt about a
  clean sample. `confidence` alone never triggers anything.
- `suggestsAiAssist(sample)` — documents candidate gating signals, reusing constants the
  classifier already computes for other reasons (`NEUTRAL_CHROMA_MAX`, `LIGHT_VALUE_MIN`,
  `DEEP_VALUE_MAX`, the sampler's own flags). Not called from the app. "Disagreement among sampled
  regions" (one of the spike's candidate signals) has no existing implementation — only one region
  is ever sampled per tap — and was left undocumented as available rather than invented.

**Deterministic authority (D1-D5).** Held structurally, not by convention: `deriveSampleAdvisory`'s
return type has no color/category field, so there is no code path by which it could change
`sample`, `match`, `category`, or `colorName` even if called. `null` normalization (AI disabled,
unavailable, timeout, malformed) always collapses to `NO_ADVISORY` — the same value as "AI said
nothing," so the existing deterministic result is byte-for-byte unchanged whenever AI doesn't run.

**No persisted fixtures.** By design (no photo persistence, §29), none of the PO's manual bake-off
runs exist as files in this repo — they only ever lived in the PO's own browser session and the
optional JSON export (§25). The spike's example walkthroughs are therefore synthetic, built on the
real sampler/matcher via `realMatchFixtures.ts`, not a replay of the PO's actual 14 cases.

**Tests.** `src/domain/photoColor/aiNormalization.test.ts`, 14 cases, all against the real
`samplePhotoRegion`/`matchPhotoColor` engine (via `realMatchFixtures.inspectHex`/`solidImage`), not
mocks: no-AI/AI-unavailable → no advisory; target mismatch and unusable-sample flagged regardless
of confidence; a lighting-cast concern on a clean sample is NOT flagged even at high AI severity/low
AI confidence (D5), the same report IS flagged once the deterministic sampler independently flags
the region; low confidence alone never triggers a caveat; recommendation isolation (`suitability`/
`reasoning` changes never change the derived normalization); gating signals reproduce on real
near-neutral/near-white/near-black/mixed-region samples and stay empty for an ordinary saturated
color. Full regression: 67 files / 1850 passed / 1 skipped (was 66/1836 before this spike — exactly
the 14 new tests). `tsc -b` clean. `npm run build` output hash unchanged
(`dist/assets/index-B_gq-POk.js`) — nothing new is reachable from any app entry point, confirming
zero behavior change. No file outside the two new ones was touched.

**Recommendation: C.** AI should remain advisory/fallback, never a second color normalizer — this
was the open question and the evidence now supports it structurally (no numeric bin→correction
mapping exists or was validated) as well as by prior Slice 0 decision. The advisory layer itself
(`deriveSampleAdvisory`) is a *candidate* next step, not yet warranted for production wiring: its
corroboration heuristic (§ "lighting-cast-corroborated") has not been checked against any real
photo where AI and the deterministic sampler actually disagree, because no such case is persisted
anywhere. Before any UI wiring, replay it against a handful of the PO's real ~15-20 photo bake-off
exports (§27/§30) to see whether the caveat fires at a sensible rate — a small offline check, not
a new provider integration or a new production code path.

## 32. Slice 0.3C — Real bakeoff advisory replay (2026-09-25, offline, no API calls, no production changes)

The PO supplied one real export, `tmp/ai-color-bakeoff-*.json` (gitignored, never read by any
production code — confirmed: `dist/assets/*.js` contains no reference to the file's contents or
path, only the pre-existing literal filename PREFIX `ai-color-bakeoff-` from §25's
`downloadBakeoffExport`, which was already in the bundle before this slice): 14 real photo/point
cases × up to 4 candidates = 56 runs (groq failed once with a provider 5xx; every other candidate
succeeded on every case), from a real wedding-day photo series against a Warm Spring profile.

**Critical finding: the export cannot fully exercise `deriveSampleAdvisory`.** `BakeoffExportRun`
(§25's leak-safety allowlist) never included a deterministic `sample` field — by design, only
`result`/`usage`/`review`/etc. So `sample.diagnostics.flags`, the one input the advisory's
`lighting-cast-corroborated` branch depends on, cannot be reconstructed from this file at all. The
other two branches (`target-mismatch`, `sample-unusable`) depend only on the AI's own normalized
result and WERE fully replayable.

**Result for Gemini Flash-Lite** (the current production candidate, all 14 cases): `targetMatched`
was `true` and `sampleAssessment.usable` was `true` in every single case, so the two testable
branches never fired — the advisory was silent (no caveat) on all 14 real cases. The PO's own
review agreed on 13/14 (color rated good/acceptable, never wrong). On the one exception — Case 8,
a beige necktie under warm studio light — the PO rated Flash-Lite's color reading **wrong**, and
the advisory stayed silent. This is not provably a heuristic bug: Flash-Lite's own `lighting.cast`
(`warm`) and `severity` (`medium`) on that case satisfy the corroboration branch's condition
exactly — if the deterministic sampler had flagged that region (plausible for a small, textured,
sheen-prone necktie sample), the advisory as currently written would have caught it. Whether it
actually would have cannot be answered without the missing deterministic flags. The same Case 8
also independently confirms the pre-existing Slice 0.1 lesson (§18): groq self-reported
`targetMatched: true` while sampling the wrong garment entirely, which the PO's review caught and
groq's own confidence score did not — self-reported target/confidence remains diagnostic only.

**Decision: C — evidence insufficient**, specifically for the one branch that matters
(`lighting-cast-corroborated`); the other two branches behaved correctly everywhere they had a
chance to fire (e.g. groq's Case 14 `sampleUsable: false` correctly triggers). No heuristic was
changed — 14 cases with zero real Flash-Lite target-mismatch/unusable events is not a basis to
tune anything, and the one interesting miss (Case 8) is structurally untestable from this export.
**Exact evidence needed**: extend `exportBakeoff.ts`'s allowlist to also carry
`sample.diagnostics` (hex/oklab/flags — already proven safe to export, nothing new to leak-test)
per run, so a future replay of a new PO export can actually exercise the corroboration branch.
Not done in this slice (would be a production code change, out of scope for a C decision).

**Slice 0.3 conclusion**: closed. Final architectural decision — the deterministic classifier
(`matchPhotoColor`/`getSuitability`) remains the sole, unmodified authority over color
classification, palette mapping, and suitability; AI vision evidence may only ever attach a
non-authoritative advisory caveat to an already-computed deterministic result, never alter it;
`null`/failed/timeout AI evidence always collapses to the same no-op as "AI didn't run"; no numeric
RGB/hex/OKLab normalization is ever fabricated from AI's coarse observational bins. Wiring the
advisory into any production UI, and extending the export format to make the corroboration branch
fully testable, are both explicitly deferred to a later slice.

## 33. Slice 0.4 — AI advisory UI prototype (2026-09-25, UX integration, no new AI network call)

Slice 0.3's `deriveSampleAdvisory()` (`{caveat, reasons}`, `domain/photoColor/aiNormalization.ts`)
had no presentation. This slice designs and builds the smallest production-facing UI for it,
without wiring anything to a real AI call. Production photo-checker result flow traced first:
`PhotoCheckerPanel` (mount, tap/keyboard handling) → `PhotoFeedback`
(`photoChecker/PhotoResultCard.tsx`, the result area) → `toPhotoResultView()`
(`photoChecker/photoResult.ts`, engine output → the shared `ColorResultView`) →
`ColorResultSummary`/`ColorResultGuidance` (`colorChecker/ColorResultCard.tsx`, the actual render,
shared with Manual). Production already has an established secondary/advisory tier for photo
quality: `.check-warnings` (amber, from `sample.diagnostics.flags` via `SampleFlag`) and
`.check-info` (quiet gray, the Slice 5f lighting note) — both plain reading-order text below the
placement/pairing guidance, never inside the live-region summary.

**Design**: `ColorResultView` gained one new optional-by-emptiness slot,
`aiAdvisory: { title: string; body: string }[]` (`colorChecker/resultView.ts`) — Photo only, `[]`
for Manual, exactly the same pattern as the existing `warnings`/`info` slots. `toPhotoResultView()`
(`photoChecker/photoResult.ts`) gained a 5th, optional, defaulted parameter,
`advisory: SampleAdvisory | null = null`; when given a real advisory it maps `reasons` through new
copy (`photoChecker.aiAdvisory: Record<SampleAdvisoryReason, {title, body}>`, added to
`i18n/types.ts` + `en.ts`/`th.ts`) — a static per-reason template, never an AI-supplied string, so
it is structurally impossible for this block to surface a competing color name, hex or "AI"
wording. `PhotoFeedback` (`photoChecker/PhotoResultCard.tsx`) gained the same optional
`advisory?: SampleAdvisory | null` prop and threads it through. `ColorResultGuidance`
(`colorChecker/ColorResultCard.tsx`) renders it as a new `.check-advisory` block — one boxed
`.check-advisory-item` per reason (title with a decorative, non-sole `💡` icon + body), placed
after `.check-warnings` and before `.check-info`/`.check-caveat`, styled with its own quiet
soft-blue tint (`styles.css`) so it reads as one more "double-check the photo" note, not a second
engine's opinion competing with the deterministic one. It renders nothing when `aiAdvisory` is `[]`
(no caveat, or `advisory` was never passed) — no empty card, no confidence meter, no AI badge. Not
a live region, matching `.check-info`'s existing convention exactly (accessibility §L: no
unnecessary `aria-live` announcements).

**Production AI boundary**: **no new AI network call**. `PhotoCheckerPanel.tsx` (the only real
mount site) is untouched — confirmed via `git diff` showing zero changes to that file — so it still
never passes an `advisory` prop, meaning `toPhotoResultView`'s default (`null`) always applies in
production today and `aiAdvisory` is always `[]`. The four advisory states (no advisory / lighting
/ sample-unusable / target-mismatch) are exercised only through component props in the test suite
(`PhotoResultCard.test.tsx`, `ColorResultCard.test.tsx`), per plan §I — no permanent production
toggle was added.

**Tests** (all in the existing files, no new test file needed): `PhotoResultCard.test.tsx` gained a
dedicated "AI advisory" describe block — `advisory: null` renders identically (DOM-diffed, ignoring
generated `useId` values) to omitting the prop entirely; a caveat-free advisory renders nothing;
each of the three reasons renders its mapped EN/TH copy; the block sits after the deterministic
result and outside any live region; the icon is `aria-hidden` with the title text still present
alongside it; three reasons firing together render three boxes and never introduce a hex code or
the word "AI"; an advisory never changes the verdict/category/hex of the same match (recommendation
+ color isolation); omitting `advisory` (every current production call) never produces a broken or
empty advisory state, across all five categories. `ColorResultCard.test.tsx`'s shared-card ordering
and "optional slots render only when the source has them" tests were extended to include
`.check-advisory`. `manualResult.ts`/its test were updated for the new required `aiAdvisory: []`
field.

**Verification**: focused suite (`PhotoResultCard.test.tsx`: 80/80,
`ColorResultCard.test.tsx`, `manualResult.test.ts`, `photoLightingGuidance.test.tsx`,
`aiNormalization.test.ts`) green; full suite 67 files / 1860 passed / 1 skipped (was 1850 before
this slice — the +10 are this slice's new tests); `tsc -b --noEmit` clean; `npm run build`
succeeds (bundle legitimately changed this time, unlike 0.3B/0.3C's spike files, because
`ColorResultCard.tsx`/`PhotoResultCard.tsx`/`styles.css` ARE imported into the app — verified
instead by compiling the new `.check-advisory*` CSS rules out of `dist/assets/*.css` and confirming
they match what was written, and by the `advisory: null` DOM-identity test above proving today's
actual render path is unchanged); `git diff --check` clean (pre-existing CRLF warnings only, same
as prior slices).

**Visual verification — honest limitation**: this session has no browser/screenshot tool
available, so "rendered and inspected in an actual browser at mobile/desktop widths" was not
literally done. What was verified instead: (1) DOM structure and render order via jsdom-based
RTL tests, including that `.check-advisory` sits after `.check-warnings`/before `.check-caveat`,
outside the live region, and that omitting/nulling `advisory` reproduces the pre-slice DOM exactly;
(2) the compiled CSS pulled from `dist/assets/*.css` to confirm the new rules parsed and match
source; (3) the existing, unmodified `.photo-layout`/`.check-guidance`/`.check-card` grid rules
that the new block inherits — single-column stack below 900px, two-column (photo | result, min
280px) at ≥900px, `.check-guidance` a 14px-gap vertical grid of full-width blocks — read directly
from the compiled CSS to reason about both breakpoints. This is a narrower guarantee than an actual
screenshot; a later slice (or a manual check by the PO in a real browser) should confirm the visual
read before this prototype is treated as final.

**Architecture verification**: deterministic result remains authoritative — `aiAdvisory` items are
static per-reason template strings with no color/category/suitability field anywhere in their type
(`{title: string; body: string}`), so there is no code path by which this UI could display a second
detected color or change the verdict, category, or hex shown above it (proven by type shape, same
structural argument as Slice 0.3B's `SampleAdvisory`, and confirmed by the "recommendation
isolation"/"no competing color" tests). AI failure remains a no-op: `advisory = null` (every
current caller) yields `aiAdvisory: []` and an unchanged render, identical to before this slice
existed.

**Recommendation: A — the UX contract works, ready for a later production AI invocation slice.**
The advisory renders as one quiet, secondary note under the single deterministic result, never as
a second engine's competing answer; it is invisible whenever there is nothing to say; and nothing
in today's production path calls AI or changes behavior. The one open item before a real invocation
slice is unrelated to this UI: Slice 0.3C's finding that `BakeoffExportRun` (and, by the same gap,
any future logging) cannot currently carry `sample.diagnostics.flags`, so the
`lighting-cast-corroborated` branch stays evidence-light until that's addressed — a data-plumbing
question, not a presentation one.

## 34. Slice 0.4B — AI advisory visual QA preview (2026-09-25, dev-only, no new AI network call)

Slice 0.4 implemented the presentation contract but could not be visually verified in a browser
(§33's honest-limitation note). This slice adds the smallest possible dev-only screen so a real
browser can be pointed at the actual four advisory states.

**Location and reuse.** Extended the existing dev-only screen family in `App.tsx` rather than
inventing new infrastructure: `AiColorLabView` is already reached only via
`import.meta.env.DEV && ?debug=ai`; a second branch, `showAdvisoryPreview`, adds the identical
gate for `?debug=advisory`, rendering a new `src/aiLab/AdvisoryPreview.tsx`. Same file family
(`src/aiLab/`), same CSS file (`aiLab.css`, with four new rules appended for the preview's own
toggle buttons), same never-in-normal-navigation guarantee.

**What it renders.** The real production path, not a mock: `AdvisoryPreview` calls the exact same
`PhotoFeedback` component (`src/photoChecker/PhotoResultCard.tsx`) that `PhotoCheckerPanel` mounts
in production, which internally still goes through `toPhotoResultView` →
`ColorResultSummary`/`ColorResultGuidance` — the identical Slice 0.4 code path, unmodified. No
advisory copy is duplicated in the preview file; it only passes a `{caveat: true, reasons: [...]}`
object shaped exactly like `deriveSampleAdvisory()`'s return value, and the card renders the
existing `en.ts`/`th.ts` copy itself.

**Fixture.** `realMatchFor('warm-spring', 'related')` from
`src/domain/photoColor/realMatchFixtures.ts` — the same TEST-ONLY helper the Slice 0.4 tests
already use, which runs a real curated palette colour through the unchanged sampler + matcher
(`inspectPhotoPoint`), never a hand-built category. This is the one new consumer of that
"TEST-ONLY" helper outside `*.test.ts(x)`; its file comment was updated to record the exception
(dev-only, DEV+query-gated, never a production-facing screen). No second result engine was
invented for the preview.

**Controls.** Four buttons (None / Lighting / Sample / Target) map directly to
`SampleAdvisoryReason` values; an EN/TH toggle exists because `AiColorLabView`'s screen family has
no language control of its own to reuse (it renders `getCopy('en')` only, for one label). No new
localization mechanism — the toggle just switches which existing locale object (`en`/`th`) is
passed to the real card.

**Production isolation.** `PhotoCheckerPanel.tsx` is untouched (confirmed: `AdvisoryPreview` does
not appear in its source). No AI network call is added — `AdvisoryPreview.tsx` contains no
`fetch`/`XMLHttpRequest`/API-client import (asserted by test). The preview fixture cannot leak into
Manual Checker, Photo Checker, or normal navigation: it is a separate branch in `App()`, gated the
same way as the existing `?debug=ai`/`?debug=color` panels, before any quiz/result state is
touched.

**Bundling, reported accurately (not claimed as excluded).** As with the existing `AiColorLabView`
branch, `import.meta.env.DEV` is statically inlined to `false` in the production build, so the
`if (showAdvisoryPreview) return <AdvisoryPreview />` branch never executes at runtime — but a
`grep` of the built `dist/assets/index-*.js` after `vite build` shows the literal strings "AI
Advisory Preview" and "Advisory preview state" ARE present in the shipped JS (count 1 each), same
as "AI Color Lab" / "Model Bake-off" already are for the pre-existing AI Lab screen. The dev-only
code is therefore runtime-inaccessible in production but not bytes-excluded from the bundle — an
existing, already-accepted trade-off in this codebase, not a new one introduced here.

**Tests.** New `src/aiLab/AdvisoryPreview.test.tsx`, 9 tests: renders the real result path
(verdict/category/placement present); defaults to no advisory; each of the three reason buttons
renders the existing EN copy verbatim; toggling back to "None" clears the block; the TH toggle
switches the whole card (advisory included) to Thai; a source-text check confirms the file imports
the real `PhotoFeedback` and does not hand-roll any `check-*` markup or duplicate advisory copy
strings; a source-text check confirms no `fetch`/`XMLHttpRequest`/AI-API-client reference and that
`PhotoCheckerPanel.tsx` never imports this preview. Deliberately does not re-assert the full Slice
0.4 card-rendering behavior already covered by `PhotoResultCard.test.tsx`.

**Verification.** Focused: 9/9 passed. Full suite: 68 files / 1869 passed / 1 skipped (up from
67/1860 before this slice). `tsc -b --noEmit`: clean. `npm run build` (`vite build`): succeeded,
bundle size 498.87 kB JS / 70.12 kB CSS. `git diff --check`: clean after trimming one pre-existing
trailing blank line at the end of this doc file (unrelated to this slice's own edits).

**PO instructions.** Run `npm run dev`, then open `http://localhost:5173/?debug=advisory` (adjust
the port to whatever the dev server prints). Click **None / Lighting / Sample / Target** to switch
the advisory state, and **EN / TH** to switch language. The card shown is the real Photo Checker
result card with a fixed sample match (a Warm Spring "related" colour) — only the advisory block
changes between states.

**Recommendation:** ready for PO visual sign-off. No production behavior, deterministic logic, AI
contract, or advisory heuristic was touched in this slice.

## 35. Slice 0.5A — Deterministic measurement confidence spike (2026-09-25, audit + pure evaluator, no wiring)

**Direction change.** After reviewing Slice 0.4B, the product direction moved away from calling AI
automatically on every sample merely to warn it might disagree, toward: deterministic measurement
first, an explicit user-triggered "✨ ask AI to analyze" fallback only when the deterministic
measurement itself looks unreliable. This slice answers the prerequisite question — can the
deterministic engine tell whether its own photo measurement is trustworthy? — without implementing
any UI or AI fallback.

**Evidence inventory** (`samplePhotoRegion`, `src/domain/photoColor/sampling.ts`):

| signal | what it measures | continuous? | usable for measurement quality? |
| --- | --- | --- | --- |
| `diagnostics.spread` | RMS OKLab distance of retained pixels from the mean — internal heterogeneity of the sampled disc | yes, thresholded at `MIXED_SPREAD` (.045) into the `mixed` flag | **yes** — directly answers "is this evidence internally consistent," independent of what colour it is |
| `diagnostics.highlightFraction` / `shadowFraction` | share of pixels with every channel ≥250 / ≤5 | yes, thresholded at `CLIPPED_FRACTION_WARN` (.35) into `highlight`/`shadow` | **caveated** — see below |
| `regionPixelCount` / `opaquePixelCount` / `retainedPixelCount` | population size and how much transparency/trimming removed | yes, but trim is a fixed 20% whenever a sample succeeds, so the retained/opaque ratio carries no extra information beyond `opaquePixelCount` itself | limited — mainly gates the separate `insufficient-pixels`/`transparent` unavailable outcomes, not a graded quality signal |
| `matchPhotoColor()`'s `nearest.distance` (palette distance) | how close the sample sits to a curated colour | yes | **no for measurement quality** — see §I below; this is a classification-ambiguity signal, not a measurement-quality one |

No signal is discarded-but-useful that isn't already in `SampleDiagnostics`; the sampler already
exposes everything it computes.

**Diagnostic flag audit** (`mixed` / `highlight` / `shadow`):

- `mixed` (from `spread`): triggers on real heterogeneity — two-colour stripes, garment/background
  boundaries, high-contrast checks — and, per the existing test suite
  (`sampling.test.ts`), does **not** trigger on benign texture, sensor-noise-like variation, knit
  shading, or a thin trimmed-away pinstripe. This is well-evidenced, real measurement-quality
  evidence: it answers exactly "is the sampled disc internally consistent," with no dependency on
  what colour the fabric actually is.
- `highlight` / `shadow` (from channel-extreme fraction): designed to catch camera clipping/
  crushed-black exposure, and the sampler's own comment already guards against one false positive
  (a single saturated channel, e.g. pure red fabric, is not flagged). But auditing the actual
  threshold (`HIGHLIGHT_CHANNEL_MIN=250`, `SHADOW_CHANNEL_MAX=5`) against this slice's own new
  tests (`measurementQuality.test.ts`) shows a **real, unfixed false positive**: a perfectly
  uniform, zero-spread sample of literal `#FFFFFF` or near-`#000000` still trips the flag, because
  the threshold only looks at channel extremity, not at whether the extremity comes with any of the
  noise/heterogeneity that real clipping produces. In practice, a correctly-exposed photo of a real
  light/dark garment rarely lands exactly at the channel ceiling/floor (confirmed: curated palette
  colours like `#F5E6D3` and realistic dark fabrics like `#141414` are never flagged), so this is a
  narrow edge case rather than a everyday problem — but it means `highlight`/`shadow`, unlike
  `mixed`, cannot be asserted as pure measurement-quality evidence without this caveat.
- All three flags are binary only because the UI currently needs a binary warning; the underlying
  values (`spread`, `highlightFraction`, `shadowFraction`) are already continuous and already in
  `SampleDiagnostics` — no new computation would be needed to grade them, only a second threshold,
  which does not currently exist and would need new calibration.
- They are not equally trustworthy: `mixed` is the strongest, cleanest measurement-quality evidence
  available; `highlight`/`shadow` are directionally right but demonstrably imperfect.
- **These flags are already shown to the user in production** — `en.photoChecker.warnings.{mixed,
  highlight,shadow}` (`src/i18n/en.ts:135-139`), rendered via `ColorResultCard`'s `.check-warnings`,
  alongside the full result (category, placement, pairings still shown; nothing is hidden). This is
  worth stating plainly: a "retry-flavoured" signal already exists and already ships — what's new in
  the target UX is only the "✨ ask AI" affordance and (possibly) a stricter, blocking `retry` tier,
  neither of which exists today.

**Measurement quality vs. classification confidence.** `matchPhotoColor()`'s `nearest.distance` (how
close the sample sits to the closest palette colour) is a real, useful signal — but for a different
question: "how easily could this sample be misclassified," not "was this a clean measurement." A
sample can be a perfect, zero-spread measurement of a colour that happens to sit exactly between two
palette references (high classification ambiguity, high measurement quality), and equally a sample
can be a noisy, mixed-region measurement that still happens to land close to a palette colour by
coincidence (low measurement quality, low apparent classification ambiguity). Conflating the two —
"the engine is confident because its answer resembles its own taxonomy" — is exactly the circularity
the spike brief warns against, and this audit did not build any evaluator that touches palette
distance. `docs/V2_AI_COLOR_LAB.md §31`'s existing `suggestsAiAssist()` (`aiNormalization.ts`) mixes
the two: its `ambiguous-neutral` and `extreme-lightness` signals are classification-difficulty
signals (a near-neutral or very light/dark colour is more likely to have a near-tie between palette
candidates), not measurement-quality signals — and critically, `extreme-lightness` is proven by its
own existing test (`aiNormalization.test.ts`, "flags extreme lightness for near-white/near-black") to
trigger on exactly the clean, uniform near-white/near-black samples that this slice's brief (Case
2/3) says must **not** be treated as low-confidence measurements. `suggestsAiAssist()` is therefore
not reusable as-is for measurement-quality gating; it answers a related but genuinely different
question and should stay separate (or be relabeled) rather than repurposed.

**Percentage-confidence decision: No.** No calibration data exists connecting any current signal to
an actual correctness rate (no ground truth of "was the deterministic answer right" has ever been
collected), so a number like "82%" would carry no real statistical meaning — it would be fake
precision. The evidence does support unweighted, binary issue detection (a flag fired or it didn't),
not a calibrated score.

**Proposed contract (implemented, Option 4 — reasons only).** `src/domain/photoColor/measurementQuality.ts`:

```ts
export interface MeasurementQuality { issues: SampleFlag[] }
export function assessPhotoMeasurement(sample: PhotoColorSample): MeasurementQuality {
  return { issues: sample.diagnostics.flags }
}
```

No `state` field (`reliable`/`caution`/`retry`) and no numeric score: only one threshold exists per
underlying signal, so a defensible second or third tier cannot be built without inventing new,
uncalibrated thresholds, which the brief explicitly rules out. `issues` is exactly
`sample.diagnostics.flags`, carried through unchanged — the function adds a stable, tested, named
seam for a future gating slice to import, without adding any new computation, threshold, or
vocabulary. It is pure, deterministic, makes no network calls, and structurally cannot see subtype,
category, palette distance, or suitability (verified by both its own type signature and a
module-boundary test).

**Tests** (`measurementQuality.test.ts`, 10/10 passing, against the real sampler via
`inspectHex`/`solidImage`/`realMatchFor`): clean uniform fabric not penalized; realistic clean
near-black not penalized; realistic clean near-white not penalized; **documented** literal
sensor-saturated white still trips `highlight` (the known limitation above, asserted rather than
hidden); mixed boundary sample degraded; shadow/highlight surfaced unchanged from the sampler's own
semantics; low-chroma neutral not penalized; a clean sample in the "outside" (far-from-palette)
category not penalized, proving independence from palette distance; deterministic on repeat calls;
module-boundary test proving no import of `photoMatch`/`suitability`/palette/subtype/AI.

**Relationship to Slice 0.3/0.4.** `deriveSampleAdvisory()` and `SampleAdvisory` (0.3B/0.4) answer a
different question — "does an AI opinion, once obtained, corroborate or contradict this
deterministic result" — and stay relevant unchanged if/when a later slice lets the user request AI
fallback and wants to annotate its result. They are not replaced by `assessPhotoMeasurement()`, which
answers "should the AI fallback option even be offered" and runs *before* any AI call, using only
already-computed deterministic diagnostics. `suggestsAiAssist()` (0.3B), however, should be treated
as likely obsolete under the new direction: it was written as a candidate *AI-call-worthy* signal set
that conflates measurement quality with classification ambiguity (see above), predates the explicit
"AI is user-requested, never automatic" decision, and is not called from anywhere in the app. A later
integration slice should decide whether to delete it, split it into two honestly-named concepts, or
fold its classification-ambiguity half into a separate, explicitly-named signal — but that decision
is out of scope here and nothing was deleted or refactored in this spike.

**Future gating (not implemented).** The deterministic evidence that exists today already supports a
narrow, non-numeric gate: `assessPhotoMeasurement(sample).issues.length === 0` → nothing new to show
beyond today's behavior; `.length > 0` → the existing warning copy already fires today, and *could*
additionally surface a later slice's "✨ ask AI to analyze" affordance next to it. What the evidence
does **not** support yet is a hard `retry` tier that hides or blocks the deterministic result:
nothing audited in this slice justifies suppressing a result that today is still shown (with a
warning) even when flagged. Whether `caution` and `retry` should be the same tier, and whether
`highlight`/`shadow`'s known false-positive caveat is acceptable for gating an optional AI button
(lower stakes than gating the whole result), are UX/policy decisions for a later integration slice,
not evidence questions this spike can resolve.

**Decision: B — existing evidence supports only limited issue detection.** Use the existing, already
partly-shipped binary reasons (`mixed`/`highlight`/`shadow`, now also available through
`assessPhotoMeasurement()`) rather than a calibrated multi-level confidence system. `mixed` is
strong, well-evidenced measurement-quality evidence; `highlight`/`shadow` are directionally useful
but carry a documented, unfixed false-positive edge case; no signal in the codebase supports a
defensible three-tier `reliable`/`caution`/`retry` ladder or any numeric score without inventing new,
uncalibrated thresholds.

**Verification.** Focused: 10/10 passed. Full suite: 69 files / 1879 passed / 1 skipped (up from
68/1869 before this slice). `tsc -b --noEmit`: clean. `npm run build` (`vite build`): succeeded,
identical bundle size (498.87 kB JS / 70.12 kB CSS) — the new module is not imported by any
production-reachable path. `git diff --check`: clean (only pre-existing LF/CRLF advisories).

## 36. Slice 0.5B — Explicit AI fallback result contract spike (2026-09-25, audit + pure resolver, no wiring)

**Question.** If AI says a garment looks like "Warm Cream," how does that become a Personal Color
suitability verdict without inventing a second classification system? Traced the deterministic path
(`PhotoColorSample → matchPhotoColor() → category → getSuitability() → ColorResultView`) and the
current AI contract (`NormalizedAiColorResult`, `api/_lib/prompt.ts`) to answer this before any UI or
network work.

**Deterministic taxonomy.** `getSuitability()` (`suitability.ts`) is a fixed 1:1 relabelling of
`PhotoMatchCategory` — nothing is computed there. `PhotoMatchCategory` itself comes ONLY from
`matchPhotoColor()`'s OKLab-distance comparison against the user's curated palette
(`getPalette(subtype)`, ~22 named `PaletteColor { id, name, hex }` entries per subtype across
best/accents/neutrals/harder). There is no path to a category, and therefore no path to a
suitability verdict, without either (a) a real OKLab point to measure a distance from, or (b)
directly selecting one of the existing canonical colors (whose distance to itself is trivially 0).

**AI semantic compatibility.** `perceivedColorName` and `colorFamily` are freeform strings (not
enums); `temperature`/`value`/`chroma` are coarse 4-value enums (incl. `uncertain`) with **no
existing resolver anywhere in the repo** mapping them to a canonical category — the only comparable
structure, `DimensionVector` (`temperature/value/chroma/contrast`, continuous 0–1) in
`seasons.ts`, scores the USER's own quiz answers against a subtype target, an entirely different
system from matching a garment color. Building a bins→category resolver would mean authoring a new,
uncalibrated mapping table from nothing, which the brief explicitly rules out. Canonical colour names
like "Warm Cream" DO exist verbatim in the data (`deep-autumn.neutrals`), but only for that one
subtype/hex pair (`#E9D8B7`) — a different subtype's cream is named "Cream" (`warm-spring`, `#FFF0CF`)
or "Warm Ivory" (`light-spring`), so even exact-string name matching cannot uniquely resolve a
canonical color across subtypes without an equally uncalibrated lookup.

**Strategy comparison.**
- **Option 1** (AI's free semantic result becomes authoritative) — rejected: would require a
  second, AI-only suitability system, since nothing in the app can turn "Warm Cream / warm / light /
  muted" into a `Suitability` without a resolver that doesn't exist.
- **Option 2** (AI selects a canonical color ID from the app's own palette) — **strategically
  favoured**. Existing `getPalette()` colors already have stable `id`/`name`/`hex`; a closed-set
  choice among ~22 options is a small, well-defined forced-choice problem, and resolution needs
  zero new suitability logic (see prototype below). Trade-off: loses AI's free descriptive
  expressiveness, and today's prompt (`api/_lib/prompt.ts`) does not send the palette or ask for an
  ID — that is new prompt surface, not something already proven live.
- **Option 3** (map AI's temperature/value/chroma bins to a category via a resolver) — rejected for
  now: no evidence in the repo that such a resolver can be built without inventing arbitrary bin
  boundaries; the 14-case bakeoff replay (below) shows the *same* perceived colour landing in
  different suitability-relevant zones across candidates, which is exactly the ambiguity a resolver
  would have to arbitrate with no calibration data to do it honestly.
- **Option 4** (AI returns semantic result + suitability directly) — rejected: creates a second
  classification authority whose verdicts, per the bakeoff replay, are NOT a stable function even of
  AI's own reported dimensions (case 6: four candidates describing essentially the same warm beige
  color returned `recommended`/`workable`/`more_considered`/`recommended`) — the risk section E asked
  to evaluate is real and evidenced, not hypothetical.
- **Option 5** (hybrid: AI observation → resolver → suitability only if uniquely resolvable) —
  collapses to Option 2 once you accept Option 3's resolver isn't buildable today: the only
  currently-resolvable case is "AI names/selects an existing canonical color."

**Bakeoff evidence (Gemini Flash-Lite, all 14 cases, replayed offline from
`tmp/ai-color-bakeoff-1790321320793.json`, no new API calls).** All 14 `targetAssessment` calls were
human-reviewed "correct"; `color` review was "good"/"acceptable" on 13/14 and "wrong" on exactly one
— **case 8**, a warm ivory/beige/white garment, where all four candidates disagreed
(`champagne beige`/`Warm Beige`/`warm ivory light beige`/`White`, `family` = beige/beige/ivory-beige/
white) and 3 of 4 candidates' `color` review was "wrong" (one also failed `target`). This is exactly
the cream/ivory/beige/white boundary the brief flagged as high-risk, and it is where the deterministic
sampler ALSO already struggles (`docs/V2_AI_COLOR_LAB.md` prior slices; see the `groq` "Light Blue
Gray" cast-lighting example logged in this same file). `confidence` was `"high"` on **all 14 of 14**
Gemini Flash-Lite cases, including case 8's incorrect one — see next section. `colorFamily` is
demonstrably noisy free text even within one candidate's own high-confidence answers: casing is
inconsistent (`"white"` vs `"White"`), and one `groq` run filed a literal "Cream" perceived color
under `family: "orange"` — unusable as a lookup key without normalization work this spike was told
not to invent.

**AI confidence semantics.** `api/_lib/prompt.ts`'s `CANONICAL_INSTRUCTION` never once explains what
`confidence` should measure — it appears only in the trailing JSON shape with no scope (target?
color? lighting? suitability? overall?). The bakeoff replay shows the practical consequence: across
14 diverse real Flash-Lite cases spanning easy (pure red) and hard (case 8) targets alike, the field
took exactly one value, `"high"`, zero times discriminating a later-reviewed-wrong answer from a
correct one. Current `confidence` is not usable as a gating signal for anything, and — consistent
with Slice 0.5A's percentage-confidence finding — must not be treated as calibrated. Splitting it
into `targetConfidence`/`colorConfidence` is not recommended from this evidence: the problem observed
is that the single field doesn't discriminate at all, not that it conflates two dimensions that
individually would.

**Recommended contract (prototype implemented, Option 2's resolution half only).**
`src/domain/photoColor/aiFallback.ts`:

```ts
export type ColorResultSource = 'deterministic' | 'ai-fallback'
export interface AiFallbackSelection { subtype: Subtype; colorId: string }
export interface AiFallbackResult {
  source: 'ai-fallback'; subtype: Subtype; color: PaletteColor; group: PositivePaletteGroup | 'harder'
  category: PhotoMatchCategory; suitability: Suitability; pairWith: PaletteColor[]
}
export type AiFallbackResolution = { ok: true; result: AiFallbackResult } | { ok: false; reason: 'unknown-color-id' }
export function resolveAiFallbackSelection(selection: AiFallbackSelection): AiFallbackResolution
export function attemptAiFallback(input: AiFallbackAttemptInput): AiFallbackAttemptOutcome // single terminal step, see §10 below
```

`colorId` is what a FUTURE, narrow prompt revision would need to add to `NormalizedAiColorResult` —
this spike does not touch the prompt, the request contract, or any provider. The resolver takes a
group (best/accents/neutrals/harder) straight from which palette array the id was found in, and
derives the category structurally (best/accents → `near-face`, neutrals → `neutral-base`, harder →
`away-from-face`) — no distance is computed, none is needed, because a canonical color's distance to
itself is 0. `getSuitability()` and `pairingSuggestions()` are called completely unmodified.

**Suitability ownership.** After a successful AI fallback, suitability is determined by the exact
same, unmodified `getSuitability(category)` the deterministic path uses — from the category implied
by which palette group AI's selected color belongs to, never from AI's own `suitability` field
(`AiSuitabilityVerdict`), which is deliberately never read by this resolver. This was proven, not just
argued: a test sweeps **every canonical color in every subtype** (all ~260) through
`resolveAiFallbackSelection` and independently through the real `inspectHex → matchPhotoColor` path,
asserting the two category values are identical every time — see Tests below.

**Result replacement semantics: (C/D) — a complete alternative result object, in the existing
canonical representation.** Not (A) color-description-only (there is no separate "description" slot
to replace — category and suitability follow from the very same selection). Not (B) reusing
deterministic suitability (there is no deterministic result to reuse when the user chose AI because
the deterministic measurement was the problem). `AiFallbackResult` deliberately shares its
`category`/`suitability`/`pairWith` field shapes with the deterministic `PhotoColorMatch` model
(same `Suitability`, `PhotoMatchCategory`, `PaletteColor[]` types) rather than being a parallel
result shape — the smallest honest difference is the `source` tag and the absence of
`difference`/`direction`/`descriptors` (which describe how a MEASURED point differs from its
nearest match; meaningless when the color IS the match, distance 0).

**Failure/terminal states (§I, one step, no retry loop).** `attemptAiFallback()` takes the three facts
a gating slice already has (provider call ok/not, `targetMatched`, `sampleUsable`) plus a hypothetical
`colorId`, and resolves ONCE: provider failure → `terminal: 'provider-failed'`; `targetMatched ===
false` → `terminal: 'target-mismatch'`; `sampleUsable === false` → `terminal: 'sample-unusable'`;
missing or unrecognized `colorId` → `terminal: 'unknown-color-id'`. No branch calls AI again or calls
itself again (verified by a source-text test). All four terminal reasons map to the same conceptual
UI outcome the brief sketched: "AI couldn't confidently analyze this item" + [select another area] /
[choose another photo] — exact wording is a later UI slice's decision, not made here.

**Provenance.** `AiFallbackResult.source` is a literal `'ai-fallback'`, never `'deterministic'` — the
two are structurally different result shapes (`AiFallbackResult` vs `PhotoColorMatch`), not a shared
object with a mutable tag, so accidental mixing (deterministic color + AI suitability, or vice versa)
is not constructible without deliberately writing new code to do it.

**Slice 0.3/0.4 disposition:**
- `AiColorNormalization`/`toAiColorNormalization` — **repurpose**. Still the right boundary for
  *observational* AI fields, but `suitability`/`reasoning` are already excluded from it (Slice 0.3B
  design), which is now additionally justified: AI's own suitability must never reach a fallback
  result per the ownership finding above.
- `deriveSampleAdvisory()` / `SampleAdvisory` — **keep**. Answers a different, still-relevant
  question (does an AI opinion corroborate a DETERMINISTIC result the app is still showing), separate
  from what happens once the user explicitly requests AI fallback.
- `ColorResultView.aiAdvisory` / `AdvisoryPreview` — **keep**, same reasoning; no UI decision here
  should touch them.
- `suggestsAiAssist()` — **likely obsolete** (flagged already in Slice 0.5A §35): predates
  user-requested-only AI, conflates measurement quality with classification ambiguity, called from
  nowhere.

**Tests** (`aiFallback.test.ts`, 14/14 passing): successful best/neutrals/harder selections resolve to
the correct category/suitability; the resolved color is the exact palette object (identity-equal, not
a re-derived copy); an unknown/hallucinated `colorId` fails safely (`ok: false`, no throw); the
category-parity sweep across all ~260 canonical colors in all 12 subtypes against the real
`inspectHex`/`matchPhotoColor` path; a clean `attemptAiFallback` success; provider failure, target
mismatch, unusable sample, missing colorId, and hallucinated colorId are each terminal without
attempting resolution; a source-text check that `attemptAiFallback` contains no loop, no recursive
call, and no `fetch`; a module-boundary check that the file never imports the sampler/matcher and
never calls `rgbToOklab`/`hexToOklab` (no fabricated numeric color).

**Verification.** Focused: 14/14 passed. Full suite: 70 files / 1893 passed / 1 skipped (up from
69/1879 before this slice). `tsc -b --noEmit`: clean. `npm run build` (`vite build`): succeeded,
identical bundle size (498.87 kB JS / 70.12 kB CSS) — neither new module is imported by any
production-reachable path. `git diff --check`: clean (only pre-existing LF/CRLF advisories).

**Decision: C — current AI semantic contract is insufficient, but the needed revision is narrow and
already identified.** Options 1/3/4 all require either an uncalibrated new mapping table or a second
suitability authority whose real-world instability the bakeoff replay demonstrates directly (case 6,
case 8). Option 2 resolves cleanly into the existing canonical model with zero new suitability logic
— proven by the category-parity sweep — but requires the AI response contract to gain a
palette-aware `colorId` selection field and the prompt to be given the user's own canonical palette,
neither of which exists yet and neither of which was touched in this spike (scope guard: no prompt
tuning, no contract changes, no API calls). A future integration slice should implement exactly that
narrow revision — not a broader one — before wiring any explicit AI fallback button to production.

## 37. Slice 0.5C — Canonical palette AI selection contract + AI Lab validation (2026-09-25, contract + resolver + AI Lab wiring, no production wiring)

**Question.** Slice 0.5B concluded that AI should select a canonical `colorId` from the user's own
subtype palette rather than describing a color freely, and prototyped the resolution half
(`aiFallback.ts`) using a hypothetical field. This slice builds the missing half — the actual
request/response contract, prompt, and AI Lab wiring needed to ask "can AI reliably choose a
`colorId` from the real palette?" — as an experimental AI-Lab-only task, never wired to production
Photo Checker.

**Canonical palette identity audit (§B).** `PaletteColor.id` (`palettes.ts`:
`` `${subtype}-${category}-${index+1}` ``, e.g. `warm-spring-best-3`) already exists and is a stable
identifier — no new ID scheme was invented. Proved computationally, not just by inspection
(`paletteIdentity.test.ts`, run against the real seed data for all 12 subtypes): every colorId is
unique within its own subtype, unique across the ENTIRE app (subtype-namespaced), and — as an
informational finding, not a requirement, since colorId is the only identity AI is ever given —
names and hex values are *also* already unique within every subtype's own palette, so no accidental
same-subtype collision exists even at the name/hex level.

**New AI fallback request contract** (`src/domain/aiColorLab/paletteContract.ts`):
```ts
export interface AiPaletteCandidate { colorId: string; name: string; hex: string } // no group, no suitability (§H)
export interface AiPaletteSelectionRequest { imageDataUrl: string; subtype: Subtype; palette: AiPaletteCandidate[] }
```
Deliberately a SEPARATE contract from `contract.ts`'s free-form `AiColorAnalysisRequest` (§C) — this
is closed-set color identification, not open-ended description, and the two request shapes need
different fields (a palette list vs. none) and different anti-bias instructions.

**New AI fallback response contract** (same file):
```ts
export const PALETTE_SELECTION_STATUSES = ['selected', 'uncertain', 'target-mismatch', 'unusable'] as const
export type AiPaletteSelectionResult =
  | { status: 'selected'; colorId: string; target: { objectType: string; objectDescription: string }; reasoning: string }
  | { status: 'uncertain' | 'target-mismatch' | 'unusable'; target: {...} | null; reasoning: string }
```
Only `'selected'` can structurally carry a `colorId` (§E: "no valid selection is better than a
confidently fabricated forced choice") — a non-selected status carrying one is a TypeScript type
error, not just a runtime check, and the server-side validator (`validatePaletteSelection.ts`)
rejects it defensively anyway since the model output is untrusted JSON, not a typed value. No
confidence field (§F, Option 1): Slice 0.5B's bakeoff replay showed the old `confidence` field was
`"high"` on 14/14 real cases including the one known-wrong answer — zero discriminative power — so
`status` itself (`selected` vs `uncertain`) is the decision boundary, not a resurrected confidence
score with no evidence it would behave any differently here. Provider/network/malformed-response
failures stay transport failures (`AiPaletteApiOutcome`, reusing `contract.ts`'s existing
`AiErrorInfo`/`AiUsage`), never a model semantic state.

**Deterministic-context decision (§D): Strategy A — independent.** The request sent to AI carries
only the marked photo, subtype, and candidate list — deliberately NOT the deterministic sample's
hex/rgb/colorName/flags. Rationale: the product intent this slice is built for is "the deterministic
measurement may be unreliable; inspect the image context and help me choose" — sending AI the very
measurement the user is asking it to reconsider risks anchoring it toward repeating that measurement
instead of judging the image independently. No evidence in this repo suggests Strategy B (informed)
would perform better, and §D's own instruction is to prefer independence absent such evidence. The
validation EXPORT (below) still records the deterministic sample/diagnostics for human review context
— that is a reviewer-facing record, not something sent to the model (§N).

**Prompt design** (`api/_lib/palettePrompt.ts`, `buildPaletteSelectionPrompt`). Reuses the existing
target-marker convention (bright ring + dot burned into the image, `imageEncode.ts`, unchanged) but
is otherwise a dedicated instruction, never sharing text with `CANONICAL_INSTRUCTION`. Anti-bias
constraints, stated explicitly and repeatedly (§G): choose based ONLY on perceived color identity,
never on which candidate would look best on this person; never invent a color outside the supplied
list; never return a hex/RGB/OKLab correction; never judge suitability. Category/suitability group
labels (`best`/`accents`/`neutrals`/`harder`) are deliberately never sent (§H) — only
`colorId`/`name`/`hex` per candidate — so nothing in the prompt lets the model infer which answer is
"the flattering one."

**Resolver integration (§I)** (`src/domain/photoColor/aiPaletteFallback.ts`,
`resolvePaletteSelectionResult`): a thin function feeding a `'selected'` result's `colorId` straight
into Slice 0.5B's UNCHANGED `resolveAiFallbackSelection()` — no new suitability logic, no
bins→category mapping, no AI suitability. Every non-`'selected'` status maps to `{ kind:
'no-replacement' }` (§Q): the deterministic result, if any, is never touched.

**AI Lab workflow (§J).** Extends the existing `?debug=ai` AI Lab (`AiColorLabView.tsx`) rather than
building new debug architecture: choose/tap a photo and sample point exactly as for the existing
bake-off, then a new "Canonical palette selection (Gemini Flash-Lite)" card appears alongside the
four free-form candidate cards with its own "Run canonical palette selection" button (only enabled
once a saved subtype and sample point exist). On success it shows status, the resolved canonical
color's swatch/name/hex, resolved category/suitability (explicitly labeled as coming from the app's
own `getSuitability()`, never AI), reasoning, a PO review control (target/color/note, mirroring the
existing bake-off's review pattern), and a debug JSON panel. A separate "Export palette-selection
validation" button (only shown once at least one run exists) downloads a JSON file
(`exportPaletteValidation.ts`) with one record per run: deterministic sample context (hex/name/flags,
recorded for review only, never sent to AI), AI status/reasoning, resolved color/category/suitability,
latency, and the PO's review — never the image itself.

**Validation evidence (§L, §9) — automated contract tests only; no real AI/photo validation was
performed in this environment.** This coding environment has no browser, camera, or existing garment
photo file to drive the AI Lab UI end-to-end (checked: the repository's only image assets are app
icons/splash screens and personal-color palette reference swatches — no real garment photographs).
`.env` does have a real `GEMINI_API_KEY` configured locally, so the endpoint IS callable, but calling
it without a real photo would only prove the transport works, not that canonical selection is
reliable — that would misrepresent automated plumbing tests as real validation, which §9 explicitly
warns against ("do not claim real validation if the environment could not perform it"). What WAS
verified automatically: the full request/response contract, prompt construction, server-side request
validation, response validation (including all six required rejection cases from §S), the resolver
integration, and the AI Lab wiring compiling and rendering correctly. Real-photo validation — the six
priority cases from §L (white/off-white under cool/mixed lighting, cream/ivory, warm/cool pink
disagreement, near-black, beige, and the original problematic case 8 image if it can be reproduced) —
must be run manually by the PO through the AI Lab UI, exactly as §L's own fallback anticipates.

**Failure/escape-hatch behavior (§Q).** `selected` → resolves through `resolveAiFallbackSelection()`
to a complete result. `uncertain` / `target-mismatch` / `unusable` → no replacement result; the
deterministic result, if any, stays untouched — verified by `aiPaletteFallback.test.ts`. Provider
failure, timeout, or a malformed/invalid response are all surfaced as `ok: false` transport failures
by `paletteHandler.ts` (mirrors `handler.ts`'s not-configured/timeout/internal handling exactly) —
never retried automatically, never a model semantic state.

**Old-field disposition (§T).**
- `perceivedColorName`/`colorFamily` — still useful for free-form AI Lab (kept there, untouched);
  not needed for the closed-set fallback task at all (the new contract has no equivalent field).
- `temperature`/`value`/`chroma`/`lighting` — still useful for free-form AI Lab and fallback
  DIAGNOSTICS (visible in the free-form cards a PO can compare against); not part of the new
  fallback result itself.
- `sampleAssessment` — superseded for the fallback task by the new contract's own
  `target-mismatch`/`unusable` statuses, which serve the same purpose in the closed-set task.
- `suitability` (AI's own) — **should never reach a production fallback path** (confirmed again this
  slice: the new contract has no such field, and the resolver never reads one even if it existed
  elsewhere on the free-form result).
- `confidence` — **not needed for fallback** (§F, Option 1 chosen; see above); still shown as-is in
  free-form AI Lab cards since removing it there is out of scope for this slice.

**Files changed:** `src/domain/aiColorLab/paletteContract.ts` (new contract), `api/_lib/palettePrompt.ts`
(prompt), `api/_lib/validatePaletteSelection.ts` (response validator), `api/_lib/validatePaletteRequest.ts`
(request validator), `api/_lib/providers/geminiPalette.ts` (dedicated minimal adapter, Gemini
Flash-Lite only), `api/_lib/paletteHandler.ts` (route handler), `api/ai-palette/gemini-flash-lite.ts`
(Vercel-style function file), `api/devServer.ts` (dev-server route wiring, edited),
`src/domain/photoColor/aiPaletteFallback.ts` (resolver integration),
`src/domain/personalColor/paletteIdentity.test.ts` (identity audit), `src/aiLab/aiPaletteApi.ts`
(client fetch), `src/aiLab/buildPaletteRequest.ts` (request builder), `src/aiLab/paletteSelectionState.ts`
(reducer), `src/aiLab/PaletteSelectionCard.tsx` (UI), `src/aiLab/exportPaletteValidation.ts` (export),
`src/aiLab/AiColorLabView.tsx` (wiring, edited), `tsconfig.node.json` (added `seasons.ts` to the
node project's include list, edited), `api/_lib/security.test.ts` (widened the "one entry point per
adapter" check to recognize `paletteHandler.ts` as a second legitimate entry point, edited).

**Tests / build.** New focused tests: 39/39 passed across `paletteIdentity.test.ts`,
`validatePaletteSelection.test.ts`, `validatePaletteRequest.test.ts`, `paletteHandler.test.ts`,
`buildPaletteRequest.test.ts`, `aiPaletteFallback.test.ts` — covering every §S requirement (palette
scoped to the active subtype only, unambiguous identity, no group/suitability leak into the AI choice
list, valid selection resolves through 0.5B, unknown/invented colorId rejected, non-selected status
carrying a colorId rejected, missing status rejected, `selected` without colorId rejected,
uncertain/target-mismatch/unusable all produce no replacement result, provider failure/timeout/crash
all contained without leaking, no RGB/HEX/OKLab fabrication, no sampler/matcher import). Full suite:
**76 files / 1932 passed / 1 skipped** (up from 75/1893 before this slice; one pre-existing security
test was updated, not weakened, to recognize the second legitimate handler entry point — see Files
changed). `tsc -b --noEmit`: clean. `vite build`: succeeded — **507.52 kB JS / 70.12 kB CSS**, up from
498.87 kB/70.12 kB. Unlike 0.5A/0.5B (pure spikes wired into nothing), this slice deliberately wires
new code into `AiColorLabView.tsx`, which IS part of the production JS bundle already (the whole AI
Lab, including the existing 4-candidate bake-off, ships in the bundle and is gated at RUNTIME by
`import.meta.env.DEV && ?debug=ai`, not by code-splitting) — the ~8.6 kB increase is the expected,
proportionate cost of the new AI Lab card, table-driven state, and export code, not evidence of
anything reaching production. `git diff --check`: clean (only pre-existing LF/CRLF advisories).

**Production isolation (§R).** Confirmed by grep: no file under `src/photoChecker/` references
`aiPaletteApi`, `aiColorLabApi`, `aiFallback`, `aiPaletteFallback`, `paletteContract`, or any
`/api/ai-color/` or `/api/ai-palette/` path. `PhotoCheckerPanel` makes no new AI request. The new
`/api/ai-palette/gemini-flash-lite` route only exists behind the same dev-server middleware and
Vercel-style function file pattern as the existing AI Lab routes — reachable only from the AI Lab UI,
itself only reachable via `?debug=ai` in a dev build (`import.meta.env.DEV`).

**Decision: B — the contract is structurally sound but needs more PO real-photo validation; keep it
in AI Lab.** Every automated guarantee this slice CAN prove — contract shape, closed-set enforcement,
anti-bias prompt constraints, resolver correctness, escape-hatch behavior, production isolation — is
proven and passing. What remains unproven is the one thing that actually matters for a fallback
feature: whether Gemini Flash-Lite, given a real ambiguous photo (cream/ivory/beige/white being the
exact boundary Slice 0.5B's bakeoff replay showed it struggling with in free-form mode) and a closed
list of ~22 subtype colors, reliably picks a defensible one or honestly declines. This environment had
no real garment photo to test that with. The PO should run the six priority validation cases from §L
manually through the AI Lab's new card before this graduates toward a narrow production
explicit-fallback integration slice (Decision A territory) — or, if closed-set selection turns out to
still force bad choices on the hard boundary cases, before concluding Decision C and revisiting the
fallback strategy instead.

## 38. Slice 0.5D — Production explicit AI fallback integration (2026-09-25, wired into the real Photo Checker, still user-invoked only)

**Gate.** The PO's own real-photo validation of Slice 0.5C's canonical-palette task (~10 runs across
cream/off-white, beige/taupe, navy/denim, pink, red, a deliberate target mismatch, and palette
reference material) found multiple `Good`, two `Acceptable`, no PO-reviewed `Wrong` canonical
selections, and correct real `target-mismatch`/`uncertain` behavior. That result is the explicit
authorization for this slice: promote the already-validated canonical-selection contract from AI
Lab-only into a real, explicit, user-invoked action inside the production Photo Checker. The prompt
itself was **not** re-tuned based on those runs (plan §AD forbids it) — this slice is UX integration
of the exact contract §37 already validated.

**Product flow.** Unchanged deterministic-first behavior, plus one new explicit step:

```
tap garment → immediate on-device deterministic result (unchanged, no network)
                        ↓
           "✨ Ask AI to analyze" (always available; more prominent near a measurement warning)
                        ↓ (only on click)
              AI analyzes (Gemini Flash-Lite, same 0.5C contract/adapter)
                        ↓
        selected            uncertain / target-mismatch / unusable / provider failure
           ↓                              ↓
  AI result becomes primary      deterministic result stays untouched, explains why
  (deterministic result kept
   internally, not shown)
```

AI **never** runs automatically — not on point selection, not because a measurement flag (`mixed`/
`highlight`/`shadow`) fired, not on a timer. `assessPhotoMeasurement()` (Slice 0.5A) only changes the
action's visual prominence (a CSS modifier class), never whether or when it fires. The action stays
manually available even with **no** measurement issue at all: the PO's own 0.5C validation showed AI
corrections on clean samples too (e.g. a light-gray sample AI identified as the subtype's actual
cream), so hiding it on a "clean" deterministic read would have hidden exactly the useful case.

**Integration boundary.** The smallest boundary that keeps `matchPhotoColor()`, the sampler, the
palette definitions and `getSuitability()` completely untouched: a second, independent
`useReducer` (`aiFallbackState.ts`'s `aiPhotoFallbackReducer`) inside `PhotoCheckerPanel.tsx`,
alongside the existing deterministic `photoPanelReducer` — never merged into it. `runAi()` builds
the request with the *same* `buildPaletteSelectionRequest()`/`callPaletteSelection()` AI Lab already
validated (imported from `src/aiLab/`, not duplicated — plan §X: "the same validated production
contract/adapter... do not duplicate prompt logic"; the `aiLab` folder name is now historical, not a
statement that this call is lab-only). The response is resolved through Slice 0.5B/0.5C's own
`resolvePaletteSelectionResult()` → `resolveAiFallbackSelection()`, unmodified.

**State model.** `PhotoFeedback` never mutates the deterministic view into an AI one. It derives:

```ts
const view = ai.status === 'selected' ? toPhotoAiResultView(ai.resolution.result, ...) : deterministicView
```

`toPhotoAiResultView()` (new, in `photoResult.ts`) builds a `ColorResultView` straight from the
already-resolved `AiFallbackResult` — `category`/`suitability`/`pairWith` are exactly what
`resolveAiFallbackSelection()` (Slice 0.5B, unmodified) already decided; `hex` is the canonical
palette entry's own hex, never a fabricated measurement. `direction`/`descriptors`/`warnings`/`info`
are empty/null: those describe how a *measured* sample differs from its nearest palette color, which
has no meaning for a direct canonical pick. Every other AI status (`loading`, `no-replacement`,
`unresolved`, `error`, `idle`) leaves `deterministicView` exactly as it was — proven directly in both
`PhotoResultCard.test.tsx` and `PhotoCheckerPanel.test.tsx` (deterministic hex/verdict/category
present, AI badge absent, for every non-`selected` status).

**Provenance without a source enum on the shared card.** Rather than teach the shared
`ColorResultCard`/`ColorResultSummary` about an `AiFallbackSource` type, `ColorResultView` gained one
new field, `sourceLabel: string | null` — exactly the existing `aiAdvisory` pattern (the adapter bakes
final, already-translated copy; the shared card only renders it, never re-derives it). `null` for
every deterministic adapter (manual, photo); only `toPhotoAiResultView()` ever sets it, to
`copy.photoChecker.ai.badge` ("AI-assisted" / "วิเคราะห์เพิ่มเติมด้วย AI"), rendered as a small pill
next to the sample label. The provider/model name (`Gemini Flash-Lite`) is never shown in this
production label — that detail stays in AI Lab/debug tooling only (plan §I).

**Stale-response protection.** `PhotoCheckerPanel` bumps an independent `aiRequest` ref and aborts
the in-flight `AbortController` whenever `selection` (a fresh object on every tap/keyboard move, from
the existing `photoPanelReducer`) or `subtype` changes identity — one `useEffect`, one dependency
list, covering every case plan §M lists (new point, new photo, subtype change) without separately
tracking *which* one changed, because a new photo already nulls `selection` and a new/moved point
already replaces it. A completion whose captured request id no longer matches the current ref is
silently dropped, mirroring the existing photo-decode staleness guard already in this file. Tested
directly: a pending AI call for the old point, when the user taps a new point before it resolves,
never overwrites the new point's deterministic result even after the stale promise resolves with a
"successful" `selected` answer.

**Escape / failure behavior (all verified, all leave the deterministic result untouched):**

| AI status | Production behavior |
|---|---|
| `selected` | AI result becomes primary via the resolver; deterministic result kept in component state (not shown), source-labeled "AI-assisted" |
| `uncertain` | No replacement; plain-text note: *"AI could not confidently match this to a color in your palette. The result from your selected spot is still shown above."* |
| `target-mismatch` | No replacement; plain-text note asking the user to tap the fabric again |
| `unusable` | No replacement; plain-text note suggesting another spot/photo |
| provider/network/timeout/malformed | No replacement; generic *"AI analysis didn't work this time. Your on-device result is still available."* — no provider status code, message, or stack ever reaches this copy (tested: a real `httpStatus: 503`/upstream message never appears in the rendered DOM) |

No automatic retry in any case. The action button re-enables afterward (idle again) so a manual retry
is always possible, but nothing in the UI encourages repeating an identical call (plan §R).

**Suitability invariant, proven not just asserted.** `PhotoAiAction`/`toPhotoAiResultView()` read
only `AiPaletteSelectionResult.status`/`.colorId`/`.target`/`.reasoning` from the AI response — never
a `suitability`/`confidence`/`verdict` field (the contract doesn't even have one). Category and
suitability in the rendered result are `resolveAiFallbackSelection()`'s own, unmodified output. A
dedicated `PhotoCheckerPanel.test.tsx` case asserts the AI-resolved verdict for a `neutrals` colorId
is exactly `en.colorResult.verdicts.good` (i.e. `neutral-base` → `good`, the app's own fixed mapping),
never something derived from the AI response.

**Privacy/network disclosure.** The existing blanket `copy.photoChecker.privacy` ("Your photo stays
on this device.") remains true by default and is left unchanged — deterministic photo checking is
still fully on-device. A new, adjacent line (`copy.photoChecker.ai.privacyNote`, "AI assistance sends
this photo for online analysis." / "การให้ AI ช่วยวิเคราะห์จะส่งรูปนี้ไปวิเคราะห์ออนไลน์") sits next
to the AI action itself (Option A from plan §U — copy adjacent to the button, not a modal), so the one
path that does leave the device is disclosed right where the user opts into it, without adding a
consent-dialog system that doesn't exist elsewhere in the app.

**Accessibility.** The AI action is a real, focusable `<button>` that stays mounted and merely
disables/relabels itself while loading (`disabled` + `aria-busy` + a changed label), so focus is never
lost or moved. The card deliberately keeps exactly **one** live region — `.photo-summary`, unchanged
from before this slice — proven by an explicit test; the AI action's own notes (privacy line,
uncertain/mismatch/unusable/failure copy) are plain reading-order text, matching how this component
already treats `warnings`/`info`/`caveat`. Mobile/desktop visual layout was **not** browser-verified
in this environment (no browser tooling available here); the new elements reuse the existing
`primary-button compact` button style and a narrow, single-column `.photo-ai-action` block, so no new
layout primitive was introduced — PO visual verification at real widths is still needed (§AB below).

**Old Slice 0.4 advisory path.** `ColorResultView.aiAdvisory` / `PhotoFeedback`'s `advisory` prop are
untouched and still **not** wired to anything in production (no caller passes a real
`SampleAdvisory`) — this slice does not activate it and does not delete it, per plan §Y. It is now
clearly superseded by the explicit-fallback UX for the "should I double-check this photo" concern;
removing it is deferred cleanup (§16 below), not done here.

**Files changed.**
- New: `src/photoChecker/aiFallbackState.ts` (+ `.test.ts`) — the production AI action's own state machine.
- Edited: `src/photoChecker/PhotoCheckerPanel.tsx` — second reducer, staleness effect, `runAi()`.
- Edited: `src/photoChecker/PhotoResultCard.tsx` — `PhotoAiAction` component; `PhotoFeedback` picks AI vs. deterministic view; `ai`/`onRunAi` props (optional, defaulted, so every pre-existing caller/test is unaffected).
- Edited: `src/photoChecker/photoResult.ts` — new `toPhotoAiResultView()`; `sourceLabel: null` added to the existing deterministic adapter.
- Edited: `src/colorChecker/resultView.ts` — new `sourceLabel: string | null` field on `ColorResultView`.
- Edited: `src/colorChecker/manualResult.ts` — `sourceLabel: null` (manual is always deterministic).
- Edited: `src/colorChecker/ColorResultCard.tsx` — renders `view.sourceLabel` as a small badge.
- Edited: `src/i18n/types.ts`, `en.ts`, `th.ts` — new `photoChecker.ai.*` copy block.
- Edited: `src/styles.css` — `.photo-ai-*` and `.check-source-badge` rules only.
- Test-only edits: `ColorResultCard.test.tsx` (new `sourceLabel` default + badge test), `PhotoResultCard.test.tsx` (new AI-action describe block; two pre-existing assertions updated for the AI button's own icon/live-region footprint — see below), `PhotoCheckerPanel.test.tsx` (new AI-integration describe block; canvas mock extended with `beginPath`/`arc`/`stroke`/`fill` + `toDataURL`, since the AI request now shares this file's mocked canvas).
- Nothing in `api/`, the provider adapters, the prompt, or the response validator changed — this slice is client-side wiring only, reusing 0.5C's server-side path exactly as-is.

**Two pre-existing tests updated, not weakened.** `PhotoResultCard.test.tsx`'s "uses one small cue per
result" test counted pictographic emoji and expected exactly one (the verdict mark); the AI button's
own `✨` is now always present alongside a matched sample, so the expected count became `category ===
'near-face' ? 2 : 1` (comment explains why). The accessibility "only one live region" test was **not**
changed — instead, the implementation was: the AI action's loading state was moved onto the button's
own label (no second `role="status"` element) specifically so that pre-existing invariant would keep
holding without modification.

**Production isolation, confirmed.** `PhotoCheckerPanel`/`PhotoResultCard`/`photoResult.ts` contain no
literal `fetch` (checked via the same source-text module-boundary tests this codebase already uses;
the network call lives one layer down, in `aiLab/aiPaletteApi.ts`, exactly like every other network
call in this codebase). The "stores nothing and makes no network request during a full photo flow"
test (pre-existing, unmodified) still passes unchanged, because it never clicks the AI button. A new
test drives the full flow up to and past tapping a point and confirms `callPaletteSelection` was still
not called; only an explicit click invokes it.

**Tests/build.** New/updated focused suites: `aiFallbackState.test.ts` (8 tests), `PhotoResultCard.test.tsx`
AI-action block (13 tests) + 2 pre-existing assertions updated, `PhotoCheckerPanel.test.tsx` AI-integration
block (15 tests) + canvas-mock extension, `ColorResultCard.test.tsx` (+1 test). Full suite:
**77 files / 1970 passed / 1 skipped** (up from 76/1932). `tsc -b --noEmit`: clean. `vite build`:
succeeded — **514.13 kB JS / 70.71 kB CSS**, up from 507.52 kB/70.12 kB. Unlike 0.5C, this increase IS
new production-reachable code (the whole point of this slice), and is proportionate: one new reducer,
one new subcomponent, one new adapter function, and the reused (not duplicated) 0.5C client call.
`git diff --check`: clean (only pre-existing LF/CRLF advisories).

**Manual PO test steps (§AB).**
1. **Normal deterministic**: choose a photo, tap a garment → deterministic result appears immediately; open devtools Network tab and confirm no request fires from the tap alone.
2. **Successful AI fallback**: tap "✨ Ask AI to analyze" → privacy note is visible next to it → button shows "✨ AI is analyzing…" and disables → on success, the result card updates in place to the AI-picked color with the "AI-assisted" badge.
3. **New target after success**: tap a different garment/point → the AI-assisted result disappears immediately, replaced by the new point's plain deterministic result.
4. **Target mismatch**: point at skin/background if your test photo allows it → deterministic result is retained, and the AI note explains the point may not be on the intended clothing.
5. **Offline/provider failure**: disconnect network (or use devtools' offline mode) before clicking the AI action → deterministic result remains, a generic failure note appears, and the app stays fully usable; reconnecting and clicking again retries manually.

**16. Deferred cleanup (identified, not removed):** `ColorResultView.aiAdvisory` / `SampleAdvisory` /
`deriveSampleAdvisory()` (Slice 0.4) are now superseded by this slice's explicit fallback for the
"should I trust this photo" concern, but still compile, still test green, and are left in place per
plan §Y/AD. The free-form AI Color Lab bake-off (Slices 0/0.1/0.2) and its four-candidate comparison
remain useful research/debug tooling and are unaffected by this slice.

**17. Decision: A — production explicit AI fallback integration is complete and ready for PO
visual/manual manual validation.** Every requirement this slice could verify in this environment is
verified: deterministic-first behavior is unchanged and covered by the full pre-existing test suite;
AI is invoked only by an explicit click, never automatically, under any measurement condition; the
request never carries the deterministic sample (Strategy A, structurally — the request object has
exactly three keys); `selected` resolves through the unmodified 0.5B/0.5C path with suitability
provably not influenced by the AI response; every escape/failure state leaves the deterministic result
untouched; stale responses across point/photo/subtype changes are provably dropped; the network/privacy
boundary is disclosed at the point of use; the shared result components were extended, not forked. What
remains is exactly what plan §V/§AA already anticipated could not be done here: real-browser visual
verification at mobile/desktop widths, and continued real-photo PO spot checks now that the action is
reachable from the real Photo Checker UI, not only AI Lab.
