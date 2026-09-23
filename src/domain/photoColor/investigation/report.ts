import { getPalette } from '../../personalColor/palettes'
import { subtypeOrder } from '../../personalColor/seasons'
import { hexToOklab } from '../../personalColor/colorUtils'
import { matchPhotoColor } from '../photoMatch'
import { diagnosePoint } from './diagnostics'
import {
  NOMINALS, flagOnset, OBSERVED, WHITE, SHADE_SKY, castSeries, categories, code, contextHint, describeLab, exposureSeries, failureScenarios, garmentScene, garmentTaps, jitter,
  lightBetween, lightestRisk, litHex, mixedFixtures, positionSweep, runFixtures, solidHex, strategyComparison, tintedLightNeutralRule, whiteBalanceExperiment,
  whiteGarmentFixtures,
} from './experiments'
import { scene } from './lightModel'
import { hexToRgb } from '../../personalColor/colorUtils'

// INVESTIGATION ONLY (Slice 5e): prints the tables used in the 5e record. Run with
//   PHOTO_INVESTIGATION_REPORT=1 npx vitest run src/domain/photoColor/investigation
const f = (value: number | null | undefined, digits = 3) => value == null || Number.isNaN(value) ? '–' : value.toFixed(digits)

export function buildReport(): string {
  const out: string[] = []
  const line = (...parts: unknown[]) => out.push(parts.join(' '))
  line('subtype order:', subtypeOrder.join(','))

  const observed = solidHex(OBSERVED)
  line('\n## Observed', OBSERVED, JSON.stringify(describeLab(observed.oklab)), 'flags', observed.diagnostics.flags.join('+') || '–', 'cats', code(categories(observed)))
  for (const subtype of subtypeOrder) {
    const match = matchPhotoColor(observed, subtype)
    line('  ', subtype, match.category, match.nearest.color.name, match.nearest.group, f(match.nearest.distance), match.resembles?.color.name ?? '')
  }
  line('WHITE under SHADE_SKY →', litHex(WHITE, SHADE_SKY), '; exact metamer light', JSON.stringify(lightBetween(WHITE, OBSERVED)))
  const white = solidHex(WHITE)
  line('WHITE', JSON.stringify(describeLab(white.oklab)), 'cats', code(categories(white)))

  for (const [title, rows] of [['White-garment matrix', runFixtures(whiteGarmentFixtures())], ['Mixed matrix', runFixtures(mixedFixtures())]] as const) {
    line(`\n## ${title}`)
    line('id | label | hex | L | C | hue | spread | hi | sh | flags | cats | median hex | ΔE(med) | L p10/p50/p90 | darkest..brightest | tint | B−R | ctxShare')
    for (const { fixture, diagnosis: d, categories: cats } of rows) {
      const s = d.sample!, dist = d.distribution!, c = d.cast!
      line(fixture.id, '|', fixture.label, '|', s.hex, '|', f(s.oklab.l), '|', f(s.chroma), '|', f(s.hue, 0), '|', f(s.spread), '|', f(s.highlightFraction, 2), '|', f(s.shadowFraction, 2), '|', s.flags.join('+') || '–', '|', code(cats), '|', dist.medianHex, '|', f(dist.medianVsProduction), '|',
        `${f(dist.lPercentiles.p10)}/${f(dist.lPercentiles.p50)}/${f(dist.lPercentiles.p90)}`, '|', `${dist.darkestRetainedHex}..${dist.brightestRetainedHex}`, '|', c.tint, '|', f(c.blueMinusRed, 1), '|', f(d.context!.lighterSimilarShare, 2),
        '| region', d.region.pixelCount, d.region.opaqueCount, d.region.keptCount)
      line('   radii:', d.radii.map((r) => `${r.radius}:${r.hex} L${f(r.l)} C${f(r.chroma)} s${f(r.spread)}${r.flags.length ? ' ' + r.flags.join('+') : ''}`).join(' | '))
    }
  }

  line('\n## Flag onset (linear intensity at which a uniform patch raises the flag; 1 = neutral normal light)')
  for (const [name, hex] of [...NOMINALS, ['observed', OBSERVED]] as const) line('  ', name, hex, 'highlight ≥', f(flagOnset(hex, 'highlight')), '| shadow ≤', f(flagOnset(hex, 'shadow'), 4))

  line('\n## Exposure series (intensity: hex L C ΔE changed/12 cats)')
  for (const row of exposureSeries()) {
    line(row.name, row.hex)
    for (const c of row.cells) line('  ', c.intensity, c.hex, f(c.lab.l), f(c.lab.chroma), f(c.lab.hue, 0), 'ΔE', f(c.deltaE), 'chg', c.changed, code(c.categories), c.flags.join('+'))
  }
  line('\n## Cast series')
  for (const row of castSeries()) {
    line(row.name, row.hex)
    for (const c of row.cells) line('  ', c.cast.padEnd(15), c.hex, f(c.lab.l), f(c.lab.chroma), f(c.lab.hue, 0), 'ΔE', f(c.deltaE), 'chg', c.changed, code(c.categories))
  }

  line('\n## Garment taps')
  const image = garmentScene()
  const taps = garmentTaps(image)
  for (const t of taps) {
    const s = t.sample
    line(t.label.padEnd(12), t.x, s.hex, f(s.oklab.l), f(describeLab(s.oklab).chroma), f(describeLab(s.oklab).hue, 0), 's', f(s.diagnostics.spread), s.diagnostics.flags.join('+') || '–', code(t.categories), 'ctx', f(t.diagnosis.context!.lighterSimilarShare, 2), t.diagnosis.context!.probableLocalShadow ? 'HINT' : '')
    line('     radii', t.diagnosis.radii.map((r) => `${r.radius}:${r.hex}${r.flags.length ? '!' : ''}`).join(' '))
  }
  line('\n## Position sweep')
  for (const r of positionSweep(image)) line('  x', r.x, r.hex, f(r.l), 's', f(r.spread), r.flags.join('+') || '–', code(r.categories))
  line('\n## Jitter ±12')
  for (const [label, x] of [['lit', 150], ['normal', 450], ['fold', 660], ['edge', 810], ['shade', 1000]] as const) line('  ', label, JSON.stringify(jitter(image, x, 300)))

  line('\n## Strategies (all triples of the 10 garment taps vs', WHITE, ')')
  for (const material of ['#A39A8E', '#1F2A44', '#B3CDE6']) {
    line('  same scene, material', material)
    for (const r of strategyComparison(garmentTaps(garmentScene(material)), material)) line('    ', r.strategy.padEnd(10), 'median ΔE', f(r.median), 'p90', f(r.p90), 'max', f(r.max), 'agree', f(r.agreement * 100, 1) + '%')
  }
  for (const material of [WHITE, '#A39A8E']) {
    line('  STRONG SUN (1.35) scene, material', material)
    for (const r of strategyComparison(garmentTaps(garmentScene(material, { intensity: 1.35, r: 1.02, b: .97 })), material)) line('    ', r.strategy.padEnd(10), 'median ΔE', f(r.median), 'p90', f(r.p90), 'max', f(r.max), 'agree', f(r.agreement * 100, 1) + '%')
  }
  line('  white material')
  for (const r of strategyComparison(taps)) line('  ', r.strategy.padEnd(10), 'median ΔE', f(r.median), 'p90', f(r.p90), 'max', f(r.max), 'agree', f(r.agreement * 100, 1) + '%')
  line('\n## Failure scenarios')
  for (const s of failureScenarios()) {
    line(s.id, 'material', s.material, 'taps', s.taps.join(','), 'flags', s.flags.map((x) => x.join('+') || '–').join(','))
    for (const r of s.results) line('    ', r.strategy.padEnd(10), r.hex, 'ΔE', f(r.deltaE), 'chg', r.changed)
  }
  line('\n## Lightest risk')
  for (const r of lightestRisk()) line('  ', r.name, r.hex, '→ lightest', r.lightest, 'ΔE', f(r.lightestDeltaE), 'chg', r.lightestChanged, '| medianL', r.median, 'ΔE', f(r.medianDeltaE))
  line('\n## White balance')
  for (const c of whiteBalanceExperiment()) line('  ', c.id, c.results.map((r) => `${r.method}:${r.hex} ΔE${f(r.deltaE)} chg${r.changed}`).join(' | '))

  line('\n## Context hint (Option G prototype)')
  const two = scene(600, 600, (x) => x < 300 ? hexToRgb(WHITE)! : hexToRgb('#A7A9AC')!, 4)
  for (const [label, img, x] of [['garment shade edge', image, 860], ['garment deep shade', image, 1000], ['garment normal', image, 450], ['garment fold', image, 660], ['uniform shade (fixture F)', whiteGarmentFixtures()[5].image, 300], ['two-tone white|grey fabric, grey side', two, 340]] as const) {
    const h = contextHint(img, x)
    line('  ', label, h.hex, f(h.share, 2), h.hint ? 'HINT' : '–')
  }
  line('\n## Tinted-light-neutral rule vs curated palettes')
  let hits = 0, total = 0
  const hitNames: string[] = []
  for (const subtype of subtypeOrder) {
    const palette = getPalette(subtype)
    for (const group of ['best', 'accents', 'neutrals'] as const) for (const color of palette[group]) {
      total++
      if (tintedLightNeutralRule(hexToOklab(color.hex)!)) { hits++; hitNames.push(`${subtype}:${color.name}`) }
    }
  }
  line('  positive palette colours matching rule', hits, '/', total, hitNames.slice(0, 40).join(', '))
  line('  observed matches rule', tintedLightNeutralRule(hexToOklab(OBSERVED)!))
  const d = diagnosePoint(whiteGarmentFixtures()[5].image, { x: 300, y: 300 })
  line('  fixture F cast', JSON.stringify(d.cast))
  return out.join('\n')
}
