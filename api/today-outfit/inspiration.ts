import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleInspirationOutfitRequest } from '../_lib/inspirationOutfitHandler.js'

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleInspirationOutfitRequest(req, res)
}
