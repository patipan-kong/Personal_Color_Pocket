import { describe, expect, it } from 'vitest'
import { seasonDefinitions, subtypeOrder } from '../domain/personalColor/seasons'
import type { DimensionKey, Season } from '../domain/personalColor/types'
import { getCopy } from '../i18n'
import type { Language } from '../i18n'
import researchDoc from '../../docs/V1_4_LEARN_RESEARCH.md?raw'
import { resolveAppCopy } from './appCopy'
import { learnTranslations } from './content'
import { dimensionOrder, getLearnCopy, seasonTraits } from './model'
import { learnGroups, learnHomeFeatured, learnTopicOrder, learnTopics } from './registry'
import { learnClaims, learnSources } from './sources'
import type { LearnClaimId } from './sources'
import type { LearnBlock, LearnCopy, LearnTopicCopy, LearnTopicId } from './types'

// V1.4 Slice 1: the Learn content registry, TH/EN parity, copy integrity, budgets and provenance.

const languages: Language[] = ['en', 'th']
const en = getLearnCopy('en')
const th = getLearnCopy('th')

// ---- helpers ----

// Learn-authored strings only (existing app copy is referenced, not stored). Skips structural fields.
const structuralKeys = new Set(['language', 'kind', 'claim', 'ref', 'group'])
function authoredStrings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]]
  if (Array.isArray(value)) return value.flatMap((item, index) => authoredStrings(item, `${path}[${index}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => structuralKeys.has(key) ? [] : authoredStrings(item, path ? `${path}.${key}` : key))
  return []
}

// The text a block puts on screen, including referenced app copy.
function blockText(language: Language, block: LearnBlock): string[] {
  const copy = getCopy(language)
  switch (block.kind) {
    case 'text': return [block.text]
    case 'list': return [...block.items]
    case 'app-copy': { const text = resolveAppCopy(copy, block.ref); return typeof text === 'string' ? [text] : [...text] }
    case 'palette-group': return [copy.palette.sections[block.group].title, copy.palette.sections[block.group].description]
  }
}

// Structure with prose removed: what must be identical in TH and EN.
function shape(topic: LearnTopicCopy) {
  const blockShape = (block: LearnBlock) => block.kind === 'list' ? { ...block, items: block.items.length } : block.kind === 'text' ? { ...block, text: '' } : block
  return { why: topic.why.map(blockShape), more: topic.more.map(blockShape) }
}

// Budgets. English: whitespace words. Thai has no spaces between words, so it is measured in visible
// characters (Thai consonants, independent and spacing vowels, Latin letters, digits; tone marks and
// above/below vowels do not count). Existing parallel app copy runs ~3.9 such characters per English
// word, so each Thai budget is the English word budget × 5.
const TH_CHARS_PER_EN_WORD = 5
const enWords = (text: string) => text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length
const thChars = (text: string) => [...text].filter((ch) => /[ก-ะาำเ-ๆ๏-๛\p{Script=Latin}\p{N}]/u.test(ch)).length
const size = (language: Language, texts: string[]) => texts.reduce((sum, text) => sum + (language === 'en' ? enWords(text) : thChars(text)), 0)
const limit = (language: Language, enBudget: number) => language === 'en' ? enBudget : enBudget * TH_CHARS_PER_EN_WORD

const topicVisible = (language: Language, topic: LearnTopicCopy) => [topic.answer, ...topic.why.flatMap((block) => blockText(language, block)), topic.takeaway]
const topicTotal = (language: Language, topic: LearnTopicCopy) => [...topicVisible(language, topic), ...topic.more.flatMap((block) => blockText(language, block))]
const authoredTopicText = (topic: LearnTopicCopy) => authoredStrings(topic).map(([, text]) => text)

// ---- A. registry ----

describe('A. registry integrity', () => {
  it('has the seven P0 topics, each once, in three groups in the planned order', () => {
    expect(learnGroups.map((group) => group.id)).toEqual(['basics', 'wear', 'app'])
    expect(learnTopicOrder).toEqual(['basics.what-is', 'basics.dimensions', 'types.overview', 'wear.palette', 'wear.harder', 'app.color-checker', 'app.lucky'])
    expect(new Set(learnTopicOrder).size).toBe(learnTopicOrder.length)
    expect(Object.keys(learnTopics).sort()).toEqual([...learnTopicOrder].sort())
    for (const group of learnGroups) for (const id of group.topics) expect(learnTopics[id]).toMatchObject({ id, group: group.id })
  })

  it('has no P1 or deferred topic', () => {
    for (const id of learnTopicOrder) expect(id).not.toMatch(/neutrals|same-name|nearby|search|quiz|makeup/)
  })

  it('features at most two topics on the Learn home, with and without a profile', () => {
    for (const featured of [learnHomeFeatured.withProfile, learnHomeFeatured.withoutProfile]) {
      expect(featured.length).toBeLessThanOrEqual(2)
      for (const id of featured) expect(learnTopicOrder).toContain(id)
    }
  })

  it.each(languages)('%s content has every registry topic and nothing else', (language) => {
    expect(Object.keys(learnTranslations[language].topics).sort()).toEqual([...learnTopicOrder].sort())
    expect(learnTranslations[language].language).toBe(language)
  })
})

// ---- TH/EN parity ----

describe('TH/EN parity', () => {
  const keys = (copy: LearnCopy) => authoredStrings(copy).map(([path]) => path)

  it('Thai and English have the same fields, sections and lists', () => {
    expect(keys(th)).toEqual(keys(en))
  })

  it.each(learnTopicOrder)('%s has identical structure: blocks, claims, app-copy refs and list lengths', (id) => {
    expect(shape(th.topics[id])).toEqual(shape(en.topics[id]))
  })

  it.each(languages)('no %s string is empty', (language) => {
    for (const [path, text] of authoredStrings(learnTranslations[language])) expect(text.trim(), path).not.toBe('')
  })

  it('Thai is written in Thai: no English fallback, and no string left identical to English', () => {
    const allowedLatin = ['Personal Color Pocket', 'Personal Color', 'Color Me Beautiful', 'Munsell']
    const enStrings = new Map(authoredStrings(en))
    for (const [path, text] of authoredStrings(th)) {
      expect(text, path).toMatch(/[฀-๿]/)
      expect(allowedLatin.reduce((rest, term) => rest.split(term).join(''), text), path).not.toMatch(/[A-Za-z]/)
      expect(text, path).not.toBe(enStrings.get(path))
      // Thai sentence style: no full stop at the end.
      expect(text, path).not.toMatch(/\.$/)
    }
  })
})

// ---- D. copy integrity ----

describe('D. copy integrity', () => {
  // Claim ids that are plain words (history, placement) are ordinary English, so only compound ids count.
  const internalIds = [...subtypeOrder, ...learnTopicOrder, ...Object.keys(learnClaims).filter((id) => id.includes('-'))]

  it.each(languages)('%s shows no HEX, internal id or palette id', (language) => {
    for (const [path, text] of authoredStrings(learnTranslations[language])) {
      expect(text, path).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      expect(text, path).not.toMatch(/-(best|neutral|accent|harder|metal)-\d/)
      for (const id of internalIds) expect(text, path).not.toContain(id)
    }
  })

  it('uses “More Considered”, never “Harder”, as the user-facing term (authored and rendered)', () => {
    for (const language of languages) {
      const learn = learnTranslations[language]
      const rendered = learnTopicOrder.flatMap((id) => [...authoredTopicText(learn.topics[id]), ...topicTotal(language, learn.topics[id])])
      for (const text of [...authoredStrings(learn).map(([, value]) => value), ...rendered]) expect(text).not.toMatch(/harder/i)
      const term = getCopy(language).palette.sections.harder.title
      expect(learn.topics['wear.harder'].title).toContain(term)
      expect(learn.topics['wear.harder'].answer).toContain(term)
    }
    expect(getCopy('en').palette.sections.harder.title).toBe('More Considered')
    expect(getCopy('th').palette.sections.harder.title).toBe('สีที่ต้องเลือกใช้สักนิด')
  })

  it('describes colours, never personality', () => {
    const forbidden = {
      en: /\b(personalit(y|ies)|character|romantic|youthful|confident|bold|gentle|dramatic|elegant|sophisticated|mature|feminine|masculine|sweet|innocent|charismatic|shy|playful|introvert\w*|extrovert\w*)\b|you are (a|an|the)\b/i,
      th: /บุคลิก|นิสัย|โรแมนติก|มั่นใจ|อ่อนโยน|ขี้อาย|อ่อนหวาน|สง่า|เป็นคนแบบ|คุณเป็นคน/,
    }
    for (const language of languages) for (const [path, text] of authoredStrings(learnTranslations[language])) expect(text, path).not.toMatch(forbidden[language])
  })

  it('makes no certainty, diagnosis or attractiveness claim', () => {
    for (const [path, text] of authoredStrings(en)) expect(text, path).not.toMatch(/\b(guarantee\w*|diagnos\w*|clinical\w*|precise\w*|accurate\w*|objective\w*|most attractive|always suits?|never suits?)\b/i)
    // The one mention of proof is a denial, next to the limited evidence.
    const evidence = en.topics['basics.what-is'].why.find((block) => block.kind === 'text' && block.claim === 'evidence-modest')
    expect(evidence).toMatchObject({ text: expect.stringMatching(/limited.*no type system is scientifically proven/) })
  })

  it('band labels name the end of the scale they lean toward', () => {
    for (const language of languages) {
      for (const dimension of dimensionOrder) {
        const { ends, bands } = learnTranslations[language].dimensions[dimension]
        for (const [band, end] of [['strong-low', 'low'], ['lean-low', 'low'], ['lean-high', 'high'], ['strong-high', 'high']] as const) {
          expect(bands[band].toLowerCase()).toContain(ends[end].toLowerCase())
        }
        expect(new Set(Object.values(bands)).size).toBe(5)
      }
    }
  })

  it('the example band quoted in the dimensions topic is a real band label', () => {
    for (const language of languages) {
      const learn = learnTranslations[language]
      const block = learn.topics['basics.dimensions'].why.find((item) => item.kind === 'text' && item.claim === 'bands-not-scores')
      expect(block).toMatchObject({ text: expect.stringContaining(`“${learn.dimensions.temperature.bands['lean-low'].toLowerCase()}”`) })
    }
  })
})

// ---- K. season summaries agree with the canonical targets ----

describe('K. season summaries', () => {
  const terms: Record<Language, Record<DimensionKey, Record<'low' | 'high', string>>> = {
    en: { temperature: { low: 'cool', high: 'warm' }, value: { low: 'deep', high: 'light' }, chroma: { low: 'soft', high: 'clear' }, contrast: { low: 'low contrast', high: 'high contrast' } },
    th: { temperature: { low: 'เย็น', high: 'อุ่น' }, value: { low: 'เข้ม', high: 'อ่อน' }, chroma: { low: 'นุ่มหม่น', high: 'สดชัด' }, contrast: { low: 'ตัดกันน้อย', high: 'ตัดกันชัด' } },
  }
  const seasons = [...new Set(subtypeOrder.map((subtype) => seasonDefinitions[subtype].season))]

  it.each(seasons.flatMap((season) => languages.map((language) => [season, language] as const)))('%s (%s) states only qualities all three of its types share', (season, language) => {
    const summary = learnTranslations[language].seasons[season].summary.toLowerCase()
    const traits = seasonTraits(season)
    for (const dimension of dimensionOrder) {
      const trait = traits[dimension]
      const { low, high } = terms[language][dimension]
      if (trait) {
        expect(summary).toContain(trait === 'low' ? low : high)
        expect(summary).not.toContain(trait === 'low' ? high : low)
      } else {
        expect(summary).not.toContain(low)
        expect(summary).not.toContain(high)
      }
    }
  })

  it('the season-model sentence matches the derived warm/cool and clear/soft seasons', () => {
    const withTrait = (dimension: DimensionKey, end: 'low' | 'high') => seasons.filter((season) => seasonTraits(season)[dimension] === end)
    const pair = (list: Season[]) => { expect(list).toHaveLength(2); return list }
    const [warmA, warmB] = pair(withTrait('temperature', 'high'))
    const [coolA, coolB] = pair(withTrait('temperature', 'low'))
    const [clearA, clearB] = pair(withTrait('chroma', 'high'))
    const [softA, softB] = pair(withTrait('chroma', 'low'))
    const sentence = (language: Language) => (learnTranslations[language].topics['types.overview'].why.find((block) => block.kind === 'text' && block.claim === 'season-model') as { text: string }).text
    const n = (language: Language, season: Season) => learnTranslations[language].seasons[season].name
    expect(sentence('en')).toContain(`${n('en', warmA)} and ${n('en', warmB)} are warm`)
    expect(sentence('en')).toContain(`${n('en', coolA)} and ${n('en', coolB)} are cool`)
    expect(sentence('en')).toContain(`${n('en', clearA)} and ${n('en', clearB)} are clearer`)
    expect(sentence('en')).toContain(`${n('en', softA)} and ${n('en', softB)} are softer`)
    expect(sentence('th')).toContain(`${n('th', warmA)}และ${n('th', warmB)}เป็นโทนอุ่น`)
    expect(sentence('th')).toContain(`${n('th', coolA)}และ${n('th', coolB)}เป็นโทนเย็น`)
    expect(sentence('th')).toContain(`${n('th', clearA)}และ${n('th', clearB)}สดชัดกว่า`)
    expect(sentence('th')).toContain(`${n('th', softA)}และ${n('th', softB)}นุ่มหม่นกว่า`)
  })

  it('the type-naming example is true: Soft Summer is the most muted Summer type', () => {
    const summers = subtypeOrder.filter((subtype) => seasonDefinitions[subtype].season === 'summer')
    const mostMuted = summers.reduce((a, b) => seasonDefinitions[a].target.chroma < seasonDefinitions[b].target.chroma ? a : b)
    expect(mostMuted).toBe('soft-summer')
    for (const language of languages) {
      const block = learnTranslations[language].topics['types.overview'].why.find((item) => item.kind === 'text' && item.claim === 'type-naming')
      expect(block).toMatchObject({ text: expect.stringContaining(getCopy(language).subtypes['soft-summer'].name) })
    }
  })
})

// ---- Q. budgets ----

describe('Q. content budgets (plan §25)', () => {
  it.each(languages)('%s Learn home copy stays within 60 words', (language) => {
    const { home } = learnTranslations[language]
    expect(size(language, [home.lede, home.startHere, home.profileHero.eyebrow, home.profileHero.cta, home.generalHero.body, home.generalHero.cta])).toBeLessThanOrEqual(limit(language, 60))
  })

  it.each(learnTopicOrder.flatMap((id) => languages.map((language) => [id, language] as const)))('%s (%s) stays within its topic budgets', (id, language) => {
    const topic = learnTranslations[language].topics[id]
    expect(size(language, [topic.rowAnswer]), 'row answer').toBeLessThanOrEqual(limit(language, 20))
    expect(size(language, [topic.answer]), 'answer').toBeLessThanOrEqual(limit(language, 45))
    expect(size(language, [topic.takeaway]), 'takeaway').toBeLessThanOrEqual(limit(language, 20))
    expect(size(language, topicVisible(language, topic)), 'visible').toBeLessThanOrEqual(limit(language, 250))
    expect(size(language, topicTotal(language, topic)), 'total').toBeLessThanOrEqual(limit(language, 400))
  })

  it.each(languages)('%s subtype-detail template prose stays within 80 words (subtype text itself is existing app copy)', (language) => {
    expect(size(language, authoredStrings(learnTranslations[language].typeDetail).map(([, text]) => text))).toBeLessThanOrEqual(limit(language, 80))
  })

  it('the budget counters behave as documented', () => {
    expect(enWords('Put your Best colors near your face.')).toBe(7)
    expect(enWords('A — B')).toBe(2)
    // Tone marks and above/below vowels are not counted; spacing vowels are.
    expect(thChars('สีที่')).toBe(2)
    expect(thChars('เข้ม')).toBe(3)
  })
})

// ---- O. provenance ----

describe('O. provenance', () => {
  const usedClaims = (language: Language) => learnTopicOrder.flatMap((id) => [...learnTranslations[language].topics[id].why, ...learnTranslations[language].topics[id].more])
    .flatMap((block) => block.kind === 'text' || block.kind === 'list' ? [block.claim] : [])

  it('every claim is used, and every authored block names a registered claim', () => {
    const used = new Set<LearnClaimId>(usedClaims('en'))
    expect([...used].sort()).toEqual(Object.keys(learnClaims).sort())
    expect(usedClaims('th')).toEqual(usedClaims('en'))
  })

  it('external and combined claims cite a source; C claims cite the research register', () => {
    for (const [id, claim] of Object.entries(learnClaims)) {
      expect(claim.sources.length, id).toBeGreaterThan(0)
      if (claim.truth === 'C') expect(claim.sources.some((source) => source in learnSources), id).toBe(true)
    }
  })

  it('register ids match docs/V1_4_LEARN_RESEARCH.md, and cited internal docs exist', () => {
    for (const id of Object.keys(learnSources)) expect(researchDoc).toContain(`| ${id} |`)
    const docs = Object.keys(import.meta.glob('../../docs/*.md')).map((path) => path.replace('../../docs/', ''))
    const docFiles: Record<string, RegExp> = {
      'doc:V1.2-slice-5E': /^V1_2_SLICE_5E_/, 'doc:V1.2-slice-5F': /^V1_2_SLICE_5F_/, 'doc:V1.3-slice-0': /^V1_3_SLICE_0_/, 'doc:V1.4-plan': /^V1_4_LEARN_PLAN\.md$/,
    }
    const cited = new Set(Object.values(learnClaims).flatMap((claim) => claim.sources).filter((source) => source.startsWith('doc:')))
    for (const source of cited) expect(docs.some((file) => docFiles[source].test(file)), source).toBe(true)
  })

  it('the history and systems-differ claims appear only in "more detail", once per topic', () => {
    for (const id of learnTopicOrder) {
      const topic = en.topics[id]
      const where = (claim: LearnClaimId) => ({ why: topic.why.filter((block) => 'claim' in block && block.claim === claim).length, more: topic.more.filter((block) => 'claim' in block && block.claim === claim).length })
      expect(where('history').why).toBe(0)
      expect(where('systems-differ').why).toBe(0)
      expect(where('systems-differ').more).toBe(id === 'basics.what-is' || id === 'types.overview' ? 1 : 0)
    }
  })

  it('app-copy references resolve to the existing screen wording itself', () => {
    for (const language of languages) {
      const copy = getCopy(language)
      const refs = learnTopicOrder.flatMap((id) => [...learnTranslations[language].topics[id].why, ...learnTranslations[language].topics[id].more]).flatMap((block) => block.kind === 'app-copy' ? [block.ref] : [])
      expect(refs.length).toBeGreaterThan(0)
      for (const ref of refs) {
        const [section, key] = ref.split('.') as [keyof typeof copy, string]
        expect(resolveAppCopy(copy, ref)).toBe((copy[section] as unknown as Record<string, unknown>)[key])
      }
    }
  })
})

// ---- F. app-guide truth ----

describe('F. app-guide truth', () => {
  const topicBlocks = (language: Language, id: LearnTopicId) => [...learnTranslations[language].topics[id].why, ...learnTranslations[language].topics[id].more]
  const claimText = (language: Language, id: LearnTopicId, claim: LearnClaimId) => (topicBlocks(language, id).find((block) => block.kind === 'text' && block.claim === claim) as { text: string } | undefined)?.text ?? ''

  it('Color Checker content is honest about photos and claims no true-colour recovery', () => {
    const authored = { en: authoredTopicText(en.topics['app.color-checker']), th: authoredTopicText(th.topics['app.color-checker']) }
    for (const text of authored.en) expect(text).not.toMatch(/\b(recover\w*|restor\w*|correct\w*|calibrat\w*|measur\w*|accura\w*|detect\w*|AI|artificial|true colou?r|real colou?r)\b/i)
    for (const text of authored.th) expect(text).not.toMatch(/AI|แก้สี|ปรับแก้|สอบเทียบ|ตรวจจับ|วัดสี|แม่นยำ/)
    const claims = topicBlocks('en', 'app.color-checker').flatMap((block) => 'claim' in block ? [block.claim] : [])
    expect(claims).toEqual(['photo-records-light', 'camera-guesses', 'context-changes-appearance', 'photo-guide-only'])
    expect(claimText('en', 'app.color-checker', 'camera-guesses')).toMatch(/white balance.*exposure/)
    expect(claimText('en', 'app.color-checker', 'photo-guide-only')).toMatch(/cannot know the exact color/)
    expect(claimText('th', 'app.color-checker', 'photo-guide-only')).toContain('ไม่สามารถ')
    // The light, low-colour caution and capture tip are the V1.2 wording itself.
    for (const language of languages) {
      const refs = topicBlocks(language, 'app.color-checker').flatMap((block) => block.kind === 'app-copy' ? [block.ref] : [])
      expect(refs).toEqual(['photoChecker.lightingNote', 'photoChecker.captureTip'])
    }
  })

  it('Daily content keeps tradition → family and Personal Color → shade and placement', () => {
    expect(en.topics['app.lucky'].answer).toMatch(/tradition picks the lucky color family.*Personal Color.*shade and where to wear it/)
    expect(th.topics['app.lucky'].answer).toMatch(/ความเชื่อ.*กำหนดกลุ่มสีมงคล.*Personal Color ช่วยเลือกเฉดและตำแหน่งที่ใส่/)
    for (const language of languages) {
      const refs = topicBlocks(language, 'app.lucky').flatMap((block) => block.kind === 'app-copy' ? [block.ref] : [])
      expect(refs).toEqual(['daily.storyFamily', 'daily.storyShade', 'daily.aboutBody'])
    }
  })

  it('two-goal composition is described as app behaviour, never as the tradition', () => {
    expect(claimText('en', 'app.lucky', 'two-goal-composition')).toMatch(/combining their colors into one outfit is how the app works, not part of the tradition/)
    expect(claimText('th', 'app.lucky', 'two-goal-composition')).toMatch(/เป็นวิธีของแอป ไม่ได้มาจากความเชื่อ/)
    for (const language of languages) {
      const all = learnTopicOrder.flatMap((id) => topicTotal(language, learnTranslations[language].topics[id]))
      for (const text of all) {
        expect(text).not.toMatch(/tradition\w*\s+(combines?|mixes|pairs|joins)/i)
        for (const sentence of text.split(/(?<=[.;])\s+/)) if (/combin/i.test(sentence)) expect(sentence).toMatch(/\bapp\b/i)
      }
    }
  })
})
