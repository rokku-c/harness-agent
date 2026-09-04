/**

 * board-preflight: the hard gate for Claude Code integration.
 * Spawns a throwaway board stdio MCP server, connects as an MCP client,
 * registers the claude-code executor and reads board_state. Exit 0 only
 * when the board is genuinely reachable and claude-code is declared;
 * otherwise exit 1 so scripts/board-claude.sh refuses to launch claude.
 *
 * Usage: bun board-preflight.ts --data-file <json> --mcp <board mcp main.ts>
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { join, resolve } from "node:path"

interface Args { dataFile: string; mcp: string }
const parseArgs = (argv: string[]): Args => {
  const out: Partial<Args> = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--data-file") out.dataFile = argv[++i]
    else if (argv[i] === "--mcp") out.mcp = argv[++i]
  }
  if (out.dataFile === undefined || out.mcp === undefined) {
    throw new Error("usage: board-preflight.ts --data-file <json> --mcp <main.ts>")
  }
  return out as Args
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  const client = new Client({ name: "board-preflight", version: "1.0.0" })
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(args.mcp)],
    env: { ...process.env, BOARD_DATA_FILE: args.dataFile }
  })
  await client.connect(transport)
  const reg = await client.callTool({
    name: "board_register_executor",
    arguments: { executorId: "claude-code", kind: "external", name: "claude-code (preflight)" }
  })
  const state = await client.callTool({ name: "board_state", arguments: {} })
  await client.close()
  const ok = reg.content[0] !== undefined && state.content[0] !== undefined
  if (ok) {
    console.error("[board-preflight] OK: board reachable; executor claude-code declared")
    process.exit(0)
  } else {
    console.error("[board-preflight] FAILED: board answered without registration")
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("[board-preflight] FAILED:", error instanceof Error ? error.message : String(error))
  process.exit(1)
})
