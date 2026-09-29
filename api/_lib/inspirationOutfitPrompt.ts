import { describeColor } from '../../src/domain/colorNames/colorNames.js'
import { getCanonicalWardrobeColor } from '../../src/domain/wardrobe/wardrobe.js'
import { getBasicWardrobeColor } from '../../src/domain/wardrobe/colors.js'
import { allowedGarmentTypesForGender, getGarmentDefinition, getWardrobeSlot } from '../../src/domain/wardrobe/taxonomy.js'
import type { InspirationOutfitRequest } from '../../src/domain/todayOutfitProduction/inspirationContract.js'

export function buildInspirationOutfitPrompt(input: InspirationOutfitRequest): string {
  const facts = {
    version: input.version,
    subtype: input.subtype,
    occasion: input.occasion,
    gender: input.gender,
    allowedGarments: allowedGarmentTypesForGender(input.gender).map((garmentType) => ({ garmentType, slot: getWardrobeSlot(garmentType), name: getGarmentDefinition(garmentType).label.en })),
    allowedColors: [
      ...input.canonicalColorIds.flatMap((canonicalColorId) => {
        const color = getCanonicalWardrobeColor(canonicalColorId)
        return color ? [{ kind: 'canonical', canonicalColorId, name: color.name }] : []
      }),
      ...input.genericColorIds.map((colorId) => {
        const color = getBasicWardrobeColor(colorId)
        return { kind: 'generic', colorId, name: describeColor(color.hex)!.en }
      }),
    ],
    luckyPreferences: input.luckyPreferences,
    exclusions: input.exclusions ?? [],
  }
  return `You are a careful stylist inside a Personal Color application. Propose a conceptual outfit, not owned inventory.

Use only the supplied garmentType and color identities. The supplied allowedGarments list is already filtered for the selected profile gender ("gender"; null means none selected). Gender applicability is a HARD validity constraint, not a preference: a garmentType outside allowedGarments makes the whole answer invalid. Never output wardrobe IDs, HEX, RGB, names, confidence, prose, provider metadata, or unknown fields. Slot is derived from garmentType and must match the property where the piece appears.

Priority:
1. Occasion appropriateness and a complete coherent outfit.
2. Personal Color, especially a canonical color near the face when subtype and canonical candidates exist.
3. Lucky preferences are soft only. Prefer Personal Color near the face; use Lucky below the face, in shoes/outerwear where suitable, or omit it.
4. General wearable coherence.

Avoid every structured exclusion exactly by kind, garmentType, and authoritative color identity. Never compare provider prose.

Return JSON only in exactly one shape:
{"outfit":{"kind":"separates","top":{"garmentType":"id","color":{"kind":"canonical","canonicalColorId":"id"}},"bottom":{"garmentType":"id","color":{"kind":"generic","colorId":"id"}},"outerwear":null,"shoes":{"garmentType":"id","color":{"kind":"generic","colorId":"id"}}}}
or
{"outfit":{"kind":"one-piece","onePiece":{"garmentType":"id","color":{"kind":"canonical","canonicalColorId":"id"}},"outerwear":null,"shoes":{"garmentType":"id","color":{"kind":"generic","colorId":"id"}}}}

A color may use either allowed color shape. A separates base requires top, bottom, and shoes. A one-piece base requires onePiece and shoes. outerwear must be a valid outerwear piece or null. Never mix base kinds.

STRUCTURED INPUT:
${JSON.stringify(facts, null, 2)}`
}
