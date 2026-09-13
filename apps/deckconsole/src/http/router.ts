/**
 * The deck's one entry: the assets it serves, then its operations, then its own
 * 404.
 *
 * Every domain route is an operation now, so this file routes and nothing more -
 * a request no operation claimed is a path this deck does not have, and the
 * answer to it stays the deck's own.
 */
import { toHttpHandler, type Operation } from "@effect-agent/effect-interface"
import { deckFailure } from "../ops/refusal.ts"
import { assets } from "./assets.ts"

const json = (value: unknown, status: number): Response => Response.json(value, { status })

export const makeRouter = (operations: readonly Operation[], basePath: string) => {
  const api = toHttpHandler(operations, { onError: deckFailure })
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    try {
      const asset = await assets(request, url.pathname, basePath)
      if (asset) return asset
      return (await api(request)) ?? json({ ok: false, detail: "not found " + request.method + " " + url.pathname }, 404)
    } catch (error) {
      return json({ ok: false, detail: error instanceof Error ? error.message : String(error) }, 500)
    }
  }
}
