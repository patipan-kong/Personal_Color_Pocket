import type { IncomingMessage, ServerResponse } from 'node:http'

// Node-http-primitive helpers shared by the Vite dev middleware (api/devServer.ts) and the
// per-provider Vercel-style function files (api/ai-color/*.ts) -- both receive the same
// (IncomingMessage, ServerResponse)-shaped request/response, so one implementation serves both
// without an adapter layer (plan §4's "smallest maintainable architecture").

// A resized photo (plan §25, working image capped at 1600px) as a JPEG data URL comfortably
// fits well under this; it exists to stop an oversized or runaway request body, not to allow
// large uploads.
export const MAX_BODY_BYTES = 12 * 1024 * 1024

export class BodyTooLargeError extends Error {}
export class InvalidJsonError extends Error {}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > MAX_BODY_BYTES) throw new BodyTooLargeError()
    chunks.push(buf)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(raw)
  } catch {
    throw new InvalidJsonError()
  }
}

export function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  // AI Lab responses are per-request and carry no cross-user data; never cached.
  res.setHeader('Cache-Control', 'no-store')
  res.end(payload)
}
