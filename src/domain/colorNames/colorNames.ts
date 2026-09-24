import { hexToOklab, hueDifference, normalizeHex, oklabChroma, oklabHue } from '../personalColor/colorUtils'

// V1.2 Slice 7: a HEX colour → a short, stable, human-readable name in English and Thai.
// The HEX stays the measurement; the name is the everyday description of it ("Light Gray",
// "Soft Pink"), deliberately coarser, so nearby samples of one garment usually share it.
// Pure and deterministic. It knows nothing about where the colour came from (manual entry, a
// photo, a palette), about Personal Color subtypes, or about any matcher. Every threshold below is
// a NAMING constant, chosen from the palette corpus and the synthetic audit
// (docs/V1_2_SLICE_7_COLOR_NAMES.md); none is a matcher or scoring threshold.

export const COLOR_FAMILIES = [
  'white', 'off-white', 'cream', 'beige', 'taupe', 'brown', 'gray', 'blue-gray', 'charcoal', 'black',
  'red', 'burgundy', 'coral', 'orange', 'peach', 'yellow', 'mustard', 'olive', 'green', 'mint',
  'teal', 'blue', 'navy', 'purple', 'lavender', 'pink',
] as const
export type ColorFamily = typeof COLOR_FAMILIES[number]

// The basic colour each family belongs to: "Navy" is a blue, "Mustard" a yellow. Useful for
// measuring stability and for any later reuse of the vocabulary.
export type ColorGroup = 'white' | 'gray' | 'black' | 'brown' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink'
export const FAMILY_GROUP: Record<ColorFamily, ColorGroup> = {
  white: 'white', 'off-white': 'white', cream: 'white',
  beige: 'brown', taupe: 'brown', brown: 'brown',
  gray: 'gray', 'blue-gray': 'gray', charcoal: 'gray', black: 'black',
  red: 'red', burgundy: 'red', coral: 'orange', orange: 'orange', peach: 'orange',
  yellow: 'yellow', mustard: 'yellow', olive: 'green', green: 'green', mint: 'green',
  teal: 'teal', blue: 'blue', navy: 'blue', purple: 'purple', lavender: 'purple', pink: 'pink',
}

export type ValueModifier = 'light' | 'deep'
export type TemperatureModifier = 'warm' | 'cool'
export type ChromaModifier = 'soft' | 'bright'

// The structured name. The modifiers are exactly the ones in the name, relative to the family
// ("Light Yellow" is lighter than an ordinary yellow), not absolute measurements.
export interface ColorName {
  hex: string
  family: ColorFamily
  group: ColorGroup
  value: ValueModifier | null
  temperature: TemperatureModifier | null
  chroma: ChromaModifier | null
  en: string
  th: string
}

// ---- Naming thresholds (OKLab L 0–1, chroma C, hue h in degrees) ----

// Below this chroma a colour has no hue name and no warm/cool: it is white, grey or black.
// 0.015 is above what ±4 RGB noise on a true grey produces in its warm / cool directions, so a grey
// is not called "Warm" on one tap and "Cool" on the next from camera noise. A lower gate (0.0045,
// which would call all three light-suit samples "Cool") labels every grey both ways under ±2 noise.
// Dark greys need more: sRGB noise makes more OKLab chroma there (±4 on #202020 ≈ 0.020), so the
// gate rises to DARK_NEUTRAL_CHROMA at L ≤ 0.2.
export const NEUTRAL_CHROMA = 0.015
export const DARK_NEUTRAL_CHROMA = 0.022
export function neutralChroma(l: number) {
  const t = Math.min(1, Math.max(0, (0.6 - l) / 0.4))
  return NEUTRAL_CHROMA + t * (DARK_NEUTRAL_CHROMA - NEUTRAL_CHROMA)
}
// Below this chroma a colour is a tinted neutral (Warm Gray, Cool Charcoal, Off-White) and gets
// no hue name. It depends on lightness: a faint tint is visible on a pale colour (Icy Pink), while
// in darker colours sRGB noise alone makes more OKLab chroma (±4 RGB on a dark grey ≈ 0.019), so
// the gate rises from TINT_CHROMA (L ≥ 0.85) to DARK_TINT_CHROMA (L ≤ 0.35).
export const TINT_CHROMA = 0.022
export const DARK_TINT_CHROMA = 0.036
export function tintChroma(l: number) {
  const t = Math.min(1, Math.max(0, (0.85 - l) / 0.5))
  return TINT_CHROMA + t * (DARK_TINT_CHROMA - TINT_CHROMA)
}
// Below this chroma, warm and blue hues still read as neutrals: beige, taupe, blue gray.
export const MUTED_CHROMA = 0.045
// Chromatic families only: below SOFT the name says "Soft", from BRIGHT it says "Bright".
export const SOFT_CHROMA = 0.075
export const BRIGHT_CHROMA = 0.18

// Neutral lightness bands.
const WHITE_L = 0.98
const OFF_WHITE_L = 0.93
const GRAY_L = 0.45
const BLACK_L = 0.23

// Per-family lightness for "Light" (L ≥ first) and "Deep" (L < second). Families differ because
// a normal yellow is much lighter than a normal blue. null: that modifier is never used.
const VALUE_BANDS: Partial<Record<ColorFamily, [light: number | null, deep: number | null]>> = {
  red: [null, 0.52], orange: [null, 0.60], peach: [0.86, null], yellow: [0.90, null],
  olive: [0.66, 0.48], green: [0.76, 0.50], mint: [0.88, null], teal: [0.72, 0.50],
  blue: [0.72, 0.52], purple: [null, 0.45], lavender: [0.86, null], pink: [0.78, 0.55],
  brown: [0.60, 0.40], taupe: [0.62, 0.48], beige: [0.84, null], gray: [0.75, null], 'blue-gray': [0.72, 0.55],
}
// Families where "Soft" / "Bright" add information. Peach, mint, lavender, navy, burgundy, olive,
// mustard and the neutrals already imply their chroma.
const CHROMA_FAMILIES = new Set<ColorFamily>(['red', 'coral', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'])
// Only greys say warm / cool; every other family's name already carries its temperature.
const TEMPERATURE_FAMILIES = new Set<ColorFamily>(['gray', 'charcoal'])

// True when h lies on the circular arc from `from` to `to` (degrees, clockwise), so 350 → 20
// includes 0. Hue wraps at 360, and a red at 359° is next to one at 1°.
export function hueInArc(h: number, from: number, to: number) {
  const span = (to - from + 360) % 360
  return (h - from + 360) % 360 < span
}

function tintTemperature(h: number): TemperatureModifier | null {
  if (Math.abs(hueDifference(55, h)) <= 65) return 'warm' // yellow, orange and red tints
  if (Math.abs(hueDifference(245, h)) <= 60) return 'cool' // blue and blue-violet tints
  return null // green or purple tints: not called warm or cool
}

function neutralFamily(l: number): ColorFamily {
  if (l >= WHITE_L) return 'white'
  if (l >= OFF_WHITE_L) return 'off-white'
  if (l >= GRAY_L) return 'gray'
  if (l >= BLACK_L) return 'charcoal'
  return 'black'
}

function chromaticFamily(l: number, c: number, h: number): ColorFamily {
  // Muted warm and blue colours are still neutrals to most people.
  if (c < MUTED_CHROMA) {
    if (hueInArc(h, 20, 110) && l >= 0.72) return l >= 0.88 ? 'cream' : 'beige'
    if (hueInArc(h, 355, 110) && l < 0.72) return l >= 0.40 ? 'taupe' : 'brown'
    // A very light, faintly blue colour reads as a pale blue, not a grey.
    if (hueInArc(h, 200, 290) && l < 0.88) {
      if (l >= 0.48) return 'blue-gray'
      // Dark and only faintly blue: a cool charcoal, not a navy.
      return c >= 0.028 ? 'navy' : l < GRAY_L ? 'charcoal' : 'blue-gray'
    }
  }
  // Light yellowish colours of moderate chroma: cream and beige.
  if (hueInArc(h, 55, 112) && c < 0.09 && l >= 0.72) return l >= 0.88 ? 'cream' : 'beige'
  // Dark or muted oranges are browns; yellows need less chroma, so a muted mustard stays mustard.
  if (hueInArc(h, 30, 72) && ((l < 0.72 && c < 0.11) || (l < 0.52 && c < 0.13))) return 'brown'
  if (hueInArc(h, 72, 92) && l < 0.72 && c < 0.085) return 'brown'
  if (hueInArc(h, 72, 92) && l < 0.76) return 'mustard'
  // Dark yellow-greens stay olive a little further round than light ones.
  if ((hueInArc(h, 92, 125) && l < 0.76) || (hueInArc(h, 125, 135) && l < 0.55)) return 'olive'
  if (hueInArc(h, 72, 115)) return 'yellow'
  if (hueInArc(h, 40, 72)) return l >= 0.75 && c < 0.15 ? 'peach' : 'orange'
  if (hueInArc(h, 12, 40)) {
    if (l < 0.45) return hueInArc(h, 12, 30) ? 'burgundy' : 'red'
    if (l >= 0.75 && c < 0.15 && hueInArc(h, 28, 40)) return 'peach' // pale salmon
    if (l >= 0.55 && c < 0.10) return 'pink' // dusty rose, clay pink
    if (l >= 0.64 && c < 0.22) return 'coral'
    return 'red'
  }
  if (hueInArc(h, 345, 12)) return l < 0.45 ? 'burgundy' : 'pink'
  if (hueInArc(h, 325, 345)) return l < 0.52 ? 'purple' : 'pink'
  if (hueInArc(h, 285, 325)) return l >= 0.70 && c < 0.12 ? 'lavender' : 'purple'
  // Navy: any very dark blue, or a dark blue that is not vivid (Royal Blue is a deep blue).
  if (hueInArc(h, 218, 285)) return l < 0.40 || (l < 0.48 && c < 0.12) ? 'navy' : 'blue'
  if (hueInArc(h, 188, 218)) return 'teal'
  if (hueInArc(h, 140, 188) && l >= 0.75 && c < 0.10) return 'mint'
  if (hueInArc(h, 178, 188)) return 'teal'
  return 'green'
}

function valueModifier(family: ColorFamily, l: number): ValueModifier | null {
  const band = VALUE_BANDS[family]
  if (!band) return null
  if (band[0] !== null && l >= band[0]) return 'light'
  if (band[1] !== null && l < band[1]) return 'deep'
  return null
}

// ---- Vocabulary ----

const EN_FAMILY: Record<ColorFamily, string> = {
  white: 'White', 'off-white': 'Off-White', cream: 'Cream', beige: 'Beige', taupe: 'Taupe', brown: 'Brown',
  gray: 'Gray', 'blue-gray': 'Blue Gray', charcoal: 'Charcoal', black: 'Black', red: 'Red', burgundy: 'Burgundy',
  coral: 'Coral', orange: 'Orange', peach: 'Peach', yellow: 'Yellow', mustard: 'Mustard', olive: 'Olive',
  green: 'Green', mint: 'Mint', teal: 'Teal', blue: 'Blue', navy: 'Navy', purple: 'Purple', lavender: 'Lavender', pink: 'Pink',
}
const EN_MODIFIER = { light: 'Light', deep: 'Deep', soft: 'Soft', bright: 'Bright', warm: 'Warm', cool: 'Cool' } as const

// Thai names follow Thai word order: the colour first, then อ่อน / เข้ม, หม่น / สด, อมอุ่น / อมเย็น
// (เทาอ่อนอมเย็น, not a word-for-word "อ่อนเย็นเทา").
const TH_FAMILY: Record<ColorFamily, string> = {
  white: 'ขาว', 'off-white': 'ออฟไวท์', cream: 'ครีม', beige: 'เบจ', taupe: 'เทาอมน้ำตาล', brown: 'น้ำตาล',
  gray: 'เทา', 'blue-gray': 'เทาอมฟ้า', charcoal: 'เทาชาร์โคล', black: 'ดำ', red: 'แดง', burgundy: 'แดงไวน์',
  coral: 'ส้มคอรัล', orange: 'ส้ม', peach: 'พีช', yellow: 'เหลือง', mustard: 'เหลืองมัสตาร์ด', olive: 'เขียวมะกอก',
  green: 'เขียว', mint: 'เขียวมิ้นต์', teal: 'เขียวหัวเป็ด', blue: 'ฟ้า', navy: 'กรมท่า', purple: 'ม่วง', lavender: 'ม่วงลาเวนเดอร์', pink: 'ชมพู',
}
const TH_MODIFIER = { light: 'อ่อน', deep: 'เข้ม', soft: 'หม่น', bright: 'สด', warm: 'อมอุ่น', cool: 'อมเย็น' } as const
// Thai splits blue into ฟ้า (lighter) and น้ำเงิน (darker), where English says "Blue" for both.
const TH_BLUE_DARK_L = 0.58

function thaiName(family: ColorFamily, l: number, value: ValueModifier | null, chroma: ChromaModifier | null, temperature: TemperatureModifier | null) {
  // A light teal is what Thai calls ฟ้าอมเขียว; "light" is already in the word.
  if (family === 'teal' && value === 'light') return chroma ? `ฟ้าอมเขียว${TH_MODIFIER[chroma]}` : 'ฟ้าอมเขียว'
  const base = family === 'blue' && l < TH_BLUE_DARK_L ? 'น้ำเงิน' : TH_FAMILY[family]
  return [base, value && TH_MODIFIER[value], chroma && TH_MODIFIER[chroma], temperature && TH_MODIFIER[temperature]].filter(Boolean).join('')
}

// The one naming entry point. Same HEX in → same name out, wherever the colour came from.
// Returns null for anything that is not a HEX colour.
export function describeColor(hex: string): ColorName | null {
  const normalized = normalizeHex(hex)
  const lab = normalized ? hexToOklab(normalized) : null
  if (!normalized || !lab) return null
  const { l } = lab
  const c = oklabChroma(lab)
  const h = oklabHue(lab)

  let family: ColorFamily
  if (l < 0.12 || (l < 0.20 && c < 0.06) || (l < BLACK_L && c < tintChroma(l))) family = 'black'
  else if (c < tintChroma(l)) family = neutralFamily(l)
  else family = chromaticFamily(l, c, h)
  // Below the neutral gate the hue angle is noise, so a grey is never called warm or cool.
  const temperature = TEMPERATURE_FAMILIES.has(family) && c >= neutralChroma(l) ? tintTemperature(h) : null

  // At most one of Bright / Light-Deep / Soft for a chromatic family, in that priority, so a name
  // never stacks modifiers ("Light Soft Pink").
  let chroma: ChromaModifier | null = CHROMA_FAMILIES.has(family) && c >= BRIGHT_CHROMA ? 'bright' : null
  const value = chroma ? null : valueModifier(family, l)
  if (!chroma && !value && CHROMA_FAMILIES.has(family) && c < SOFT_CHROMA) chroma = 'soft'

  const en = [value && EN_MODIFIER[value], chroma && EN_MODIFIER[chroma], temperature && EN_MODIFIER[temperature], EN_FAMILY[family]].filter(Boolean).join(' ')
  const th = thaiName(family, l, value, chroma, temperature)
  return { hex: normalized, family, group: FAMILY_GROUP[family], value, temperature, chroma, en, th }
}
