import type { MetalRecommendation, PaletteColor, PersonalColorPalette, Subtype } from './types'

type ColorSeed = [name: string, hex: string]
type PaletteSeed = { best: ColorSeed[]; neutrals: ColorSeed[]; accents: ColorSeed[]; harder: ColorSeed[]; metals: [string, string, string][] }

function buildPalette(subtype: Subtype, seed: PaletteSeed): PersonalColorPalette {
  const colors = (category: string, items: ColorSeed[]): PaletteColor[] => items.map(([name, hex], index) => ({ id: `${subtype}-${category}-${index + 1}`, name, hex }))
  const metals: MetalRecommendation[] = seed.metals.map(([name, hex, note], index) => ({ id: `${subtype}-metal-${index + 1}`, name, hex, note }))
  return { best: colors('best', seed.best), neutrals: colors('neutral', seed.neutrals), accents: colors('accent', seed.accents), harder: colors('harder', seed.harder), metals }
}

const paletteSeeds: Record<Subtype, PaletteSeed> = {
  'light-spring': {
    best: [['Peach Bloom', '#F6A987'], ['Fresh Apricot', '#F3A45F'], ['Buttercup', '#F5D46F'], ['Mint Leaf', '#93D6AE'], ['Aqua Glass', '#6FD3CF'], ['Warm Sky', '#77BDE0'], ['Petal Pink', '#F4A6B7'], ['Light Poppy', '#ED7966']],
    neutrals: [['Warm Ivory', '#FFF3D6'], ['Oatmeal', '#DCCDB2'], ['Light Camel', '#C7A578'], ['Warm Dove', '#B9ADA0'], ['Soft Navy', '#465D73']],
    accents: [['Melon', '#F28B70'], ['Clear Turquoise', '#29BDB5'], ['Leaf Green', '#75B96B'], ['Sunlit Coral', '#F06F61'], ['Golden Rose', '#DB7185']],
    harder: [['Black', '#111111'], ['Burgundy', '#671D38'], ['Icy Lavender', '#DAD7F2'], ['Charcoal', '#414249']],
    metals: [['Champagne Gold', '#D6B267', 'Soft warmth without too much weight'], ['Light Rose Gold', '#DCA38F', 'A gentle rosy warmth']],
  },
  'warm-spring': {
    best: [['Warm Coral', '#E9785D'], ['Golden Apricot', '#ED9B50'], ['Daffodil', '#F0C83E'], ['Apple Green', '#78A94A'], ['Warm Turquoise', '#2CA8A0'], ['Geranium', '#DC5B56'], ['Peacock Blue', '#237F89'], ['Persimmon', '#E86F3D']],
    neutrals: [['Cream', '#FFF0CF'], ['Honey Beige', '#D9B47D'], ['Golden Tan', '#BA8B54'], ['Warm Cocoa', '#82624A'], ['Warm Navy', '#314C5A']],
    accents: [['Papaya', '#F48A45'], ['Marigold', '#E9A824'], ['Jade', '#379C75'], ['Tomato Red', '#DB4C3D'], ['Bright Teal', '#168E92']],
    harder: [['Cool Mauve', '#9B738A'], ['Optic White', '#FFFFFF'], ['Blue Grey', '#6E7D8B'], ['Cool Fuchsia', '#BC3575']],
    metals: [['Yellow Gold', '#C89B3C', 'Rich gold echoes your natural warmth'], ['Bronze', '#A76E3A', 'A grounded, sunny finish']],
  },
  'clear-spring': {
    best: [['Flame Coral', '#F15B4E'], ['Clear Peach', '#FF9B73'], ['Sunshine', '#F7CE36'], ['Kelly Green', '#29A55F'], ['Caribbean Blue', '#15AEB7'], ['Bright Aqua', '#36C9D0'], ['Warm Violet', '#9867C7'], ['Cobalt Teal', '#087E8B']],
    neutrals: [['Clear Ivory', '#FFF7E8'], ['Warm Stone', '#BBAA91'], ['Caramel', '#B67B43'], ['Cocoa', '#735043'], ['Clear Navy', '#173F5F']],
    accents: [['Poppy', '#EE3F3B'], ['Lime Leaf', '#8CC63E'], ['Electric Peach', '#FF775D'], ['Azure', '#168AAD'], ['Hot Coral', '#F05264']],
    harder: [['Dusty Rose', '#A9838C'], ['Mushroom', '#8E8278'], ['Smoky Blue', '#728895'], ['Muted Mauve', '#927383']],
    metals: [['Polished Gold', '#D4A92F', 'A bright, reflective finish'], ['Bright Rose Gold', '#D78C77', 'Clear warmth with lively shine']],
  },
  'light-summer': {
    best: [['Powder Pink', '#EAB6C5'], ['Rosewater', '#DDA4B5'], ['Sky Blue', '#91C5DD'], ['Periwinkle', '#9CA9D6'], ['Seafoam', '#92CFC2'], ['Light Raspberry', '#D8789A'], ['Cool Lemon', '#EDE38A'], ['Soft Orchid', '#C9A5D1']],
    neutrals: [['Soft White', '#F7F6F2'], ['Pearl Grey', '#D5D8DB'], ['Rose Beige', '#C7ACA9'], ['Blue Grey', '#8D9FAC'], ['Soft Navy', '#485B75']],
    accents: [['Watermelon', '#DC7486'], ['Cornflower', '#709BCC'], ['Cool Mint', '#86C9B8'], ['Bluebell', '#7E84C7'], ['Pink Orchid', '#C875B2']],
    harder: [['Burnt Orange', '#B5572F'], ['Dark Chocolate', '#493227'], ['Mustard', '#AF842C'], ['Black', '#111111']],
    metals: [['Silver', '#C7CCD1', 'Light, cool reflection'], ['Soft White Gold', '#D8D6CD', 'A subtle neutral shimmer']],
  },
  'cool-summer': {
    best: [['Raspberry Rose', '#C85E82'], ['Blue Pink', '#D47BA0'], ['True Lavender', '#A894C7'], ['Denim Blue', '#668CAD'], ['Cool Teal', '#3C8D91'], ['Plum Rose', '#9A5275'], ['Blueberry', '#5D638E'], ['Sea Green', '#579D8C']],
    neutrals: [['Soft White', '#F4F3F0'], ['Cool Taupe', '#A89FA0'], ['Rose Brown', '#8D6F73'], ['Slate Blue', '#596D7E'], ['Soft Charcoal', '#4A4A52']],
    accents: [['Cranberry', '#B73E65'], ['French Blue', '#477CB5'], ['Cool Emerald', '#278174'], ['Magenta Rose', '#B84D91'], ['Iris', '#7164A8']],
    harder: [['Pumpkin', '#C4662E'], ['Camel', '#B28452'], ['Tomato Red', '#C94636'], ['Golden Olive', '#88772F']],
    metals: [['Silver', '#BFC5CB', 'A classic cool-toned shine'], ['White Gold', '#D5D6D2', 'Refined and quietly reflective']],
  },
  'soft-summer': {
    best: [['Dusty Rose', '#B9828F'], ['Mauve Mist', '#A8819A'], ['Smoky Blue', '#71899A'], ['Eucalyptus', '#72968A'], ['Heather', '#8D7892'], ['Soft Berry', '#9E5E79'], ['Blue Sage', '#7B9798'], ['Muted Plum', '#7D5C72']],
    neutrals: [['Oyster', '#DDD7D1'], ['Mushroom', '#A79B95'], ['Cool Cocoa', '#796A68'], ['Slate', '#667078'], ['Soft Navy', '#455462']],
    accents: [['Mulberry', '#87536D'], ['Storm Blue', '#58788A'], ['Muted Teal', '#4E817B'], ['Antique Pink', '#B06F7D'], ['Soft Aubergine', '#66506B']],
    harder: [['Neon Coral', '#FF5E66'], ['Bright Orange', '#F07828'], ['Optic White', '#FFFFFF'], ['Jet Black', '#0B0B0D']],
    metals: [['Brushed Silver', '#AEB3B5', 'Soft sheen suits your blended quality'], ['Rose Silver', '#B9A6A6', 'A muted rosy metallic']],
  },
  'soft-autumn': {
    best: [['Terracotta Rose', '#B66F5D'], ['Dusty Apricot', '#C88B69'], ['Moss', '#788058'], ['Soft Olive', '#8C8A58'], ['Muted Teal', '#4F7B74'], ['Clay Pink', '#B77F79'], ['Warm Sage', '#929B78'], ['Spiced Peach', '#C77D5B']],
    neutrals: [['Oat', '#D2C2A6'], ['Mushroom', '#A49586'], ['Camel', '#B08A63'], ['Warm Pewter', '#766F64'], ['Soft Espresso', '#58483D']],
    accents: [['Adobe', '#A95D48'], ['Lichen', '#68724D'], ['Petrol Blue', '#3E6D70'], ['Old Rose', '#9F6670'], ['Soft Mustard', '#AE8A42']],
    harder: [['Electric Blue', '#2767DC'], ['Cool Fuchsia', '#C12B7A'], ['Optic White', '#FFFFFF'], ['Icy Pink', '#F2DDE8']],
    metals: [['Antique Gold', '#A98A4D', 'Warmth with a softened finish'], ['Brushed Bronze', '#8F6948', 'Low-shine, earthy depth']],
  },
  'warm-autumn': {
    best: [['Rust', '#B9572D'], ['Pumpkin', '#D06A2C'], ['Golden Mustard', '#C3972E'], ['Olive Leaf', '#737B38'], ['Forest Teal', '#276B62'], ['Brick Red', '#A83F32'], ['Cinnamon', '#A8603D'], ['Warm Aubergine', '#69434F']],
    neutrals: [['Ecru', '#E8D6B4'], ['Camel', '#B58A55'], ['Cognac', '#965F35'], ['Olive Brown', '#655C3B'], ['Espresso', '#46372C']],
    accents: [['Paprika', '#B94B32'], ['Ochre', '#C18B23'], ['Peacock', '#126C6B'], ['Avocado', '#758237'], ['Warm Burgundy', '#77363A']],
    harder: [['Icy Blue', '#D8EAF3'], ['Cool Pink', '#DC8FB6'], ['Blue Violet', '#7356B4'], ['Optic White', '#FFFFFF']],
    metals: [['Antique Gold', '#B18B3D', 'Rich warmth with character'], ['Copper', '#B46842', 'A natural extension of autumn warmth']],
  },
  'deep-autumn': {
    best: [['Oxblood', '#712F32'], ['Burnished Rust', '#9D482B'], ['Dark Olive', '#4C542D'], ['Pine Teal', '#1F5851'], ['Deep Mustard', '#9E7624'], ['Aubergine Brown', '#533A43'], ['Mahogany', '#643B2C'], ['Forest', '#2E5238']],
    neutrals: [['Warm Cream', '#E9D8B7'], ['Tobacco', '#8B633F'], ['Dark Camel', '#856441'], ['Chocolate', '#4A3327'], ['Warm Charcoal', '#3E3A34']],
    accents: [['Chili Red', '#9D3428'], ['Deep Peacock', '#125B5E'], ['Amber', '#B36D25'], ['Bottle Green', '#275039'], ['Warm Plum', '#613845']],
    harder: [['Baby Pink', '#F1C6D3'], ['Icy Lilac', '#DDD8EE'], ['Cool Lemon', '#F1E885'], ['Pale Aqua', '#C7E8E5']],
    metals: [['Dark Gold', '#9E7836', 'Substantial, burnished warmth'], ['Aged Bronze', '#78583A', 'Deep and grounded']],
  },
  'deep-winter': {
    best: [['Black Cherry', '#581B33'], ['Burgundy', '#6E1F3A'], ['Deep Emerald', '#07594A'], ['Ink Navy', '#17243F'], ['Royal Purple', '#4E2D78'], ['Cranberry', '#A3204C'], ['Pine', '#16483F'], ['Midnight Blue', '#182D54']],
    neutrals: [['Pure White', '#FAFAF8'], ['Cool Taupe', '#7C7478'], ['Charcoal', '#383A42'], ['Ink', '#22232A'], ['Black', '#0A0A0C']],
    accents: [['Ruby', '#A50F3D'], ['Jewel Teal', '#006A69'], ['Royal Blue', '#234A9B'], ['Deep Fuchsia', '#9D266F'], ['Amethyst', '#633C8A']],
    harder: [['Camel', '#B78A59'], ['Peach', '#F0A07C'], ['Mustard', '#B58A28'], ['Warm Beige', '#D8BA91']],
    metals: [['Polished Silver', '#C1C6CC', 'Crisp shine for strong contrast'], ['White Gold', '#D4D5D3', 'Cool, substantial reflection']],
  },
  'cool-winter': {
    best: [['True Red', '#C51F3A'], ['Fuchsia', '#C12678'], ['Cobalt', '#234EB3'], ['Emerald', '#00735E'], ['Royal Purple', '#5D3598'], ['Icy Pink', '#E8B9D2'], ['Blue Teal', '#08788A'], ['Magenta', '#A92373']],
    neutrals: [['Optic White', '#FFFFFF'], ['Silver Grey', '#B9BEC6'], ['Cool Charcoal', '#3D414A'], ['Navy', '#1E2C4D'], ['Black', '#090A0D']],
    accents: [['Sapphire', '#174AA8'], ['Blue Red', '#B31335'], ['Cool Emerald', '#008067'], ['Violet', '#6942A6'], ['Hot Pink', '#D32683']],
    harder: [['Orange', '#E66D2E'], ['Camel', '#B88C5A'], ['Warm Brown', '#7B4C31'], ['Golden Olive', '#807A2F']],
    metals: [['Silver', '#C4C9CE', 'Clean and decisively cool'], ['Platinum', '#D6D7D8', 'Bright, neutral-cool polish']],
  },
  'clear-winter': {
    best: [['Electric Blue', '#1756C4'], ['Hot Pink', '#E02582'], ['Bright Ruby', '#C5113E'], ['Emerald Green', '#00835E'], ['Clear Violet', '#7042BB'], ['Turquoise', '#00A5AC'], ['Icy Lemon', '#F2EE8F'], ['Royal Purple', '#5731A4']],
    neutrals: [['Optic White', '#FFFFFF'], ['Ice Grey', '#D9DCE2'], ['Cool Grey', '#777E8B'], ['True Navy', '#172B55'], ['Black', '#08090B']],
    accents: [['Cobalt', '#164AC0'], ['Magenta', '#C7197A'], ['Blue Red', '#D01B3F'], ['Jewel Teal', '#007C7A'], ['Acid Green', '#6EBA3A']],
    harder: [['Dusty Mauve', '#A78796'], ['Camel', '#B58B5F'], ['Muted Sage', '#8E9B83'], ['Soft Peach', '#E8A991']],
    metals: [['Polished Silver', '#C8CDD2', 'High shine mirrors your clarity'], ['Bright White Gold', '#E1E0DB', 'A sharp, luminous finish']],
  },
}

export const palettes = Object.fromEntries(
  Object.entries(paletteSeeds).map(([subtype, seed]) => [subtype, buildPalette(subtype as Subtype, seed)]),
) as Record<Subtype, PersonalColorPalette>

export function getPalette(subtype: Subtype) {
  return palettes[subtype]
}
