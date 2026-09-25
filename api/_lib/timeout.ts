// Per-provider bounded timeout (plan §9: ~30-45s). Combines the caller's own AbortSignal (e.g.
// a client disconnect) with our own deadline, and always reports WHICH one fired so the caller
// can tell a timeout apart from a genuine cancellation.

export const PROVIDER_TIMEOUT_MS = 35_000

export interface TimeoutGuard {
  signal: AbortSignal
  didTimeout: () => boolean
  cleanup: () => void
}

export function withTimeout(parentSignal: AbortSignal | undefined, timeoutMs = PROVIDER_TIMEOUT_MS): TimeoutGuard {
  const timeoutController = new AbortController()
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs)
  let timedOut = false
  timeoutController.signal.addEventListener('abort', () => { timedOut = true })
  const signals = parentSignal ? [parentSignal, timeoutController.signal] : [timeoutController.signal]
  return {
    signal: AbortSignal.any(signals),
    didTimeout: () => timedOut,
    cleanup: () => clearTimeout(timer),
  }
}
