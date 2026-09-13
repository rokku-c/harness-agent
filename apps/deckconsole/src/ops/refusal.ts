/**
 * The answers this deck refuses with.
 *
 * Every route here has always answered a refusal with `{ ok: false, detail }`,
 * and the console's own browser code branches on that key, so an operation that
 * refuses throws the answer it wants read rather than a bare message a surface
 * would have to reinvent. A tool call reaches the same refusal as a tool error,
 * which is what an agent can act on - an HTTP status is not.
 */
import { issuesOf, messageOf, type Failed } from "@effect-agent/effect-interface"

/** A refusal carrying the exact body its route has always returned. */
export class Refusal extends Error {
  constructor(readonly status: number, readonly body: Record<string, unknown>) {
    super(typeof body.detail === "string" ? body.detail : "refused")
    this.name = "Refusal"
  }
}

/** Refuse a call the way its route always has: one status, one reason. */
export function refuse(status: number, detail: string): never {
  throw new Refusal(status, { ok: false, detail })
}

/**
 * What a thrown error becomes over HTTP. A refusal is the answer its route
 * declared; a shape that did not parse is this deck's 400; anything else is the
 * failure the deck has always reported as one.
 */
export const deckFailure = (error: unknown): Failed => {
  if (error instanceof Refusal) return { status: error.status, body: error.body }
  const issues = issuesOf(error)
  if (issues !== undefined) return { status: 400, body: { ok: false, detail: issues } }
  const status = (error as { status?: unknown } | null)?.status
  const code = typeof status === "number" && status >= 400 && status < 600 ? status : 500
  return { status: code, body: { ok: false, detail: messageOf(error) } }
}
