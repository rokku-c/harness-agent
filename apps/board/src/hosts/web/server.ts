import { toHttpHandler } from "@effect-agent/effect-interface"
import { boardOperations } from "../../api.ts"
import type { BoardApi } from "../../board.ts"

export const makeBoardWeb = (board: BoardApi) => {
  const api = toHttpHandler(boardOperations(board))
  return async (request: Request): Promise<Response> => {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      return await api(request) ?? Response.json({ ok: false, error: "Unknown Board route" }, { status: 404 })
    }
    return Response.json({ ok: false, error: "Not found" }, { status: 404 })
  }
}
