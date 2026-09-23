import type { ConfidenceLabel, DimensionKey, MatchRating, QuizOptionIds, QuizQuestionId, Subtype } from '../domain/personalColor/types'
import type { QuizVisualLabelKey } from '../domain/personalColor/quizVisuals'
import type { GarmentNounKey, StyleCategoryKey } from '../domain/personalColor/styleGuide'
import type { PhotoMatchCategory, SampleFlag, SampleUnavailableReason } from '../domain/photoColor/types'
import type { PhotoImageErrorCode } from '../services/photoImage'

export type Language = 'en' | 'th'

export type QuizCopy = {
  [Question in QuizQuestionId]: {
    prompt: string
    helper: string
    options: Record<QuizOptionIds[Question], { label: string; hint: string }>
  }
}

export interface SubtypeCopy {
  name: string
  secondaryName: string
  characteristics: [string, string, string]
  summary: string
}

export interface LocaleCopy {
  language: Language
  languageName: string
  switcherLabel: string
  header: { homeLabel: string; edition: string; presentationSwitcherLabel: string }
  presentation: {
    eyebrow: string
    title: string
    helper: string
    women: string
    men: string
    womenImageAlt: string
    menImageAlt: string
    note: string
    changeLater: string
  }
  welcome: {
    eyebrow: string
    titleBefore: string
    titleEmphasis: string
    lede: string
    start: string
    continue: string
    privacy: string
    imageAlt: string
    profileCount: string
    howItWorks: string
    steps: [string, string, string]
  }
  quiz: {
    progressLabel: string
    progressAria: (current: number, total: number) => string
    questionLabel: (current: number) => string
    back: string
    next: string
    finish: string
    reassurance: string
    visualGuideLabel: string
    visualInstruction: string
    visualExampleNote: string
    visualImageAlt: (option: string) => string
    enlargeVisual: (option: string) => string
  }
  quizVisualLabels: Record<QuizVisualLabelKey, string>
  result: {
    eyebrow: string
    secondaryNameLabel: string
    visualLabel: string
    visualHeading: string
    whyLabel: string
    whyHeading: string
    previewLabel: string
    previewHeading: string
    previewCopy: string
    previewAria: string
    paletteCta: string
    retake: string
    disclaimer: string
  }
  palette: {
    eyebrow: (subtypeName: string) => string
    title: string
    intro: string
    selected: string
    selectAria: (color: string) => string
    sections: {
      best: { title: string; description: string }
      neutrals: { title: string; description: string }
      accents: { title: string; description: string }
      harder: { title: string; description: string }
      metals: { title: string; description: string }
    }
    tabs: { palette: string; examples: string }
    tabsAria: string
    summaryHeading: string
    harderTips: [string, string, string, string]
  }
  styleExamples: {
    heading: string
    intro: string
    inspirationHeading: string
    inspirationBody: string
    imageAlt: (subtypeName: string, preference: 'men' | 'women') => string
    viewLarger: string
    viewerClose: string
    viewerLabel: (subtypeName: string) => string
    categoriesHeading: string
    categories: Record<StyleCategoryKey, string>
    garments: Record<GarmentNounKey, string>
    combinationsHeading: string
    teaserTitle: string
    teaserBadge: string
  }
  checker: {
    eyebrow: (subtypeName: string) => string
    title: string
    intro: string
    choose: string
    hexLabel: string
    check: string
    hexError: string
    hexExample: string
    fit: (percent: number) => string
    estimate: string
    outfitLabel: string
    pairHeading: string
  }
  photoChecker: {
    modeAria: string
    modes: { manual: string; photo: string }
    choose: string
    change: string
    privacy: string
    preparing: string
    instruction: string
    surfaceLabel: string
    keyboardHint: string
    pending: string
    sampleLabel: string
    categories: Record<PhotoMatchCategory, string>
    warnings: Record<SampleFlag, string>
    unavailable: Record<SampleUnavailableReason, string>
    errors: Record<Exclude<PhotoImageErrorCode, 'aborted'>, string>
  }
  nav: { aria: string; colors: string; palette: string; checker: string }
  dialog: { title: string; body: string; cancel: string; confirm: string }
  confidence: Record<ConfidenceLabel, string>
  ratings: Record<MatchRating, string>
  reasonText: Record<DimensionKey, Record<'high' | 'low', Record<'strong' | 'moderate', string>>>
  matchReason: Record<MatchRating, (colorName?: string) => string>
  subtypes: Record<Subtype, SubtypeCopy>
  quizQuestions: QuizCopy
}
