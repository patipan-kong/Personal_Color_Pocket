import { describe, expect, it } from 'vitest'
import type { OutfitPreviewInput } from '../../src/domain/todayOutfitProduction/previewContract.js'
import { buildOutfitPreviewPrompt } from './outfitPreviewPrompt.js'

const piece = (garmentType: 'shirt' | 'trousers' | 'blazer' | 'loafers' | 'dress', hex: string) => ({ garmentType, color: { hex } })
const separates: OutfitPreviewInput = { version: 1, mode: 'flat-lay', outfit: { kind: 'separates', top: piece('shirt', '#112233'), bottom: piece('trousers', '#445566'), outerwear: null, shoes: piece('loafers', '#778899') } }
const separatesWithOuterwear: OutfitPreviewInput = { version: 1, mode: 'flat-lay', outfit: { kind: 'separates', top: piece('shirt', '#112233'), bottom: piece('trousers', '#445566'), outerwear: piece('blazer', '#DDEEFF'), shoes: piece('loafers', '#778899') } }
const onePiece: OutfitPreviewInput = { version: 1, mode: 'flat-lay', outfit: { kind: 'one-piece', onePiece: piece('dress', '#AABBCC'), outerwear: piece('blazer', '#DDEEFF'), shoes: piece('loafers', '#010203') } }
const onePieceWithoutOuterwear: OutfitPreviewInput = { version: 1, mode: 'flat-lay', outfit: { kind: 'one-piece', onePiece: piece('dress', '#AABBCC'), outerwear: null, shoes: piece('loafers', '#010203') } }

describe('production Outfit Preview prompt', () => {
  it.each([
    ['separates without outerwear', separates, ['shirt', 'trousers', 'loafers'], ['#112233', '#445566', '#778899']],
    ['separates with outerwear', separatesWithOuterwear, ['shirt', 'trousers', 'blazer', 'loafers'], ['#112233', '#445566', '#DDEEFF', '#778899']],
    ['one-piece without outerwear', onePieceWithoutOuterwear, ['dress', 'loafers'], ['#AABBCC', '#010203']],
    ['one-piece with outerwear', onePiece, ['dress', 'blazer', 'loafers'], ['#AABBCC', '#DDEEFF', '#010203']],
  ] as const)('contains only the selected facts and visualizer constraints for %s', (_label, input, garmentTypes, colors) => {
    const prompt = buildOutfitPreviewPrompt(input)
    for (const garmentType of garmentTypes) expect(prompt).toContain(`garment type ${garmentType}`)
    for (const color of colors) expect(prompt.match(new RegExp(color, 'g'))).toHaveLength(1)
    expect(prompt).toMatch(/fashion-editorial flat-lay/i)
    expect(prompt).toMatch(/square composition/i)
    expect(prompt).toMatch(/neutral background/i)
    expect(prompt).toMatch(/exactly these supplied garments, once each/i)
    expect(prompt).toMatch(/do not redesign/i)
    expect(prompt).toMatch(/substitute/i)
    expect(prompt).toMatch(/do not add or remove/i)
    expect(prompt).toMatch(/people, bodies, faces, mannequins, or hands/i)
    expect(prompt).toMatch(/text, labels, captions, typography, written HEX values, logos, or watermarks/i)
    expect(prompt).toMatch(/accessories, bags, jewelry, props/i)
    expect(prompt).toMatch(/visualizer, not a stylist/i)
    expect(prompt).not.toMatch(/lucky goal|warm-spring|occasion-id|wardrobe-id|custom-name|provider-model|reasoning-text/i)
  })

  it('includes outerwear only when supplied', () => {
    expect(buildOutfitPreviewPrompt(separates)).not.toContain('- outerwear:')
    expect(buildOutfitPreviewPrompt(onePiece)).toContain('- outerwear: blazer')
  })

  it('uses a constrained visual description without changing garment identity or exact color', () => {
    const input: OutfitPreviewInput = {
      ...separates,
      outfit: {
        ...separates.outfit,
        shoes: { garmentType: 'sandals', color: { hex: '#A45C31' }, visualDescription: "men's casual sandals" },
      },
    }
    const prompt = buildOutfitPreviewPrompt(input)
    expect(prompt).toContain("sandals (garment type sandals; visual presentation: men's casual sandals)")
    expect(prompt.match(/#A45C31/g)).toHaveLength(1)
    expect(prompt).toMatch(/must never cause a substitution/i)
    expect(prompt).not.toMatch(/sneakers|profile|recommendation reasoning|lucky|personal color/i)
  })
})
