import type { LuckyColorFamily } from '../domain/luckyColor/types'

// These are presentation-only representative swatches for broad source families. They are not
// lucky-domain knowledge, Personal Color palette entries, or an exact recommended shade.
export const LUCKY_FAMILY_DISPLAY_SWATCHES: Readonly<Record<LuckyColorFamily, string>> = Object.freeze({
  white: '#F7F2E8', yellow: '#D9A52E', pink: '#D66A8A', red: '#B94442', green: '#43845A',
  blue: '#447DB5', purple: '#76519D', orange: '#D97732', gray: '#7D7B80', black: '#2F2D31',
})
