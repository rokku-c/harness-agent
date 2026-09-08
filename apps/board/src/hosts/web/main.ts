import { makeBoard } from "../../board.ts"
import { makeBoardWeb } from "./server.ts"

/** Explicit unmanaged standalone mode; this listener is not a platform listener. */
const board = makeBoard({ dataFile: process.env.BOARD_DATA_FILE ?? ".effect-agent/board.sqlite" })
const server = Bun.serve({ hostname: "127.0.0.1", port: Number(process.env.BOARD_PORT ?? 3999), fetch: makeBoardWeb(board) })
console.error(`Board standalone http://127.0.0.1:${server.port}`)
const close = () => { server.stop(); board.close(); process.exit(0) }
process.on("SIGINT", close); process.on("SIGTERM", close)
