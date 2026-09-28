import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleOwnedOutfitRequest } from '../_lib/ownedOutfitHandler.js'

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleOwnedOutfitRequest(req, res)
}
