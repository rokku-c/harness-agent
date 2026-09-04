/**
 * Board over MCP stdio: run with  bun apps/board/src/hosts/mcp/main.ts
 * Env: BOARD_DATA_FILE (optional JSON snapshot for persistence),
 *      BOARD_MODEL_API/BOARD_MODEL/BOARD_MODEL_KEY/BOARD_MODEL_BASE
 *      (only needed for board_coordinate).
 */
import { Effect } from "effect"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { makeBoard } from "../../board.ts"
import { buildBoardModel } from "../../model.ts"
import { makeBoardMcp } from "./board-mcp.ts"

const dataFile = process.env.BOARD_DATA_FILE
const hasModel = ["BOARD_MODEL_API", "BOARD_MODEL", "BOARD_MODEL_KEY", "BOARD_MODEL_BASE"].some((k) => process.env[k] !== undefined)

try {
  const board = await Effect.runPromise(makeBoard({ dataFile }))
  const server = makeBoardMcp({ board, model: hasModel ? buildBoardModel() : undefined })
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("board mcp ready" + (hasModel ? " (with coordinator)" : " (coordinator disabled: no BOARD_MODEL_* env)"))
} catch (error) {
  console.error("board mcp failed:", error)
  process.exit(1)
}
