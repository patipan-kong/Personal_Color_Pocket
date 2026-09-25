import type { Plugin } from 'vite'
import { handleAiColorRequest } from './_lib/handler'
import { AI_PROVIDER_IDS } from '../src/domain/aiColorLab/contract'
import type { AiProviderId } from '../src/domain/aiColorLab/contract'

// V2.0 Slice 0 (plan §4): the local-dev half of the server-side boundary. `vite dev` has no
// built-in API routes, so this Vite plugin mounts /api/ai-color/<provider> as Connect
// middleware -- the SAME handleAiColorRequest used by the Vercel-style files in api/ai-color/,
// so there is exactly one implementation of "call this provider," not two that could drift.
// DEV-only glue; it never runs in a production `vite build` output (plugins execute at build/
// dev-server time, never inside the shipped client bundle).
const ROUTE = /^\/api\/ai-color\/([a-z]+)\/?$/

export function aiColorLabDevServer(): Plugin {
  return {
    name: 'ai-color-lab-dev-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        const match = ROUTE.exec(url)
        const provider = match?.[1]
        if (!provider || !(AI_PROVIDER_IDS as readonly string[]).includes(provider)) return next()
        void handleAiColorRequest(provider as AiProviderId, req, res)
      })
    },
  }
}
