import { rewriteRequest, type EffectPlugin } from "@effect-agent/effect-host"
import { makeBoard } from "../board.ts"
import { makeBoardTools } from "../tools.ts"
import { makeBoardWeb } from "../hosts/web/server.ts"
import { effectConfig } from "../effect-config.ts"

export const createBoardPlugin = (getConfig: () => unknown): EffectPlugin => ({
  id: "board",
  load: async () => {
    const board = makeBoard(effectConfig.schema.parse(getConfig()) as { dataFile: string })
    const handle = makeBoardWeb(board, "/board/")
    return { tools: makeBoardTools(board), handle: async (request) => {
      if (new URL(request.url).pathname === "/board") return Response.redirect(new URL("/board/", request.url), 307)
      const inner = rewriteRequest(request, "/board")
      return inner ? handle(inner) : new Response(null, { status: 404 })
    }, stop: () => board.close() }
  },
})
