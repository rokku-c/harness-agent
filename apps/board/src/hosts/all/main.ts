/**
 * One-command board: the web panel AND the stdio MCP surface in ONE process,
 * sharing a single BoardApi - so the browser, the builtin coordinator and
 * external agents (Claude Code over stdio) all act on the same live board,
 * and only one process ever writes BOARD_DATA_FILE.
 *
 *   bun apps/board/src/hosts/all/main.ts
 *
 * Env (same as the split entries):
 *   BOARD_WEB_HOST (default 127.0.0.1)  BOARD_WEB_PORT (default 3999)
 *   BOARD_DATA_FILE (optional snapshot persistence)
 *   BOARD_MODEL_API / BOARD_MODEL / BOARD_MODEL_KEY / BOARD_MODEL_BASE
 *     (enables the builtin coordinator tool on both surfaces)
 *
 * Output: the web panel URL is printed to stdout; the stdio MCP server owns
 * stdin/stdout, so all diagnostics go to stderr.
 */
import { Effect } from "effect"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { makeBoard } from "../../board.ts"
import { buildBoardModel } from "../../model.ts"
import { makeBoardMcp } from "../mcp/board-mcp.ts"
import { serveBoardWeb } from "../web/server.ts"

const dataFile = process.env.BOARD_DATA_FILE
const hasModel = ["BOARD_MODEL_API", "BOARD_MODEL", "BOARD_MODEL_KEY", "BOARD_MODEL_BASE"].some((k) => process.env[k] !== undefined)
const host = process.env.BOARD_WEB_HOST ?? "127.0.0.1"
const port = Number(process.env.BOARD_WEB_PORT ?? "3999") || 3999

try {
  const board = await Effect.runPromise(makeBoard({ dataFile }))
  const model = hasModel ? buildBoardModel() : undefined

  // one server instance per surface, both over the SAME BoardApi
  const webPanel = await serveBoardWeb({
    server: makeBoardMcp({ board, model, name: "board" }),
    host,
    port
  })
  // URL goes to stderr: stdout belongs to the MCP stdio protocol
  console.error("[board] web panel at " + webPanel.url + (hasModel ? " (coordinator enabled)" : " (coordinator disabled: no BOARD_MODEL_* env)"))

  const stdioServer = makeBoardMcp({ board, model, name: "board-stdio" })
  const transport = new StdioServerTransport()
  await stdioServer.connect(transport)
  console.error("[board] stdio MCP ready: board_* tools share the same board as the web panel")

  const stop = () => {
    webPanel.stop()
    process.exit(0)
  }
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)
} catch (error) {
  console.error("board failed to start:", error)
  process.exit(1)
}
