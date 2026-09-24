# V1.2 Physical QA Checklist

Human testing on real phones for the V1.2 release decision.

- **Status:** NOT YET PERFORMED. Every row below is blank.
- **Automated gates:** passed in [Slice 8](V1_2_SLICE_8_RELEASE_CANDIDATE.md).
- **Scope:** this list covers only what a phone can prove.

**How to use it:**
- Fill `Result` with **PASS** / **FAIL** / **N/A**, and add a note for anything surprising.
- A FAIL needs evidence:
  - a screenshot or screen recording
  - the photo's size in megapixels, and its format
  - the phone model and RAM
- **Do not tune any threshold because of a result.** Record it and hand it back.

## 0. Test record

| Field | Value |
|---|---|
| Tester | |
| Date | |
| Android phone (model / RAM / Android version / Chrome or WebView version) | |
| Surface tested on Android | ☐ debug APK (Capacitor) ☐ Chrome website — do both if possible |
| iPhone (model / iOS version) | |
| Build / commit tested | |

**Getting the Android app (debug APK).** An Android SDK is needed; see
[Slice 8 §17](V1_2_SLICE_8_RELEASE_CANDIDATE.md#17-android-build). Then run:

```
npm run build
npx cap sync android
cd android && gradlew.bat assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**Getting the website:** on the same Wi-Fi, run `npm run dev`, then open `http://<PC-IP>:5173/` on the phone. Any
HTTPS preview of the production build also works.

**Optional desktop inspection:** debug builds and Chrome can be inspected from a desktop at `chrome://inspect`, to
watch the console and the Network tab.

## 1. Android

| ID | Action | Expected | Result | Notes |
|---|---|---|---|---|
| A1 | Install/open the app (or the site). Complete the quiz, or reuse a saved profile. | Opens normally; quiz images show; result appears; profile is still there after closing and reopening | | |
| A2 | Color Checker → Photo → **Choose photo** | The system photo/file picker opens. **No permission prompt** of any kind | | |
| A3 | Pick a normal camera photo (~12 MP) | Ready in about 1.5 s or less; a tap gives a marker, a bilingual name, a HEX and a verdict | | |
| A4 | Pick a 24 MP photo | Loads; note roughly how long it takes | | |
| A5 | Pick a **48–50 MP** photo (high-resolution camera mode) | **No crash, no app/tab reload.** It loads, or shows the friendly "too large" message. If it crashes, record the RAM and megapixels: this decides the 60 MP limit | | |
| A6 | Pick a photo taken in **portrait** | Upright preview; the marker sits under your finger; the colour matches the spot | | |
| A7 | Pick a photo taken in **landscape** | Upright preview; marker and colour correct | | |
| A8 | Replace the photo quickly, about 5 times (A → B → C …), and reselect the same photo once | Only the last photo is shown; no stale result; reselecting reopens it; no growing sluggishness | | |
| A9 | Tap the centre, near the edges, and different areas of a garment | The marker follows every tap; nothing is sampled outside the photo | | |
| A10 | White/off-white garment, **even daylight** | A plausible light name (e.g. White / Off-White / Light Gray); lighting note shown; verdict readable | | |
| A11 | White/off-white garment in **shade or warm indoor light** | Note shown; the name may drift (e.g. Cool Gray): that is the photo, not the fabric. Re-tapping an evenly lit spot moves it lighter | | |
| A12 | Dark garment | Plausible dark name; **no** lighting note | | |
| A13 | Saturated garment | Plausible name; no lighting note; verdict stable across nearby taps | | |
| A14 | Mixed pattern (stripes/print) | The "mixed" warning appears and reads well | | |
| A15 | **TalkBack** on: choose a photo, tap/double-tap to check a spot, switch Manual ↔ Photo | Controls are announced; one summary per check; the colour name is spoken **once**, in the page language | | |
| A16 | **Airplane mode** after the app has opened; pick and check a photo; use Manual | Everything works. APK: also cold-start the app while in airplane mode; it must fully load | | |
| A17 | APK only: Settings → Apps → Personal Color Pocket → Permissions | "No permissions requested" (or an empty list). There was no prompt at any point | | |
| A18 | Optional: Samsung "Save as HEIF", or an iPhone HEIC copied to the phone | The friendly HEIC message, not a crash or blank screen | | |

## 2. iPhone (Safari; no iOS app in V1.2)

| ID | Action | Expected | Result | Notes |
|---|---|---|---|---|
| I1 | Open the site in Safari | Loads normally; quiz and result work | | |
| I2 | Choose a real **HEIC** photo from Photos | The picker returns it | | |
| I3 | Check that HEIC photo | It decodes and shows **or** it shows the friendly HEIC message. Never a blank or a crash | | |
| I4 | A portrait / rotated photo | Upright; marker and colour agree | | |
| I5 | A JPEG (e.g. a screenshot, or "Most Compatible" camera format) | Same as A3 | | |
| I6 | White/off-white garment, even light then shade | Same as A10 / A11 | | |
| I7 | Replace the photo quickly several times | Same as A8 | | |
| I8 | **VoiceOver**: the same flow as A15 | Same as A15 | | |

## 3. Shared real-world colour set

Use real garments. Photos can come from either phone.

The goal is not textile-accurate measurement. For each colour, ask:
- Does the bilingual name make sense for the colour **visible in the photo**?
- Is the verdict understandable?
- Does the lighting guidance explain the odd cases?

| ID | Garment colour | Name shown (EN · TH) | HEX | Verdict | Name sensible? | Notes |
|---|---|---|---|---|---|---|
| R1 | white / off-white / very light gray | | | | | |
| R2 | cream / beige | | | | | |
| R3 | medium neutral (gray, taupe, khaki) | | | | | |
| R4 | dark (navy, charcoal, black, brown) | | | | | |
| R5 | saturated bright (red, cobalt, emerald…) | | | | | |
| R6 | muted / soft (dusty pink, sage…) | | | | | |
| R7 | mixed / patterned | | | | | |

## 4. Same-garment five-tap test (human observation)

For **at least 3 solid garments**, tap about 5 reasonable points on each: flat, evenly lit, and away from edges and
folds.

| Garment | Tap | Name (EN · TH) | HEX | Verdict |
|---|---|---|---|---|
| G1: | 1 | | | |
| | 2 | | | |
| | 3 | | | |
| | 4 | | | |
| | 5 | | | |
| G2: | 1–5 | | | |
| G3: | 1–5 | | | |

- **PASS:** the HEX varies, but the name stays the same or moves to a close neighbour (e.g. Light Gray ↔ Light Cool
  Gray, Off-White ↔ White), and the recommendation stays semantically stable.
- **INVESTIGATE:** nearby reasonable taps **repeatedly** jump to unrelated colour families, or the verdict flips
  between positive and negative.
- **Do not tune anything automatically.** Capture screenshots and hand the evidence back.

| Garment | PASS / INVESTIGATE | Why |
|---|---|---|
| G1 | | |
| G2 | | |
| G3 | | |

## 5. Native Thai review

A native Thai reader checks the Thai UI on a phone. Record **actual** awkward or wrong wording only. Another possible
translation is not a defect.

| Area | Examples to look at | Problem wording found (if any) | Suggested wording |
|---|---|---|---|
| Colour names | เทาอ่อน, เทาอมเย็น, เทาชาร์โคลอมเย็น, ชมพูหม่น, น้ำเงินเข้ม, แดงสด, ฟ้าอมเขียว, เขียวมะกอกเข้ม, เหลืองมัสตาร์ด, กรมท่า, เทาอมน้ำตาล, แดงไวน์ | | |
| Verdicts | the four verdict lines and the category chip | | |
| Placement guidance | "ถ้ายังอยากใส่สีนี้" cards | | |
| Lighting guidance | the light near-neutral note; highlight / shadow / mixed warnings | | |
| Picker and errors | choose/change photo, "Preparing photo", HEIC, too large, generic error | | |
| Photo label and caveat | สีที่เห็นในรูปนี้, and the caveat line | | |

**Also check (both languages):**
- The name reads *page language · other language*: TH `เทาอ่อน · Light Gray`, EN `Light Gray · เทาอ่อน`.
- The HEX is small and underneath.
- The verdict is the largest text.

## 6. Sign-off

| Gate | Result |
|---|---|
| 48–50 MP on physical Android (A5) — decides whether the 60 MP limit stays | |
| Real iPhone HEIC (I2–I3) | |
| TalkBack (A15) | |
| VoiceOver (I8) | |
| Native Thai review (§5) | |
| Capacitor picker + no permissions + offline (A2, A16, A17 on the APK) | |
| Five-tap stability (§4) | |

V1.2 may be released only when every gate above is PASS, or is explicitly accepted with a written reason.
