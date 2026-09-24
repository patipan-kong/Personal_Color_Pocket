import type { LuckyOutfitRole } from '../domain/luckyColor/outfit'

// V1.3 Slice 5.1. Presentation-neutral flat-lay garments, drawn from above like a styled outfit board.
// They are decorative: the annotation next to each one carries the same information as text. Every
// garment surface is the colour it is given, unchanged; seams, lining and shadows use neutral UI ink only.

const outline = { stroke: 'var(--garment-line)', strokeWidth: 1.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
const seam = { fill: 'none', stroke: 'var(--garment-seam)', strokeWidth: 1.2, strokeLinecap: 'round' as const }
const svgProps = { 'aria-hidden': true, focusable: false } as const

// A relaxed short-sleeve shirt with a camp collar and a buttoned placket.
function Top({ color }: { color: string }) {
  return <svg viewBox="0 0 180 170" {...svgProps}>
    <path fill={color} {...outline} d="M72 15 Q90 24 108 15 L140 26 Q152 30 158 42 L174 76 Q162 86 146 90 L135 68 L137 150 Q138 160 128 161 Q90 166 52 161 Q42 160 43 150 L45 68 L34 90 Q18 86 6 76 L22 42 Q28 30 40 26 Z" />
    <path fill="var(--garment-shade)" d="M75 16 Q90 23 105 16 L90 47 Z" />
    <path fill={color} {...outline} d="M72 14 L61 38 L79 45 L90 49 Q80 32 77 16 Z" />
    <path fill={color} {...outline} d="M108 14 L119 38 L101 45 L90 49 Q100 32 103 16 Z" />
    <path {...seam} d="M90 49 V160 M40 26 Q49 47 45 68 M140 26 Q131 47 135 68 M10 71 Q22 80 35 84 M170 71 Q158 80 145 84 M47 152 Q90 158 133 152 M62 108 Q68 124 63 142" />
    <g {...seam}><circle cx="94" cy="70" r="2.2" /><circle cx="94" cy="96" r="2.2" /><circle cx="94" cy="122" r="2.2" /><circle cx="94" cy="148" r="2.2" /></g>
  </svg>
}

// Tailored straight-leg trousers: waistband, belt loops, fly, slant pockets, pressed creases, cuffs.
function Bottom({ color }: { color: string }) {
  return <svg viewBox="0 0 130 190" {...svgProps}>
    <path fill={color} {...outline} d="M22 8 H108 Q111 8 111 11 L113 22 L122 176 Q122 181 117 181 L76 181 Q72 181 71.5 177 L65 70 L58.5 177 Q58 181 54 181 L13 181 Q8 181 8 176 L17 22 L19 11 Q19 8 22 8 Z" />
    <path {...seam} d="M17.5 21 H112.5 M30 7 V22 M100 7 V22 M65 22 V70 M71 22 V50 Q71 58 65 62 M30 22 Q28 40 15.5 52 M100 22 Q102 40 114.5 52 M38 24 L33 178 M92 24 L97 178 M8.4 171 H58.9 M71.1 171 H121.6" />
  </svg>
}

// A pair seen from above, toes slightly splayed; the lining is a neutral, never the garment colour.
function Shoes({ color }: { color: string }) {
  const shoe = <>
    <path fill={color} {...outline} d="M0 -44 C14 -44 19 -30 19 -14 C19 6 15 24 14 34 C13 42 7 46 0 46 C-7 46 -13 42 -14 34 C-15 24 -19 6 -19 -14 C-19 -30 -14 -44 0 -44 Z" />
    <path fill="var(--garment-inner)" {...outline} d="M0 -3 C9 -3 11 7 11 19 C11 31 7 38 0 38 C-7 38 -11 31 -11 19 C-11 7 -9 -3 0 -3 Z" />
    <path {...seam} d="M-15 -11 Q0 -3 15 -11 M-11 -27 Q0 -36 11 -27" />
  </>
  return <svg viewBox="0 0 150 104" {...svgProps}>
    <g transform="translate(50 52) rotate(-9)">{shoe}</g>
    <g transform="translate(100 52) rotate(9)">{shoe}</g>
  </svg>
}

// A generic accent (a simple ring). The recommendation does not name an accessory type, so the art
// does not invent one.
function Accessory({ color }: { color: string }) {
  return <svg viewBox="0 0 110 110" {...svgProps}>
    <path fill={color} fillRule="evenodd" {...outline} d="M55 13 A42 42 0 1 1 54.99 13 Z M55 29 A26 26 0 1 0 55.01 29 Z" />
    <circle {...seam} cx="55" cy="55" r="34" />
  </svg>
}

export function GarmentArt({ role, color }: { role: LuckyOutfitRole; color: string }) {
  if (role === 'top') return <Top color={color} />
  if (role === 'bottom') return <Bottom color={color} />
  if (role === 'shoes') return <Shoes color={color} />
  return <Accessory color={color} />
}
