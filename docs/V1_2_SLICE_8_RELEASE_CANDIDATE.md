# V1.2 Slice 8 — Capacitor Integration, Physical QA Preparation and Release Candidate Hardening

- **Written:** 2026-09-24.
- **Slice type:** the final engineering slice before the V1.2 release decision. V1.2 feature development is closed.
- **Status:** **READY FOR PHYSICAL QA.** V1.2 is **not** released.
- **Physical-device gates:** still pending. See [V1_2_PHYSICAL_QA.md](V1_2_PHYSICAL_QA.md).
- **Earlier records:**
  - [plan](V1_2_PHOTO_COLOR_CHECKER_PLAN.md)
  - [Slice 0 spike](V1_2_SLICE_0_DEVICE_SPIKE.md)
  - [Slice 3 image pipeline](V1_2_SLICE_3_IMAGE_PIPELINE.md)
  - [Slice 6 hardening](V1_2_SLICE_6_HARDENING.md)
  - [Slice 7 colour names](V1_2_SLICE_7_COLOR_NAMES.md)

## 1. Summary

**Changed:**
- The existing Vite app is now packaged for Android through **Capacitor 8.5.2**, with one codebase and one `dist`.
- The 12 `both.png` palette-art intermediates moved out of `public/`, so every build ships the same 97 files.
- The DEV diagnostics panel is now removed from the production bundle, which saves 12.46 kB raw / 2.38 kB gzip.
- A concise physical QA checklist was written.

**Not changed:** app behaviour, engines, thresholds, taxonomy and copy.

**Not built:** the native debug APK. It is **ENVIRONMENT BLOCKED**: this machine has a JDK but no Android SDK (§17).
Everything on the repository side is in place and was verified. The web payload the APK would carry was tested in
Chrome as Capacitor serves it.

## 2. Entry state

| | Value |
|---|---|
| Branch | `main` |
| HEAD | `f8fd1dfbaea2ccaaa40e989c611099df445fea1d` (Slice 7) |
| Working tree | clean |
| Ahead of `origin/main` | 14 |
| `package.json` version | `1.1.0` (unchanged) |
| Vite config | `vite.config.ts`: the React plugin plus Vitest settings; **no `base`** (default `/`); `.kilo/**` excluded from tests |
| Capacitor before this slice | none: no `@capacitor/*`, no `android/`, no config (plan §3) |
| Service worker / PWA | none |

## 3. Frozen (not touched)

- The quiz, its scoring and the subtypes.
- Palettes.
- Manual scoring and thresholds.
- The Photo matcher, its sampler, radius, trim and thresholds.
- Mixed/highlight/shadow detection.
- OKLab.
- The colour-name taxonomy, thresholds and grammar.
- Verdicts, placement, pairing and lighting guidance.
- File-size and 60 MP limits, and HEIC classification.

**Changes to `src/` in this slice:**
- one expression in `App.tsx` (§14)
- one new test file

## 4. Capacitor version and compatibility

| Item | Value |
|---|---|
| Node | 22.15.1 (Capacitor 8 CLI requires ≥ 22) |
| npm | 11.4.2, `package-lock.json` |
| Vite / React / TypeScript | 8.3.0 / 19.3.0 / 7.0.2 |
| Capacitor | **8.5.2**, the current stable release, for `core`, `android` and `cli` |
| Android template | AGP **8.13.0**, Gradle **8.14.3** (wrapper), compileSdk **36**, targetSdk **36**, minSdk **24** |

**Config format: JSON, not TypeScript.**
- `capacitor.config.ts` is loaded by the CLI through the TypeScript JS API.
- This repository uses TypeScript 7 (the native compiler), so a `.ts` config would couple native builds to that API.
- `capacitor.config.json` has no such dependency.

## 5. Dependencies added

| Package | Where | Why |
|---|---|---|
| `@capacitor/core` 8.5.2 | dependencies | Required peer of `@capacitor/android`. **Not imported by app code**, so it adds 0 bytes to the web bundle |
| `@capacitor/android` 8.5.2 | dependencies | The Android platform (WebView shell, local asset server, file chooser) |
| `@capacitor/cli` 8.5.2 | devDependencies | `cap add` / `cap sync` |

**Not added:** any plugin, including camera, filesystem, preferences, network, browser and splash-screen plugins.

**Version style:** versions are pinned exactly, matching the repository's style. npm re-sorted the existing entries of
`dependencies` alphabetically; no existing version changed.

## 6. Configuration and identity

```json
{ "appId": "io.github.patipankong.personalcolorpocket", "appName": "Personal Color Pocket", "webDir": "dist" }
```

- **appName:** the product name, unchanged.
- **appId:** the project has no domain or organisation, so the id is derived from the repository owner's real GitHub
  namespace (`github.com/patipan-kong`), in the conventional `io.github.<owner>.<app>` form.
  - The hyphen is dropped, because Java package segments cannot contain one.
  - This invents no company identity.
- **The appId becomes permanent** after the first Play Store upload. If a real domain is acquired, change the appId
  **before** that upload, in:
  - `capacitor.config.json`
  - `android/app/build.gradle` (`namespace`, `applicationId`)
  - `strings.xml`
  - the `MainActivity` package

## 7. Architecture

```
React/Vite source ── npm run build ──► dist/ ──► web hosting (unchanged)
                                         │
                                         └─ npx cap sync android ──► android/app/src/main/assets/public ──► APK WebView
```

- One application, one `dist`, and no native code of our own. `MainActivity` is the template's empty
  `BridgeActivity`.
- Capacitor serves the bundled files from `https://localhost/` (its local asset server). No network is involved.
- **Source control follows normal Capacitor practice:**
  - The `android/` project is committed: Gradle files, the wrapper, the manifest, resources and `MainActivity`.
  - The generated `android/.gitignore` excludes:
    - the synced web copy (`app/src/main/assets/public`, `capacitor.config.json`, `capacitor.plugins.json`)
    - `capacitor-cordova-android-plugins/`
    - `build/`, `.gradle/`
    - `local.properties`, which holds the machine's SDK path
  - `npx cap sync android` regenerates all of these from `dist`.

## 8. Web asset paths

- **Audited:** script, CSS and image paths, quiz visuals, palette art, `fetch`, `new URL`, `import.meta`, routing,
  history and location.
  - Every asset is a root-absolute path (`/assets/…`, `/img/…`, `/favicon.svg`, `/color-draping.png`).
  - There is **no router**: views are React state.
  - The only `import.meta` use is `import.meta.env.DEV`.
  - The only `fetch(` is Vite's modulepreload polyfill.
  - `location` is used only for `?debug=color`.
- **Capacitor serves the web root at the origin root,** so root-absolute paths resolve unchanged.
  - **Proved:** the synced Android payload was served at an origin root and run end to end (§19). All 50 requests
    resolved; nothing was missing.
- **Vite `base` was not changed.** Opening `dist/index.html` from `file://` remains unsupported, and Capacitor does not
  need it.

## 9. Network and offline

- **App code makes no network request.** The ad service is a no-op, and there is no analytics, crash-reporting or ad
  SDK.
- **Inside the APK:**
  - All assets are local (`assets/public`, served from `https://localhost/`), so the UI and photo analysis need no
    internet after installation.
  - **Automated proof** (§19): the HTTP server was stopped and Chrome set offline. The photo decode, tap, verdict and
    Manual check still worked, and no request in the session left the app's origin.
  - A physical cold start in airplane mode is gate A16.
- **Web:** unchanged. A cold visit needs the network (there is no service worker), and analysis is local once loaded.
- **No service worker was added.**

## 10. Photo picker in Capacitor

- The markup is still `<input type="file" accept="image/*">`, with **no `capture` attribute**. A test now guards this.
- **Code path, read from `@capacitor/android` 8.5.2's `BridgeWebChromeClient.onShowFileChooser`:**
  - With no capture flag, it calls `showFilePicker`.
  - That uses `fileChooserParams.createIntent()`, an `ACTION_GET_CONTENT` intent for `image/*`, and launches the
    **system picker**. **No runtime permission is requested.**
  - The picker returns a `content://` URI with a temporary read grant. The WebView hands the page an ordinary `File`,
    so `openPhoto(file)` is unchanged.
- The camera path (which may request `CAMERA`) runs only when `capture` is set. We never set it.
- **Physical confirmation:** gates A2 and A17.

## 11. Android permissions

**Generated `AndroidManifest.xml`:** exactly one `<uses-permission>`, `android.permission.INTERNET`. The Capacitor
library manifest declares **none**.

| Permission | Kept? | Why |
|---|---|---|
| `INTERNET` | kept (template default) | A **normal**, install-time permission. There is no prompt, and it gives no access to user data. Capacitor's live-reload workflow (`server.url`, Slice 0 §17 C1) needs it. App code makes no request (§9). Removing it would make "no upload" OS-enforced; that is a possible later product decision, not needed for correctness |
| `${applicationId}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | expected in the **merged** manifest | Declared and used by AndroidX Core ≥ 1.9 as a `signature`-level, app-private permission. It grants nothing to other apps and is never prompted. It **cannot be confirmed without the SDK** (the merged manifest is a build output) |

- **Absent:** camera, microphone, location, contacts, and `READ_MEDIA_*` / `READ|WRITE_EXTERNAL_STORAGE` /
  `MANAGE_*`. A test guards this.
- **Other manifest items:**
  - Capacitor's FileProvider (`exported=false`) is template scaffolding for camera capture; our app never triggers it.
  - `allowBackup="true"` is the template default. It backs up WebView `localStorage`, which holds only the quiz
    profile, language and presentation. No photo is ever stored.

## 12. Privacy regression

| Claim | Evidence |
|---|---|
| Photo bytes, sampled pixels and file names are not uploaded | No network API in app code (Slice 6 guards: `photoPrivacy.test.tsx`, network guard). The bundle scan shows no XHR, `sendBeacon`, WebSocket or `fetch` beyond modulepreload. Every request in the Chrome sessions was same-origin (§19) |
| No analytics, ad or crash-reporting SDK | `package.json`: the only new packages are the three Capacitor packages. The ad service is a no-op |
| No Capacitor plugin receives the image | No plugin is installed, and **app code never imports `@capacitor/*`** (test) |
| No photo content is persisted | Unchanged Slice 6 storage guards. Capacitor adds no storage |

**"Photo analysis runs locally on the device" remains accurate for the web app and the Android app.**

## 13. `both.png` cleanup (Slice 6 F1)

**What they are:** 12 git-ignored 1536×1024 PNGs, about 2.4 MB each and **29.56 MB** in total. Each is the source image
that was split into its subtype's tracked `men.webp` and `women.webp` (768×1024). They are product art, not personal
photos, and no code references them.

**What changed:**
- They moved from `public/img/personal-color/<subtype>/both.png` to `asset-sources/personal-color/<subtype>/both.png`.
  - The SHA-256 of all 12 was verified identical after the move. **Nothing was deleted.**
  - The production `.webp` assets are untouched.
- `.gitignore` now ignores `asset-sources/`.
- The old `public/…/both.png` ignore rule is **removed**, so an intermediate re-created in `public/` shows up in
  `git status` instead of silently shipping.
- **New test:** `public/` must contain exactly the assets the app references, and no `both.png`.

**Result:**

| Build | Files | Size |
|---|---|---|
| Local, before | 109 | 38.47 MB |
| Local, after | **97** | **8.90 MB** |

The local build and a clean-checkout build are now **byte-identical** (SHA-256 over every file).

## 14. DEV diagnostics panel (Slice 6 F7)

**Found:**
- The panel was gated at runtime: `showDiagnostics` came from a `useMemo` and was passed as a prop.
- The bundler could not prove it false, so the panel component and `buildDiagnosticReport` (answer traces, rankings,
  a clipboard copy) shipped although they never rendered.
- It **exposed nothing sensitive**: it only shows the scoring of the user's own answers, and never rendered in
  production.

**Fix:** one expression at the render site, `{import.meta.env.DEV && showDiagnostics && <DiagnosticPanel …/>}`.
- In production, `import.meta.env.DEV` is the constant `false`, so the JSX, the component and the diagnostics module
  are removed.
- Dev behaviour is identical: `?debug=color` still opens it, and the existing `styleExperience.test.tsx` test still
  passes.

| | Before | After | Δ |
|---|---|---|---|
| JS raw | 386.95 kB | 374.49 kB | **−12.46 kB** |
| JS gzip | 114.67 kB | 112.29 kB | **−2.38 kB** |

- **Bundle scan:** `diagnostic-panel`, `answerTrace`, `buildDiagnostic` all **0**.
- **Left alone:** the `.diagnostic-panel` CSS rules (a few hundred bytes). Removing them is not worth touching the
  stylesheet in a release candidate.
- **New test:** the render site keeps the compile-time gate.

## 15. Existing follow-ups (classification)

| # | Item | Class | Reason |
|---|---|---|---|
| F1 | `both.png` in local builds | **FIXED** | §13 |
| F2 | Slice 0 spike | **FOLLOW-UP (keep)** | §16 |
| F3 | Tabs ARIA (`aria-controls` to an unrendered panel; no arrow-key roving) | **FOLLOW-UP** | Shared with the palette tabs. Tabs work by tap, click, Tab and Enter. TalkBack/VoiceOver (A15/I8) will show whether it matters in practice. Aligning both tab sets with the WAI-ARIA pattern is not a one-line change |
| F4 | `openPhoto` reports a decode failure instead of `aborted` when both coincide | **ACCEPTED LIMITATION** | Not user-visible: stale requests are dropped by the panel |
| F5 | A mouse drag that starts outside the photo and ends on it samples a spot | **ACCEPTED LIMITATION** | Desktop mouse only. Touch scrolls end in `pointercancel`, and the Android app is touch-only |
| F6 | Open product questions Q1/Q3/Q5 | **FOLLOW-UP** | Product decisions, not engineering |
| F7 | DEV panel in the bundle | **FIXED** | §14 |

**Blockers found:** none.

## 16. Slice 0 spike

**Decision: keep** `spikes/photo-device-spike/` **until the physical matrix is recorded.**
- **Why it still helps:** it measures decode time and peak memory **per decode method** at 12/24/48 MP. If A5 (48–50
  MP) crashes, those numbers decide the new cap, and the production app cannot measure them.
- **Not shipped:**
  - Vite builds only `index.html`, so the spike is not in `dist`.
  - Because `cap sync` copies `dist`, it is not in the Android assets either.
  - A bundle scan finds `spike` 0 times.
- **Retire it** in the release step, after the physical QA results are recorded (Slice 0 §21).

## 17. Android build

**Attempted with the generated Gradle wrapper:** `gradlew.bat assembleDebug`.

| Item | Value |
|---|---|
| JDK | `JAVA_HOME` = Oracle JDK **21.0.2** (Gradle launcher and daemon). Temurin 21.0.11 is also on `PATH` |
| Gradle | 8.14.3 (wrapper, downloaded to `~/.gradle`) |
| AGP | 8.13.0 |
| compile / target / min SDK | 36 / 36 / 24 |
| Android SDK | **not installed.** Android Studio (2024.1) is installed but its SDK was never downloaded: no `ANDROID_HOME`, no `%LOCALAPPDATA%\Android\Sdk` |
| Result | Project configuration succeeded, then `SDK location not found`. **BUILD FAILED → ENVIRONMENT BLOCKED** |
| APK | not produced |

**Not done:** installing the SDK. It means downloading Google's SDK and **accepting its licence on the owner's
behalf**, so it was left to the owner.

**To build:**
1. In Android Studio → SDK Manager, install:
   - Android SDK Platform 36
   - Build-Tools
   - Platform-Tools
2. Point Gradle at the SDK, either:
   - set `ANDROID_HOME`, or
   - write `sdk.dir=C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk` in `android/local.properties` (git-ignored).
3. Build:

```
npm run build
npx cap sync android
cd android
gradlew.bat assembleDebug        # → android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

- **Not in scope:** signing and a Play Store release build.
- **Before a store release** (outside this slice):
  - `versionName` / `versionCode` (the template's `1.0` / `1`)
  - the launcher icon and splash, which are still Capacitor's placeholders
  - the appId decision (§6)

## 18. APK content audit (web payload)

**Without an APK,** the audit covers `android/app/src/main/assets/public`. `cap sync` wrote it, and it is exactly the
web content the APK packs:

| Check | Result |
|---|---|
| Same as `dist` | **identical**, plus Capacitor's two empty stubs `cordova.js` and `cordova_plugins.js` |
| Files | 99 (97 + 2 stubs), 8.90 MB |
| Contents | 92 `.webp`, 1 `.png` (`color-draping.png`, 2.92 MB, the largest), 1 JS (374 kB), 1 CSS, `index.html`, `favicon.svg` |
| `both.png`, `.kilo`, spike, tests, reports, `.md`, fixtures, photos (`.jpg`/`.heic`), source maps | **none** |

**Also carried by a real APK:** the Capacitor/AndroidX runtime (roughly 3–5 MB of DEX and resources, typical; not
measured here).

**Still to do:** a real APK audit (`unzip -l app-debug.apk`) once the SDK exists.

## 19. Automated smoke test (desktop Chrome, not a substitute for phones)

**Harness:** headless Chrome 153 over CDP, with a local HTTP server that, like Capacitor, answers unknown paths with
`index.html`.

**Instrumentation:**
- Any request for a missing file is recorded.
- Console errors and warnings, exceptions and failed loads are captured.
- Every request URL is checked against the app origin.

**A. Capacitor-shaped cold start:** served from **`android/app/src/main/assets/public`** at the origin root, at 390 px.
**20 / 20 PASS.**
- The first load shows the welcome page and its image.
- The quiz ran from empty storage through the UI, 11 questions and a presentation choice; all quiz visuals loaded.
- The result appeared and persisted across a reload.
- My Palette (palette and examples tabs) loaded its images.
- **Manual, EN:** `Light Gray · เทาอ่อน`, the HEX as a `span`, the second language `aria-hidden`, and no photo
  wording.
- **Photo:**
  - the input is `accept="image/*"` with no `capture`
  - a PNG was chosen, decoded locally, and the input was cleared
  - a tap showed the marker, `Coral · ส้มคอรัล`, a verdict and the caveat
  - `#F4F4F2` gave `Off-White · ออฟไวท์` with the lighting note
- **Errors:**
  - a HEIC header gave the friendly HEIC message
  - a file of 30 MiB + 1 byte gave the size message
- **Mode switching:** Photo → Manual → Photo gives a fresh panel.
- **Thai,** switched through the header: `เทาอ่อน · Light Gray`, and in Photo `ออฟไวท์ · Off-White` with the note.
- **Offline:** with the **HTTP server stopped** and the network offline, the photo decode, tap and verdict still worked,
  and so did Manual.
- **Hygiene:** 50 of 50 requests went to the local origin. No missing assets and no console errors.

**B. Web regression** from `dist` at **320 / 390 / 1280 px × EN / TH**. **9 / 9 PASS.**
- Each run: a cold-start quiz, the result, My Palette (both tabs), Manual `#D0D1D5` and the Photo note case.
- Horizontal overflow was 0 everywhere, and no image was broken.
- The names were correct and locale-ordered.
- All 270 requests were same-origin. No missing assets and no console errors.
- Screenshots were reviewed. One quiz capture is faded only because it was taken during the page-enter fade.

**Guard mutations of the new tests: 5 / 5 caught.** They were:
- a `both.png` put back in `public/`
- a `CAMERA` permission
- a `capture` attribute
- the DEV gate reverted
- `webDir` changed

## 20. Bilingual colour-name regression

**Slice 7 behaviour is preserved:**
- TH shows Thai first, EN shows English first, and both are always visible.
- The secondary language is `aria-hidden`, with the correct `lang`.
- The HEX is a small, muted `span` below the name.
- The Slice 7 integration and mutation-guarded tests all pass.
- The taxonomy was not touched.

## 21. Tests, audit, build

| Run | Files | Tests | Result | Duration |
|---|---|---|---|---|
| 1 | 38 | 1,162 passed + 1 skipped | pass | 26.84 s |
| 2 | 38 | 1,162 passed + 1 skipped | pass | 24.68 s |
| 3 | 38 | 1,162 passed + 1 skipped | pass | 24.06 s |

That is 1,153 tests from Slice 7 plus the 9 new release-candidate tests.

- **Test discovery:** `.kilo/**` is still excluded. `.kilo/worktrees/endurable-sundial` was not touched.
- **Exhaustive quiz audit:** **177,147 / 177,147**.

**Build audit:**
- `dist`: 97 files, 8.90 MB.
  - 92 `.webp` quiz, palette and presentation images, plus `color-draping.png` (2.92 MB).
  - `index.html` and `favicon.svg`.
  - 1 JS file and 1 CSS file.
- **Not present:** `both.png`, spike, `.kilo`, tests, dev audit/report files and personal photos.
- **Bundle scan:** 0 each for:
  - `diagnostic-panel`, `answerTrace`, `colorNamesAudit`, `syntheticCorpus`, `investigation`
  - `vitest`, `describe(`, `expect(`, `console.log`, `spike`, `localhost`, `sourceMappingURL`
  - XHR, `sendBeacon`, WebSocket, `indexedDB`, `caches.`, `serviceWorker`
  - `capacitor`
- **Bundle vs Slice 7:**

| | Slice 7 | Slice 8 | Δ |
|---|---|---|---|
| JS raw | 386.95 kB | 374.49 kB | −12.46 kB (DEV panel removed) |
| JS gzip | 114.67 kB | 112.29 kB | −2.38 kB |
| CSS raw | 37.09 kB | 37.09 kB | 0 (same hash `DqhEBIf1`) |
| CSS gzip | 8.44 kB | 8.44 kB | 0 |

Capacitor adds **0 bytes** to the web bundle.

**Dependency audit (`npm audit`):**
- **0 vulnerabilities in runtime dependencies** (`--omit=dev`).
- **3 moderate issues in dev tooling**, all one chain: `@capacitor/cli` → `xcode` → `uuid < 11.1.1` (GHSA-w5hq-g745-h8pq).
  - That code path is iOS project tooling. We don't use it, and nothing ships.
  - npm's only "fix" is a forced **downgrade** of the CLI to 8.4.3.
  - **Accepted; revisit on the next Capacitor CLI release.**

## 22. Release gates (all PENDING — human)

See [V1_2_PHYSICAL_QA.md](V1_2_PHYSICAL_QA.md) §6.

| Gate | State |
|---|---|
| 48–50 MP on physical Android (decides the provisional 60 MP limit) | PENDING |
| Real iPhone HEIC | PENDING |
| TalkBack | PENDING |
| VoiceOver | PENDING |
| Native Thai review (all strings, including the colour names) | PENDING |
| Capacitor picker, no permission prompt, offline APK | PENDING (**also needs the SDK to build the APK**) |
| Same-garment five-tap stability | PENDING |

- The **web** V1.2 release depends on every gate except the APK-only row.
- The **Android app** release also needs the APK row.
- No version bump or tag is made until these are recorded.

## 23. Known limitations

- The native APK was not built or run here (no SDK). Picker, permission and offline behaviour inside a real WebView are
  confirmed only by code reading and a desktop simulation.
- The merged-manifest permission list is inferred, not observed.
- The launcher icon and splash are Capacitor's placeholders; the version name is the template's `1.0`.
- **Unchanged from earlier slices:**
  - a photo's colour is not the fabric's colour
  - a boundary colour's name can alternate between taps
  - Manual and Photo verdicts can differ for one HEX
  - web cold starts need the network
  - HEIC does not decode in Chromium or the Android WebView
- Dev-tooling `npm audit` findings (§21).

## 24. Next input

**The human physical QA results.** V1.2 is **READY FOR PHYSICAL QA** and is not released.
