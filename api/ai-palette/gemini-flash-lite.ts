import type { IncomingMessage, ServerResponse } from 'node:http'
import { handlePaletteSelectionRequest } from '../_lib/paletteHandler'

// V2.0 Slice 0.5C: the Vercel-style function file for the canonical-palette-selection task.
// AI Lab only (see docs/V2_AI_COLOR_LAB.md §37) -- not reachable from normal Photo Checker.
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handlePaletteSelectionRequest(req, res)
}
