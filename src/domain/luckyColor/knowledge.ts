import type { LuckyColorFamily, LuckyColorKnowledgeSet, LuckyColorRule, LuckyColorSource, LuckyGoal, LuckyWeekday, TraditionalCategory } from './types'
import { LUCKY_COLOR_FAMILIES, LUCKY_GOALS, LUCKY_WEEKDAYS, TRADITIONAL_CATEGORIES } from './types'

const SOURCE_IDS = ['S1', 'S2', 'S3'] as const

const FAMILY_TERMS_TH: Readonly<Record<LuckyColorFamily, string>> = Object.freeze({
  white: 'ขาว', yellow: 'เหลือง', pink: 'ชมพู', red: 'แดง', green: 'เขียว',
  blue: 'ฟ้า', purple: 'ม่วง', orange: 'ส้ม', gray: 'เทา', black: 'ดำ',
})

const CATEGORY_FOR_GOAL: Readonly<Record<LuckyGoal, TraditionalCategory>> = Object.freeze({
  work: 'dech',
  money: 'mula',
  luck: 'sri',
  'mentor-support': 'montri',
})

const freezeSource = (source: LuckyColorSource): LuckyColorSource => Object.freeze({ ...source })
const freezeRule = (rule: LuckyColorRule): LuckyColorRule => Object.freeze({
  ...rule,
  colorFamilies: Object.freeze([...rule.colorFamilies]),
  sourceIds: Object.freeze([...rule.sourceIds]),
  sourceTermsTh: Object.freeze([...rule.sourceTermsTh]),
})

function rule(weekday: LuckyWeekday, goal: LuckyGoal, family: LuckyColorFamily): LuckyColorRule {
  return freezeRule({
    weekday,
    goal,
    traditionalCategory: CATEGORY_FOR_GOAL[goal],
    colorFamilies: [family],
    sourceIds: SOURCE_IDS,
    sourceTermsTh: [FAMILY_TERMS_TH[family]],
  })
}

function kalakiniRule(weekday: LuckyWeekday, family: LuckyColorFamily): LuckyColorRule {
  return freezeRule({
    weekday,
    goal: null,
    traditionalCategory: 'kalakini',
    colorFamilies: [family],
    sourceIds: SOURCE_IDS,
    sourceTermsTh: [FAMILY_TERMS_TH[family]],
  })
}

// Slice 0's frozen S1 table. These values are intentionally broad source families, not shades.
const RULES: readonly LuckyColorRule[] = Object.freeze([
  rule('sun', 'work', 'pink'), rule('sun', 'luck', 'green'), rule('sun', 'money', 'purple'), rule('sun', 'mentor-support', 'gray'),
  rule('mon', 'work', 'green'), rule('mon', 'luck', 'purple'), rule('mon', 'money', 'orange'), rule('mon', 'mentor-support', 'blue'),
  rule('tue', 'work', 'purple'), rule('tue', 'luck', 'orange'), rule('tue', 'money', 'gray'), rule('tue', 'mentor-support', 'red'),
  rule('wed', 'work', 'orange'), rule('wed', 'luck', 'gray'), rule('wed', 'money', 'blue'), rule('wed', 'mentor-support', 'yellow'),
  rule('thu', 'work', 'blue'), rule('thu', 'luck', 'red'), rule('thu', 'money', 'yellow'), rule('thu', 'mentor-support', 'green'),
  rule('fri', 'work', 'yellow'), rule('fri', 'luck', 'pink'), rule('fri', 'money', 'green'), rule('fri', 'mentor-support', 'orange'),
  rule('sat', 'work', 'gray'), rule('sat', 'luck', 'blue'), rule('sat', 'money', 'red'), rule('sat', 'mentor-support', 'pink'),
  kalakiniRule('sun', 'blue'), kalakiniRule('mon', 'red'), kalakiniRule('tue', 'white'), kalakiniRule('wed', 'pink'),
  kalakiniRule('thu', 'black'), kalakiniRule('fri', 'gray'), kalakiniRule('sat', 'green'),
])

export const LUCKY_COLOR_KNOWLEDGE: LuckyColorKnowledgeSet = Object.freeze({
  datasetVersion: '2026.1',
  systemId: 'thai-daily-shirt-color-taksa-7day',
  reviewedAt: '2026-09-24',
  sources: Object.freeze([
    freezeSource({
      id: 'S1',
      title: 'สีเสื้อมงคล 2569 หมอไก่ พ.พาทินี',
      publisher: 'Thai Rath',
      url: 'https://www.thairath.co.th/horoscope/belief/2897832',
      role: 'canonical daily table',
    }),
    freezeSource({
      id: 'S2',
      title: 'สีเสื้อมงคล 2569 สีถูกโฉลกประจำวัน สีไหนเสริมเดิม สีไหนควรเลี่ยง',
      publisher: 'KTC',
      url: 'https://www.ktc.co.th/article/shopping/fashion/birthday-auspicious-color-timetable',
      role: 'corroborating table',
    }),
    freezeSource({
      id: 'S3',
      title: 'สีถูกโฉลก ตามวันเกิด ครบ 7 วัน + พุธกลางคืน — ตารางสีมงคล สีกาลกิณี 2569',
      publisher: 'Sinsaebank',
      url: 'https://sinsaebank.com/lucky-colors/',
      role: 'traditional-category interpretation',
    }),
  ]),
  rules: RULES,
})

function domainError(message: string): never {
  throw new RangeError(`Invalid lucky-color knowledge: ${message}`)
}

// Validates the frozen production record at module initialization and is exported so tests can
// prove that malformed future edits fail rather than being silently accepted.
export function validateLuckyColorKnowledge(knowledge: LuckyColorKnowledgeSet): void {
  if (knowledge.systemId !== 'thai-daily-shirt-color-taksa-7day') domainError('unexpected system ID')
  if (!/^\d{4}\.\d+$/.test(knowledge.datasetVersion)) domainError('datasetVersion must be an explicit major.minor value')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(knowledge.reviewedAt)) domainError('reviewedAt must be an ISO date literal')
  if (knowledge.sources.length !== SOURCE_IDS.length) domainError(`expected ${SOURCE_IDS.length} sources`)

  const sourceIds = new Set<string>()
  for (const source of knowledge.sources) {
    if (!source.id.trim() || !source.title.trim() || !source.publisher.trim() || !source.url.trim() || !source.role.trim()) domainError('source metadata is incomplete')
    if (sourceIds.has(source.id)) domainError(`duplicate source ID ${source.id}`)
    sourceIds.add(source.id)
  }
  for (const sourceId of SOURCE_IDS) if (!sourceIds.has(sourceId)) domainError(`missing source ID ${sourceId}`)

  if (knowledge.rules.length !== 35) domainError('expected exactly 35 rules')
  const positiveKeys = new Set<string>()
  const categoryKeys = new Set<string>()
  const positiveCountByWeekday = new Map<LuckyWeekday, number>()
  const kalakiniCountByWeekday = new Map<LuckyWeekday, number>()
  let positiveCount = 0
  let kalakiniCount = 0

  for (const rule of knowledge.rules) {
    if (!LUCKY_WEEKDAYS.includes(rule.weekday)) domainError(`unknown weekday ${String(rule.weekday)}`)
    if (!TRADITIONAL_CATEGORIES.includes(rule.traditionalCategory)) domainError(`unknown traditional category ${String(rule.traditionalCategory)}`)
    if (rule.colorFamilies.length === 0 || rule.colorFamilies.some((family) => !LUCKY_COLOR_FAMILIES.includes(family))) domainError('rule has an invalid or empty colour family list')
    if (rule.sourceIds.length === 0 || rule.sourceIds.some((id) => !sourceIds.has(id))) domainError('rule has an unresolved source ID')
    if (rule.sourceTermsTh.length === 0 || rule.sourceTermsTh.some((term) => !term.trim())) domainError('rule has an empty Thai source term')

    const categoryKey = `${rule.weekday}:${rule.traditionalCategory}`
    if (categoryKeys.has(categoryKey)) domainError(`duplicate weekday/category ${categoryKey}`)
    categoryKeys.add(categoryKey)

    if (rule.goal === null) {
      if (rule.traditionalCategory !== 'kalakini') domainError('only kalakini may have a null goal')
      kalakiniCount += 1
      kalakiniCountByWeekday.set(rule.weekday, (kalakiniCountByWeekday.get(rule.weekday) ?? 0) + 1)
      continue
    }

    if (!LUCKY_GOALS.includes(rule.goal)) domainError(`unknown goal ${String(rule.goal)}`)
    if (rule.traditionalCategory === 'kalakini') domainError('positive rule may not use kalakini')
    if (rule.traditionalCategory !== CATEGORY_FOR_GOAL[rule.goal]) domainError(`wrong traditional category for ${rule.goal}`)
    const positiveKey = `${rule.weekday}:${rule.goal}`
    if (positiveKeys.has(positiveKey)) domainError(`duplicate weekday/goal ${positiveKey}`)
    positiveKeys.add(positiveKey)
    positiveCount += 1
    positiveCountByWeekday.set(rule.weekday, (positiveCountByWeekday.get(rule.weekday) ?? 0) + 1)
  }

  if (positiveCount !== 28) domainError('expected exactly 28 positive rules')
  if (kalakiniCount !== 7) domainError('expected exactly 7 kalakini rules')
  for (const weekday of LUCKY_WEEKDAYS) {
    if (positiveCountByWeekday.get(weekday) !== LUCKY_GOALS.length) domainError(`expected four positive rules for ${weekday}`)
    if (kalakiniCountByWeekday.get(weekday) !== 1) domainError(`expected one kalakini rule for ${weekday}`)
  }
}

validateLuckyColorKnowledge(LUCKY_COLOR_KNOWLEDGE)
