import { describe, expect, it } from 'vitest'
import { hexToOklab, oklabChroma, rgbToHex } from '../personalColor/colorUtils'
import { BRIGHT_CHROMA, COLOR_FAMILIES, describeColor, FAMILY_GROUP, hueInArc, NEUTRAL_CHROMA, neutralChroma, SOFT_CHROMA, tintChroma } from './colorNames'
import type { ColorFamily } from './colorNames'
import { isUnrelatedJump, paletteNameRows, rgbNeighbours, stability, syntheticCorpus, TRUE_NEUTRAL_CHROMA } from './colorNamesAudit'
import namesSource from './colorNames.ts?raw'

// V1.2 Slice 7: the colour-name engine. Pure HEX → name, the same for every source.

const name = (hex: string) => describeColor(hex)!
const en = (hex: string) => name(hex).en
const th = (hex: string) => name(hex).th

// OKLab (L, C, h°) → HEX, or null outside sRGB. Test-only inverse of colorUtils.rgbToOklab.
function oklch(l: number, c: number, h: number): string | null {
  const a = c * Math.cos(h * Math.PI / 180)
  const b = c * Math.sin(h * Math.PI / 180)
  const lms = [(l + 0.3963377774 * a + 0.2158037573 * b) ** 3, (l - 0.1055613458 * a - 0.0638541728 * b) ** 3, (l - 0.0894841775 * a - 1.291485548 * b) ** 3]
  const linear = [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ]
  if (linear.some((value) => value < -0.001 || value > 1.001)) return null
  const [r, g, bl] = linear.map((value) => {
    const v = Math.min(1, Math.max(0, value))
    return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)
  })
  return rgbToHex({ r, g, b: bl })
}

// The families met walking once round the hue circle at one lightness and chroma, in order.
function hueWalk(l: number, c: number) {
  const runs: ColorFamily[] = []
  for (let h = 0; h < 360; h += 1) {
    const hex = oklch(l, c, h)
    if (!hex) continue
    const family = name(hex).family
    if (runs[runs.length - 1] !== family) runs.push(family)
  }
  if (runs.length > 1 && runs[0] === runs[runs.length - 1]) runs.pop()
  return runs
}

describe('A. canonical anchors', () => {
  it.each([
    ['#FFFFFF', 'white', 'White', 'ขาว'],
    ['#F7F6F2', 'off-white', 'Off-White', 'ออฟไวท์'],
    ['#FFF0CF', 'cream', 'Cream', 'ครีม'],
    ['#D3D3D3', 'gray', 'Light Gray', 'เทาอ่อน'],
    ['#808080', 'gray', 'Gray', 'เทา'],
    ['#404040', 'charcoal', 'Charcoal', 'เทาชาร์โคล'],
    ['#111111', 'black', 'Black', 'ดำ'],
    ['#000000', 'black', 'Black', 'ดำ'],
    ['#D8BA91', 'beige', 'Beige', 'เบจ'],
    ['#8D6F73', 'taupe', 'Taupe', 'เทาอมน้ำตาล'],
    ['#7B4C31', 'brown', 'Brown', 'น้ำตาล'],
    ['#C94636', 'red', 'Red', 'แดง'],
    ['#E66D2E', 'orange', 'Orange', 'ส้ม'],
    ['#F7CE36', 'yellow', 'Yellow', 'เหลือง'],
    ['#29A55F', 'green', 'Green', 'เขียว'],
    ['#087E8B', 'teal', 'Teal', 'เขียวหัวเป็ด'],
    ['#709BCC', 'blue', 'Blue', 'ฟ้า'],
    ['#7356B4', 'purple', 'Purple', 'ม่วง'],
    ['#DB7185', 'pink', 'Pink', 'ชมพู'],
  ])('%s → %s (%s / %s)', (hex, family, english, thai) => {
    expect(name(hex)).toMatchObject({ family, en: english, th: thai })
  })

  it.each([
    ['#1E2C4D', 'navy', 'Navy', 'กรมท่า'],
    ['#000080', 'navy', 'Navy', 'กรมท่า'],
    ['#671D38', 'burgundy', 'Burgundy', 'แดงไวน์'],
    ['#E9785D', 'coral', 'Coral', 'ส้มคอรัล'],
    ['#F0A07C', 'peach', 'Peach', 'พีช'],
    ['#93D6AE', 'mint', 'Mint', 'เขียวมิ้นต์'],
    ['#A894C7', 'lavender', 'Lavender', 'ม่วงลาเวนเดอร์'],
    ['#737B38', 'olive', 'Olive', 'เขียวมะกอก'],
    ['#AF842C', 'mustard', 'Mustard', 'เหลืองมัสตาร์ด'],
    ['#71899A', 'blue-gray', 'Blue Gray', 'เทาอมฟ้า'],
  ])('special family %s → %s (%s / %s)', (hex, family, english, thai) => {
    expect(name(hex)).toMatchObject({ family, en: english, th: thai })
  })

  it('names modified colours compositionally, in natural EN and TH order', () => {
    expect([en('#9FABB4'), th('#9FABB4')]).toEqual(['Cool Gray', 'เทาอมเย็น'])
    expect([en('#8E8278'), th('#8E8278')]).toEqual(['Warm Gray', 'เทาอมอุ่น'])
    expect([en('#36454F'), th('#36454F')]).toEqual(['Cool Charcoal', 'เทาชาร์โคลอมเย็น'])
    expect([en('#493227'), th('#493227')]).toEqual(['Deep Brown', 'น้ำตาลเข้ม'])
    expect([en('#EAB6C5'), th('#EAB6C5')]).toEqual(['Light Pink', 'ชมพูอ่อน'])
    expect([en('#A9838C'), th('#A9838C')]).toEqual(['Soft Pink', 'ชมพูหม่น'])
    expect([en('#668CAD'), th('#668CAD')]).toEqual(['Soft Blue', 'ฟ้าหม่น'])
    expect([en('#234A9B'), th('#234A9B')]).toEqual(['Deep Blue', 'น้ำเงินเข้ม'])
    expect([en('#FF0000'), th('#FF0000')]).toEqual(['Bright Red', 'แดงสด'])
    expect([en('#4C542D'), th('#4C542D')]).toEqual(['Deep Olive', 'เขียวมะกอกเข้ม'])
    expect([en('#6FD3CF'), th('#6FD3CF')]).toEqual(['Light Teal', 'ฟ้าอมเขียว'])
  })

  it('returns the structured semantics, not only strings', () => {
    expect(name('#9FABB4')).toEqual({ hex: '#9FABB4', family: 'gray', group: 'gray', value: null, temperature: 'cool', chroma: null, en: 'Cool Gray', th: 'เทาอมเย็น' })
    expect(name('#EAB6C5')).toMatchObject({ family: 'pink', group: 'pink', value: 'light', temperature: null, chroma: null })
    expect(name('#1E2C4D')).toMatchObject({ family: 'navy', group: 'blue' })
    expect(name('#AF842C')).toMatchObject({ family: 'mustard', group: 'yellow' })
  })
})

describe('B. observed light-suit samples (one garment, three taps)', () => {
  const SUIT = ['#C6CACF', '#D9DCDF', '#D0D1D5']

  it('all three are the same consumer colour: Light Gray / เทาอ่อน', () => {
    expect(SUIT.map(en)).toEqual(['Light Gray', 'Light Gray', 'Light Gray'])
    expect(SUIT.map(th)).toEqual(['เทาอ่อน', 'เทาอ่อน', 'เทาอ่อน'])
    // Their faint blue (OKLab chroma 0.005–0.008) is below the naming gate, so no hue and no temperature.
    for (const hex of SUIT) expect(oklabChroma(hexToOklab(hex)!)).toBeLessThan(NEUTRAL_CHROMA)
  })

  it('small RGB changes around them stay grey: never a hue family', () => {
    for (const hex of SUIT) {
      for (const delta of [2, 4]) {
        for (const neighbour of rgbNeighbours(hex, delta)) expect(name(neighbour).family, `${hex} → ${neighbour}`).toBe('gray')
      }
      // At ±2 even the exact name holds.
      for (const neighbour of rgbNeighbours(hex, 2)) expect(en(neighbour)).toBe('Light Gray')
    }
  })
})

describe('C. neutral jitter', () => {
  it('true greys never get a hue name or a temperature under ±2 / ±4 RGB noise', () => {
    for (let level = 16; level <= 248; level += 4) {
      const grey = rgbToHex({ r: level, g: level, b: level })
      for (const delta of [2, 4]) {
        for (const neighbour of rgbNeighbours(grey, delta)) {
          const next = name(neighbour)
          expect(['white', 'gray', 'black'], `${grey} → ${neighbour} (${next.en})`).toContain(next.group)
          expect(next.temperature, `${grey} → ${neighbour}`).toBeNull()
        }
      }
    }
  })

  it('a near-neutral light grey does not wander Blue → Purple → Green as its tint rotates', () => {
    // A faint tint turned all the way round the hue circle, at the chroma of the suit samples.
    for (let h = 0; h < 360; h += 5) expect(name(oklch(0.86, 0.008, h)!).family).toBe('gray')
  })

  it('white, off-white, grey, charcoal and black follow lightness in order along the neutral axis', () => {
    const order: ColorFamily[] = ['black', 'charcoal', 'gray', 'off-white', 'white']
    let previous = 0
    for (let level = 0; level <= 255; level += 1) {
      const index = order.indexOf(name(rgbToHex({ r: level, g: level, b: level })).family)
      expect(index).toBeGreaterThanOrEqual(previous)
      previous = index
    }
    expect(previous).toBe(order.length - 1)
  })
})

describe('D. hue-family boundaries', () => {
  it('walks the hue circle in consumer order at mid lightness', () => {
    expect(hueWalk(0.65, 0.12)).toEqual(['pink', 'coral', 'orange', 'mustard', 'olive', 'green', 'teal', 'blue', 'purple'])
    expect(hueWalk(0.5, 0.1)).toEqual(['pink', 'red', 'brown', 'mustard', 'olive', 'green', 'blue', 'purple'])
  })

  it('light and dark slices use their own families (peach, mint, lavender / burgundy, navy)', () => {
    expect(hueWalk(0.8, 0.08)).toEqual(['pink', 'peach', 'beige', 'yellow', 'green', 'mint', 'teal', 'blue', 'lavender'])
    expect(hueWalk(0.35, 0.08)).toEqual(['burgundy', 'brown', 'olive', 'green', 'navy', 'purple'])
  })

  it('pins the chosen boundaries (±2° either side)', () => {
    const at = (h: number, l = 0.65, c = 0.12) => name(oklch(l, c, h)!).family
    expect([at(10), at(15)]).toEqual(['pink', 'coral']) // pink ↔ coral/red at 12°
    expect([at(38), at(42)]).toEqual(['coral', 'orange']) // coral ↔ orange at 40°
    expect([at(70), at(74)]).toEqual(['orange', 'mustard']) // orange ↔ yellow (mustard) at 72°
    expect([at(122), at(127)]).toEqual(['olive', 'green']) // olive ↔ green at 125°
    expect([at(10, 0.5, 0.1), at(14, 0.5, 0.1)]).toEqual(['pink', 'red']) // pink ↔ red at 12°
    expect([at(283, 0.5, 0.1), at(287, 0.5, 0.1)]).toEqual(['blue', 'purple']) // blue ↔ purple at 285°
    expect([at(323), at(327)]).toEqual(['purple', 'pink']) // purple ↔ pink at 325° (lighter colours)
    expect([at(216, 0.8, 0.08), at(220, 0.8, 0.08)]).toEqual(['teal', 'blue']) // teal ↔ blue at 218°
    expect([at(186, 0.8, 0.08), at(190, 0.8, 0.08)]).toEqual(['mint', 'teal']) // mint ↔ teal at 188°
  })

  it('dark magentas are purple, lighter ones pink (the purple ↔ pink boundary depends on lightness)', () => {
    expect(name(oklch(0.45, 0.15, 335)!).family).toBe('purple')
    expect(name(oklch(0.65, 0.15, 335)!).family).toBe('pink')
    expect(en('#800080')).toBe('Bright Purple')
    expect(en('#FF00FF')).toBe('Bright Pink')
  })
})

describe('E. 0° / 360° wraparound', () => {
  it('hueInArc handles arcs that cross 0°', () => {
    expect(hueInArc(359, 345, 12)).toBe(true)
    expect(hueInArc(0, 345, 12)).toBe(true)
    expect(hueInArc(11.9, 345, 12)).toBe(true)
    expect(hueInArc(12, 345, 12)).toBe(false)
    expect(hueInArc(344.9, 345, 12)).toBe(false)
    expect(hueInArc(180, 345, 12)).toBe(false)
  })

  it('colours either side of 0° get the same family', () => {
    for (const [l, c] of [[0.6, 0.1], [0.75, 0.08], [0.4, 0.1], [0.55, 0.18]] as const) {
      const family = name(oklch(l, c, 358)!).family
      for (const h of [359, 0, 1, 2]) expect(name(oklch(l, c, h)!).family, `L${l} C${c} h${h}`).toBe(family)
    }
  })
})

describe('F. value boundaries', () => {
  it('Light / plain / Deep follow lightness for a family', () => {
    expect([0.4, 0.6, 0.8].map((l) => name(oklch(l, 0.12, 140)!).value)).toEqual(['deep', null, 'light'])
    expect([0.45, 0.6, 0.8].map((l) => name(oklch(l, 0.1, 255)!).value)).toEqual([null, null, 'light']) // 0.45 blue is navy
  })

  it('the grey value boundary is at L 0.75', () => {
    expect(en(oklch(0.74, 0, 0)!)).toBe('Gray')
    expect(en(oklch(0.76, 0, 0)!)).toBe('Light Gray')
  })

  it('never stacks modifiers on a chromatic family', () => {
    for (const hex of syntheticCorpus(30)) {
      const color = name(hex)
      if (FAMILY_GROUP[color.family] === 'gray' || color.family === 'charcoal') continue
      expect(Number(Boolean(color.value)) + Number(Boolean(color.chroma)), `${hex} ${color.en}`).toBeLessThanOrEqual(1)
    }
  })
})

describe('G. chroma boundaries', () => {
  it('rising chroma goes Gray → Soft → plain → Bright, in order', () => {
    const steps = [0, 0.01, 0.03, 0.06, 0.1, 0.15, 0.2].map((c) => name(oklch(0.7, c, 140)!))
    expect(steps.map((color) => color.en)).toEqual(['Gray', 'Gray', 'Soft Green', 'Soft Green', 'Green', 'Green', 'Bright Green'])
  })

  it('uses the named chroma constants', () => {
    expect(name(oklch(0.7, SOFT_CHROMA - 0.002, 140)!).chroma).toBe('soft')
    expect(name(oklch(0.7, SOFT_CHROMA + 0.002, 140)!).chroma).toBeNull()
    expect(name(oklch(0.7, BRIGHT_CHROMA + 0.002, 140)!).chroma).toBe('bright')
  })

  it('the hue and temperature gates are higher for dark colours, where sRGB noise makes more chroma', () => {
    expect(tintChroma(0.9)).toBeCloseTo(0.022)
    expect(tintChroma(0.3)).toBeCloseTo(0.036)
    expect(tintChroma(0.6)).toBeGreaterThan(tintChroma(0.9))
    expect(neutralChroma(0.8)).toBeCloseTo(NEUTRAL_CHROMA)
    expect(neutralChroma(0.15)).toBeCloseTo(0.022)
    // A tint is always a smaller step than a hue name.
    for (let l = 0; l <= 1; l += 0.05) expect(neutralChroma(l)).toBeLessThan(tintChroma(l))
  })
})

describe('H. warm / cool', () => {
  it('only tinted greys say Warm or Cool; a true grey says neither', () => {
    expect(name(oklch(0.6, 0.018, 60)!)).toMatchObject({ family: 'gray', temperature: 'warm' })
    expect(name(oklch(0.6, 0.018, 245)!)).toMatchObject({ family: 'gray', temperature: 'cool' })
    expect(name(oklch(0.6, 0.018, 150)!)).toMatchObject({ family: 'gray', temperature: null }) // green tint
    expect(name(oklch(0.6, NEUTRAL_CHROMA - 0.002, 245)!).temperature).toBeNull()
  })

  it('Warm and Cool are the right way round in both languages', () => {
    expect([en('#8E8278'), th('#8E8278')]).toEqual(['Warm Gray', 'เทาอมอุ่น'])
    expect([en('#667078'), th('#667078')]).toEqual(['Cool Gray', 'เทาอมเย็น'])
  })

  it('chromatic families never carry a temperature word', () => {
    for (const hex of syntheticCorpus(30)) {
      const color = name(hex)
      if (color.temperature) expect(['gray', 'charcoal']).toContain(color.family)
    }
  })
})

describe('I. nearby-colour stability', () => {
  const PALETTE = paletteNameRows().map((row) => row.hex)
  const SYNTHETIC = syntheticCorpus()

  it('±2 and ±4 RGB never cause an unrelated jump (palette and synthetic corpus)', () => {
    for (const delta of [2, 4]) {
      expect(stability(PALETTE, delta).unrelated).toEqual([])
      expect(stability(SYNTHETIC, delta).unrelated).toEqual([])
    }
  })

  it('most nearby colours keep their exact name, and nearly all keep their group', () => {
    const two = stability(SYNTHETIC, 2)
    const four = stability(SYNTHETIC, 4)
    expect(two.sameName / two.pairs).toBeGreaterThan(0.93)
    expect(two.sameGroup / two.pairs).toBeGreaterThan(0.96)
    expect(four.sameName / four.pairs).toBeGreaterThan(0.88)
    expect(four.sameGroup / four.pairs).toBeGreaterThan(0.94)
    // A tinted grey never reverses from Warm to Cool.
    expect(two.temperatureReversals + four.temperatureReversals).toBe(0)
  })

  it('judges jumps: unrelated hues and a true neutral picking up a hue are unreasonable', () => {
    expect(isUnrelatedJump(name('#29A55F'), name('#DB7185'))).toBe(true) // green → pink
    expect(isUnrelatedJump(name('#808080'), name('#29A55F'))).toBe(true) // true grey → green
    expect(isUnrelatedJump(name('#C94636'), name('#E66D2E'))).toBe(false) // red → orange
    expect(isUnrelatedJump(name(oklch(0.8, 0.03, 0)!), name(oklch(0.8, 0.012, 0)!))).toBe(false) // pale pink → faintly pink grey
    expect(oklabChroma(hexToOklab('#808080')!)).toBeLessThan(TRUE_NEUTRAL_CHROMA)
  })
})

describe('J. every palette colour', () => {
  const rows = paletteNameRows()

  it('covers all 258 unique HEX values across the 12 subtypes and 4 categories', () => {
    expect(rows).toHaveLength(258)
    expect(new Set(rows.flatMap((row) => row.where.map((where) => where.subtype))).size).toBe(12)
  })

  it('names each palette colour within the colour its palette name says', () => {
    // Palette word → groups a sensible everyday name may use.
    const expected: [RegExp, string[]][] = [
      [/Pink|Fuchsia|Magenta/, ['pink', 'purple']], [/Red|Ruby|Cherry/, ['red', 'pink']], [/Burgundy|Oxblood|Wine/, ['red']],
      [/Purple|Violet|Lavender|Lilac|Orchid|Amethyst|Iris|Plum/, ['purple', 'pink', 'red']],
      [/Navy/, ['blue', 'gray']], [/Blue|Sky|Cobalt|Sapphire|Azure|Denim|Cornflower/, ['blue', 'teal', 'gray']],
      [/Teal|Turquoise|Aqua|Peacock/, ['teal', 'green', 'blue']], [/Mint|Seafoam|Green|Emerald|Jade|Leaf|Forest|Pine|Sage/, ['green', 'teal']],
      [/Olive|Moss|Lichen|Avocado/, ['green']], [/Mustard|Ochre|Lemon|Daffodil|Sunshine|Buttercup|Marigold/, ['yellow']],
      [/Orange|Papaya|Pumpkin|Persimmon|Apricot|Coral|Melon|Peach/, ['orange', 'brown', 'red']],
      [/Brown|Chocolate|Cocoa|Espresso|Camel|Caramel|Cognac|Tobacco|Tan|Mahogany/, ['brown', 'gray']],
      [/Beige|Oat|Stone/, ['brown']], [/Cream|Ivory|Ecru/, ['white', 'brown']], [/White/, ['white']], [/Grey|Charcoal|Slate|Pewter/, ['gray', 'black']],
      [/Black|Ink$/, ['black', 'gray']],
    ]
    for (const row of rows) {
      const rule = expected.find(([pattern]) => pattern.test(row.paletteName))
      if (rule) expect(rule[1], `${row.paletteName} ${row.hex} → ${row.name.en}`).toContain(row.name.group)
    }
  })

  it('uses a compact vocabulary on the palette: every family at most a few modifiers deep', () => {
    const names = new Set(rows.map((row) => row.name.en))
    expect(names.size).toBeLessThanOrEqual(70)
    for (const row of rows) expect(row.name.en.split(' ').length, row.name.en).toBeLessThanOrEqual(3)
  })
})

describe('K–N. synthetic corpus, language completeness and determinism', () => {
  const corpus = syntheticCorpus()
  const all = corpus.map((hex) => name(hex))

  it('K. names every colour in the synthetic corpus with a valid family, and uses every family', () => {
    expect(corpus.length).toBeGreaterThan(6000)
    const families = new Set<string>(COLOR_FAMILIES)
    for (const color of all) {
      expect(families.has(color.family), color.hex).toBe(true)
      expect(color.group).toBe(FAMILY_GROUP[color.family])
    }
    expect(new Set(all.map((color) => color.family))).toEqual(families)
  })

  it('L. every English name is plain Title Case words, no technical terms', () => {
    for (const color of all) {
      expect(color.en, color.hex).toMatch(/^[A-Z][a-z]+(?:-[A-Z][a-z]+)?(?: [A-Z][a-z]+(?:-[A-Z][a-z]+)?){0,2}$/)
      expect(color.en).not.toMatch(/undefined|null|NaN|OKLab|Chroma|Sector|Low|High/)
    }
  })

  it('M. every Thai name is Thai script only, non-empty, with no English left in it', () => {
    for (const color of all) {
      expect(color.th, color.hex).toMatch(/^[฀-๿]+$/)
    }
    // Every family and every modifier has a Thai word.
    expect(new Set(all.map((color) => color.th)).size).toBeGreaterThan(50)
  })

  it('N. is deterministic and ignores HEX spelling', () => {
    for (const hex of corpus.slice(0, 500)) expect(describeColor(hex)).toEqual(describeColor(hex))
    expect(describeColor('#d0d1d5')).toEqual(describeColor('#D0D1D5'))
    expect(describeColor('d0d1d5')).toEqual(describeColor('#D0D1D5'))
    expect(describeColor('#abc')).toEqual(describeColor('#AABBCC'))
    for (const bad of ['', 'red', '#12345', '#GGGGGG', '#1234567']) expect(describeColor(bad)).toBeNull()
  })
})

describe('purity: HEX in, name out', () => {
  const code = namesSource.replace(/\/\/.*$/gm, '')

  it('imports only the shared colour maths', () => {
    expect(namesSource.match(/^import .*$/gm)).toEqual(["import { hexToOklab, hueDifference, normalizeHex, oklabChroma, oklabHue } from '../personalColor/colorUtils'"])
  })

  it('knows nothing about sources, subtypes, matchers, the DOM, storage or the network', () => {
    for (const forbidden of ['manual', 'photo', 'subtype', 'palette', 'season', 'match', 'score', 'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'File', 'PixelSource', 'Date', 'Math.random']) {
      expect(code, forbidden).not.toContain(forbidden)
    }
  })
})
