import type { PaletteColor } from './domain/personalColor/types'
import { colorDisplayName } from './i18n'
import type { Language } from './i18n'

type CanonicalColor = Pick<PaletteColor, 'name' | 'hex'>

// One presentation contract for canonical palette identity. Thai localization is derived at
// render time; the secondary English label and HEX always come from the canonical palette entry.
export function CanonicalColorLabel({ color, language, showHex = false, mode = 'stacked', className = '' }: {
  color: CanonicalColor
  language: Language
  showHex?: boolean
  mode?: 'stacked' | 'compact'
  className?: string
}) {
  return <span className={`canonical-color-label is-${mode}${className ? ` ${className}` : ''}`}>
    <strong className="canonical-color-primary">{colorDisplayName(language, color)}</strong>
    {language === 'th' && <span className="canonical-color-secondary" lang="en">{color.name}</span>}
    {showHex && <code className="canonical-color-hex">{color.hex}</code>}
  </span>
}
