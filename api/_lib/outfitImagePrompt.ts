import type { TodayOutfitImageRequest } from '../../src/domain/todayOutfitImage/contract.js'

export function buildOutfitImagePrompt(request: TodayOutfitImageRequest): string {
  const lines = (['top', 'bottom', 'outerwear', 'shoes'] as const).flatMap((slot) => {
    const item = request.selectedItems[slot]
    if (!item) return []
    return [`${slot.toUpperCase()}`, item.name, `Color: ${item.color.name} (${item.color.hex.toUpperCase()})`]
  })
  return `Create one clean, realistic fashion-editorial flat-lay showing exactly the supplied garments.

${lines.join('\n')}

Context metadata only: Personal Color subtype ${request.subtype}; occasion ${request.occasion}.

Requirements:
- Show exactly the supplied garment categories, with one piece for each listed category.
- Do not add another top, bottom, outerwear piece, or pair of shoes.
- Do not substitute or reinterpret any garment type.
- Include outerwear only when it is supplied above.
- Preserve every supplied garment color as closely as possible; use the supplied HEX values for color grounding.
- Arrange the pieces separately and clearly on a simple neutral background.
- Use realistic apparel photography and a polished editorial flat-lay composition.
- No person, face, body, mannequin, hands, or virtual try-on.
- No text, labels, captions, typography, watermarks, or brand logos.
- No decorative accessories, props, jewelry, bags, or other garments.
- Do not choose, recommend, improve, or change the outfit. Visualize only the listed pieces.`
}
