import type { BoardApi } from "../../board.ts"
import { BoardError, type TaskInput, type TaskPatch } from "../../tasks/schema.ts"

export const boardApi = async (board: BoardApi, request: Request): Promise<Response> => {
  const url = new URL(request.url), path = url.pathname, method = request.method
  if (method === "GET") {
    if (path === "/api/health") return Response.json({ ok: true })
    if (path === "/api/state") return Response.json(board.state())
    if (path === "/api/tree") return Response.json(board.tree())
    if (path === "/api/tasks") return Response.json({ tasks: board.list() })
    if (path === "/api/events") {
      const after = Number(url.searchParams.get("after") ?? 0)
      if (!Number.isSafeInteger(after) || after < 0) throw new BoardError(400, "after must be a nonnegative integer")
      return Response.json({ events: board.events(after) })
    }
  }
  if (path === "/api/tasks" && method === "POST") return Response.json(board.create(await request.json() as TaskInput), { status: 201 })
  const match = path.match(/^\/api\/tasks\/([^/]+)$/)
  if (match) {
    const id = decodeURIComponent(match[1])
    if (method === "GET") return Response.json(board.get(id))
    if (method === "PATCH") return Response.json(board.update(id, await request.json() as TaskPatch))
    if (method === "DELETE") return Response.json(board.delete(id))
    return new Response(null, { status: 405 })
  }
  return Response.json({ ok: false, error: "Unknown Board route" }, { status: 404 })
}
