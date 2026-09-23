import type { GarmentNounKey } from '../personalColor/styleGuide'
import type { PresentationPreference } from '../../services/presentationPreference'
import type { PhotoColorMatch, PhotoMatchCategory } from './types'

// V1.2 colour placement (Slice 5b): "given this colour and the user's subtype, where does it work
// best?" Pure and deterministic. Slice 5d keys the table by a placement INTENT so the manual
// checker can share it: the photo match category maps 1:1 to an intent (PHOTO_INTENT), and the
// manual adapter maps its existing rating the same way. The presentation preference chooses
// example garments and nothing else. There is deliberately no input for what was tapped: no
// garment type, label, box, mask or confidence. A shirt and a bag of the same colour get the same
// answer. No prose here: the UI renders these keys through i18n.

// How comfortable the placement is. Not a score and not ordered numerically.
// (EN labels as of Slice 5c)
// best     "Wear it here"     the colour's natural home
// good     "Also works"       comfortable as well
// easiest  "Easiest here"     the simplest way to use a colour that is less natural near the face
// care     "Less ideal"       works only with a palette colour placed nearer the face
export type PlacementTier = 'best' | 'good' | 'easiest' | 'care'

// Where on the body / outfit, independent of presentation.
export type PlacementArea = 'near-face' | 'larger-pieces' | 'base' | 'layers' | 'below-face' | 'accents'

// How the UI frames match.pairWith:
// around     "Goes well with": general companions (near-face, neutral-base)
// near-face  "If you like it, keep one of these near your face" (related, away-from-face, outside)
export type PairingAdvice = 'around' | 'near-face'

export interface PlacementRow {
  tier: PlacementTier
  areas: PlacementArea[]
  // Example pieces for this presentation, reusing the style guide's garment vocabulary.
  examples: GarmentNounKey[]
}

// What a colour's result says about where it belongs. Not a score and not ordered numerically.
// face          natural near the face, fine everywhere else   (photo near-face, manual Great Match)
// base          an easy foundation                             (photo neutral-base)
// harmonious    main pieces, near the face included            (manual Good Match)
// second-color  usable as a second colour or layer             (photo related, manual Wearable)
// below-face    easiest below the face                         (photo away-from-face, manual Tricky)
// accents       easiest in small or lower placements           (photo outside)
export type PlacementIntent = 'face' | 'base' | 'harmonious' | 'second-color' | 'below-face' | 'accents'

export interface PlacementGuide {
  rows: PlacementRow[]
  pairing: PairingAdvice
}

export interface ColorPlacement extends PlacementGuide {
  category: PhotoMatchCategory
}

interface RowPlan {
  tier: PlacementTier
  areas: PlacementArea[]
  examples: Record<PresentationPreference, GarmentNounKey[]>
}

// Presentation-specific examples for "near the face". Men never get dress/skirt examples.
const NEAR_FACE: Record<PresentationPreference, GarmentNounKey[]> = { women: ['top', 'scarf'], men: ['shirt', 'tshirt'] }

const PLANS: Record<PlacementIntent, { rows: RowPlan[]; pairing: PairingAdvice }> = {
  // One of the safer colours to wear close to the face, and fine everywhere else too.
  face: {
    rows: [
      { tier: 'best', areas: ['near-face'], examples: { women: ['top', 'blouse', 'scarf', 'jacket'], men: ['shirt', 'tshirt', 'polo', 'jacket'] } },
      { tier: 'good', areas: ['larger-pieces', 'accents'], examples: { women: ['dress', 'skirt', 'bag'], men: ['trousers', 'bag', 'shoes'] } },
    ],
    pairing: 'around',
  },
  // An easy foundation. Not downgraded for being neutral: it also works near the face.
  base: {
    rows: [
      { tier: 'best', areas: ['base'], examples: { women: ['trousers', 'skirt', 'jacket', 'bag'], men: ['trousers', 'jacket', 'shoes', 'bag'] } },
      { tier: 'good', areas: ['near-face'], examples: NEAR_FACE },
    ],
    pairing: 'around',
  },
  // Manual Good Match (Slice 5d): harmonious in main pieces, near the face included.
  harmonious: {
    rows: [
      { tier: 'best', areas: ['near-face', 'larger-pieces'], examples: { women: ['top', 'dress', 'jacket', 'blouse'], men: ['shirt', 'jacket', 'polo', 'trousers'] } },
      { tier: 'good', areas: ['accents'], examples: { women: ['bag', 'scarf', 'shoes'], men: ['bag', 'shoes', 'belt'] } },
    ],
    pairing: 'around',
  },
  // Usable; placement and pairing make it easier.
  'second-color': {
    rows: [
      { tier: 'good', areas: ['layers'], examples: { women: ['jacket', 'skirt', 'bag'], men: ['jacket', 'trousers', 'bag'] } },
      { tier: 'care', areas: ['near-face'], examples: NEAR_FACE },
    ],
    pairing: 'near-face',
  },
  // Still wearable: easiest below the face, with a palette colour nearer the face.
  'below-face': {
    rows: [
      { tier: 'easiest', areas: ['below-face', 'accents'], examples: { women: ['skirt', 'trousers', 'shoes', 'bag'], men: ['trousers', 'belt', 'shoes', 'bag'] } },
      { tier: 'care', areas: ['near-face'], examples: NEAR_FACE },
    ],
    pairing: 'near-face',
  },
  // Not a prohibition: easiest in small or lower placements, paired with a palette colour.
  accents: {
    rows: [
      { tier: 'easiest', areas: ['accents', 'below-face'], examples: { women: ['bag', 'shoes', 'accessory', 'skirt'], men: ['bag', 'shoes', 'belt', 'trousers'] } },
      { tier: 'care', areas: ['near-face'], examples: NEAR_FACE },
    ],
    pairing: 'near-face',
  },
}

// The photo match category decides the intent, one to one.
const PHOTO_INTENT: Record<PhotoMatchCategory, PlacementIntent> = {
  'near-face': 'face',
  'neutral-base': 'base',
  related: 'second-color',
  'away-from-face': 'below-face',
  outside: 'accents',
}

// One table lookup. `presentation` picks the example garments and cannot change tiers, areas or pairing.
export function getPlacementGuide(intent: PlacementIntent, presentation: PresentationPreference): PlacementGuide {
  const plan = PLANS[intent]
  if (!plan) throw new RangeError(`Unknown placement intent: ${String(intent)}`)
  return {
    rows: plan.rows.map(({ tier, areas, examples }) => ({ tier, areas: [...areas], examples: [...examples[presentation]] })),
    pairing: plan.pairing,
  }
}

// The photo placement model. Only `match.category` is read from the match.
export function getColorPlacement(match: Pick<PhotoColorMatch, 'category'>, presentation: PresentationPreference): ColorPlacement {
  const intent = PHOTO_INTENT[match.category]
  if (!intent) throw new RangeError(`Unknown photo match category: ${String(match.category)}`)
  return { category: match.category, ...getPlacementGuide(intent, presentation) }
}
