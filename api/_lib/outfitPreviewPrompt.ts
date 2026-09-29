import { describeColor } from '../../src/domain/colorNames/colorNames.js'
import type { OutfitPreviewInput, PreviewPiece } from '../../src/domain/todayOutfitProduction/previewContract.js'
import { getGarmentDefinition } from '../../src/domain/wardrobe/taxonomy.js'

function pieceLine(slot: string, piece: PreviewPiece): string {
  const garment = getGarmentDefinition(piece.garmentType).label.en
  const color = describeColor(piece.color.hex)
  if (!color) throw new Error('Validated preview color could not be described')
  const presentation = piece.visualDescription ? `; visual presentation: ${piece.visualDescription}` : ''
  return `- ${slot}: ${garment} (garment type ${piece.garmentType}${presentation}), color ${color.en} (${piece.color.hex})`
}

export function buildOutfitPreviewPrompt(input: OutfitPreviewInput): string {
  const lines = input.outfit.kind === 'separates'
    ? [
        pieceLine('top', input.outfit.top),
        pieceLine('bottom', input.outfit.bottom),
        ...(input.outfit.outerwear ? [pieceLine('outerwear', input.outfit.outerwear)] : []),
        pieceLine('shoes', input.outfit.shoes),
      ]
    : [
        pieceLine('one-piece', input.outfit.onePiece),
        ...(input.outfit.outerwear ? [pieceLine('outerwear', input.outfit.outerwear)] : []),
        pieceLine('shoes', input.outfit.shoes),
      ]

  return `Create one clean, realistic fashion-editorial flat-lay in a square composition on a simple neutral background.

Show exactly these supplied garments, once each, separately and clearly:
${lines.join('\n')}

Requirements:
- Preserve the supplied garment categories, garment types, and colors as closely as practical.
- A visual presentation description, when supplied, refines only the appearance of that same garment type. It must never cause a substitution.
- Do not redesign, improve, recommend, reinterpret, or substitute any garment.
- Do not add or remove garments. Include outerwear only when it is listed above.
- No people, bodies, faces, mannequins, or hands.
- No text, labels, captions, typography, written HEX values, logos, or watermarks in the image.
- No accessories, bags, jewelry, props, or unlisted garments.
- Keep every garment visually separated and readable. The image model is a visualizer, not a stylist.`
}
