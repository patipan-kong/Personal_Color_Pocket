import type { ConfidenceLabel, DimensionKey, MatchRating, QuizOptionIds, QuizQuestionId, Subtype } from '../domain/personalColor/types'
import type { QuizVisualLabelKey } from '../domain/personalColor/quizVisuals'
import type { GarmentNounKey, StyleCategoryKey } from '../domain/personalColor/styleGuide'

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
  nav: { aria: string; colors: string; palette: string; checker: string }
  dialog: { title: string; body: string; cancel: string; confirm: string }
  confidence: Record<ConfidenceLabel, string>
  ratings: Record<MatchRating, string>
  reasonText: Record<DimensionKey, Record<'high' | 'low', Record<'strong' | 'moderate', string>>>
  matchReason: Record<MatchRating, (colorName?: string) => string>
  subtypes: Record<Subtype, SubtypeCopy>
  quizQuestions: QuizCopy
}
