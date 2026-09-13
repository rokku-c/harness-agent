import { toHttpHandler } from "@effect-agent/effect-interface"
import { boardOperations } from "../../api.ts"
import type { BoardApi } from "../../board.ts"
import { boardAsset } from "./assets.ts"

/**
 * A socket-free service. Only the owning host or standalone entry binds ports.
 *
 * The `/api/` half is the projection of the board's operation list - the same
 * list the MCP host registers as tools - so this file routes and nothing more:
 * every verdict about input and status is the operation's.
 */
export const makeBoardWeb = (board: BoardApi, basePath = "/") => {
  const api = toHttpHandler(boardOperations(board))
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname
    if (path.startsWith("/api/")) {
      return await api(request) ?? Response.json({ ok: false, error: "Unknown Board route" }, { status: 404 })
    }
    if (request.method === "GET") {
      const asset = boardAsset(path, basePath)
      if (asset) return asset
    }
    return Response.json({ ok: false, error: "Not found" }, { status: 404 })
  }
}
