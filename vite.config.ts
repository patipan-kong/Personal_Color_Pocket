import { configDefaults, defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { aiColorLabDevServer } from './api/devServer'

// V2.0 AI Color Lab (Slice 0, plan §3-4): loadEnv reads .env into a plain object here, in
// Node/config context only -- never through `define` or `import.meta.env`, so these four
// values never reach the client bundle. Only these exact names are copied into process.env,
// which is where api/_lib/env.ts (server-only) reads them from.
// DeepSeek was removed from the AI Lab in Slice 0.1 (docs/V2_AI_COLOR_LAB.md §15); its key is no
// longer read even if still present, unused, in a developer's local .env.
const AI_LAB_KEYS = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY'] as const
const loadedEnv = loadEnv('development', process.cwd(), '')
for (const key of AI_LAB_KEYS) if (loadedEnv[key] && !process.env[key]) process.env[key] = loadedEnv[key]

export default defineConfig({
  plugins: [react(), aiColorLabDevServer()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // .kilo/worktrees/* are git-ignored tool worktrees holding other copies of this repo. Without
    // this, plain `npm test` also runs their stale test files (V1.2 Slice 6).
    exclude: [...configDefaults.exclude, '**/.kilo/**'],
  },
})
