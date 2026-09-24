import type { LuckyOutfitRole } from '../domain/luckyColor/outfit'

// V1.3 Slice 5. Minimal, presentation-neutral flat-lay silhouettes for the four generic outfit roles.
// They are decorative: the caption next to each one carries the same information as text. The fill
// is the colour it is given, unchanged; outlines and seams use neutral UI ink only.

const outline = { stroke: 'var(--garment-line)', strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
const seam = { fill: 'none', stroke: 'var(--garment-seam)', strokeWidth: 1.4, strokeLinecap: 'round' as const }

function Top({ color }: { color: string }) {
  return <svg viewBox="0 0 160 150" aria-hidden="true" focusable="false">
    <path fill={color} {...outline} d="M58 12 Q80 27 102 12 L134 25 Q145 29 149 41 L156 69 Q149 76 131 78 L126 63 L126 136 Q126 142 120 142 L40 142 Q34 142 34 136 L34 63 L29 78 Q11 76 4 69 L11 41 Q15 29 26 25 Z" />
    <path {...seam} d="M58 12 Q80 31 102 12" />
    <path {...seam} d="M34 63 L37 44 M126 63 L123 44" />
  </svg>
}

function Bottom({ color }: { color: string }) {
  return <svg viewBox="0 0 120 170" aria-hidden="true" focusable="false">
    <path fill={color} {...outline} d="M20 6 H100 Q103 6 103 10 L112 158 Q112 164 106 164 L71 164 Q66 164 66 159 L60 64 L54 159 Q54 164 49 164 L14 164 Q8 164 8 158 L17 10 Q17 6 20 6 Z" />
    <path {...seam} d="M18 21 H102 M60 21 V44" />
  </svg>
}

function Shoes({ color }: { color: string }) {
  const shoe = 'M8 52 Q6 36 18 32 L39 28 Q47 38 63 40 L88 44 Q103 47 105 58 L105 61 Q105 64 102 64 L11 64 Q8 64 8 60 Z'
  return <svg viewBox="0 0 150 72" aria-hidden="true" focusable="false">
    <g transform="translate(40 -18)"><path fill={color} {...outline} d={shoe} /><path {...seam} d="M9 58 H104" /></g>
    <path fill={color} {...outline} d={shoe} transform="translate(0 6)" /><path {...seam} d="M9 64 H104" />
  </svg>
}

// A generic accent token (a simple ring). The recommendation does not name an accessory type, so
// the art does not invent one.
function Accessory({ color }: { color: string }) {
  return <svg viewBox="0 0 110 110" aria-hidden="true" focusable="false">
    <path fill={color} fillRule="evenodd" {...outline} d="M55 14 A41 41 0 1 1 54.99 14 Z M55 30 A25 25 0 1 0 55.01 30 Z" />
  </svg>
}

export function GarmentArt({ role, color }: { role: LuckyOutfitRole; color: string }) {
  if (role === 'top') return <Top color={color} />
  if (role === 'bottom') return <Bottom color={color} />
  if (role === 'shoes') return <Shoes color={color} />
  return <Accessory color={color} />
}
