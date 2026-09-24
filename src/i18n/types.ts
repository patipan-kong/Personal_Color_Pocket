import type { ConfidenceLabel, DimensionKey, MatchRating, QuizOptionIds, QuizQuestionId, Subtype } from '../domain/personalColor/types'
import type { QuizVisualLabelKey } from '../domain/personalColor/quizVisuals'
import type { GarmentNounKey, StyleCategoryKey } from '../domain/personalColor/styleGuide'
import type { PairingAdvice, PlacementArea, PlacementTier } from '../domain/photoColor/placement'
import type { Suitability, SuitabilityTone } from '../domain/photoColor/suitability'
import type { PhotoMatchCategory, PhotoMatchDescriptors, PhotoMatchDirection, PositivePaletteGroup, SampleFlag, SampleUnavailableReason } from '../domain/photoColor/types'
import type { PhotoImageErrorCode } from '../services/photoImage'
import type { LuckyGoal, LuckyWeekday, LuckyColorFamily } from '../domain/luckyColor/types'
import type { LuckyOutfitPlacement, LuckyOutfitRole } from '../domain/luckyColor/outfit'

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
    // Slice 5d: the manual result uses the shared colorResult card. These are the manual-only parts.
    sampleLabel: string
    // One reason per existing manual rating, reworded from the V1.1 matchReason. No colour is named:
    // the engine's reference colours (nearest Best, or a Harder colour for Tricky) are not always close.
    why: Record<MatchRating, string>
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
    // Slice 5f: shown before choosing a photo, and the note for a light near-neutral colour.
    captureTip: string
    lightingNote: string
    unavailable: Record<SampleUnavailableReason, string>
    errors: Record<Exclude<PhotoImageErrorCode, 'aborted'>, string>
    // Photo-specific reasons (Slice 5c): they speak about "this photo color". Shared result wording is in colorResult.
    why: Record<Suitability, (names: { nearest: string; harder: string | null }) => string>
    resembles: (colorName: string) => string
    direction: (colorName: string, parts: string[]) => string
    directions: Record<PhotoMatchDirection, string>
    descriptorsLabel: string
    descriptors: { value: Record<PhotoMatchDescriptors['value'], string>; clarity: Record<PhotoMatchDescriptors['clarity'], string> }
    caveat: string
  }
  // Slice 5d: the one Color Checker result, shared by Manual and Photo. The verdict answers
  // "is this colour good for me?", the action says what to do. Colour and garment names come from
  // colorDisplayName / styleExamples.garments.
  colorResult: {
    verdicts: Record<Suitability, string>
    action: Record<Suitability, (pieces: string[], pair: string | null) => string>
    // The palette colour to compare with. 'similar': the photo engine's nearest palette colour.
    // 'nearestBest': the manual engine only reports the nearest Best colours. 'compare' is added when
    // the result is not positive, so the reference never reads as a recommendation.
    reference: { similar: string; nearestBest: string; compare: string }
    groups: Record<PositivePaletteGroup, string>
    placementHeading: Record<SuitabilityTone, string>
    tiers: Record<PlacementTier, string>
    areas: Record<PlacementArea, string>
    pairing: Record<PairingAdvice, { heading: string; body: string }>
  }
  nav: { aria: string; daily: string; colors: string; palette: string; checker: string }
  daily: {
    entryCta: string
    title: string
    today: string
    weekdays: Record<LuckyWeekday, string>
    framing: string
    goalPrompt: string
    goalLimit: string
    goalSeparator: string
    goals: Record<LuckyGoal, string>
    resultEyebrow: string
    familyLabel: string
    familyLabels: Record<LuckyColorFamily, string>
    personalizedShade: string
    personalizedFor: (subtype: string) => string
    generalNote: string
    quizCta: string
    placementNotes: Record<Exclude<LuckyOutfitPlacement, 'top'>, string>
    outfitEyebrow: string
    outfitHeading: string
    storyFamily: string
    storyShade: string
    boardLabel: string
    pieceLabels: Record<LuckyOutfitRole, string>
    luckyBadge: string
    personalSupport: string
    neutralSupport: string
    semanticColors: { 'light-neutral': string; neutral: string }
    aboutHeading: string
    aboutBody: string
    sourcesLabel: string
    sourceJoin: string
    dateError: string
  }
  dialog: { title: string; body: string; cancel: string; confirm: string }
  confidence: Record<ConfidenceLabel, string>
  ratings: Record<MatchRating, string>
  reasonText: Record<DimensionKey, Record<'high' | 'low', Record<'strong' | 'moderate', string>>>
  subtypes: Record<Subtype, SubtypeCopy>
  quizQuestions: QuizCopy
}
