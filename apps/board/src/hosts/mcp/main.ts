import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { makeBoard } from "../../board.ts"
import { standaloneSettings } from "../settings.ts"
import { makeBoardMcp } from "./board-mcp.ts"

const board = makeBoard(standaloneSettings())
const server = makeBoardMcp(board)
await server.connect(new StdioServerTransport())
const close = async () => { await server.close(); board.close(); process.exit(0) }
process.on("SIGINT", close); process.on("SIGTERM", close)
