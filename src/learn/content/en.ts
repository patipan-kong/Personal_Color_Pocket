import type { LearnCopy } from '../types'

// English Learn copy. Describe colours, never people. Colours are named by palette data, not here.
export const learnEn: LearnCopy = {
  language: 'en',
  home: {
    title: 'Color Guide',
    lede: 'Short, practical guides to wearing your colors and using the app.',
    startHere: 'Start here',
    groups: { basics: 'Color basics', wear: 'Wearing color', app: 'Using the app' },
    profileHero: { eyebrow: 'Your type', cta: 'Learn about your type' },
    generalHero: {
      title: 'Find the colors that suit you',
      body: 'Start with the basics. Take the quiz whenever you like to see your own colors here.',
      cta: 'Find your Personal Color',
    },
  },
  reader: { back: 'Back to Color Guide', why: 'Why it works', more: 'More detail', takeaway: 'Try this' },
  topics: {
    'basics.what-is': {
      title: 'What is Personal Color?',
      rowAnswer: 'A styling framework for finding the color qualities that tend to suit you.',
      answer: 'Personal Color is a styling framework. It sorts colors by qualities such as warm or cool and light or deep, and suggests the ones that tend to look easiest near your face.',
      why: [
        { kind: 'text', claim: 'app-quiz-estimate', text: 'In Personal Color Pocket, a short quiz compares your answers with 12 color types, each described by four color qualities.' },
        { kind: 'app-copy', ref: 'result.disclaimer' },
        { kind: 'text', claim: 'evidence-modest', text: 'Research suggests people fairly consistently match warmer or cooler clothing colors to different skin tones, but the evidence is limited, and no type system is scientifically proven.' },
      ],
      more: [
        { kind: 'text', claim: 'history', text: 'Seasonal color ideas began in art teaching, with Johannes Itten, and became popular as four seasons through Color Me Beautiful in the 1980s. Later versions split each season into three types.' },
        { kind: 'text', claim: 'systems-differ', text: 'Other systems use different names and numbers of types, such as 4, 12, 16 or more. This guide explains the model this app uses, so a name seen elsewhere may not mean exactly the same thing here.' },
      ],
      takeaway: 'Treat your result as a starting point, and trust what you see in the mirror.',
    },
    'basics.dimensions': {
      title: 'Understanding color',
      rowAnswer: 'Four qualities: temperature, value, chroma and contrast.',
      answer: 'Personal Color Pocket describes every type with four qualities: temperature (warm or cool), value (light or deep), chroma (clear or soft) and contrast.',
      why: [
        {
          kind: 'list',
          claim: 'color-vocabulary',
          items: [
            'Temperature: whether a color leans golden (warm) or blue-based (cool).',
            'Value: how light or dark a color is.',
            'Chroma: how vivid or muted a color is. A gray has no chroma at all.',
            'Contrast: how different the lightest and darkest parts of your coloring are, across skin, hair and eyes.',
          ],
        },
        { kind: 'text', claim: 'bands-not-scores', text: 'Each type sits somewhere on all four scales. This guide describes that position in words, such as “leans cool”, instead of a score.' },
      ],
      more: [
        { kind: 'text', claim: 'color-vocabulary', text: 'Value and chroma are standard color terms from the Munsell color system. Temperature and contrast are how Personal Color systems describe undertone and the range of your coloring.' },
      ],
      takeaway: 'Open your palette and notice which qualities its colors share.',
    },
    'types.overview': {
      title: '4 seasons, 12 types',
      rowAnswer: 'How the 12 types group into four seasons, and what their names mean.',
      answer: 'Personal Color Pocket groups its 12 types into four seasons. Each season shares its main color qualities and splits into three types, each named for its strongest quality.',
      why: [
        { kind: 'text', claim: 'season-model', text: 'Spring and Autumn are warm; Summer and Winter are cool. Spring and Winter are clearer; Summer and Autumn are softer.' },
        { kind: 'text', claim: 'type-naming', text: 'Within a season, a type is called Light, Deep, Warm, Cool, Clear or Soft after the quality it shows most strongly. Soft Summer, for example, is the most muted Summer type.' },
      ],
      more: [
        { kind: 'text', claim: 'systems-differ', text: 'Other 12-type systems use other names for similar ideas, such as Bright instead of Clear, or True instead of Warm or Cool. These names are not exact matches.' },
      ],
      takeaway: 'Compare your type with the other two in its season.',
    },
    'wear.palette': {
      title: 'Using your palette',
      rowAnswer: 'Best colors near your face, Neutrals as the base, Accents in smaller doses.',
      answer: 'Put your Best colors near your face, build outfits on your Neutrals, and add Accents in smaller pieces. Metals are for jewelry and hardware.',
      why: [
        { kind: 'palette-group', group: 'best' },
        { kind: 'palette-group', group: 'neutrals' },
        { kind: 'palette-group', group: 'accents' },
        { kind: 'palette-group', group: 'metals' },
      ],
      more: [
        { kind: 'text', claim: 'placement', text: 'Near your face means tops, collars, scarves and earrings. Farther away means trousers, skirts, shoes and bags. A color changes how your face looks most when it sits close to it.' },
      ],
      takeaway: 'Pick one Best color for your top today.',
    },
    'wear.harder': {
      title: 'More Considered colors are not off-limits',
      rowAnswer: 'You can still wear them. A few simple moves make them easier.',
      answer: 'More Considered colors are not forbidden. They can take a little more styling near your face, so place them with care.',
      why: [
        { kind: 'palette-group', group: 'harder' },
        { kind: 'app-copy', ref: 'palette.harderTips' },
        { kind: 'text', claim: 'more-considered-listed-only', text: 'Only the colors listed in your More Considered group are More Considered. A color that is simply not in your palette is not one to avoid.' },
      ],
      more: [],
      takeaway: 'Try a More Considered color as a bag or shoes, with a Best color on top.',
    },
    'app.color-checker': {
      title: 'Getting the most from Color Checker',
      rowAnswer: 'How manual and photo checks work, and why photos can shift colors.',
      answer: 'Color Checker compares one color with your palette. Enter a color, or tap a spot in a photo; both tell you how well it suits you and where to wear it.',
      why: [
        { kind: 'text', claim: 'photo-records-light', text: 'A photo records the light that reaches the camera, not the fabric itself. The same garment can look different in warm light, cool light or shade.' },
        { kind: 'text', claim: 'camera-guesses', text: 'The camera also guesses the color of the light (white balance) and how bright the scene is (exposure), so a photo can shift a color lighter, darker, warmer or cooler.' },
        { kind: 'text', claim: 'context-changes-appearance', text: 'Nearby colors change how a color looks, too.' },
        { kind: 'app-copy', ref: 'photoChecker.lightingNote' },
        { kind: 'app-copy', ref: 'photoChecker.captureTip' },
      ],
      more: [
        { kind: 'text', claim: 'photo-guide-only', text: 'Photo check reads the color as it appears in your photo. It cannot know the exact color of the garment, so treat the result as a guide.' },
      ],
      takeaway: 'If a photo result looks off, try another evenly lit spot, or enter the color manually.',
    },
    'app.lucky': {
      title: 'Lucky colors and Personal Color',
      rowAnswer: 'Tradition picks the lucky color; Personal Color picks the shade and placement.',
      answer: 'In Daily, a Thai daily tradition picks the lucky color family for your goal. Your Personal Color then helps choose the shade and where to wear it.',
      why: [
        { kind: 'app-copy', ref: 'daily.storyFamily' },
        { kind: 'app-copy', ref: 'daily.storyShade' },
        { kind: 'text', claim: 'two-goal-composition', text: 'The tradition gives a separate color for each goal. When you choose two goals, combining their colors into one outfit is how the app works, not part of the tradition.' },
      ],
      more: [
        { kind: 'app-copy', ref: 'daily.aboutBody' },
      ],
      takeaway: 'Open Daily to see today’s lucky color and where to wear it.',
    },
  },
  seasons: {
    spring: { name: 'Spring', summary: 'Warm, clear colors, from light to medium depth.' },
    summer: { name: 'Summer', summary: 'Cool, soft colors, from light to medium depth, with low contrast.' },
    autumn: { name: 'Autumn', summary: 'Warm, soft colors, from medium to deep.' },
    winter: { name: 'Winter', summary: 'Cool, clear, deeper colors with high contrast.' },
  },
  dimensions: {
    temperature: { name: 'Temperature', ends: { low: 'Cool', high: 'Warm' }, bands: { 'strong-low': 'Strongly cool', 'lean-low': 'Leans cool', middle: 'In between', 'lean-high': 'Leans warm', 'strong-high': 'Strongly warm' } },
    value: { name: 'Value', ends: { low: 'Deep', high: 'Light' }, bands: { 'strong-low': 'Strongly deep', 'lean-low': 'Leans deep', middle: 'In between', 'lean-high': 'Leans light', 'strong-high': 'Strongly light' } },
    chroma: { name: 'Chroma', ends: { low: 'Soft', high: 'Clear' }, bands: { 'strong-low': 'Strongly soft', 'lean-low': 'Leans soft', middle: 'In between', 'lean-high': 'Leans clear', 'strong-high': 'Strongly clear' } },
    contrast: { name: 'Contrast', ends: { low: 'Low', high: 'High' }, bands: { 'strong-low': 'Very low contrast', 'lean-low': 'Low contrast', middle: 'Medium contrast', 'lean-high': 'High contrast', 'strong-high': 'Very high contrast' } },
  },
  typeDetail: {
    intro: 'Every type is shown the same way: where it sits on the four color scales, then its palette.',
    seasonLabel: 'Season',
    positionHeading: 'Where this type sits',
    positionNote: 'Positions describe the type, not a score from your answers.',
    formulaHeading: 'A simple outfit formula',
    formula: { nearFace: 'A Best color near your face', base: 'A Neutral as the base', accent: 'An Accent in a small piece' },
    yourType: 'Your type',
    quizCta: 'Find your Personal Color',
    examplesCta: 'See outfit examples',
  },
}
