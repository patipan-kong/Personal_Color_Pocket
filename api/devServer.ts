import type { Plugin } from 'vite'
import { handleAiColorRequest } from './_lib/handler.js'
import { handlePaletteSelectionRequest } from './_lib/paletteHandler.js'
import { AI_CANDIDATE_IDS } from '../src/domain/aiColorLab/contract.js'
import type { AiCandidateId } from '../src/domain/aiColorLab/contract.js'
import { handleAiOutfitRequest } from './_lib/outfitHandler.js'
import { handleOutfitImageRequest } from './_lib/outfitImageHandler.js'
import { OUTFIT_IMAGE_CANDIDATE_IDS } from '../src/domain/todayOutfitImage/catalog.js'
import type { OutfitImageCandidateId } from '../src/domain/todayOutfitImage/catalog.js'
import { handleOwnedOutfitRequest } from './_lib/ownedOutfitHandler.js'
import { handleInspirationOutfitRequest } from './_lib/inspirationOutfitHandler.js'
import { createPreviewTraceContext, handleOutfitPreviewRequest } from './_lib/outfitPreviewHandler.js'
import type { OutfitPreviewHandlerOptions } from './_lib/outfitPreviewHandler.js'

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
const OUTFIT_ROUTE = /^\/api\/ai-outfit\/([a-z-]+)\/?$/
const OUTFIT_IMAGE_ROUTE = /^\/api\/ai-outfit-image\/([a-z-]+)\/?$/
const OWNED_OUTFIT_ROUTE = /^\/api\/today-outfit\/wardrobe\/?$/
const INSPIRATION_OUTFIT_ROUTE = /^\/api\/today-outfit\/inspiration\/?$/
const OUTFIT_PREVIEW_ROUTE = /^\/api\/today-outfit\/preview\/?$/

export interface AiColorLabDevServerOptions {
  // Test/dev harness only; this is constructed by the server and never read from a request.
  readonly outfitPreview?: Pick<OutfitPreviewHandlerOptions, 'provider' | 'timeoutMs' | 'trace'>
}

export function aiColorLabDevServer(options: AiColorLabDevServerOptions = {}): Plugin {
  return {
    name: 'ai-color-lab-dev-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (OUTFIT_PREVIEW_ROUTE.test(url)) {
          const traceContext = options.outfitPreview?.trace ? createPreviewTraceContext(options.outfitPreview.trace) : undefined
          traceContext?.emit('route-accepted')
          return void handleOutfitPreviewRequest(req, res, { ...options.outfitPreview, traceContext })
        }
        if (INSPIRATION_OUTFIT_ROUTE.test(url)) return void handleInspirationOutfitRequest(req, res)
        if (OWNED_OUTFIT_ROUTE.test(url)) return void handleOwnedOutfitRequest(req, res)
        if (PALETTE_ROUTE.test(url)) return void handlePaletteSelectionRequest(req, res)
        const outfitImageMatch = OUTFIT_IMAGE_ROUTE.exec(url)
        const outfitImageCandidateId = outfitImageMatch?.[1]
        if (outfitImageCandidateId && (OUTFIT_IMAGE_CANDIDATE_IDS as readonly string[]).includes(outfitImageCandidateId)) return void handleOutfitImageRequest(outfitImageCandidateId as OutfitImageCandidateId, req, res)
        const outfitMatch = OUTFIT_ROUTE.exec(url)
        const outfitCandidateId = outfitMatch?.[1]
        if (outfitCandidateId && (AI_CANDIDATE_IDS as readonly string[]).includes(outfitCandidateId)) return void handleAiOutfitRequest(outfitCandidateId as AiCandidateId, req, res)
        const match = ROUTE.exec(url)
        const candidateId = match?.[1]
        if (!candidateId || !(AI_CANDIDATE_IDS as readonly string[]).includes(candidateId)) return next()
        void handleAiColorRequest(candidateId as AiCandidateId, req, res)
      })
    },
  }
}
