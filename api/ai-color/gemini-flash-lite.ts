import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleAiColorRequest } from '../_lib/handler'

// See api/ai-color/gemini-flash.ts for the shared-handler rationale (Slice 0.2 plan §4).
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleAiColorRequest('gemini-flash-lite', req, res)
}
