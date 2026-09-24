import type { LocaleCopy } from '../i18n'

// Existing app wording that Learn shows as-is. Learn stores the key, never a copy of the text, so a
// wording change on the app screen reaches Learn too (truth B: existing presentation guidance).
const appCopy = {
  'result.disclaimer': (copy: LocaleCopy) => copy.result.disclaimer,
  'palette.harderTips': (copy: LocaleCopy) => copy.palette.harderTips,
  'photoChecker.captureTip': (copy: LocaleCopy) => copy.photoChecker.captureTip,
  'photoChecker.lightingNote': (copy: LocaleCopy) => copy.photoChecker.lightingNote,
  'daily.storyFamily': (copy: LocaleCopy) => copy.daily.storyFamily,
  'daily.storyShade': (copy: LocaleCopy) => copy.daily.storyShade,
  'daily.aboutBody': (copy: LocaleCopy) => copy.daily.aboutBody,
} satisfies Record<string, (copy: LocaleCopy) => string | readonly string[]>

export type AppCopyRef = keyof typeof appCopy

export function resolveAppCopy(copy: LocaleCopy, ref: AppCopyRef): string | readonly string[] {
  return appCopy[ref](copy)
}
