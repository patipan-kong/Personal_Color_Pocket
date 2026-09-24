import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // .kilo/worktrees/* are git-ignored tool worktrees holding other copies of this repo. Without
    // this, plain `npm test` also runs their stale test files (V1.2 Slice 6).
    exclude: [...configDefaults.exclude, '**/.kilo/**'],
  },
})
