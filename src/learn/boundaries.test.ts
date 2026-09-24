import { describe, expect, it } from 'vitest'
import { subtypeOrder } from '../domain/personalColor/seasons'

// V1.4 Slice 1: architectural boundaries of the Learn foundation, checked on the source text.

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

  it('Z. no Learn UI yet: nothing outside src/learn imports it, and it has no components', () => {
    expect(Object.keys(appSources)).toContain('../App.tsx')
    expect(Object.keys(appSources).some((path) => path.includes('learn'))).toBe(false)
    const users = Object.entries(appSources).filter(([, source]) => specifiers(source).some((specifier) => /(^|\/)learn(\/|$)/.test(specifier))).map(([path]) => path)
    expect(users).toEqual([])
    expect(Object.keys(import.meta.glob('./**/*.tsx'))).toEqual([])
  })
})
