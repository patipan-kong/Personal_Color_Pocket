export const WARDROBE_SLOTS = ['top', 'bottom', 'one-piece', 'outerwear', 'shoes'] as const
export type WardrobeSlot = typeof WARDROBE_SLOTS[number]

export const WARDROBE_FORMALITIES = ['casual', 'smart-casual', 'formal'] as const
export type WardrobeFormality = typeof WARDROBE_FORMALITIES[number]

// This is the single source of truth for type -> slot/default-formality. Defaults are only UI
// starting points; each saved garment keeps its resolved formality so a future UI can override it.
// Every "other" type deliberately defaults to casual, the least opinionated choice.
export const GARMENT_DEFINITIONS = [
  { id: 't-shirt', slot: 'top', defaultFormality: 'casual', audience: 'unisex', label: { en: 'T-shirt', th: 'เสื้อยืด' } },
  { id: 'polo', slot: 'top', defaultFormality: 'smart-casual', audience: 'unisex', label: { en: 'polo', th: 'เสื้อโปโล' } },
  { id: 'shirt', slot: 'top', defaultFormality: 'smart-casual', audience: 'unisex', label: { en: 'shirt', th: 'เสื้อเชิ้ต' } },
  { id: 'blouse', slot: 'top', defaultFormality: 'smart-casual', audience: 'women', label: { en: 'blouse', th: 'เสื้อเบลาส์' } },
  { id: 'knit-top', slot: 'top', defaultFormality: 'smart-casual', audience: 'unisex', label: { en: 'knit top', th: 'เสื้อถัก' } },
  { id: 'other-top', slot: 'top', defaultFormality: 'casual', audience: 'unisex', label: { en: 'other top', th: 'เสื้อท่อนบนอื่น ๆ' } },

  { id: 'trousers', slot: 'bottom', defaultFormality: 'smart-casual', audience: 'unisex', label: { en: 'trousers', th: 'กางเกงขายาว' } },
  { id: 'chinos', slot: 'bottom', defaultFormality: 'smart-casual', audience: 'unisex', label: { en: 'chinos', th: 'กางเกงชิโน' } },
  { id: 'jeans', slot: 'bottom', defaultFormality: 'casual', audience: 'unisex', label: { en: 'jeans', th: 'กางเกงยีนส์' } },
  { id: 'skirt', slot: 'bottom', defaultFormality: 'smart-casual', audience: 'women', label: { en: 'skirt', th: 'กระโปรง' } },
  { id: 'shorts', slot: 'bottom', defaultFormality: 'casual', audience: 'unisex', label: { en: 'shorts', th: 'กางเกงขาสั้น' } },
  { id: 'other-bottom', slot: 'bottom', defaultFormality: 'casual', audience: 'unisex', label: { en: 'other bottom', th: 'ท่อนล่างอื่น ๆ' } },

  { id: 'dress', slot: 'one-piece', defaultFormality: 'smart-casual', audience: 'women', label: { en: 'dress', th: 'เดรส' } },
  { id: 'jumpsuit', slot: 'one-piece', defaultFormality: 'smart-casual', audience: 'unisex', label: { en: 'jumpsuit', th: 'จัมป์สูท' } },
  { id: 'other-one-piece', slot: 'one-piece', defaultFormality: 'casual', audience: 'unisex', label: { en: 'other one-piece', th: 'ชุดชิ้นเดียวอื่น ๆ' } },

  { id: 'jacket', slot: 'outerwear', defaultFormality: 'smart-casual', audience: 'unisex', label: { en: 'jacket', th: 'แจ็กเก็ต' } },
  { id: 'blazer', slot: 'outerwear', defaultFormality: 'smart-casual', audience: 'unisex', label: { en: 'blazer', th: 'เบลเซอร์' } },
  { id: 'cardigan', slot: 'outerwear', defaultFormality: 'smart-casual', audience: 'unisex', label: { en: 'cardigan', th: 'คาร์ดิแกน' } },
  { id: 'coat', slot: 'outerwear', defaultFormality: 'smart-casual', audience: 'unisex', label: { en: 'coat', th: 'โค้ต' } },
  { id: 'other-outerwear', slot: 'outerwear', defaultFormality: 'casual', audience: 'unisex', label: { en: 'other outerwear', th: 'เสื้อคลุมอื่น ๆ' } },

  { id: 'sneakers', slot: 'shoes', defaultFormality: 'casual', audience: 'unisex', label: { en: 'sneakers', th: 'รองเท้าสนีกเกอร์' } },
  { id: 'loafers', slot: 'shoes', defaultFormality: 'smart-casual', audience: 'unisex', label: { en: 'loafers', th: 'รองเท้าโลฟเฟอร์' } },
  { id: 'flats', slot: 'shoes', defaultFormality: 'smart-casual', audience: 'women', label: { en: 'flats', th: 'รองเท้าส้นแบน' } },
  { id: 'heels', slot: 'shoes', defaultFormality: 'formal', audience: 'women', label: { en: 'heels', th: 'รองเท้าส้นสูง' } },
  { id: 'boots', slot: 'shoes', defaultFormality: 'smart-casual', audience: 'unisex', label: { en: 'boots', th: 'รองเท้าบูท' } },
  { id: 'sandals', slot: 'shoes', defaultFormality: 'casual', audience: 'unisex', label: { en: 'sandals', th: 'รองเท้าแตะ' } },
  { id: 'formal-shoes', slot: 'shoes', defaultFormality: 'formal', audience: 'unisex', label: { en: 'formal shoes', th: 'รองเท้าทางการ' } },
  { id: 'other-shoes', slot: 'shoes', defaultFormality: 'casual', audience: 'unisex', label: { en: 'other shoes', th: 'รองเท้าอื่น ๆ' } },
] as const

export type GarmentType = typeof GARMENT_DEFINITIONS[number]['id']
export type GarmentDefinition = typeof GARMENT_DEFINITIONS[number]
export const GARMENT_TYPES = GARMENT_DEFINITIONS.map((definition) => definition.id) as readonly GarmentType[]

const definitionsByType = new Map<GarmentType, GarmentDefinition>(
  GARMENT_DEFINITIONS.map((definition) => [definition.id, definition]),
)

// Single source of truth for which explicit profile gender a garment type is offered to when the
// app CONCEPTUALLY proposes a look (Inspiration). 'unisex' is valid for every profile. This is not
// a wardrobe filter: a garment the user saved themselves stays eligible for Owned recommendations.
export const PROFILE_GENDERS = ['women', 'men'] as const
export type ProfileGender = typeof PROFILE_GENDERS[number]
export type GarmentAudience = ProfileGender | 'unisex'

export function isProfileGender(value: unknown): value is ProfileGender {
  return typeof value === 'string' && (PROFILE_GENDERS as readonly string[]).includes(value)
}

export function isGarmentAllowedForGender(type: GarmentType, gender: ProfileGender | null): boolean {
  if (gender === null) return true
  const audience: GarmentAudience = getGarmentDefinition(type).audience
  return audience === 'unisex' || audience === gender
}

// gender === null means no explicit profile gender was selected: nothing is excluded.
export function allowedGarmentTypesForGender(gender: ProfileGender | null): readonly GarmentType[] {
  return GARMENT_TYPES.filter((type) => isGarmentAllowedForGender(type, gender))
}

export function isGarmentType(value: unknown): value is GarmentType {
  return typeof value === 'string' && definitionsByType.has(value as GarmentType)
}

export function getGarmentDefinition(type: GarmentType): GarmentDefinition {
  return definitionsByType.get(type)!
}

export function getWardrobeSlot(type: GarmentType): WardrobeSlot {
  return getGarmentDefinition(type).slot
}

export function getDefaultFormality(type: GarmentType): WardrobeFormality {
  return getGarmentDefinition(type).defaultFormality
}

export function isWardrobeFormality(value: unknown): value is WardrobeFormality {
  return typeof value === 'string' && WARDROBE_FORMALITIES.includes(value as WardrobeFormality)
}
