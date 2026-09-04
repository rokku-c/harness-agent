/**

 * CLI for the global (user-level) Claude Code integration: apply | revert | status.
 * Used by the operator for the one-time write to ~/.claude.json + ~/.claude/CLAUDE.md
 * (the web panel drives the same code over /api/integration/claude).
 * Usage: bun apps/board/scripts/claude-global-cli.ts <apply|revert|status>
 */
import { homedir } from "node:os"
import { applyGlobalClaudeIntegration, globalClaudeStatus, revertGlobalClaudeIntegration } from "../src/hosts/web/integration/claude-global.ts"

const base = new URL("..", import.meta.url).pathname // apps/board/
const paths = {
  bunCli: process.env.BOARD_BUN ?? "/Users/user/.bun/bin/bun",
  claudeCli: process.env.BOARD_CLAUDE_CLI ?? "/Users/user/.local/bin/claude",
  mcpEntry: base + "src/hosts/mcp/main.ts",
  preflightEntry: base + "scripts/board-preflight.ts",
  dataFile: process.env.BOARD_DATA_FILE ?? base + "../../.board-data/board.json"
}
const action = process.argv[2] ?? "status"
const home = process.env.HOME ?? homedir()
let out
if (action === "apply") { applyGlobalClaudeIntegration(home, paths); out = globalClaudeStatus(home, paths, false) }
else if (action === "revert") out = revertGlobalClaudeIntegration(home, paths)
else out = globalClaudeStatus(home, paths, false)
console.log(JSON.stringify({ ok: true, scope: "global", home, action, state: out }, null, 1))
