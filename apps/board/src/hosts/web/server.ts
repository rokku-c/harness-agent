import type { BoardApi } from "../../board.ts"
import { BoardError } from "../../tasks/schema.ts"
import { boardApi } from "./api.ts"
import { boardAsset } from "./assets.ts"

/** A socket-free service. Only the owning host or standalone entry binds ports. */
export const makeBoardWeb = (board: BoardApi, basePath = "/") => async (request: Request): Promise<Response> => {
  try {
    const path = new URL(request.url).pathname
    if (path.startsWith("/api/")) return await boardApi(board, request)
    if (request.method === "GET") {
      const asset = boardAsset(path, basePath)
      if (asset) return asset
    }
    return Response.json({ ok: false, error: "Not found" }, { status: 404 })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof BoardError ? error.message : "Invalid Board request" },
      { status: error instanceof BoardError ? error.status : 400 })
  }
}
