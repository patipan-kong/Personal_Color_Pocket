// V2.0 Slice 0.2 (plan §12): median is preferred over average for latency because provider
// latency can have outliers (a single slow retry should not drag the whole session's reported
// latency toward it the way it would with a mean).
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
