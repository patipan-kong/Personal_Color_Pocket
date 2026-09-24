# V1.3 Slice 6 — Daily experience polish, accessibility and edge cases

**Status:** complete. This is a polish and robustness slice for the existing Daily experience. It adds no product feature, changes no domain behaviour, and keeps the Slice 5.1 editorial board design.

## 1. Entry state

- Branch `main`, clean tree, package 1.1.0.
- HEAD `fc2c70c` ("style: refine daily outfit editorial board"), 8 commits ahead of `origin/main`.
- The brief named `f5ea44f` (7 ahead) as the entry commit. That commit is Slice 5. Slice 5.1 was inserted after the brief was drafted, and the brief's own large-text gate addresses the 5.1 board. So `fc2c70c` is the intended base, and nothing else differed.

## 2. Files changed

| File | Change |
|---|---|
| `src/dailyLuckyColor/DailyView.tsx` | Local-day hook with one self-rescheduling timer. One resolved Daily state feeds every section. Separate date and recommendation errors, with a retry for the date error. 2 × 2 arrow keys. Localized source links with a new-tab hint. Plural-aware eyebrow. |
| `src/i18n/types.ts`, `th.ts`, `en.ts` | Copy audit (§3–§5). New keys: `sourceEnd`, `sourceNames`, `newTab`, `retry`, `resultError`; `resultEyebrow` now takes the claim count. |
| `src/styles.css` | Large-text re-flow mode. Accent text switched to `--accent-ink`. Firmer dashed broad-family ring and light-garment outline. Disclosure tap target and focus ring. Board animation off under reduced motion. `.daily-sr-only`. |
| `src/dailyLuckyColor/DailyPolish.test.tsx` | New: 20 behavioural and invariant tests (§22). |
| `src/dailyLuckyColor/DailyView.test.tsx`, `DailyBoard.test.tsx` | Copy expectations updated for the audited strings; no assertion removed or weakened. |
| `docs/V1_3_DAILY_LUCKY_COLOR_PLAN.md` | Status line and the Slice 6 row. |

Unchanged: `src/domain/**`, `outfitBoard.ts`, `presentation.ts`, `GarmentArt.tsx`, `dailyLuckyColorGoal.ts`, all V1.2 files, `package.json`/lock, `public/`, `android/`.

## 3. Thai copy audit

Every V1.3 Thai string was reviewed. The changes and the reasons:

| Key | Before | After | Why |
|---|---|---|---|
| `framing` | สีแนะนำวันนี้อ้างอิงความเชื่อเรื่องสีมงคลของไทย และจะปรับให้เข้ากับ Personal Color ของคุณเมื่อมีข้อมูล | สีของวันนี้อิงจากความเชื่อเรื่องสีมงคลประจำวันของไทย และปรับให้เข้ากับ Personal Color ของคุณ (ถ้ามี) | "สีแนะนำ" and "เมื่อมีข้อมูล" read as translated; the new line is shorter and names the daily tradition. |
| `goalLimit` | เลือกได้สูงสุด 2 เรื่อง | เลือกได้ไม่เกิน 2 เรื่อง | More conversational. |
| `goals.work` | งาน | การงาน | The standard term in Thai daily lucky-colour tables; "งาน" alone can read as "event". |
| `goals.mentor-support` | ผู้ใหญ่สนับสนุน | ผู้ใหญ่อุปถัมภ์ | The idiomatic phrase for patronage from seniors; "สนับสนุน" was a literal rendering of "support". |
| `familyLabels.*` | ขาว, เหลือง … | สีขาว, สีเหลือง … | A bare colour word reads unnaturally as a heading or sentence subject in Thai. |
| `generalNote` | ยังไม่มีข้อมูล Personal Color จึงแนะนำเป็นไอเดียชุดจากกลุ่มสีมงคลที่เลือก | ยังไม่มีผล Personal Color ของคุณ ชุดนี้จึงใช้สีมงคลแบบกว้าง ๆ | The old text said the user "chose" a colour family (they choose goals). The new text is honest and plain. |
| `placementNotes.*` | Full sentences ending in "." | e.g. "เหมาะเป็นชิ้นหลักของชุด" after the bold family name | Thai does not end sentences with a full stop. The notes now follow the bold family as topic–comment, so "สีมงคลวันนี้" is not repeated. |
| `storyFamily`, `storyShade` | Used quotation marks around “สีอะไร” / “เฉดและตำแหน่ง” | สีมงคลบอกว่าควรใส่สีอะไร / Personal Color ช่วยเลือกเฉดและตำแหน่งที่ใส่ | Quote marks made the lines read like a diagram label. |
| `pieceLabels.top` | เสื้อท่อนบน | ท่อนบน | Redundant; parallel with ท่อนล่าง. |
| `personalSupport` | Personal Color | สีจาก Personal Color | On its own, the status did not say what it meant. |
| `aboutBody` | …แล้วผลิตภัณฑ์จะนำสี… | …ซึ่งให้สีแยกกันในแต่ละเรื่อง แอปให้คุณเลือกได้ไม่เกิน 2 เรื่อง แล้วนำสีของแต่ละเรื่องมาจัดรวมเป็นชุดเดียว… | "ผลิตภัณฑ์" was a literal "the product". The text now states that the source gives separate colours per goal and that the app does the combining (§19). |
| `sourceJoin` | และข้อมูลสนับสนุนจาก | และข้อมูลประกอบจาก | Lighter wording for a supporting source. |
| Source link text | Thai Rath | ไทยรัฐ | The Thai name of the publication. The URL is unchanged. |
| Sentence end after the sources | "." | (none) | No full stop in Thai. |
| `dateError` | ไม่สามารถอ่านวันที่จากอุปกรณ์ได้ โปรดตรวจสอบนาฬิกาในอุปกรณ์แล้วลองใหม่ | อ่านวันที่จากเครื่องไม่ได้ ลองตรวจสอบวันและเวลาในเครื่อง แล้วลองอีกครั้ง | Less formal; matches the new retry button. |
| New | — | `retry` ลองอีกครั้ง, `resultError` ขออภัย ตอนนี้ยังแสดงชุดของวันนี้ไม่ได้, `newTab` (เปิดในแท็บใหม่) | New states (§11, §17). |

Reviewed and kept: `entryCta`, `title`, `goalPrompt`, `goals.money`, `goals.luck`, `resultEyebrow` (สีของวันนี้ does not vary with number), `familyLabel`, `personalizedShade`, `personalizedFor`, `quizCta`, `outfitEyebrow`, `outfitHeading`, `boardLabel`, `luckyBadge`, `neutralSupport`, `semanticColors`, `aboutHeading`, `sourcesLabel`, weekdays. The belief framing was not strengthened anywhere. The copy still presents lucky colours as a cultural tradition, never a promise.

A native Thai reader has not reviewed the new strings (§26).

## 4. English copy audit

| Key | Before | After | Why |
|---|---|---|---|
| `resultEyebrow` | Today's colors | Today's color / Today's colors | It was plural even with one goal. |
| `framing` | Today's color is based on a Thai lucky-color tradition and adapted… | Lucky colors follow a Thai daily tradition and are adapted to your Personal Color when available. | It was singular even with two goals; the new sentence is number-neutral. |
| `generalNote` | Personalization is not available yet. These are broad lucky-color outfit ideas. | No Personal Color result yet, so these are broad lucky-color ideas. | Plainer; says why. |
| `placementNotes.*` | "Today's lucky color works best…" after a bold family name, which read as "**Green** Today's lucky color works…" | "**Green** works best as the main piece of your outfit." etc. | The bold family is now the subject of the sentence. |
| `storyFamily` | The lucky color says which color. | Thai tradition picks the lucky color. | Removes the "color… color" repetition. |
| `storyShade` | Personal Color picks… | Your Personal Color picks… | Consistent with the rest of the page. |
| `personalSupport` | Personal Color | From your Personal Color | A bare "Personal Color" did not read as a status. |
| `aboutBody` | …independent goal colors; the product composes them… | …which gives a separate color for each goal. The app lets you choose up to two goals and combines their colors into one outfit… | "The product composes" was internal language. The source/app split is now explicit. |
| `sourceJoin` | with corroboration from | supported by | Plainer. |
| `dateError` | We could not read a valid device date… | We couldn't read today's date from your device. Check your date and time settings, then try again. | Plainer, and it points to a setting users can actually find. |

Reviewed and kept: goal labels (Work, Money, Luck & opportunity, Mentor support), "Lucky color family", "Your shade", "Lucky color", "Supporting neutral", "Light neutral", "Neutral", headings, and the CTA. The colour spelling is "color" throughout.

## 5. Terminology

| Concept | TH | EN | Where |
|---|---|---|---|
| Lucky colour (status of a piece) | สีมงคล | Lucky color | Board note badge, source copy |
| Lucky colour family, broad | กลุ่มสีมงคล | Lucky color family | Summary shade line when there is no exact shade |
| Family name | สี + name (สีเขียว) | Green | Summary heading, placement notes, broad garment |
| Exact personalized shade | เฉดของคุณ | Your shade | Summary, once per claim |
| Supporting piece from the palette | สีจาก Personal Color | From your Personal Color | Board notes |
| Supporting neutral | สีกลางช่วยเสริม | Supporting neutral | Board notes |
| Broad neutral stand-ins | สีกลางอ่อน / สีกลาง | Light neutral / Neutral | General-mode garment names |
| Personal Color | Personal Color (untranslated product term) | Personal Color | Everywhere |

"Supporting color" alone was not used. Every supporting piece is either from the user's palette or a neutral, and the label says which.

## 6. Raw internal-value audit

The Daily page contains no goal IDs, placement or suitability enums, role or slot IDs, family IDs, fill kinds, storage values, error objects, `undefined`/`null`/`NaN`, or HEX. This covers visible text, `aria-label`, `title` and `alt`, in both languages, for every weekday, and in the error states.

Guarded by the Slice 5 raw-identifier audit and the new Slice 6 test. HEX remains intentionally absent from Daily; exact HEX appears only as SVG fills.

## 7. Date behaviour

- The weekday comes from `luckyWeekdayForDate(today)`, which uses local `Date` semantics (unchanged domain). The first render reads the device clock.
- `useLocalToday` holds one stable `Date` per local calendar day. A re-read on the same day returns the previous state object, so React bails out: focus and visibility events on the same day cause **zero commits** (tested with a `Profiler`).
- When the day changes, the new date flows into one `resolveDaily(today, goals, subtype)`. The goals, the profile and the language are separate state or props and are not touched, so a rollover keeps them, and no previous-day board can remain.
- No timezone or location service was added.

## 8. Midnight timer lifecycle

- **One timer at a time.** Every tick (timer, focus, visible) clears the pending timer, then schedules the next one, using the fresh clock reading rather than the mount-time date. The previous implementation scheduled from the stored `today`. It re-armed through a state change, so every focus caused a state change, a re-render, and a new effect run.
- **Wait length.** The next local midnight plus 50 ms, clamped between 1 s and 1 h. The 1 h cap means a sleeping device, a throttled timer or a changed device clock is caught within the hour, and the delay can never overflow `setTimeout`. `new Date(y, m, d + 1)` gives the true local midnight on DST days.
- **Effect dependencies.** The effect depends only on a stable callback; the clock is read through a ref. Goal, language and profile changes never touch the timer (tested).
- **Unmount.** Clears the timer and removes both listeners (tested; mutation 12).
- **Hidden tab.** `visibilitychange` to hidden does nothing; becoming visible re-reads the clock.

## 9. Storage read failure

`loadDailyLuckyColorGoals` (unchanged) already handled blocked storage and bad values. This slice adds UI-level tests:

- A `SecurityError` from `getItem` gives a usable Daily with Work.
- Malformed JSON gives Work.
- A legacy scalar `"luck"` gives Luck.
- A JSON string `"money"` gives Money.
- `42`, `null` and an object give Work.
- `["love","luck","luck"]` gives Luck; invalid and duplicate values are dropped, and the valid one is kept.
- `[]` gives Work.
- More than two IDs are cut to the first two (existing service test).

No raw error is shown and nothing is sent anywhere.

## 10. Storage write failure

`saveDailyLuckyColorGoals` already swallows write errors; Daily does not read storage back after a write. If `setItem` throws, the in-memory selection still changes, recommends, and replaces the oldest goal. Nothing reverts and no modal appears (tested; mutation 2).

No user-facing message is shown. The failure is harmless for this session: the only cost is that the choice is not remembered next time. A warning would add alarm without giving the user an action. The UI never claims persistence succeeded.

## 11. Invalid date and result errors

- **Reachability.** The device clock is `new Date()`, which is valid in practice. An invalid date is reachable only through the injected `clock` (tests or a mocked environment), or a broken host clock.
- **Fallback.** The existing localized fallback is kept rather than removed, and now has a **Try again** button. It never substitutes a weekday or fabricates a rule (tested: no weekday name appears while in the error state, and the retry recovers).
- **Result errors.** A recommendation that `buildOutfitBoardModel` rejects is now reported separately as `resultError`. Before, it wrongly blamed the device date. No board, summary or piece is rendered, nothing is guessed, and the error is logged to the console in development builds only.

This is the only view-level handling. There is no global error boundary.

## 12. Profile edge cases

- A valid `subtype` gives personalized mode.
- No profile, a partial record (no subtype), or a stale or unknown subtype gives honest general mode (tested). `validSubtype` checks against `subtypeOrder`; nothing is fabricated.
- Removing or changing the profile while Daily is open recomputes on that render, because the subtype is derived from props and is not stored. No exact fill, "Your shade", palette label or subtype name remains (tested; mutation 4).
- In the app, retaking the quiz leaves Daily. Once the profile is gone, the Daily tab is no longer shown.

## 13. Goal persistence edge cases

Reconfirmed by the existing and new tests:

- 1 or 2 goals; the last goal cannot be deselected; a third click replaces the oldest.
- Duplicates are impossible through the UI; malformed saved values are sanitized.
- Click order is kept only to know which goal to replace. The domain composition is order-independent: the Slice 4.1 audits and the locale/order test show the same pieces and fills.

## 14. Rapid interaction

A 10-step goal sequence with language flips in between was tested. After every step:

- the pressed goals equal the expected last two;
- the summary families equal the rule families for those goals;
- the board's lucky families equal the summary's;
- no family is claimed twice.

Also tested:

- the same pieces and fills in TH and EN;
- a profile change while visible;
- focus and visibility events after goal changes.

No React warnings appeared in the test run or in the 144 browser captures (0 console errors).

## 15. Board consistency

`resolveDaily` produces one `DailyState` from `(today, goals, subtype)`. Its single `OutfitBoardModel` feeds `TodayColors`, `OutfitBoard` and `OutfitNotes`, and the weekday comes from the same `today`. There is no second recommendation path.

## 16. Presentation mapper robustness

`buildOutfitBoardModel` is unchanged and still rejects duplicate pieces, a lucky piece without exactly one claim, a claim without a lucky piece, and a family-token mismatch.

A new view-level test feeds a real recommendation with its claims removed. The view shows the localized result error and renders no board. Mutation 11 makes the mapper invent a claim and is caught.

## 17. Accessibility semantics

- **Board.** A `section` labelled by its `h2`, containing a `ul aria-label` ("Outfit pieces"). Each `li` reads: `h3` role, colour name, then status. The status is "Lucky color · Work" or "From your Personal Color"/"Supporting neutral".
- **Hidden decoration.** The SVGs (`aria-hidden`, `focusable=false`), glow, ✦ tag and badge glyph are hidden, so nothing is announced as "image" and nothing is read twice.
- **Tests.**
  - In all 13 profile states with Work + Money, each dual lucky piece reads its own goal.
  - Supporting pieces never read "Lucky".
  - The ✦ glyph, enums and HEX are never spoken.
- **Why a list.** A list matches the content: a set of pieces in recommendation order. `figure`/`figcaption` was not adopted because the board has no single caption, and the section heading already names it. No ARIA widget roles.
- **Goal controls.**
  - Native `button`s with accurate `aria-pressed`, in a labelled `group`.
  - Selected state is shown by the border, fill and check mark, not by colour alone.
  - Focus uses the global 3 px teal ring.
- **Goal arrow keys.** Arrows now follow the visible 2 × 2 grid: Left/Right move ±1, Up/Down ±2, wrapping. Tab order is unchanged, since every button stays in it (no roving tabindex).
- **Focus after replacing a goal.** Focus stays on the clicked button (tested).
- **Disclosure.** Native `details`/`summary` (closed by default). The summary now has a 44 px tap target and a visible `:focus-visible` ring; the global rule covered buttons, links and inputs only.
- **Source links.**
  - The hrefs are unchanged, with `target="_blank" rel="noreferrer"` as before.
  - The visible text is the source name, localized for Thai Rath, and no raw URL is shown.
  - A visually hidden "(opens in a new tab)" / "(เปิดในแท็บใหม่)" is part of the link name.

## 18. Contrast, light and dark garments

Measured contrast ratios:

| Text / indicator | Before | After |
|---|---|---|
| Spring accent text on paper (weekday eyebrow, section kickers, "Today's color", story line 2, disclosure summary, Daily text buttons) | 4.34:1 (below 4.5 at small sizes) | Uses `--accent-ink`: spring 7.2–8.1:1; every season ≥ 7:1 |
| Muted labels on the board (worst corner) | 4.91:1 | unchanged, passes |
| Lucky badge `--accent-ink` on the board | ≥ 7.2:1 | unchanged |
| White ✓ on the selected chip's accent | spring 4.91:1 | unchanged |
| Dashed broad-family ring on paper | 2.31:1 | 3.2:1 (alpha .38 → .58) |
| Light-garment outline on the board | 3.07:1 | ≈ 3.5:1 (alpha .5 → .56) |

Garment colours:

- **Fills.** Never changed. The test checks that no Daily CSS rule sets a `fill`, and that fills equal the recommendation.
- **Light garments.** White, cream, pale yellow, light beige and light grey (tone `light`) get the firmer neutral outline.
- **Dark garments.** Black, navy, burgundy, deep purple and dark grey (tone `dark`) get light seams and a darker collar shade. The ✦ tag keeps its cream ring, and the glow sits on the paper around the garment.
- **Text.** No text sits on a garment fill; the collision audit checks this.

## 19. Colour-vision independence

Every meaning is in text:

- the role;
- the colour name;
- "✦ Lucky color · <goal>" or the supporting status;
- the family names and goal chips in the summary;
- placement sentences.

The ✦ tag and glow are shape and light cues, not hue. Two lucky colours that look identical to a user are still told apart by name and goal.

## 20. Responsive and text-zoom audit — the large-text editorial gate

Baseline (Slice 5.1 build): **39 of 63** stress runs had note collisions, notes on garments or notes outside the canvas. They occurred at:

- 130–200 % text at 360 px;
- 200 % zoom at 360 px;
- 200 % text at 768 and 1280 px;
- two accessories at 320 px, even at 100 %.

**Decision: a deliberate re-flow mode.**

- **The rule.** The floating notes need a board that is wide relative to its text. Container queries in `em`, which follow the text size and not the screen, choose the layout:
  - editorial below 540 px when the board is at least 19em wide;
  - editorial at 540 px or more when the board is at least 34em wide;
  - otherwise re-flow.
- **Re-flow layout.**
  - The garments stay composed in an art area: compact coordinates on phones, the wide composition on wide screens.
  - The notes flow below at full size, in reading order, in an auto-fill grid.
  - The ✦ tag scales with the board, so at 200 % zoom it cannot hide a small accessory.
- **What this avoids.** No font was shrunk, no ellipsis or hidden label was added, and the canvas height is not inflated.
- **Tuning.** The second-accessory note in the narrow editorial layout moved from 55 to 59cqw. That cleared the one remaining collision at the 19em threshold (Thai, two accessories).

Results (headless Chrome, final build):

- 91-run stress matrix: 0 issues. Widths 320–1280, text scale 1.0–2.0, zoom 1 or 2.
- Final QA: 144 captures, 0 issues, 0 console errors (§21).
- "Luck & opportunity" still wraps to three readable lines at 360 px, 100 %. That is intentional and not treated as a bug.

The harness checked, for every capture:

- note/note and note/garment overlap;
- anything outside the canvas;
- horizontal clipping of any Daily element;
- horizontal page scroll;
- off-screen controls;
- goal chips shorter than 44 px.

Other items:

- **Font sizes.** No fixed-height text containers are used, and chips, badges and notes grow naturally.
- **Touch targets.**
  - Goal chips: ≥ 50 px.
  - Text buttons: 48 px.
  - Summary: now 44 px.
  - Inline source links fall under the WCAG inline-link exception.

## 21. Visual QA actually performed

This QA used headless Chrome over CDP, with the page clock pinned and storage seeded (throwaway scratchpad harness `qad6.mjs`, not committed).

- **Enlarged text.** Emulated by scaling the root font size (the app sizes text in `rem`).
- **Browser zoom.** Emulated as a CSS viewport of width ÷ zoom at `deviceScaleFactor = zoom`.
- **Cases.**
  - TH single and TH dual personalized; EN single and EN dual personalized.
  - General mode.
  - Accessory fallback and two-accessory fallback.
  - Light garment and dark garment.
  - Longest labels (Luck & opportunity + Mentor support).
  - About disclosure open.
- **Configurations.** 320, 360, 430, 768 and 1280 px at 100 %; 360 and 1280 px at 200 % text; 360 px at 200 % zoom. 144 captures in total.
- **By eye.** The re-flow mode, light garments, dual mode and the open disclosure were inspected.
- **Not performed.**
  - No real phone.
  - No TalkBack or VoiceOver session.
  - No Safari/WebKit.
  - No OS-level font scaling, which is emulated as described above.

## 22. Tests added

The new file `DailyPolish.test.tsx` has 20 tests. Brief items A–W:

- **Copy.** TH/EN key parity with no empty string (A, B); Thai has no full stops or stray English.
- **Leakage.** No raw identifier or HEX in text or accessible attributes, in both languages, for every weekday and in the error states (C, D).
- **Storage.** Read throws (E); write throws (F); malformed and legacy values (G, H).
- **Profile.** Missing, partial, stale or removed profile gives general mode (I, J).
- **Date lifecycle.**
  - Midnight rollover keeps two goals, the profile and the language, and recomputes the weekday and families (K, L).
  - The timer is cleared on unmount (M).
  - Repeated focus or visibility on the same day causes zero commits and still one timer (N).
  - One timer across goal, language and profile changes.
- **Interaction.** Rapid replacement with language flips (O); locale parity of pieces and fills (P).
- **Errors.** An inconsistent recommendation gives an honest error (Q); an unreadable date gives an error that recovers on retry.
- **Colour treatment.** Light and dark garment treatment without touching the fill (R, S).
- **Screen reader.** Dual lucky pieces each read their goal (T); supporting pieces never read as lucky (U).
- **Disclosure.** Native `details`, localized links, new-tab hint, hrefs (V).
- **Reduced motion.** The board animation is off (W).
- **Re-flow CSS gate.** The re-flow rules exist, and no Daily ellipsis is used.
- **Grid arrows.** Arrow-key grid navigation, and focus is kept on a replaced goal.

Existing tests were updated only for the audited strings.

## 23. Exhaustive audits

All are unchanged and passing:

- 70 weekday × selection combinations and 42 general dual combinations (`multiGoal.test.ts`).
- 504 personalized dual combinations.
- Order independence.
- 336 personalized and 28 general single-goal regressions.
- Slice 5 presentation audits: 130 colour × profile boards, 910 real day × selection × profile boards, and the raw-identifier audit.
- The 177,147-combination quiz scoring audit.

## 24. Mutation testing

The 12 mutations required by the brief were each applied alone. The Daily and service tests were run against each one, and the file was restored byte-for-byte (verified by hash, and the working-tree diff hash is unchanged afterwards).

| # | Mutation | Failing tests |
|---|---|---|
| 1 | Reading storage throws and crashes Daily | 1 |
| 2 | A failed write reverts the selection | 1 |
| 3 | Midnight drops the second goal | 2 |
| 4 | Stale personalized board survives profile removal | 1 |
| 5 | Raw goal ID leaks into visible copy | 8 |
| 6 | Raw placement enum leaks | 4 |
| 7 | HEX becomes visible | 5 |
| 8 | Supporting piece announced as lucky | 1 |
| 9 | One dual goal disappears from the accessible description | 1 |
| 10 | Reduced motion still animates the board | 1 |
| 11 | The mapper fabricates a missing claim instead of rejecting | 10 |
| 12 | Timer survives unmount | 1 |

On the first run, two mutations survived:

- **#8.** The screen-reader test sorted pieces into lucky and supporting by their spoken text, so a supporting piece that said "Lucky color" was simply counted as lucky. The test now classifies pieces by `is-lucky`/`is-support` and asserts the spoken status of each group.
- **#2.** The first version reverted inside the save effect, which loops forever when the write keeps failing: it hung the run rather than failing a test. It was replaced with a loop-free revert: the goal change is dropped when a write fails.

Both were then caught.

## 25. Performance and privacy

- **SVG and assets.** Unchanged, inline and lightweight; no asset was added; no animation loop.
- **Rendering.** Focus and visibility on the same day no longer re-render anything (§7). `resolveDaily` is memoised on `(today, goals, subtype)`, so language changes re-render copy without recomputing the recommendation.
- **Network and data.**
  - No network access is needed for Daily.
  - Source links open only when tapped.
  - No analytics or upload; no account.
  - Only local preference storage.
- **Dependencies.** No new dependency.

## 26. Known limitations

- No native Thai reader has reviewed the new copy. No real device, TalkBack or VoiceOver testing yet (Slice 7).
- Re-flow thresholds (19em / 34em) were tuned in Chrome with the current fonts. Other engines' text metrics may shift the exact switch point; the re-flow side is the safe side.
- The wide re-flow layout (≥ 540 px with very large text) leaves open space to the right of the art. That is acceptable for a rare case.
- **Kept on purpose.**
  - Garment silhouettes stay neutral; no gender-specific silhouettes were added (V1.3 scope decision).
  - The accessory stays a generic ring, because the domain names no accessory type.
- A failed save is not reported to the user (§10).

## 27. Real-device QA checklist (for Slice 7)

- **Browsers.** Android Chrome (360–412 px), and iPhone Safari if available.
- **Goals.**
  - Tap each goal; select two; tap a third and confirm the oldest is replaced.
  - Tap the last goal and confirm it stays selected.
- **Layout.**
  - Scroll the whole page with the bottom nav visible; the board is readable and nothing hides behind the nav.
  - System text size at the largest setting and at 130 %: the board switches to re-flow, nothing overlaps, and nothing scrolls sideways.
  - Browser zoom at 200 % on desktop.
- **Garments.** Pale yellow (Light Spring, Thursday + Money) and burgundy (Deep Winter, Saturday + Money) garments are clearly outlined; the ✦ tag is visible on both.
- **Language.** Switching TH ↔ EN keeps the goals and the outfit.
- **Rollover.** If practical, leave Daily open across midnight, or change the device date and return to the app; the weekday and colours update and the goals stay.
- **Offline.** Airplane mode: Daily still works; source links fail only when tapped.
- **Disclosure.** Opens and closes by tap and keyboard; links open in a new tab.
- **Screen reader** (TalkBack/VoiceOver) spot check. The board reads as a list of pieces with role, colour and status. The dual goals are both announced. Decorative art is silent.

## 28. Slice 7 handoff

- The Daily state has one path: `resolveDaily` → `OutfitBoardModel` → the summary, board and notes. Keep any new checks inside it.
- The layout mode is CSS only: editorial variables (Slice 5.1), plus the em-based re-flow container queries. Re-run the stress matrix after any change to font or copy length.
- The remaining items are real-device, assistive-technology and native-Thai review, per §27.
