# Personal Color Pocket

A mobile-first personal color companion that estimates a 12-season
personal-color subtype and helps users understand and use their palette.

## V1.0 features

- TH / EN
- Men / Women presentation
- 11-question visual-assisted quiz
- 12 subtype deterministic classification
- confidence / explanation
- personal palette
- style examples
- color checker
- local-only persistence
- no account/backend required

## Development

```
npm install
npm run dev
npm test
npm run build
```

`npm test` runs the repository's own test suite only; git-ignored tool worktrees under
`.kilo/` are excluded in `vite.config.ts`.

Everything in `public/` ships in `dist`. Keep source art and other intermediates in the
git-ignored `asset-sources/` folder instead.

## Android (Capacitor)

The Android app wraps the same production build: `npm run build` → `dist/` → Capacitor
WebView. There is no separate native implementation and no Capacitor plugin.

- Config: `capacitor.config.json` (`appId` `io.github.patipankong.personalcolorpocket`,
  `webDir` `dist`). The native project is in `android/`.
- Needs: Node ≥ 22, a JDK 21, and an Android SDK (platform 36). Point Gradle at the SDK with
  `ANDROID_HOME`, or with `sdk.dir` in `android/local.properties` (git-ignored).

```
npm run build
npx cap sync android              # copies dist into the Android project
cd android
gradlew.bat assembleDebug         # → app/build/outputs/apk/debug/app-debug.apk
```

- Permissions: the manifest declares only `INTERNET`, a normal permission with no prompt.
- Photo picker: the photo input opens the system picker without any permission.
- Offline: all app files are bundled in the APK, so after installation the app and photo
  analysis work offline.
- Status: see `docs/V1_2_SLICE_8_RELEASE_CANDIDATE.md` and the human checklist in
  `docs/V1_2_PHYSICAL_QA.md`.

## Architecture note

- scoring is deterministic
- generated fashion imagery is presentation/inspiration only
- canonical HEX palette data is authoritative
- presentation preference does not affect classification

## Privacy

- V1.0 stores profile state locally in the browser
- no account/backend/upload is required
- V1.2 Photo Color Checker: photo analysis runs locally on the device. The chosen photo is
  decoded, sampled and matched in the page; it is never uploaded or sent anywhere, and the
  photo, its file name, its pixels and the sampled colours are never stored
- the web app has no service worker: photo analysis keeps working without a network once the
  app is loaded in the tab, but a cold start needs the network
- the Android app is the same code in a WebView, and no Capacitor plugin ever receives a photo.
  It adds no analytics, ads or crash reporting
