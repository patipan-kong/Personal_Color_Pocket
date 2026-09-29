import type { ConfidenceLabel, DimensionKey, MatchRating, QuizOptionIds, QuizQuestionId, Subtype } from '../domain/personalColor/types'
import type { QuizVisualLabelKey } from '../domain/personalColor/quizVisuals'
import type { GarmentNounKey, StyleCategoryKey } from '../domain/personalColor/styleGuide'
import type { PairingAdvice, PlacementArea, PlacementTier } from '../domain/photoColor/placement'
import type { Suitability, SuitabilityTone } from '../domain/photoColor/suitability'
import type { SampleAdvisoryReason } from '../domain/photoColor/aiNormalization'
import type { PhotoMatchCategory, PhotoMatchDescriptors, PhotoMatchDirection, PositivePaletteGroup, SampleFlag, SampleUnavailableReason } from '../domain/photoColor/types'
import type { PhotoImageErrorCode } from '../services/photoImage'
import type { LuckyGoal, LuckyWeekday, LuckyColorFamily } from '../domain/luckyColor/types'
import type { LuckyOutfitPlacement, LuckyOutfitRole } from '../domain/luckyColor/outfit'
import type { WardrobeFormality, WardrobeSlot } from '../domain/wardrobe'

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
    learnCta: string
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
    // V1.4 Slice 3: the contextual link from Result to the user's type in Learn.
    learnCta: string
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
    // V1.4 Slice 4: the More Considered section's link to its Learn guide.
    learnCta: string
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
    // V1.4 Slice 4: the photo mode's link to the Color Checker guide in Learn.
    photoLearnCta: string
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
    // Slice 0.4: display copy for deriveSampleAdvisory()'s reasons (AI, advisory-only -- see
    // domain/photoColor/aiNormalization.ts). Never a verdict or a colour name.
    aiAdvisory: Record<SampleAdvisoryReason, { title: string; body: string }>
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
    // V2.0 Slice 0.5D: the explicit, user-invoked AI fallback (plan §C-Q). AI never runs
    // automatically; this copy only appears once the user taps the action button. `why` and
    // `caveat` describe an AI-SELECTED canonical palette color, never a pixel measurement --
    // deliberately separate from the deterministic `why`/`caveat` above, which describe a
    // photo-measured colour instead. 'conditional'/'outside' are unreachable in practice (the
    // canonical-palette resolver only ever produces near-face/neutral-base/away-from-face, see
    // aiFallback.ts's categoryFor), kept only so this stays a total Record like its deterministic
    // counterpart.
    ai: {
      action: string
      actionLoading: string
      privacyNote: string
      badge: string
      why: Record<Suitability, (colorName: string) => string>
      caveat: string
      uncertain: string
      targetMismatch: string
      unusable: string
      failure: string
    }
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
  nav: { aria: string; daily: string; colors: string; palette: string; checker: string; learn: string }
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
    occasionPrompt: string
    occasions: Record<import('../domain/todayOutfitProduction/todayInputs').TodayOccasion, string>
    sourcePrompt: string
    sourceLabels: Record<import('../domain/todayOutfitProduction/todayInputs').OutfitSource, string>
    sourceInspirationBody: string
    sourceWardrobeCount: (count: number) => string
    sourceWardrobeEmpty: string
    sourceWardrobeIncomplete: string
    sourceWardrobeMissingShoes: string
    manageWardrobe: string
    viewSavedOutfits: string
    buildHeading: string
    buildLook: string
    addLook: string
    buildingLook: string
    addingLook: string
    maxLooksGuidance: string
    readyToBuild: string
    buildMissingShoes: string
    buildIncomplete: string
    inspirationReady: string
    inspirationEyebrow: string
    inspirationHeading: string
    inspirationOwnershipNote: string
    inspirationFallbackNote: string
    inspirationPieces: string
    recommendationEyebrow: string
    recommendationHeading: string
    recommendationSourceAi: string
    recommendationSourceFallback: string
    fallbackNote: string
    recommendationPieces: string
    occasionReason: string
    personalColorReason: string
    luckyReason: string
    occasionExplanations: Record<import('../domain/todayOutfitProduction/todayInputs').TodayOccasion, string>
    personalColorExplanations: Record<import('../domain/todayOutfitProduction/presentation').OwnedPersonalColorEmphasis, (subtype: string) => string>
    luckyColorExplanation: (families: readonly string[], includedInOutfit: boolean) => string
    totalFailure: string
    noAlternative: string
    retryRecommendation: string
    lookLabel: (number: number) => string
    previewCta: string
    previewLoading: string
    previewRetry: string
    previewHelper: string
    previewOwnedExpectation: string
    previewInspirationExpectation: string
    previewFailure: string
    previewUnknownColor: string
    previewAlt: (pieces: readonly string[]) => string
    saveLook: string
    savingLook: string
    lookSaved: string
    attachPreview: string
    previewStored: string
    saveFailure: string
    imageSaveFailure: string
    emptyLuckyTitle: string
    emptyLuckyBody: string
    // Singular for one lucky colour, plural for two.
    resultEyebrow: (count: number) => string
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
    sourceEnd: string
    sourceNames: { thaiRath: string; ktc: string }
    newTab: string
    dateError: string
    retry: string
    resultError: string
  }
  savedOutfits: {
    eyebrow: string
    title: string
    intro: string
    back: string
    emptyTitle: string
    emptyBody: string
    savedLabel: string
    outfitHeading: string
    piecesLabel: string
    delete: string
    loadFailure: string
    deleteFailure: string
  }
  wardrobe: {
    eyebrow: string
    title: string
    back: string
    itemCount: (count: number) => string
    add: string
    emptyTitle: string
    emptyBody: string
    coverageHeading: string
    coverageSeparates: string
    coverageOr: string
    coverageOnePiece: string
    coverageOuterwear: string
    filterLabel: string
    all: string
    slots: Record<WardrobeSlot, string>
    filterEmpty: string
    addEyebrow: string
    editEyebrow: string
    addTitle: string
    editTitle: string
    closeEditor: string
    typeHeading: string
    slotGroupLabel: string
    colorHeading: string
    colorSourceLabel: string
    colorSources: { basic: string; palette: string; exact: string }
    noPalette: string
    selectColor: (color: string) => string
    colorPickerLabel: string
    hexLabel: string
    hexError: string
    namePreview: string
    moreDetails: string
    customName: string
    customNamePlaceholder: string
    formality: string
    formalities: Record<WardrobeFormality, string>
    useDefault: (formality: string) => string
    cancel: string
    save: string
    saveAnother: string
    edit: string
    delete: string
    editName: (name: string) => string
    deleteName: (name: string) => string
    deleteTitle: string
    deleteBody: (name: string) => string
    confirmDelete: string
    storage: {
      title: string
      corrupt: string
      unavailable: string
      unsupported: string
      retry: string
      notSavedTitle: string
      notSavedBody: string
      retrySave: string
    }
  }
  dialog: { title: string; body: string; cancel: string; confirm: string }
  confidence: Record<ConfidenceLabel, string>
  ratings: Record<MatchRating, string>
  reasonText: Record<DimensionKey, Record<'high' | 'low', Record<'strong' | 'moderate', string>>>
  subtypes: Record<Subtype, SubtypeCopy>
  quizQuestions: QuizCopy
}
