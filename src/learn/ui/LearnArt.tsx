// V1.4 Slice 4: the one garment drawing behind every Learn illustration (the type page's outfit
// formula, palette placement, More Considered placement, the lighting tiles and the lucky-colour flow),
// so they share a line weight, corner shape and scale. Presentation only: pieces are filled with the
// canonical colours they are given, or drawn as an outline or an illustration tone. It holds no colour
// and knows nothing about Daily's garments or recommendations.

export const garmentPath = {
  top: 'M52 12 70 6c3 6 7 8 10 8s7-2 10-8l18 6 18 20-14 10-6-8v36H54V34l-6 8-14-10Z',
  bottom: 'M56 76h48l4 68H87l-7-44-7 44H52Z',
  bag: 'M145 92h30a7 7 0 0 1 7 7v22a7 7 0 0 1-7 7h-30a7 7 0 0 1-7-7V99a7 7 0 0 1 7-7Z',
  strap: 'M148 94c0-16 24-16 24 0',
  chain: 'M68 12c2 13 22 13 24 0',
}

// The whole flat-lay, the zone near the face (the top), the zone below it, or the top on its own.
export const flatLayView = { all: '0 0 200 150', upper: '0 0 200 76', lower: '0 76 200 74', top: '28 0 104 76' } as const

// A canonical colour, an empty outline, or the illustration tone of a concept diagram.
export type Piece = { hex: string } | 'outline' | 'tone'

function Shape({ piece, d }: { piece: Piece; d: string }) {
  if (piece === 'outline' || piece === 'tone') return <path className={`learn-flatlay-shape is-${piece}`} d={d} />
  return <path className="learn-flatlay-piece" style={{ fill: piece.hex }} d={d} />
}

// Decorative: every illustration writes out what each piece is and which colour it wears.
export function FlatLay({ top, bottom, bag, metal, view = 'all', className = '' }: {
  top?: Piece
  bottom?: Piece
  bag?: Piece
  metal?: { hex: string }
  view?: keyof typeof flatLayView
  className?: string
}) {
  return <svg className={`learn-flatlay ${className}`} viewBox={flatLayView[view]} aria-hidden="true" focusable="false">
    {top && <Shape piece={top} d={garmentPath.top} />}
    {metal && <g className="learn-flatlay-metal">
      <path className="learn-flatlay-chain" style={{ stroke: metal.hex }} d={garmentPath.chain} />
      <circle className="learn-flatlay-pendant" style={{ fill: metal.hex }} cx="80" cy="25" r="4" />
    </g>}
    {bottom && <Shape piece={bottom} d={garmentPath.bottom} />}
    {bag && <>
      <path className={`learn-flatlay-strap${typeof bag === 'string' ? ` is-${bag}` : ''}`} style={typeof bag === 'string' ? undefined : { stroke: bag.hex }} d={garmentPath.strap} />
      <Shape piece={bag} d={garmentPath.bag} />
    </>}
  </svg>
}
