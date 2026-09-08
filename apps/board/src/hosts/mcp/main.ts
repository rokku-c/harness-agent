import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { makeBoard } from "../../board.ts"
import { makeBoardMcp } from "./board-mcp.ts"

const board = makeBoard({ dataFile: process.env.BOARD_DATA_FILE ?? ".effect-agent/board.sqlite" })
const server = makeBoardMcp(board)
await server.connect(new StdioServerTransport())
const close = async () => { await server.close(); board.close(); process.exit(0) }
process.on("SIGINT", close); process.on("SIGTERM", close)
