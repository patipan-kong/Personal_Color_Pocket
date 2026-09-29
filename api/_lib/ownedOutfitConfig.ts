// One replaceable production choice. This is intentionally separate from the multi-provider Lab
// catalog: production has no user-facing selector and no automatic provider fallback.
export const OWNED_OUTFIT_PROVIDER = Object.freeze({
  provider: 'groq' as const,
  model: 'qwen/qwen3.8-27b',
})
