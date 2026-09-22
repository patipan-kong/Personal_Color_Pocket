import { describe, expect, it } from 'vitest'
import { subtypeOrder } from './seasons'
import { summarizeAudit } from './scoringAudit'

// Exhaustively enumerates all 3^11 = 177,147 possible answer combinations (Model V2:
// 11 questions) and checks the scoring model for gross distribution problems: an
// unreachable subtype, a runaway dominant subtype, or confidence escaping its
// documented bounds. This is a sanity check, not a target for equal distribution --
// some subtypes are legitimately more common combinations than others.
describe('scoring model distribution audit', () => {
  it('reaches every subtype and stays within confidence bounds across all 177,147 answer combinations', () => {
    const summary = summarizeAudit()

    expect(summary.total).toBe(177147)
    expect(summary.unreachable).toEqual([])

    subtypeOrder.forEach((subtype) => {
      expect(summary.bySubtype[subtype]).toBeGreaterThan(0)
    })

    // No single subtype should dominate the space (12 subtypes; flag anything over ~35%).
    subtypeOrder.forEach((subtype) => {
      expect(summary.bySubtype[subtype] / summary.total).toBeLessThan(.35)
    })

    expect(summary.confidence.min).toBeGreaterThanOrEqual(.42)
    expect(summary.confidence.max).toBeLessThanOrEqual(.91)
  })
})
