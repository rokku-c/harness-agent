import { rewriteRequest, type EffectPlugin } from "@effect-agent/effect-host"
import { makeBoard } from "../board.ts"
import { makeBoardTools } from "../api.ts"
import { makeBoardWeb } from "../hosts/web/server.ts"
import { boardSettings } from "../effect-config.ts"

export const createBoardPlugin = (getConfig: () => unknown): EffectPlugin => ({
  id: "board",
  load: async () => {
    const board = makeBoard(boardSettings(getConfig()))
    const handle = makeBoardWeb(board)
    return { tools: makeBoardTools(board), handle: async (request) => {
      const inner = rewriteRequest(request, "/board")
      return inner ? handle(inner) : new Response(null, { status: 404 })
    }, stop: () => board.close() }
  },
})
