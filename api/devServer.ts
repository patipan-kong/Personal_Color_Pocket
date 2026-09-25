import type { Plugin } from 'vite'
import { handleAiColorRequest } from './_lib/handler'
import { handlePaletteSelectionRequest } from './_lib/paletteHandler'
import { AI_CANDIDATE_IDS } from '../src/domain/aiColorLab/contract'
import type { AiCandidateId } from '../src/domain/aiColorLab/contract'

// V2.0 Slice 0 (plan §4), extended Slice 0.2 (plan §4, §7): the local-dev half of the
// server-side boundary. `vite dev` has no built-in API routes, so this Vite plugin mounts
// /api/ai-color/<candidateId> as Connect middleware -- the SAME handleAiColorRequest used by the
// Vercel-style files in api/ai-color/, so there is exactly one implementation of "call this
// candidate," not two that could drift. DEV-only glue; it never runs in a production
// `vite build` output (plugins execute at build/dev-server time, never inside the shipped client
// bundle). Candidate ids may contain hyphens (e.g. "gemini-flash-lite").
const ROUTE = /^\/api\/ai-color\/([a-z-]+)\/?$/
// V2.0 Slice 0.5C: the canonical-palette-selection task's dev route. Only ever gemini-flash-lite
// (plan §L), so the route carries no candidateId segment.
const PALETTE_ROUTE = /^\/api\/ai-palette\/gemini-flash-lite\/?$/

export function aiColorLabDevServer(): Plugin {
  return {
    name: 'ai-color-lab-dev-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (PALETTE_ROUTE.test(url)) return void handlePaletteSelectionRequest(req, res)
        const match = ROUTE.exec(url)
        const candidateId = match?.[1]
        if (!candidateId || !(AI_CANDIDATE_IDS as readonly string[]).includes(candidateId)) return next()
        void handleAiColorRequest(candidateId as AiCandidateId, req, res)
      })
    },
  }
}
