import type { ItemFormality, OutfitOccasion, TodayOutfitInput, WardrobeCategory, WardrobeItem } from './contract'
import type { Subtype } from '../personalColor/types'

export interface OutfitBakeoffCase extends TodayOutfitInput {
  readonly id: string
  readonly title: string
  readonly intendedTest: string
}

const item = (id: string, name: string, category: WardrobeCategory, color: string, hex: string, formality: ItemFormality): WardrobeItem => ({
  id, name, category, color: { name: color, hex }, formality,
})
const i = item
const make = (id: string, title: string, intendedTest: string, subtype: Subtype, occasion: OutfitOccasion, wardrobe: WardrobeItem[], occasionContext?: string): OutfitBakeoffCase => ({
  id, title, intendedTest, subtype, occasion, wardrobe, ...(occasionContext ? { occasionContext } : {}),
})

export const OUTFIT_BAKEOFF_CASES: readonly OutfitBakeoffCase[] = Object.freeze([
  make('warm-spring-easy-casual', 'Easy Warm Spring casual', 'A straightforward case with several strong options.', 'warm-spring', 'casual', [
    i('cream-tee', 'Cream T-shirt', 'top', 'Cream', '#FFF0CF', 'casual'), i('coral-polo', 'Warm coral polo', 'top', 'Warm Coral', '#E9785D', 'smart-casual'), i('khaki-chinos', 'Light khaki chinos', 'bottom', 'Honey Beige', '#D9B47D', 'casual'), i('navy-trousers', 'Warm navy trousers', 'bottom', 'Warm Navy', '#314C5A', 'smart-casual'), i('white-sneakers', 'White sneakers', 'shoes', 'Soft White', '#F7F6F2', 'casual'), i('brown-loafers', 'Brown loafers', 'shoes', 'Warm Cocoa', '#82624A', 'smart-casual'),
  ]),
  make('great-top-poor-bottom', 'Excellent top, difficult bottom', 'Whether near-face suitability outweighs a weaker below-face color.', 'warm-spring', 'casual-dinner', [
    i('apricot-shirt', 'Golden apricot shirt', 'top', 'Golden Apricot', '#ED9B50', 'smart-casual'), i('optic-tee', 'Optic white T-shirt', 'top', 'Optic White', '#FFFFFF', 'casual'), i('cool-grey-trousers', 'Cool grey trousers', 'bottom', 'Blue Grey', '#6E7D8B', 'smart-casual'), i('black-jeans', 'Black jeans', 'bottom', 'Black', '#111111', 'casual'), i('brown-shoes', 'Brown leather shoes', 'shoes', 'Warm Cocoa', '#82624A', 'smart-casual'),
  ]),
  make('poor-near-face-alternatives', 'Poor near-face temptation', 'Whether the recommender avoids a tempting difficult top when a better one exists.', 'warm-spring', 'date', [
    i('mauve-blouse', 'Cool mauve blouse', 'top', 'Cool Mauve', '#9B738A', 'smart-casual'), i('jade-blouse', 'Jade blouse', 'top', 'Jade', '#379C75', 'smart-casual'), i('cream-top', 'Cream knit top', 'top', 'Cream', '#FFF0CF', 'smart-casual'), i('tan-skirt', 'Golden tan skirt', 'bottom', 'Golden Tan', '#BA8B54', 'smart-casual'), i('navy-skirt', 'Warm navy skirt', 'bottom', 'Warm Navy', '#314C5A', 'smart-casual'), i('cognac-shoes', 'Cognac shoes', 'shoes', 'Cognac', '#965F35', 'smart-casual'),
  ]),
  make('cool-with-warm-temptation', 'Cool subtype with warm temptation', 'Whether coordination is balanced against a strongly warm near-face item.', 'cool-summer', 'smart-casual', [
    i('camel-jacket', 'Camel jacket', 'outerwear', 'Camel', '#B28452', 'smart-casual'), i('denim-shirt', 'Denim blue shirt', 'top', 'Denim Blue', '#668CAD', 'smart-casual'), i('pumpkin-top', 'Pumpkin top', 'top', 'Pumpkin', '#C4662E', 'smart-casual'), i('taupe-trousers', 'Cool taupe trousers', 'bottom', 'Cool Taupe', '#A89FA0', 'smart-casual'), i('navy-trousers', 'Slate blue trousers', 'bottom', 'Slate Blue', '#596D7E', 'formal'), i('grey-loafers', 'Grey loafers', 'shoes', 'Soft Charcoal', '#4A4A52', 'smart-casual'),
  ]),
  make('mostly-neutrals', 'Mostly neutrals', 'Nuance when color compatibility does not clearly decide the outfit.', 'soft-autumn', 'work', [
    i('oat-shirt', 'Oat shirt', 'top', 'Oat', '#D2C2A6', 'smart-casual'), i('mushroom-knit', 'Mushroom knit', 'top', 'Mushroom', '#A49586', 'casual'), i('espresso-trousers', 'Espresso trousers', 'bottom', 'Soft Espresso', '#58483D', 'formal'), i('camel-trousers', 'Camel trousers', 'bottom', 'Camel', '#B08A63', 'smart-casual'), i('pewter-jacket', 'Warm pewter jacket', 'outerwear', 'Warm Pewter', '#766F64', 'smart-casual'), i('brown-loafers', 'Brown loafers', 'shoes', 'Soft Espresso', '#58483D', 'smart-casual'),
  ]),
  make('all-compatible', 'All items compatible', 'Whether the stylist adds value when Personal Color barely differentiates options.', 'deep-winter', 'casual', [
    i('cranberry-tee', 'Cranberry T-shirt', 'top', 'Cranberry', '#A3204C', 'casual'), i('emerald-knit', 'Deep emerald knit', 'top', 'Deep Emerald', '#07594A', 'casual'), i('ink-jeans', 'Ink jeans', 'bottom', 'Ink', '#22232A', 'casual'), i('charcoal-trousers', 'Charcoal trousers', 'bottom', 'Charcoal', '#383A42', 'smart-casual'), i('black-sneakers', 'Black sneakers', 'shoes', 'Black', '#0A0A0C', 'casual'),
  ]),
  make('no-perfect-option', 'No perfect Personal Color option', 'Honest tradeoffs rather than pretending a perfect outfit exists.', 'soft-summer', 'casual-dinner', [
    i('orange-shirt', 'Bright orange shirt', 'top', 'Bright Orange', '#F07828', 'smart-casual'), i('white-tee', 'Optic white T-shirt', 'top', 'Optic White', '#FFFFFF', 'casual'), i('black-trousers', 'Jet black trousers', 'bottom', 'Jet Black', '#0B0B0D', 'smart-casual'), i('coral-skirt', 'Neon coral skirt', 'bottom', 'Neon Coral', '#FF5E66', 'smart-casual'), i('white-sneakers', 'White sneakers', 'shoes', 'Optic White', '#FFFFFF', 'casual'),
  ]),
  make('smart-casual', 'Smart casual', 'Formality balance without over-dressing.', 'clear-spring', 'smart-casual', [
    i('ivory-shirt', 'Clear ivory shirt', 'top', 'Clear Ivory', '#FFF7E8', 'smart-casual'), i('peach-tee', 'Clear peach T-shirt', 'top', 'Clear Peach', '#FF9B73', 'casual'), i('navy-chinos', 'Clear navy chinos', 'bottom', 'Clear Navy', '#173F5F', 'smart-casual'), i('stone-jeans', 'Warm stone jeans', 'bottom', 'Warm Stone', '#BBAA91', 'casual'), i('cocoa-blazer', 'Cocoa blazer', 'outerwear', 'Cocoa', '#735043', 'formal'), i('caramel-loafers', 'Caramel loafers', 'shoes', 'Caramel', '#B67B43', 'smart-casual'),
  ]),
  make('work', 'Work', 'Professional formality and near-face color.', 'cool-winter', 'work', [
    i('white-shirt', 'Optic white shirt', 'top', 'Optic White', '#FFFFFF', 'formal'), i('pink-blouse', 'Icy pink blouse', 'top', 'Icy Pink', '#E8B9D2', 'smart-casual'), i('navy-trousers', 'Navy trousers', 'bottom', 'Navy', '#1E2C4D', 'formal'), i('grey-trousers', 'Silver grey trousers', 'bottom', 'Silver Grey', '#B9BEC6', 'formal'), i('charcoal-blazer', 'Cool charcoal blazer', 'outerwear', 'Cool Charcoal', '#3D414A', 'formal'), i('black-shoes', 'Black leather shoes', 'shoes', 'Black', '#090A0D', 'formal'),
  ]),
  make('date', 'Date', 'Subjective expressiveness versus safe compatibility.', 'light-summer', 'date', [
    i('rose-top', 'Rosewater top', 'top', 'Rosewater', '#DDA4B5', 'smart-casual'), i('blue-top', 'Sky blue top', 'top', 'Sky Blue', '#91C5DD', 'smart-casual'), i('navy-skirt', 'Soft navy skirt', 'bottom', 'Soft Navy', '#485B75', 'smart-casual'), i('pearl-trousers', 'Pearl grey trousers', 'bottom', 'Pearl Grey', '#D5D8DB', 'smart-casual'), i('rose-shoes', 'Rose beige shoes', 'shoes', 'Rose Beige', '#C7ACA9', 'smart-casual'),
  ]),
  make('casual-dinner', 'Casual dinner', 'A polished result from mixed casual and smart-casual pieces.', 'warm-autumn', 'casual-dinner', [
    i('ecru-shirt', 'Ecru Oxford shirt', 'top', 'Ecru', '#E8D6B4', 'smart-casual'), i('rust-tee', 'Rust T-shirt', 'top', 'Rust', '#B9572D', 'casual'), i('olive-chinos', 'Olive brown chinos', 'bottom', 'Olive Brown', '#655C3B', 'smart-casual'), i('denim-jeans', 'Dark denim jeans', 'bottom', 'Deep Navy', '#26354A', 'casual'), i('cognac-shoes', 'Cognac shoes', 'shoes', 'Cognac', '#965F35', 'smart-casual'), i('white-sneakers', 'White sneakers', 'shoes', 'Optic White', '#FFFFFF', 'casual'),
  ]),
  make('wedding-guest', 'Wedding guest', 'Formal occasion fit without assuming a hidden dress code.', 'clear-winter', 'wedding-guest', [
    i('cobalt-shirt', 'Cobalt dress shirt', 'top', 'Cobalt', '#164AC0', 'formal'), i('white-shirt', 'Optic white dress shirt', 'top', 'Optic White', '#FFFFFF', 'formal'), i('navy-trousers', 'True navy trousers', 'bottom', 'True Navy', '#172B55', 'formal'), i('black-trousers', 'Black trousers', 'bottom', 'Black', '#08090B', 'formal'), i('navy-jacket', 'True navy jacket', 'outerwear', 'True Navy', '#172B55', 'formal'), i('black-oxfords', 'Black Oxford shoes', 'shoes', 'Black', '#08090B', 'formal'),
  ], 'Daytime venue; no stated color restrictions.'),
  make('outerwear-tradeoff', 'Outerwear tradeoff', 'A strong top versus a weaker near-face outer layer.', 'light-spring', 'work', [
    i('peach-shirt', 'Peach bloom shirt', 'top', 'Peach Bloom', '#F6A987', 'smart-casual'), i('ivory-shirt', 'Warm ivory shirt', 'top', 'Warm Ivory', '#FFF3D6', 'formal'), i('charcoal-blazer', 'Charcoal blazer', 'outerwear', 'Charcoal', '#414249', 'formal'), i('warm-dove-jacket', 'Warm dove jacket', 'outerwear', 'Warm Dove', '#B9ADA0', 'smart-casual'), i('navy-trousers', 'Soft navy trousers', 'bottom', 'Soft Navy', '#465D73', 'formal'), i('camel-shoes', 'Light camel shoes', 'shoes', 'Light Camel', '#C7A578', 'smart-casual'),
  ]),
  make('shoe-tradeoff', 'Shoe tradeoff', 'Whether footwear formality appropriately outweighs its lower Personal Color importance.', 'deep-autumn', 'formal', [
    i('cream-shirt', 'Warm cream shirt', 'top', 'Warm Cream', '#E9D8B7', 'formal'), i('pine-shirt', 'Pine teal shirt', 'top', 'Pine Teal', '#1F5851', 'formal'), i('chocolate-trousers', 'Chocolate trousers', 'bottom', 'Chocolate', '#4A3327', 'formal'), i('black-oxfords', 'Black Oxford shoes', 'shoes', 'Black', '#111111', 'formal'), i('tobacco-sneakers', 'Tobacco sneakers', 'shoes', 'Tobacco', '#8B633F', 'casual'), i('charcoal-jacket', 'Warm charcoal jacket', 'outerwear', 'Warm Charcoal', '#3E3A34', 'formal'),
  ]),
  make('coordination-vs-score', 'Coordination versus strongest color score', 'Whether AI identifies a coherent outfit rather than greedily maximizing each color score.', 'cool-summer', 'date', [
    i('raspberry-top', 'Raspberry rose top', 'top', 'Raspberry Rose', '#C85E82', 'smart-casual'), i('teal-top', 'Cool teal top', 'top', 'Cool Teal', '#3C8D91', 'smart-casual'), i('rose-brown-skirt', 'Rose brown skirt', 'bottom', 'Rose Brown', '#8D6F73', 'smart-casual'), i('slate-trousers', 'Slate blue trousers', 'bottom', 'Slate Blue', '#596D7E', 'smart-casual'), i('cranberry-shoes', 'Cranberry shoes', 'shoes', 'Cranberry', '#B73E65', 'smart-casual'), i('charcoal-shoes', 'Soft charcoal shoes', 'shoes', 'Soft Charcoal', '#4A4A52', 'smart-casual'),
  ]),
  make('near-black', 'Near-black option', 'Whether a less-ideal dark item is handled differently near versus away from the face.', 'light-spring', 'casual-dinner', [
    i('black-top', 'Near-black knit top', 'top', 'Black', '#111111', 'smart-casual'), i('mint-top', 'Mint leaf blouse', 'top', 'Mint Leaf', '#93D6AE', 'smart-casual'), i('black-trousers', 'Near-black trousers', 'bottom', 'Black', '#111111', 'smart-casual'), i('oat-trousers', 'Oatmeal trousers', 'bottom', 'Oatmeal', '#DCCDB2', 'smart-casual'), i('navy-shoes', 'Soft navy shoes', 'shoes', 'Soft Navy', '#465D73', 'smart-casual'),
  ]),
  make('white-vs-cream', 'White or cream', 'A close choice whose near-face undertone matters.', 'warm-spring', 'work', [
    i('white-shirt', 'Optic white shirt', 'top', 'Optic White', '#FFFFFF', 'formal'), i('cream-shirt', 'Cream shirt', 'top', 'Cream', '#FFF0CF', 'formal'), i('navy-trousers', 'Warm navy trousers', 'bottom', 'Warm Navy', '#314C5A', 'formal'), i('cocoa-trousers', 'Warm cocoa trousers', 'bottom', 'Warm Cocoa', '#82624A', 'formal'), i('navy-jacket', 'Warm navy jacket', 'outerwear', 'Warm Navy', '#314C5A', 'formal'), i('brown-shoes', 'Brown leather shoes', 'shoes', 'Warm Cocoa', '#82624A', 'formal'),
  ]),
  make('multiple-valid', 'Multiple valid outfits', 'A deliberately ambiguous case with no single objective answer.', 'soft-summer', 'smart-casual', [
    i('dusty-rose-top', 'Dusty rose top', 'top', 'Dusty Rose', '#B9828F', 'smart-casual'), i('smoky-blue-top', 'Smoky blue top', 'top', 'Smoky Blue', '#71899A', 'smart-casual'), i('mushroom-trousers', 'Mushroom trousers', 'bottom', 'Mushroom', '#A79B95', 'smart-casual'), i('navy-trousers', 'Soft navy trousers', 'bottom', 'Soft Navy', '#455462', 'smart-casual'), i('slate-jacket', 'Slate jacket', 'outerwear', 'Slate', '#667078', 'smart-casual'), i('cocoa-shoes', 'Cool cocoa shoes', 'shoes', 'Cool Cocoa', '#796A68', 'smart-casual'), i('navy-shoes', 'Soft navy shoes', 'shoes', 'Soft Navy', '#455462', 'smart-casual'),
  ]),
  make('formal-limited', 'Formal with limited wardrobe', 'An explicit imperfect formal recommendation or uncertainty.', 'warm-autumn', 'formal', [
    i('mustard-polo', 'Golden mustard polo', 'top', 'Golden Mustard', '#C3972E', 'casual'), i('white-tee', 'Optic white T-shirt', 'top', 'Optic White', '#FFFFFF', 'casual'), i('espresso-chinos', 'Espresso chinos', 'bottom', 'Espresso', '#46372C', 'smart-casual'), i('jeans', 'Blue jeans', 'bottom', 'Blue', '#405C78', 'casual'), i('brown-loafers', 'Brown loafers', 'shoes', 'Cognac', '#965F35', 'smart-casual'),
  ]),
])
