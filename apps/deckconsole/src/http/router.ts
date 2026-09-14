/**
 * The deck's one entry: its operations, then its own 404.
 *
 * Every domain route is an operation, so this file routes and nothing more -
 * a request no operation claimed is a path this deck does not have, and the
 * answer to it stays the deck's own. The deck serves no page: its UI is the
 * deck's declarative view in the platform console (`src/effect-ui.ts`).
 */
import { toHttpHandler, type Operation } from "@effect-agent/effect-interface"
import { deckFailure } from "../ops/refusal.ts"

const json = (value: unknown, status: number): Response => Response.json(value, { status })

export const makeRouter = (operations: readonly Operation[]) => {
  const api = toHttpHandler(operations, { onError: deckFailure })
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    try {
      return (await api(request)) ?? json({ ok: false, detail: "not found " + request.method + " " + url.pathname }, 404)
    } catch (error) {
      return json({ ok: false, detail: error instanceof Error ? error.message : String(error) }, 500)
    }
  }
}
