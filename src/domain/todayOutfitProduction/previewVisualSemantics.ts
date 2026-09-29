import type { GarmentType, ProfileGender } from '../wardrobe/taxonomy.js'

export type PreviewTaxonomyAuditClass =
  | 'unambiguous'
  | 'gender-restricted'
  | 'presentation-sensitive'
  | 'too-generic'

export const PREVIEW_TAXONOMY_AUDIT: Readonly<Record<GarmentType, PreviewTaxonomyAuditClass>> = {
  't-shirt': 'unambiguous',
  polo: 'unambiguous',
  shirt: 'unambiguous',
  blouse: 'gender-restricted',
  'knit-top': 'unambiguous',
  'other-top': 'too-generic',
  trousers: 'unambiguous',
  chinos: 'unambiguous',
  jeans: 'unambiguous',
  skirt: 'gender-restricted',
  shorts: 'unambiguous',
  'other-bottom': 'too-generic',
  dress: 'gender-restricted',
  jumpsuit: 'presentation-sensitive',
  'other-one-piece': 'too-generic',
  jacket: 'presentation-sensitive',
  blazer: 'presentation-sensitive',
  cardigan: 'presentation-sensitive',
  coat: 'presentation-sensitive',
  'other-outerwear': 'too-generic',
  sneakers: 'unambiguous',
  loafers: 'presentation-sensitive',
  flats: 'gender-restricted',
  heels: 'gender-restricted',
  boots: 'presentation-sensitive',
  sandals: 'presentation-sensitive',
  'formal-shoes': 'presentation-sensitive',
  'other-shoes': 'too-generic',
}

const VISUAL_DESCRIPTIONS = {
  jumpsuit: { men: "men's jumpsuit", women: "women's jumpsuit" },
  jacket: { men: "men's jacket", women: "women's jacket" },
  blazer: { men: "men's blazer", women: "women's blazer" },
  cardigan: { men: "men's cardigan", women: "women's cardigan" },
  coat: { men: "men's coat", women: "women's coat" },
  loafers: { men: "men's loafers", women: "women's loafers" },
  boots: { men: "men's boots", women: "women's boots" },
  sandals: { men: "men's casual sandals", women: "women's casual sandals" },
  'formal-shoes': { men: "men's formal shoes", women: "women's formal shoes" },
} as const satisfies Partial<Record<GarmentType, Readonly<Record<ProfileGender, string>>>>

export type PreviewVisualDescription = typeof VISUAL_DESCRIPTIONS[keyof typeof VISUAL_DESCRIPTIONS][ProfileGender]

export function resolveInspirationPreviewVisualDescription(
  garmentType: GarmentType,
  gender: ProfileGender | null,
): PreviewVisualDescription | undefined {
  if (gender === null) return undefined
  const descriptions = VISUAL_DESCRIPTIONS[garmentType as keyof typeof VISUAL_DESCRIPTIONS]
  return descriptions?.[gender]
}

export function isAllowedPreviewVisualDescription(
  garmentType: GarmentType,
  value: unknown,
): value is PreviewVisualDescription {
  if (typeof value !== 'string') return false
  const descriptions = VISUAL_DESCRIPTIONS[garmentType as keyof typeof VISUAL_DESCRIPTIONS]
  return descriptions !== undefined && (descriptions.men === value || descriptions.women === value)
}
