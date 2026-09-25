# V2.0 AI Color Lab — Slice 0 (Four-Provider Vision Bake-off) + Slice 0.1 (Grounding Fix)

Status: **implemented, dev-only, not deployed.** Active bake-off: **Gemini, OpenAI, Groq**
(DeepSeek was evaluated in Slice 0 and removed in Slice 0.1 — see §15).

## 1. Purpose

An experimental, developer-only playground: the same photo and the same selected sample point,
analyzed independently by AI vision providers, compared side by side with the existing
deterministic Photo Color Checker. It answers one question — does AI vision add *context* beyond
a raw pixel measurement (lighting, garment identification, usability) — not "which provider is
right." It does **not** replace, correct, or feed into the production Photo Color Checker,
personal-color scoring, or any recommendation.

Slice 0 ran this bake-off across four providers (Gemini, OpenAI, Groq, DeepSeek). Slice 0.1
(this update) removed DeepSeek after it failed structured-output validation live, and fixed a
grounding bug where every provider received the full photo with no indication of which point the
user had actually selected — see §15-19 for the full audit, fix, and new live-smoke results.

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
api/_lib/providers/*.ts   <- one adapter per provider (isolated, server-only)
api/_lib/{env,http,timeout,prompt,validate,validateRequest}.ts

api/ai-color/{gemini,openai,groq}.ts
  -> Vercel-style (req, res) function files. Not deployed this slice; exist so the path to
     Vercel serverless functions is real, not aspirational. Each is a 4-line wrapper around
     handleAiColorRequest(). (api/ai-color/deepseek.ts and api/_lib/providers/deepseek.ts were
     deleted in Slice 0.1 -- see §15.)

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

| Provider | Model used | Vision support | Structured output + vision |
|---|---|---|---|
| Gemini | `gemini-3.5-flash` | Yes, all current 3.x models | Not confirmed compatible by official docs (a documented case elsewhere returned 400 with responseSchema + image); adapter uses `responseMimeType: application/json` only, no schema, plus explicit JSON-shape prompt instructions |
| OpenAI | `gpt-5-mini` | Yes | Confirmed — `response_format: json_schema` (strict) documented as vision-compatible |
| Groq | `qwen/qwen3.8-27b` | Yes — **the only Groq model that accepts images**; Groq's fast Llama/gpt-oss lineup is text-only. Listed under Groq's Preview tier (evaluation-only, no production-stability guarantee) | Confirmed working with vision per Groq's own docs (`json_object` mode) |
| ~~DeepSeek~~ | ~~`deepseek-flash`~~ | Evaluated in Slice 0: yes, the only DeepSeek model that accepts images, but vision was ~5 weeks old at the time | **Removed in Slice 0.1** (§15) — the live smoke run consistently produced JSON that did not validate against the contract for the full canonical prompt, unlike the other three. Historical record only; no longer an active provider. |

No model IDs changed in Slice 0.1 for the three remaining providers (plan §4: freeze the
remaining providers unless a capability problem is found — none was).

Sources (fetched live, not recalled): `ai.google.dev/gemini-api/docs/{image-understanding,structured-output,models}`,
`developers.openai.com/api/docs/{guides/images-vision,guides/structured-outputs,models/gpt-5-mini,pricing}`,
`console.groq.com/docs/{vision,models,deprecations}`, `api-docs.deepseek.com/{guides/vision,news/news260821,quick_start/error_codes}`.

All three active adapters use plain `fetch()` — no provider SDK was installed (see §Dependencies).
Every adapter, regardless of what structured-output mode it requested, has its JSON response
re-validated server-side against the contract (`api/_lib/validate.ts`); nothing is trusted merely
because structured output was asked for.

## 7. Canonical prompt

One instruction, `api/_lib/prompt.ts`'s `CANONICAL_INSTRUCTION` + `buildCanonicalPrompt()`, used
verbatim by all three active adapters (`api/_lib/providers/shared.ts`'s `promptFor` is just
`buildCanonicalPrompt`). Parity is asserted by a real fetch-body inspection test, not just an
import check — `api/_lib/prompt.test.ts` captures each adapter's actual outgoing request text
(and, since Slice 0.1, its outgoing image payload too) and asserts both equal
`buildCanonicalPrompt(request)` / `request.imageDataUrl` byte-for-byte.

It asks the model to first identify the garment/object under the marked target (Slice 0.1, §16-18),
then report perceived color family, temperature/value/chroma, ambient lighting cast and severity,
whether the sampled region is shadowed/highlighted/mixed/usable, and suitability against the
user's subtype if one is saved — explicitly not "what hex is this," and explicitly forbidding a
claim of recovering the true physical color or reporting the marker graphic's own color.

## 8. Same input for all three providers

Every provider receives the same annotated JPEG (`src/aiLab/imageEncode.ts`, re-encoding the exact
working-image pixels the existing photo pipeline already produced — no re-decoding of the
original file — with a target marker burned in at the selected point, Slice 0.1 §17), the same
deterministic sample context (hex, RGB, OKLab lightness, semantic color name, sampling flags), and
the same subtype context (or none). Provider-specific request syntax differs (Gemini's
`inline_data` vs. the other two's OpenAI-compatible `image_url`); the *content* does not —
verified by `api/_lib/prompt.test.ts`'s parity test, which asserts the exact same prompt text and
the exact same image bytes reach all three.

## 9. Deterministic baseline

Shown above the AI cards (`src/aiLab/DeterministicBaselineCard.tsx`), reusing the existing
engine functions unchanged: `samplePhotoRegion`, `matchPhotoColor`, `describeColor`,
`getSuitability` — no new color logic, no AI-derived correction of any deterministic value.
`src/aiLab/aiLabDeterministic.ts` composes them with an **optional** subtype (the production
`inspect.ts` requires one; the AI Lab does not, since it must work with no saved profile —
plan §27 forbids inventing one).

## 10. Failure isolation

Each provider is its own route (`/api/ai-color/<provider>`) and its own adapter; there is no
combined "call all three" backend request that could return one failing status for everyone.
`api/_lib/handler.ts`'s `runProviderSafely` always resolves to a well-formed outcome — a missing
key, a thrown adapter exception, a timeout, an HTTP error, or malformed JSON all become a typed
`AiErrorInfo`, never an unhandled rejection or a 500 that could be mistaken for "the whole feature
is down." Client-side, `aiLabState.ts`'s reducer keys every completion to the `runId` that started
it, so a stale response (superseded by a new Run All, or a provider that was never in flight) is
silently discarded rather than overwriting a newer or unrelated card.

Proven end-to-end (not just by construction) in `src/aiLab/AiColorLabView.test.tsx` — full
component render, mocked `fetch` — covering plan §31 Cases A–G (now exercised across the three
active providers): 3/3 success; a mixed success/500 run; malformed JSON isolated to one card; a
missing key isolated to one card; retry-one calling only that provider; a still-loading card not
blocking completed ones; and a stale response from a superseded run never overwriting the new
run's result. Slice 0.1 added a dedicated check that Run All fires exactly three requests and
none of them targets `deepseek`.

## 11. Timeout / retry

35s bound per provider (`api/_lib/timeout.ts`), combining the caller's signal with our own via
`AbortSignal.any`. A timeout becomes that provider's error card; it never cancels or delays the
other two. "Run all providers" and a per-card "Retry `<Provider>`" both exist — retry sends the
same current photo/sample only to that one provider (`AiColorLabView.tsx`'s `runProvider`), never
re-running the other two.

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

## 20. Known limitations

- Groq's only vision model (`qwen/qwen3.8-27b`) is Preview-tier — availability/stability risk
  independent of this app.
- DeepSeek was removed in Slice 0.1 (§15) after failing structured-output validation live; it is
  no longer an active provider or a limitation to track going forward.
- Gemini's structured-output mode is not officially documented as vision-compatible; its adapter
  leans on prompt-instructed JSON + server-side validation rather than a provider-enforced schema.
- The grounding fix (§17) was validated on one representative image (fabric swatches, §19), not
  yet the PO's original two-person photo or a larger set — the marker+prompt approach should be
  re-verified against a real garment-on-a-person photo before being considered fully proven.
- `targetMatched` is self-reported by the model and only diagnostic (§18) — it is not an
  independent grounding proof, just a reviewable signal shown alongside the object description.
- No cost accounting (plan §19 explicitly defers this) — usage tokens are shown as reported, cost
  is not computed.
- A Vite "configLoader: 'native'" deprecation warning appears for relative imports without file
  extensions across `api/**` and `src/domain/aiColorLab/contract.ts`; harmless today (current Vite
  major version), not yet fixed.

## 21. Recommended next experiment

Run the same three-provider bake-off across a larger, PO-curated set of real photos — including
the original two-person/two-garment scenario that motivated Slice 0.1 — and confirm the marker +
authoritative-target prompt continues to ground correctly on an actual garment-on-a-person photo,
not just the fabric-swatch stand-in used in §19. Compare normalized results (including
`targetAssessment`) across providers systematically, before any provider-selection decision.
