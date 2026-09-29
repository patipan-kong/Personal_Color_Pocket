import { describe, expect, it } from 'vitest'
import { validateOutfitPreviewInput } from './previewContract'

const piece = (garmentType: string, hex = '#112233') => ({ garmentType, color: { hex } })
const separates = { kind: 'separates', top: piece('shirt'), bottom: piece('trousers'), outerwear: null, shoes: piece('loafers') }
const onePiece = { kind: 'one-piece', onePiece: piece('dress'), outerwear: null, shoes: piece('heels') }
const request = (outfit: unknown) => ({ version: 1, mode: 'flat-lay', outfit })

describe('production Outfit Preview contract', () => {
  it.each([
    ['separates without outerwear', separates],
    ['separates with outerwear', { ...separates, outerwear: piece('blazer') }],
    ['one-piece without outerwear', onePiece],
    ['one-piece with outerwear', { ...onePiece, outerwear: piece('coat') }],
  ])('accepts the bounded %s shape', (_label, outfit) => {
    expect(validateOutfitPreviewInput(request(outfit))).toEqual({ ok: true, value: request(outfit), issues: [] })
  })

  it('accepts only a fixed visual description that matches the semantic garment type', () => {
    const sandals = { garmentType: 'sandals', color: { hex: '#112233' }, visualDescription: "men's casual sandals" }
    expect(validateOutfitPreviewInput(request({ ...separates, shoes: sandals })).ok).toBe(true)
    expect(validateOutfitPreviewInput(request({ ...separates, shoes: { ...sandals, garmentType: 'loafers' } })).ok).toBe(false)
    expect(validateOutfitPreviewInput(request({ ...separates, shoes: { ...sandals, visualDescription: 'designer sandals' } })).ok).toBe(false)
  })

  it.each([
    ['unsupported version', { version: 2, mode: 'flat-lay', outfit: separates }],
    ['unsupported mode', { version: 1, mode: 'model', outfit: separates }],
    ['generic prompt', { ...request(separates), prompt: 'change it' }],
    ['provider selector', { ...request(separates), provider: 'gemini' }],
    ['model selector', { ...request(separates), model: 'gemini-3.1-flash-image' }],
    ['display string', request({ ...separates, top: { ...separates.top, name: 'private label' } })],
    ['malformed HEX', request({ ...separates, top: piece('shirt', 'navy') })],
    ['non-normalized HEX', request({ ...separates, top: piece('shirt', '#abcdef') })],
    ['unknown garment', request({ ...separates, top: piece('cape') })],
    ['wrong-slot garment', request({ ...separates, top: piece('trousers') })],
    ['missing required piece', request({ kind: 'separates', top: piece('shirt'), outerwear: null, shoes: piece('loafers') })],
    ['extra piece', request({ ...separates, hat: piece('shirt') })],
    ['one-piece in separates', request({ ...separates, top: piece('dress') })],
    ['top in one-piece', request({ ...onePiece, top: piece('shirt') })],
  ])('rejects %s', (_label, value) => expect(validateOutfitPreviewInput(value).ok).toBe(false))
})
