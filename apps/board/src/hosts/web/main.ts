/**
 * Board web console live entry: the whole board over one HTTP process.
 *
 * The panel in the browser is an MCP client: this process maps every /api
 * call onto the in-process board MCP server (InMemoryTransport) - the same
 * board_* tools Claude Code gets over stdio. The feed is a stateless poll of
 * board_events with a timestamp cursor.
 *
 * Env: BOARD_WEB_HOST (default 127.0.0.1), BOARD_WEB_PORT (default 0 = free),
 *      BOARD_DATA_FILE (optional persistence snapshot),
 *      BOARD_MODEL_API/BOARD_MODEL/BOARD_MODEL_KEY/BOARD_MODEL_BASE (enables
 *      the builtin coordinator button).
 *
 * Run: bun apps/board/src/hosts/web/main.ts
 */
import { Effect } from "effect"
import { makeBoard } from "../../board.ts"
import { buildBoardModel } from "../../model.ts"
import { makeBoardMcp } from "../mcp/board-mcp.ts"
import { serveBoardWeb } from "./server.ts"

const dataFile = process.env.BOARD_DATA_FILE
const hasModel = ["BOARD_MODEL_API", "BOARD_MODEL", "BOARD_MODEL_KEY", "BOARD_MODEL_BASE"].some((k) => process.env[k] !== undefined)

try {
  const board = await Effect.runPromise(makeBoard({ dataFile }))
  const server = makeBoardMcp({ board, model: hasModel ? buildBoardModel() : undefined })
  const web = await serveBoardWeb({
    server,
    host: process.env.BOARD_WEB_HOST ?? "127.0.0.1",
    port: Number(process.env.BOARD_WEB_PORT ?? "0") || 0
  })
  console.log("board web: " + web.url + (hasModel ? " (coordinator enabled)" : " (coordinator disabled: no BOARD_MODEL_* env)"))
  process.on("SIGINT", () => {
    web.stop()
    process.exit(0)
  })
  process.on("SIGTERM", () => {
    web.stop()
    process.exit(0)
  })
} catch (error) {
  console.error("board web failed:", error)
  process.exit(1)
}
