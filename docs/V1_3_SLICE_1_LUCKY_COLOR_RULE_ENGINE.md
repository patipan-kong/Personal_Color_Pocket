# V1.3 Slice 1 — Canonical Lucky Color Knowledge + Rule Engine

**Status:** engineering complete. This slice adds only the deterministic, source-domain layer selected in Slice 0. It adds no visible feature.

## Entry state

| Check | Value |
|---|---|
| Branch | `main` |
| Starting HEAD | `95311f2032753bc231b773f70f1e4af578f13bce` (`docs: plan v1.3 daily lucky color outfit`) |
| Starting working tree | clean |
| Package version | `1.1.0` |

## Files changed

| File | Purpose |
|---|---|
| `src/domain/luckyColor/types.ts` | Closed source-domain vocabulary and immutable TypeScript contracts. |
| `src/domain/luckyColor/knowledge.ts` | Frozen `2026.1` dataset, compact source metadata, and validation. |
| `src/domain/luckyColor/luckyColor.ts` | Pure weekday/date and positive-rule lookup API. |
| `src/domain/luckyColor/luckyColor.test.ts` | Canonical-table, invariant, validation-mutation, date, immutability, and dependency-boundary tests. |
| `docs/V1_3_DAILY_LUCKY_COLOR_PLAN.md` | Marks Slice 1 complete. |
| This file | Durable implementation and verification record. |

## Domain model and dataset

The module is deliberately small and does not model astrology generally.

```ts
type LuckyWeekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
type LuckyGoal = 'work' | 'money' | 'luck' | 'mentor-support'
type TraditionalCategory = 'dech' | 'sri' | 'mula' | 'montri' | 'kalakini'
type LuckyColorFamily =
  | 'white' | 'yellow' | 'pink' | 'red' | 'green'
  | 'blue' | 'purple' | 'orange' | 'gray' | 'black'
```

`LuckyColorRule` holds weekday, traditional category, nullable goal, one or more broad source families, source IDs, and Thai source terms. `LuckyColorKnowledgeSet` holds an explicit `datasetVersion`, fixed system ID, literal review date, sources, and rules.

| Field | Frozen value |
|---|---|
| `systemId` | `thai-daily-shirt-color-taksa-7day` |
| `datasetVersion` | `2026.1` |
| `reviewedAt` | `2026-09-24` |
| Positive rules | 28 (7 weekdays × 4 goals) |
| Kalakini provenance rules | 7 (one per weekday, `goal: null`) |
| Total | 35 |

There is no `wed-night` runtime type, birth date/time, zodiac, location, weather, shade, HEX, Personal Color subtype, palette, or garment type.

## Provenance

The runtime record contains compact static metadata only. It does not fetch these URLs.

| ID | Publisher | Role |
|---|---|---|
| S1 | Thai Rath | Canonical daily table |
| S2 | KTC | Corroborating table |
| S3 | Sinsaebank | Traditional-category interpretation |

Every rule references these resolved IDs and contains its broad Thai source term (for example `ชมพู`, `เขียว`, `ม่วง`, `เทา`). Source URLs and the fuller source/disagreement record remain in Slice 0 research.

## Exact frozen rules

| Day | Work / เดช | Luck / ศรี | Money / มูละ | Mentor support / มนตรี | Kalakini only |
|---|---|---|---|---|---|
| Sun | pink | green | purple | gray | blue |
| Mon | green | purple | orange | blue | red |
| Tue | purple | orange | gray | red | white |
| Wed | orange | gray | blue | yellow | pink |
| Thu | blue | red | yellow | green | black |
| Fri | yellow | pink | green | orange | gray |
| Sat | gray | blue | red | pink | green |

`kalakini` is preserved only as a source/provenance category. It is not a `LuckyGoal`, and the normal lookup cannot select it.

## Public API and invalid-input contract

```ts
luckyWeekdayForDate(date: Date): LuckyWeekday
getLuckyColorRule(weekday: LuckyWeekday, goal: LuckyGoal): LuckyColorRule
getLuckyColorForDate(date: Date, goal: LuckyGoal): LuckyColorRule
```

- `luckyWeekdayForDate` uses the supplied Date object’s **local** `getDay()` mapping: `0..6` → `sun..sat`. It uses neither UTC nor a Bangkok override.
- Invalid Dates (including `new Date(NaN)`) throw `RangeError('Invalid lucky-color date')`.
- Runtime-invalid weekday or goal values throw `RangeError`; there is no default Sunday/work/family fallback.
- Lookup is synchronous, deterministic, and has no hidden current-time call. The eventual UI owns “today” and midnight refresh.

## Immutability and invariants

All public data contracts are readonly. The knowledge set, source list, every source, rules list, every rule, and every nested rule array are `Object.freeze()`d. Lookup returns the canonical frozen rule; callers cannot mutate it and corrupt a later lookup.

Validation runs at module initialization and is also exported for malformed-data tests. It requires:

- expected system ID, explicit `YYYY.N` version, and literal ISO review date;
- exactly S1/S2/S3, complete and unique source metadata;
- exactly 35 rules: 28 positive and 7 kalakini;
- all seven weekdays, exactly four positive rules and one kalakini rule each;
- no duplicate weekday/goal or weekday/category key;
- non-empty valid canonical family/source ID/Thai source term values;
- resolved source IDs; and
- the frozen goal → category mapping, with `goal: null` reserved for kalakini.

## Tests and deliberate mutation checks

The focused suite has 24 tests. It verifies the entire readable positive and kalakini matrices, exhaustive positive lookup, all counts, provenance, local-date mapping, invalid values, immutability, and an import/source boundary that excludes V1.2 colour systems, browser APIs, storage, network, timers, AI, and current-time reads.

These temporary real-source mutations were performed, each run failed, and each edit was restored before final verification:

| Mutation | Catch |
|---|---|
| Sunday/Work `pink` → `red` | Exact positive-table test |
| Sunday kalakini `blue` → `red` | Exact kalakini-table test |
| Work `dech` → `mula` | Initialization validation: duplicate weekday/category |
| Remove Saturday kalakini rule | Initialization validation: expected 35 rules |
| Duplicate Sunday Work rule | Initialization validation: duplicate weekday/category |
| S3 → unresolved S404 | Initialization validation: missing source ID |
| `getDay()` → `getUTCDay()` | Local-date mapping/spies and date lookup tests |
| Positive lookup changed to select `goal === null` | Exact positive table and “never kalakini” invariant |

## Regression and privacy result

| Command | Result |
|---|---|
| `npm test` | 39 test files passed; 1,186 passed and 1 skipped. |
| `npx vitest run src/domain/personalColor/scoringAudit.test.ts` | Passed: 177,147 / 177,147 quiz combinations. |
| `npm run build` | Passed: TypeScript and Vite production build. |
| `git diff --check` | Passed before staging; staged check is repeated immediately before commit. |

The production domain has no import of Personal Color palettes, OKLab, `describeColor`, manual/photo matching, pairing, placement, UI, CSS, localStorage, timers, networking, analytics, external API, weather/location, or dependencies. Source URLs are inert static strings only.

## Known limitations

- This layer intentionally returns a broad family, not a wearable shade or HEX.
- It does not select garment placement, a neutral, an outfit, a date timer, a goal preference, or a localized UI label.
- Kalakini is available in the immutable provenance record but has no positive lookup API.

## Slice 2 handoff

Slice 2 may consume a returned canonical family and a valid Personal Color subtype, then inspect subtype palettes, V1.2 structured colour names, and OKLab. It must choose a wearable expression of the **same** family and an honest placement fallback. Slice 1 must remain untouched and independent of those V1.2 systems.
