import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleAiColorRequest } from '../_lib/handler'

// Vercel-style serverless function (Node runtime, default-export (req, res) handler). Not
// deployed in this slice (plan §4, §36) -- this file exists so the plausible future path to
// Vercel is real, not aspirational: api/_lib/handler.ts is the ONLY logic, shared verbatim with
// the local Vite dev server (api/devServer.ts). One route file per bake-off candidate (Slice
// 0.2 plan §4) -- Gemini Flash and Gemini Flash-Lite share the gemini adapter but are separate
// candidate ids and separate routes.
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleAiColorRequest('gemini-flash', req, res)
}
