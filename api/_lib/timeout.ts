// Shared cancellation/deadline primitive. The signal asks transport work to stop; the deadline
// promise lets an application handler settle even when a transport/provider ignores that abort.

export const PROVIDER_TIMEOUT_MS = 35_000

export interface TimeoutGuard {
  signal: AbortSignal
  deadline: Promise<void>
  didTimeout: () => boolean
  cleanup: () => void
}

export function withTimeout(parentSignal: AbortSignal | undefined, timeoutMs = PROVIDER_TIMEOUT_MS): TimeoutGuard {
  const timeoutController = new AbortController()
  let timedOut = false
  let resolveDeadline!: () => void
  const deadline = new Promise<void>((resolve) => { resolveDeadline = resolve })
  const onTimeoutAbort = () => {
    timedOut = true
    resolveDeadline()
  }
  timeoutController.signal.addEventListener('abort', onTimeoutAbort, { once: true })
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs)
  const signals = parentSignal ? [parentSignal, timeoutController.signal] : [timeoutController.signal]
  return {
    signal: AbortSignal.any(signals),
    deadline,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer)
      timeoutController.signal.removeEventListener('abort', onTimeoutAbort)
    },
  }
}
