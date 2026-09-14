import { toHttpHandler } from "@effect-agent/effect-interface"
import { boardOperations } from "../../api.ts"
import type { BoardApi } from "../../board.ts"

/**
 * The board's HTTP surface, and nothing else.
 *
 * A socket-free service. Only the owning host or standalone entry binds ports.
 *
 * The `/api/` half is the projection of the board's operation list - the same
 * list the MCP host registers as tools - so this file routes and nothing more:
 * every verdict about input and status is the operation's. The board's UI is not
 * served here; it is the board's declarative view in the platform console
 * (`src/effect-ui.ts`), and a request outside `/api/` is a 404.
 */
export const makeBoardWeb = (board: BoardApi) => {
  const api = toHttpHandler(boardOperations(board))
  return async (request: Request): Promise<Response> => {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      return await api(request) ?? Response.json({ ok: false, error: "Unknown Board route" }, { status: 404 })
    }
    return Response.json({ ok: false, error: "Not found" }, { status: 404 })
  }
}
