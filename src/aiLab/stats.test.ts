import { describe, expect, it } from 'vitest'
import { median, sum } from './stats'

// V2.0 Slice 0.2 (plan §12, §22 L): median is what the session summary reports for latency.
describe('median', () => {
  it('returns null for an empty list rather than fabricating a value', () => {
    expect(median([])).toBeNull()
  })

  it('returns the single value for a list of one', () => {
    expect(median([42])).toBe(42)
  })

  it('returns the middle value for an odd-length list', () => {
    expect(median([300, 100, 200])).toBe(200)
  })

  it('averages the two middle values for an even-length list', () => {
    expect(median([100, 200, 300, 400])).toBe(250)
  })

  it('is not skewed by a single large outlier the way a mean would be', () => {
    expect(median([100, 110, 120, 9000])).toBe(115)
  })
})

describe('sum', () => {
  it('returns 0 for an empty list', () => {
    expect(sum([])).toBe(0)
  })

  it('adds every value', () => {
    expect(sum([1, 2, 3.5])).toBe(6.5)
  })
})
