# V1.4 Slice 2 — Learn Home & Navigation

**Status:** complete. Learn is now visible: a Learn home (with and without a profile), a generic topic reader for all seven P0 topics, a minimal "your type" page, a fifth bottom-nav item **Guide / คู่มือ**, and a secondary Welcome link.

**Governing plan:** [V1_4_LEARN_PLAN.md](V1_4_LEARN_PLAN.md). **Foundation:** [V1_4_SLICE_1_CONTENT_FOUNDATION.md](V1_4_SLICE_1_CONTENT_FOUNDATION.md).

## 1. Entry state

`main` at `036ec5e` "feat: add v1.4 learn content foundation", clean, version 1.1.0, 3 commits ahead of `origin/main`. Matched the brief.

## 2. Files changed

| File | Change |
|---|---|
| `src/learn/ui/LearnView.tsx` | New. The Learn shell: page state (home / topic / type), Back, scroll and focus. |
| `src/learn/ui/LearnHome.tsx` | New. Hero, two featured topics, grouped rows. |
| `src/learn/ui/LearnReader.tsx` | New. The generic topic reader, the minimal type page, decorative swatches. |
| `src/learn/ui/LearnView.test.tsx` | New. 26 behaviour tests (home, reader, Back, reactivity, app entry points). |
| `src/learn/boundaries.test.ts` | Slice 1's "no UI yet" rule replaced by the UI boundary rules (§14). |
| `src/learn/types.ts`, `content/{en,th}.ts` | `LearnCopy.reader`: Back, "Why it works", "More detail", "Try this". |
| `src/learn/index.ts` | Comment only. |
| `src/App.tsx` | `'learn'` view, book icon, fifth nav item, Welcome link, `<LearnView>`. |
| `src/i18n/{types,en,th}.ts` | Two entry labels: `nav.learn` (Guide / คู่มือ), `welcome.learnCta`. |
| `src/styles.css` | Learn styles; nav buttons lose the UA side padding on phones; Welcome link order. |

No domain, palette, classifier, Color Checker, Photo Checker, Daily, persistence, service, package or native file changed.

## 3. Learn Home design

An editorial reading column (max 720 px), not a card grid:

1. **Header:** `h1` "Color Guide / คู่มือสี" and a one-line lede.
2. **Hero:** a soft tinted panel (profile or general, §4–5).
3. **Start here:** at most two featured cards, each with a small swatch motif, its group label, title and one-line answer.
4. **Grouped rows:** the remaining topics as plain rows (title, one-line answer, →) under their group heading.

Everything — order, grouping, featuring, titles and row lines — is read from the Slice 1 registry and `LearnCopy`. The UI contains no topic ids, titles or prose (a boundary test checks this).

**First viewport (360 × 800):** the header, hero and its action end at 455–467 px (EN/TH); "Start here" begins about 50 px below. At 320 px Thai the hero action ends at 506 px.

**Content budget:** the home framing copy is still Slice 1's 39/60 English words (enforced in `content.test.ts`). Row lines are governed by the row budget (≤ 20 words; longest 13). No topic answer appears on the home page.

## 4. Profile mode

When the app's current result is valid (`learnProfileFrom(result)`):
- **Kicker:** "Your type · Summer" / "ไทป์ของคุณ · ซัมเมอร์" (the season name from Learn copy);
- **`h2`:** the subtype name from `LocaleCopy.subtypes` (Thai also shows the existing English `secondaryName`);
- **Summary:** the existing `subtypes[x].summary`, unchanged;
- **Swatches:** the first five canonical Best colours, decorative (`aria-hidden`);
- **Action:** "Learn about your type" / "ดูรายละเอียดไทป์ของคุณ" → the minimal type page (§11).
- **Featured:** `wear.palette` and `wear.harder`, with the user's own colours as the card motif.

No quiz scores, dimension numbers, confidence labels or percentages are shown. Characteristic words are not shown on the home (PO decision C: no rewrite; they appear only where existing screens already use them).

## 5. General mode

With no result, or an invalid one: the hero is "Find the colors that suit you" with a two-sentence body and an optional **text link** to the quiz ("Find your Personal Color"). Its motif is the 12 season samples (`seasonGroups()`). Featured: `basics.what-is` and `types.overview`. Every topic stays readable; nothing is gated.

## 6. Hierarchy

`h1` page title → `h2` hero → `h2` "Start here" → `h3` featured titles → `h2` group → `h3` row titles. Groups whose topics are all featured (Wearing colour, with a profile) have no empty section; their name still appears on the featured cards, so all three groups are always named on the page.

## 7. Primary navigation experiment (Q2)

Every candidate was built as real code, compiled with `npm run build`, served locally, and measured in headless Chrome over CDP on the Learn page, with a Soft Summer profile. Viewports: 320, 360, 390, 430, 768 and 1280 px, in TH and EN, plus 200 % root text at 360. Captures were taken per case (full viewport, 2× nav crop and 2× header crop). They are local QA artefacts and are not committed.

| Candidate | What it is |
|---|---|
| Baseline | The current 4-item nav (for comparison) |
| **A** | 5-item bottom nav, existing CSS unchanged |
| **A2** | A, with the browser's default side padding removed from nav buttons on phones (`padding: 1px 2px`). Text size, target height and gap unchanged. |
| **B** | Header entry: book icon + "Guide / คู่มือ" pill before the switchers |
| **B2** | Header entry, icon only, 44 × 44 px, with an accessible name |

## 8. 320 px Thai measurements

| | Item width × height | Gap | Label wrapping | Page width at a 320 viewport | Notes |
|---|---|---|---|---|---|
| Baseline (4) | 67 × 57 | 4 px | all one line | 320 | — |
| A (5) | 52.8 × 57 | 4 px | **สีของ/ฉัน; พาเลต/ต์ (mid-word)** | 320 | Label box only 40.8 px (UA padding) |
| **A2 (5)** | **52.8 × 57** | **4 px** | **all one line** | **320** | Label box 48.8 px; longest label สีของฉัน 44.9 px |
| B (header, labelled) | — | — | presentation switcher wraps (ผู้/หญิง) | **327 (+7)** | Horizontal overflow |
| B2 (header, icon) | 44 × 44 | 6 px | — | 320 | Header full; no visible label |

Other widths and languages:
- **A2, Thai:**
  - 360: all labels on one line, items 60.8 × 57;
  - 430: all labels on one line, items 74.8 × 57;
  - 768/1280: desktop pill, 120 × 58, 16 px text.
- **A2, English:**
  - 320: "My / Colors" and "Color / Checker" wrap at word boundaries ("Color Checker" already wraps in the 4-item baseline);
  - 360: only "Color Checker" wraps;
  - no clipping and no overflow.
- **Font robustness (A2, 320, Thai):**
  - with Tahoma forced (wider than Leelawadee UI), all labels stay on one line (สีของฉัน 45.8 px of 48.8 px);
  - Noto Sans Thai is not installed on this machine.
- **B, English:** page 363 px at 320 and 360, and 449 px at 430 (the header wraps once the brand text shows).
- **B2, English 320:** page 322 px (+2).
- **All candidates:** no item overlap, and the nav box inside the viewport. At 320, text stays 11.84 px (TH) / 10.88 px (EN), the existing standard; nothing was shrunk. The QA gate also checks every item's right edge (§17).

## 9. Bottom-nav candidate (A2)

- **Fit:** five labelled items with 52.8 × 57 px targets (above 44 × 44); icons above labels; unchanged text size.
- **Active state:** a filled pill in the season accent plus `aria-current="page"`, so the state does not rely on colour alone.
- **Icon:** an outline open book, drawn in the same 24-unit stroke style as the other four icons. No dependency, no emoji.

## 10. Header candidate (B / B2)

The header already holds the brand mark, the Women/Men switcher and the TH/EN switcher.
- **B (labelled):** overflows at 320 Thai and at every tested English phone width.
- **B2 (icon only):** also overflows at 320 English. It removes the visible label, adds a third control to an already crowded header, and gives the destination no text on screen.

## 11. Final Q2 decision

**Guide / คู่มือ is the fifth bottom-nav item (A2).** The measured evidence:
- A2 fits at 320 Thai with every label on one line, unchanged text size and gap, 52.8 × 57 targets, no overflow or overlap, and a clear active state.
- Both header options overflow at 320.

The one change to existing nav CSS is removing the browser's default side padding (about 6 px each side) from phone nav buttons; it only widens the label box. Candidate B/B2 code was experiment-only and does not ship; one navigation solution ships.

**Consequence:** the bottom nav exists only with a profile (unchanged V1.3 rule). Without a profile, Learn is reached from the Welcome link (§12).

## 12. Welcome entry

A text link, "Read the color guide" / "อ่านคู่มือสี", after the primary quiz button:
- **Desktop:** it sits on the line under the button and the Daily link.
- **Phones:** it sits directly under the quiz button (`order: 5` inside the `display: contents` layout), so it stays secondary to the quiz.

The Welcome page gains one link, not a menu.

**Observation, not changed:** on phones the existing Daily link (`.welcome-daily-link`, V1.3) has no `order`, so it renders at the very top of Welcome, above the eyebrow. This slice does not move frozen V1.3 UI; recorded here for the PO.

## 13. Internal navigation model

There is no router and no dependency. `LearnView` keeps local page state:

```ts
type LearnPage = { kind: 'home' } | { kind: 'topic'; topic: LearnTopicId } | { kind: 'type' }
```

- **Opening Learn** (nav or Welcome) always starts at the Learn home, at the top; the app's view change scrolls, and focus stays where the user activated.
- **Home → topic / type:** the home scroll position is remembered; the page scrolls to the top and focus moves to the page `h1` (`tabIndex=-1`, no outline).
- **Back** ("← Back to Color Guide" / "กลับไปหน้าคู่มือสี", a real button at the top of every topic and type page) returns to the home, restores the scroll position and focuses the row or hero action the user came from.
- **Leaving Learn** (bottom nav) unmounts it; returning starts at the home again.
- **Device back:** not handled. The app has no history integration (plan Q3), so the Android/browser back button still leaves the app. This is deferred with native work.

## 14. Topic-reader decision

**Chosen: a generic, content-driven reader** (brief §11 option A, and plan §31, which assigns the topic page shell to Slice 2). Every topic renders the same way:
- the group kicker, `h1` title and answer (Level 1);
- `h2` "Why it works" with its blocks (Level 2);
- a native `<details>` "More detail", collapsed (Level 3, only when the topic has one);
- `h2` "Try this" with the takeaway.

**Blocks:**
- `text` and `list` render as they are.
- `app-copy` is resolved from `LocaleCopy` at render time (for example the four More Considered tips, or the result disclaimer).
- `palette-group` renders the existing section title and description, plus (with a profile only) up to six of the user's own colours as decoration.

There is no per-topic layout.

**Not built yet:**
- dimension scales, the 12-type grid and the garment flat-lay (Slices 3–4);
- the lighting illustration and any Daily visual (Slice 4).

All seven topics are therefore readable now, and there are no "coming soon" dead ends or disabled rows.

**The type page ("Learn about your type"), minimal by design:**
- **Built only from `subtypeGuide()`:**
  - name, season and summary;
  - five Best swatches;
  - "Where this type sits" as four text bands with the "not a score" note;
  - the three-colour outfit formula with localised colour names;
  - one button to the existing Palette screen.
- **Not in it (the Slice 3 template):** scales, all palette groups, metals, any type other than the user's own, and the P1 nearby types.
- **Availability:** it exists only with a profile. If the result disappears while it is open, Learn returns to its home.

## 15. Accessibility

- **Headings:** one `h1` per page, no skipped heading levels (tested on the home in both modes, all 7 topics and the type page).
- **Controls:**
  - every control is a native `button`, and `details` / `summary` is used for Level 3;
  - cards and rows put the button inside the heading and stretch its hit area over the card with `::after`, so the accessible name is just the title;
  - focus is drawn on the whole card via `:has(:focus-visible)`.
- **Targets:** every card, row, Back, summary and CTA is at least 44 × 44 px; the smallest row is 64 px tall.
- **Current page:** the nav item has `aria-current="page"` and a filled pill.
- **Swatches:** always `aria-hidden`, never with a title or HEX. The text beside them already names the group, type or topic, and colour is never the only signal.
- **Motion:** the only motion is the existing `page-enter` animation, disabled by the existing reduced-motion rule; scrolling inside Learn uses `behavior: 'instant'`.
- **Language:** Thai uses the existing Thai font stack, with looser heading line-height and wider kicker sizing.

## 16. Responsive QA

The production build was served locally and driven through headless Chrome. For each state below I recorded full-page and first-viewport captures and computed checks: page width against viewport, elements beyond the viewport, clipped text, HEX in text or attributes, targets under 44 px, heading sequence and position of the hero action.

| State | Widths | Result |
|---|---|---|
| Profile home, TH | 320, 360, 430, 768 | no overflow, no clipping, no HEX, no small target |
| Profile home, EN | 320, 360, 430, 1280 | same |
| General home, TH | 320, 360 | same |
| General home, EN | 360, 768 | same |
| Topics `basics.what-is`, `wear.harder`, `app.color-checker` (Level 3 open) | TH 320, EN 360, EN 1280 | same |
| Type page | TH 320, EN 360, EN 1280 | same |
| General `wear.palette` reader (no swatches) | TH 360 | same |
| Back from each topic (after scrolling 700 px) | TH 320, EN 360, EN 1280 | focus on the originating row; scroll restored (700, or the page maximum 467 at 1280) |
| Welcome with the new link | TH 320, EN 360, EN 1280 | link under the quiz button on phones; no overflow |

- **Longest labels:** EN "More Considered colors are not off-limits" and "Getting the most from Color Checker" wrap to two lines in cards and rows; Thai titles wrap naturally.
- **Clean run:** no console errors, and no requests to other origins.

## 17. 200 % text, state and reactivity QA

**200 % text.** 200 % root text at 360 was tested for profile TH, profile EN and general TH. Learn itself reflows: nothing in the Learn page is wider than the viewport.
- **Fix made:** at 200 % the featured-card arrow collided with the last text line; card and row padding are now in `em`, so it scales with the text.
- **Existing issue:** at 200 % English, the page is 389 px wide because the existing header overflows. That is identical in the 4-item baseline, so it is not a Learn regression.
- **Known limit:** at 200 % English, "Palette" and "Color Checker" are wider than their nav buttons (see §20).

**States.** `LearnView.test.tsx` covers:

| Tested | Result |
|---|---|
| Welcome → Learn (general) | tested |
| Bottom nav → Learn (profile), with `aria-current` | tested |
| Learn → Palette, through the nav and the type page | tested |
| Valid profile / no profile / invalid stored profile | tested |
| Language switched in the header while Learn is open | the page re-renders in Thai, including the nav label |
| Language switched with a topic open | the topic stays open, in the new language |
| Result removed | the type page falls back to home, general mode, with no stale name |
| Result changed | the hero and the type page show the new type |
| Storage unavailable | `LearnView` renders and calls no storage |

Learn derives its profile from props on every render; nothing about the type is held in state.

## 18. Bundle delta

| | Raw | Gzip |
|---|---|---|
| JS baseline (Slice 1) | 410.59 kB | 123.01 kB |
| JS final | 451.45 kB | 134.12 kB |
| **JS delta** | **+40.86 kB** | **+11.11 kB** |
| CSS baseline | 47.53 kB | 10.72 kB |
| CSS final | 53.83 kB | 11.93 kB |
| **CSS delta** | **+6.30 kB** | **+1.21 kB** |

**Attribution:**
- The Slice 1 content and model, now wired in, account for most of the JS delta (they measured at most 10.38 kB gzip on their own).
- The three UI components and two i18n labels make up the rest.

The delta is well under the ~30 kB gzip threshold, so there is no lazy loading.

## 19. Adversarial checks

16 source mutations, each applied alone, run against `src/learn` tests, then restored. **16/16 caught:**

| Mutation | Caught by |
|---|---|
| Profile cached in state (stale hero) | result removed / changed tests |
| One P0 topic dropped from the landing | general-mode "every topic readable", 7-topics test |
| HEX exposed in a swatch tooltip | no-HEX test; reader test |
| Thai nav label replaced with English | header language-switch test |
| `LearnView` reads `localStorage` | UI boundary test |
| Back turned into a `span` | reader Back test (both modes) |
| Swatches exposed to assistive technology | decorative-swatch test |
| `fetch` in the home | UI boundary test |
| A topic title hard-coded in the UI | UI boundary test (copied data); 7-topics test (TH) |
| Featured topics hard-coded | featured-from-registry test |
| "68%" added to the hero | no-scores test |
| No focus move on topic open | reader focus test |
| App imports Learn internals | Z boundary test |
| UI imports `palettes` directly | UI import allow-list |
| Guide not marked current | nav `aria-current` tests |
| Welcome Learn link removed | Welcome and corrupted-profile tests |

**Layout mutation (browser QA, not jsdom):**
- **Fixed-width mutant:** a `flex: 1 0 64px` nav mutant was built and measured at 320. The gate reported `itemsInside false` (last item right edge 356 px on a 320 viewport).
- **Original candidate A:** this QA also caught its mid-word Thai wrap (§8).

## 20. Known limitations

1. **Device back** leaves the app (plan Q3); only the in-app Back exists.
2. **200 % text in English:**
   - "Palette" and "Color Checker" are wider than their 5-item nav buttons.
   - The existing header already overflows at 200 %, in the 4-item baseline too.
   - Both belong to the Slice 5 accessibility/reflow pass.
3. **Thai nav headroom** at 320 is about 3 px on สีของฉัน in the fonts available here. A wider device font would wrap it at its natural boundary (สีของ / ฉัน), never mid-word, based on the measured widths. This needs checking on a physical Android device.
4. **No-profile users see no bottom nav** (unchanged V1.3 rule). They reach Learn from Welcome, and leave via the brand button or the quiz link.
5. **The type page is minimal** and only for the user's own type; the full template is Slice 3.
6. **The Daily link** on the mobile Welcome renders above the title (pre-existing, §12).
7. **Native Thai review** of the Learn copy is still pending (plan Q4).

## 21. Slice 3 handoff

- **Shell:**
  - extend `LearnPage`'s `type` variant to `{ kind: 'type'; subtype: Subtype }` for any of the 12 types;
  - keep the rule that a missing profile never strands the user (a type page for a non-profile subtype stays valid without one);
  - keep `homeReturn` focus and scroll restoration, and add `from` ids for type cards.
- **Reader:** render the `visual` of `types.overview` (`subtype-grid`) and `basics.dimensions` (`dimension-scales`) inside the generic reader by registry `visual` kind, never by topic id (the boundary test forbids quoted topic ids in `ui/`).
- **Type template:**
  - replace `LearnTypePage` with the full `typeDetailSections` template: scales with text bands, all four colour groups with names, metals, formula and the "Your type" badge;
  - reuse `Swatches` only for decoration; named colours need visible names.
- **Contextual link:** Result → your type. It will need `LearnView` to accept an initial page from the app, for example `entry?: LearnPage`; the app still passes only the result, never storage.
- **Boundaries:** the UI may import only `react`, `..` (public API), and types from `../../i18n` and the domain. Add new UI files to the Z test's `.tsx` list.
