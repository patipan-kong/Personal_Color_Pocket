import { describe, expect, it } from 'vitest'
import { subtypeOrder } from '../domain/personalColor/seasons'
import { learnTranslations } from './content'
import { learnTopicOrder } from './registry'

// V1.4 Slices 1–2: architectural boundaries of the Learn foundation and its UI, checked on the source text.

const learnSources = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const appSources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!./**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
// Source without comments, so a comment saying what Learn does not import is not a hit.
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
const specifiers = (source: string) => [...source.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)].map((match) => match[1])

describe('R/E. Learn architecture boundaries', () => {
  it('finds the Learn source files', () => {
    expect(Object.keys(learnSources).sort()).toEqual(['./appCopy.ts', './content/en.ts', './content/index.ts', './content/th.ts', './examples.ts', './index.ts', './model.ts', './registry.ts', './sources.ts', './types.ts'])
  })

  it('imports only canonical data, types and i18n: no classifier, scoring, quiz, colour naming, services, React or package', () => {
    const allowed = new Set([
      '../domain/personalColor/palettes', '../domain/personalColor/seasons', '../domain/personalColor/types',
      '../i18n', '../../i18n',
    ])
    for (const [path, source] of Object.entries(learnSources)) {
      for (const specifier of specifiers(source)) {
        const local = specifier.startsWith('./') || (specifier === '../types' && path.startsWith('./content/'))
        expect(local || allowed.has(specifier), `${path} imports ${specifier}`).toBe(true)
      }
      expect(code(source), path).not.toMatch(/scoring|diagnostics|classify|analyzeQuiz|quizQuestions|colorNames|describeColor|colorMatch/)
    }
  })

  it('has no runtime network, storage or dynamic import', () => {
    for (const [path, source] of Object.entries(learnSources)) {
      expect(source, path).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|https?:\/\/|localStorage|sessionStorage|indexedDB|import\s*\(/)
    }
  })

  it('stores no colour values or subtype targets: palette ids and plan thresholds only', () => {
    for (const [path, source] of Object.entries(learnSources)) {
      expect(source, path).not.toMatch(/#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?\b|rgba?\(|hsla?\(/)
      // Decimal literals appear only in model.ts, as the plan's band thresholds and the scale midpoint.
      const decimals = source.match(/(?<![\w.])0?\.\d+/g) ?? []
      if (path === './model.ts') expect([...new Set(decimals)].sort()).toEqual(['.2', '.4', '.5', '.6', '.8'])
      else expect(decimals, path).toEqual([])
    }
  })

  it('does not keep its own subtype list', () => {
    for (const [path, source] of Object.entries(learnSources)) {
      for (const subtype of subtypeOrder) expect(source, `${path}: ${subtype}`).not.toMatch(new RegExp(`['"\`]${subtype}['"\`]`))
    }
  })

  // Slice 2 replaces Slice 1's "no UI yet" rule: the app may now use Learn, but only through its one
  // view component, and the UI may use Learn only through the public barrel.
  it('Z. the app reaches Learn only through LearnView', () => {
    expect(Object.keys(appSources)).toContain('../App.tsx')
    const users = Object.entries(appSources).flatMap(([path, source]) => specifiers(source).filter((specifier) => /(^|\/)learn(\/|$)/.test(specifier)).map((specifier) => `${path} -> ${specifier}`))
    expect(users).toEqual(['../App.tsx -> ./learn/ui/LearnView'])
    expect(Object.keys(import.meta.glob(['./**/*.tsx', '!./**/*.test.tsx'])).sort()).toEqual(['./ui/LearnHome.tsx', './ui/LearnReader.tsx', './ui/LearnView.tsx'])
  })
})

const uiSources = import.meta.glob(['./ui/**/*.tsx', '!./ui/**/*.test.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('E. Learn UI boundaries (Slice 2)', () => {
  it('uses the public Learn API, React and types only: no domain data, classifier, services or package', () => {
    const allowed = new Set(['react', '..', '../../i18n', '../../domain/personalColor/types'])
    for (const [path, source] of Object.entries(uiSources)) {
      for (const specifier of specifiers(source)) expect(specifier.startsWith('./') || allowed.has(specifier), `${path} imports ${specifier}`).toBe(true)
      // Type-only imports from i18n and the domain: the UI never calls getCopy, palettes or seasons itself.
      expect(source, path).not.toMatch(/^import \{[^}]*\} from '\.\.\/\.\.\/(i18n|domain\/personalColor\/types)'/m)
      expect(code(source), path).not.toMatch(/scoring|diagnostics|classify|analyzeQuiz|colorNames|colorMatch|getPalette|seasonDefinitions|subtypeOrder/)
    }
  })

  it('has no storage, network, colour literals or copied Learn data', () => {
    for (const [path, source] of Object.entries(uiSources)) {
      expect(source, path).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|https?:\/\/|localStorage|sessionStorage|indexedDB|import\s*\(/)
      expect(source, path).not.toMatch(/#[0-9A-Fa-f]{6}\b|rgba?\(|hsla?\(/)
      for (const subtype of subtypeOrder) expect(source, `${path}: ${subtype}`).not.toMatch(new RegExp(`['"\`]${subtype}['"\`]`))
      // No topic ids, titles or prose: order, featuring and wording all come from the registry and content.
      for (const topic of learnTopicOrder) expect(source, `${path}: ${topic}`).not.toContain(`'${topic}'`)
      for (const language of ['en', 'th'] as const) {
        for (const text of Object.values(learnTranslations[language].topics).flatMap((topic) => [topic.title, topic.rowAnswer, topic.answer])) expect(source, path).not.toContain(text)
      }
    }
  })
})
