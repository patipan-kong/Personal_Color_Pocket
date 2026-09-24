import { describe, expect, it, vi } from 'vitest'
import { LUCKY_COLOR_KNOWLEDGE, validateLuckyColorKnowledge } from './knowledge'
import { getLuckyColorForDate, getLuckyColorRule, luckyWeekdayForDate } from './luckyColor'
import { LUCKY_COLOR_FAMILIES, LUCKY_GOALS, LUCKY_WEEKDAYS } from './types'
import type { LuckyColorKnowledgeSet, LuckyColorRule, LuckyColorSource, LuckyGoal, LuckyWeekday, TraditionalCategory } from './types'
import engineSource from './luckyColor.ts?raw'
import knowledgeSource from './knowledge.ts?raw'

const CATEGORY_FOR_GOAL: Record<LuckyGoal, TraditionalCategory> = {
  work: 'dech', money: 'mula', luck: 'sri', 'mentor-support': 'montri',
}

const POSITIVE_TABLE: Record<LuckyWeekday, Record<LuckyGoal, string>> = {
  sun: { work: 'pink', luck: 'green', money: 'purple', 'mentor-support': 'gray' },
  mon: { work: 'green', luck: 'purple', money: 'orange', 'mentor-support': 'blue' },
  tue: { work: 'purple', luck: 'orange', money: 'gray', 'mentor-support': 'red' },
  wed: { work: 'orange', luck: 'gray', money: 'blue', 'mentor-support': 'yellow' },
  thu: { work: 'blue', luck: 'red', money: 'yellow', 'mentor-support': 'green' },
  fri: { work: 'yellow', luck: 'pink', money: 'green', 'mentor-support': 'orange' },
  sat: { work: 'gray', luck: 'blue', money: 'red', 'mentor-support': 'pink' },
}

const KALAKINI_TABLE: Record<LuckyWeekday, string> = {
  sun: 'blue', mon: 'red', tue: 'white', wed: 'pink', thu: 'black', fri: 'gray', sat: 'green',
}

type MutableKnowledge = Omit<LuckyColorKnowledgeSet, 'rules' | 'sources'> & {
  rules: LuckyColorRule[]
  sources: LuckyColorSource[]
}

function mutableKnowledge(change: Partial<MutableKnowledge> = {}): MutableKnowledge {
  return {
    ...LUCKY_COLOR_KNOWLEDGE,
    sources: LUCKY_COLOR_KNOWLEDGE.sources.map((source) => ({ ...source })),
    rules: LUCKY_COLOR_KNOWLEDGE.rules.map((rule) => ({ ...rule, colorFamilies: [...rule.colorFamilies], sourceIds: [...rule.sourceIds], sourceTermsTh: [...rule.sourceTermsTh] })),
    ...change,
  }
}

describe('V1.3 canonical lucky-colour knowledge', () => {
  it('has frozen, versioned source metadata', () => {
    expect(LUCKY_COLOR_KNOWLEDGE).toMatchObject({
      datasetVersion: '2026.1', systemId: 'thai-daily-shirt-color-taksa-7day', reviewedAt: '2026-09-24',
    })
    expect(LUCKY_COLOR_KNOWLEDGE.sources.map((source) => source.id)).toEqual(['S1', 'S2', 'S3'])
    for (const source of LUCKY_COLOR_KNOWLEDGE.sources) {
      expect(source.title.trim()).toBeTruthy()
      expect(source.publisher.trim()).toBeTruthy()
      expect(source.url).toMatch(/^https:\/\//)
      expect(source.role.trim()).toBeTruthy()
    }
  })

  it('contains exactly 28 positive rules plus seven provenance-only kalakini rules', () => {
    const positive = LUCKY_COLOR_KNOWLEDGE.rules.filter((rule) => rule.goal !== null)
    const kalakini = LUCKY_COLOR_KNOWLEDGE.rules.filter((rule) => rule.goal === null)
    expect(LUCKY_COLOR_KNOWLEDGE.rules).toHaveLength(35)
    expect(positive).toHaveLength(28)
    expect(kalakini).toHaveLength(7)
    expect(new Set(positive.map((rule) => rule.weekday))).toEqual(new Set(LUCKY_WEEKDAYS))
  })

  it('matches the frozen positive table and goal-to-traditional-category mapping exactly', () => {
    for (const weekday of LUCKY_WEEKDAYS) {
      for (const goal of LUCKY_GOALS) {
        const rule = getLuckyColorRule(weekday, goal)
        expect(rule).toMatchObject({ weekday, goal, traditionalCategory: CATEGORY_FOR_GOAL[goal] })
        expect(rule.colorFamilies).toEqual([POSITIVE_TABLE[weekday][goal]])
      }
    }
  })

  it('matches the frozen kalakini provenance table exactly', () => {
    for (const weekday of LUCKY_WEEKDAYS) {
      const rule = LUCKY_COLOR_KNOWLEDGE.rules.find((candidate) => candidate.weekday === weekday && candidate.traditionalCategory === 'kalakini')
      expect(rule).toMatchObject({ weekday, goal: null, traditionalCategory: 'kalakini', colorFamilies: [KALAKINI_TABLE[weekday]] })
    }
  })

  it('keeps all rules in the source vocabulary with resolved provenance and non-empty Thai terms', () => {
    const sourceIds = new Set(LUCKY_COLOR_KNOWLEDGE.sources.map((source) => source.id))
    for (const rule of LUCKY_COLOR_KNOWLEDGE.rules) {
      expect(rule.colorFamilies.length).toBeGreaterThan(0)
      rule.colorFamilies.forEach((family) => expect(LUCKY_COLOR_FAMILIES).toContain(family))
      rule.sourceIds.forEach((sourceId) => expect(sourceIds).toContain(sourceId))
      rule.sourceTermsTh.forEach((term) => expect(term.trim()).toBeTruthy())
    }
  })

  it('has unique weekday/goal and weekday/category keys, four positive rules and one kalakini per weekday', () => {
    const positiveKeys = LUCKY_COLOR_KNOWLEDGE.rules.filter((rule) => rule.goal !== null).map((rule) => `${rule.weekday}:${rule.goal}`)
    const categoryKeys = LUCKY_COLOR_KNOWLEDGE.rules.map((rule) => `${rule.weekday}:${rule.traditionalCategory}`)
    expect(new Set(positiveKeys).size).toBe(28)
    expect(new Set(categoryKeys).size).toBe(35)
    for (const weekday of LUCKY_WEEKDAYS) {
      expect(LUCKY_COLOR_KNOWLEDGE.rules.filter((rule) => rule.weekday === weekday && rule.goal !== null)).toHaveLength(4)
      expect(LUCKY_COLOR_KNOWLEDGE.rules.filter((rule) => rule.weekday === weekday && rule.goal === null)).toHaveLength(1)
    }
  })

  it('positive lookup is exhaustive, deterministic, and can never return kalakini', () => {
    for (const weekday of LUCKY_WEEKDAYS) {
      for (const goal of LUCKY_GOALS) {
        const first = getLuckyColorRule(weekday, goal)
        expect(getLuckyColorRule(weekday, goal)).toBe(first)
        expect(first.goal).toBe(goal)
        expect(first.traditionalCategory).not.toBe('kalakini')
        expect(first.goal).not.toBeNull()
      }
    }
  })

  it('is deeply frozen enough that callers cannot mutate canonical rules or leak changes', () => {
    const rule = getLuckyColorRule('mon', 'work')
    expect(Object.isFrozen(LUCKY_COLOR_KNOWLEDGE)).toBe(true)
    expect(Object.isFrozen(LUCKY_COLOR_KNOWLEDGE.rules)).toBe(true)
    expect(Object.isFrozen(rule)).toBe(true)
    expect(Object.isFrozen(rule.colorFamilies)).toBe(true)
    expect(() => (rule.colorFamilies as string[]).push('red')).toThrow(TypeError)
    expect(() => (rule as { goal: LuckyGoal }).goal = 'money').toThrow(TypeError)
    expect(getLuckyColorRule('mon', 'work').colorFamilies).toEqual(['green'])
  })
})

describe('V1.3 lucky-colour rule API', () => {
  it.each([
    [0, 'sun'], [1, 'mon'], [2, 'tue'], [3, 'wed'], [4, 'thu'], [5, 'fri'], [6, 'sat'],
  ] as const)('maps Date.getDay() value %i to %s', (day, weekday) => {
    const date = new Date(2026, 0, 4 + day)
    const getDay = vi.spyOn(date, 'getDay')
    const getUTCDay = vi.spyOn(date, 'getUTCDay')
    expect(luckyWeekdayForDate(date)).toBe(weekday)
    expect(getDay).toHaveBeenCalledTimes(1)
    expect(getUTCDay).not.toHaveBeenCalled()
  })

  it('uses the supplied local Date and never reads a hidden current time', () => {
    const monday = new Date(2026, 0, 5)
    expect(getLuckyColorForDate(monday, 'work')).toMatchObject({ weekday: 'mon', colorFamilies: ['green'] })
    expect(engineSource).not.toMatch(/new Date\s*\(/)
  })

  it('rejects invalid Dates explicitly', () => {
    expect(() => luckyWeekdayForDate(new Date(NaN))).toThrow('Invalid lucky-color date')
  })

  it('rejects runtime-invalid weekday and goal values instead of guessing', () => {
    expect(() => getLuckyColorRule('wed-night' as LuckyWeekday, 'work')).toThrow(RangeError)
    expect(() => getLuckyColorRule('mon', 'love' as LuckyGoal)).toThrow(RangeError)
  })
})

describe('V1.3 knowledge validation mutation guards', () => {
  it('rejects a removed weekday rule', () => {
    const knowledge = mutableKnowledge()
    knowledge.rules = knowledge.rules.slice(1)
    expect(() => validateLuckyColorKnowledge(knowledge)).toThrow('expected exactly 35 rules')
  })

  it('rejects duplicate weekday/goal rules', () => {
    const knowledge = mutableKnowledge()
    knowledge.rules[1] = { ...knowledge.rules[0] } as LuckyColorRule
    expect(() => validateLuckyColorKnowledge(knowledge)).toThrow('duplicate weekday/category')
  })

  it('rejects an unresolved source ID', () => {
    const knowledge = mutableKnowledge()
    knowledge.rules[0] = { ...knowledge.rules[0], sourceIds: ['S404'] }
    expect(() => validateLuckyColorKnowledge(knowledge)).toThrow('unresolved source ID')
  })

  it('rejects a swapped goal-to-traditional-category mapping', () => {
    const knowledge = mutableKnowledge()
    knowledge.rules[0] = { ...knowledge.rules[0], traditionalCategory: 'mula' }
    expect(() => validateLuckyColorKnowledge(knowledge)).toThrow('wrong traditional category for work')
  })

  it('rejects a positive rule that is made kalakini', () => {
    const knowledge = mutableKnowledge()
    knowledge.rules[0] = { ...knowledge.rules[0], traditionalCategory: 'kalakini' }
    expect(() => validateLuckyColorKnowledge(knowledge)).toThrow('positive rule may not use kalakini')
  })
})

describe('V1.3 dependency boundary', () => {
  it('uses no V1.2 Personal Color, browser, persistence, network, or current-time dependency', () => {
    const code = `${knowledgeSource}\n${engineSource}`.replace(/\/\/.*$/gm, '')
    for (const forbidden of [
      'personalColor', 'palettes', 'oklab', 'describeColor', 'colorMatch', 'photoColor', 'pairing', 'placement',
      'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'WebSocket', 'navigator', 'window',
      'setTimeout', 'setInterval', 'new Date', 'Intl', 'weather', 'location', 'analytics', 'openai',
    ]) expect(code, forbidden).not.toMatch(new RegExp(forbidden, 'i'))
    expect(code).not.toMatch(/\bAI\b/i)
  })
})
