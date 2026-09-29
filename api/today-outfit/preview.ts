import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleOutfitPreviewRequest } from '../_lib/outfitPreviewHandler.js'

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleOutfitPreviewRequest(req, res)
}
