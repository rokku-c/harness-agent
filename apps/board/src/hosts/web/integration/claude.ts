/**

 * Claude Code <-> board integration (apply / revert / status).
 * Pure file operations against a target dir (default: repo root) so the web
 * shell can expose it over /api and tests can use a temp dir.
 * Idempotent + reversible: originals are backed up under .board-data/claude-int/
 * and restored on revert. UI triggers: Integrations > Claude Code.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join, resolve } from "node:path"

export const INT_DIR_NAME = ".board-data/claude-int"
export const SEG_START = "<!-- app-board:claude-code:start -->"
export const SEG_END = "<!-- app-board:claude-code:end -->"

export interface ClaudeCliPaths {
  bunCli: string
  claudeCli: string
  mcpEntry: string
  preflightEntry: string
  dataFile: string
}
export interface ClaudeState {
  applied: boolean
  connected: boolean
  claudeCliExists: boolean
  files: { mcpJson: boolean; claudeMd: boolean; wrapper: boolean; systemPrompt: boolean }
  error?: string
}
interface Manifest {
  hadMcpJson: boolean; mcpJsonBackup?: string
  hadClaudeMd: boolean; claudeMdBackup?: string
  hadWrapper: boolean; wrapperBackup?: string
  dataFile: string; createdAt: number
}

const intDir = (target: string) => resolve(target, INT_DIR_NAME)
const manifestFile = (target: string) => join(intDir(target), "manifest.json")
const dirCount = (d: string): number => { try { return readdirSync(d).length } catch { return 0 } }

/** strip an existing app-board segment from a file body (marker based) */
export const stripSegment = (text: string): string => {
  let out = text
  const s = out.indexOf(SEG_START)
  if (s >= 0) {
    const e = out.indexOf(SEG_END, s)
    if (e >= 0) out = out.slice(0, s) + out.slice(e + SEG_END.length)
  }
  return out.replace(/\n{3,}/g, "\n").trim()
}

export const CLAUDE_SEGMENT = [
  SEG_START,
  "## app-board coordination - REQUIRED for any work in this repository",
  "This repository work items are governed by app-board (MCP tools named board_*).",
  "The tools arrive from the board MCP server. If they are missing, the board is",
  "NOT connected and you must treat this repository as read-only: STOP and report",
  "the message board MCP unavailable instead of starting work.",
  "Before doing any work here you MUST declare yourself on the board:",
  "1. Register as the executor claude-code via board_register_executor.",
  "2. CLAIM exactly one work item for what you are about to do: find it with",
  "   board_view / board_get_item and take it with board_start (pass itemId and",
  "   executorId claude-code). If no item exists yet, create one with",
  "   board_create_item (title it precisely).",
  "3. Keep the item in doing only while you actually work. When finished (or on",
  "   failure) report board_report_done / board_report_failed with concrete",
  "   detail. Never leave an item doing when you stop; never run two at once.",
  "4. You may hold resource claims only through that item; the governor grants",
  "   them atomically or parks you (blocked, waiting). If parked, poll",
  "   board_get_item until it flips to doing - do not bypass the board.",
  "Violating the above (unclaimed work, skipped reporting, edits without a",
  "doing item) is a release-blocking defect for this repository.",
  SEG_END
].join("\n")

export const SYSTEM_PROMPT = [
  "app-board integration (enforced by scripts/board-claude.sh):",
  "- The board_* MCP tools MUST be available; without them do not modify this repository.",
  "- Before work: register executor claude-code and claim exactly one work item via board_start.",
  "- After work: report board_report_done/failed. Never leave items in doing.",
  "- The governor parks you (blocked) when a claim group does not fit; wait for the grant."
].join("\n")

/** apply is idempotent: any previous application is reverted first */
export const applyClaudeIntegration = (target: string, p: ClaudeCliPaths): ClaudeState => {
  const dir = intDir(target)
  mkdirSync(dir, { recursive: true })
  if (existsSync(manifestFile(target))) revertClaudeIntegration(target)

  const mcpJson = resolve(target, ".mcp.json")
  const claudeMd = resolve(target, "CLAUDE.md")
  const wrapper = resolve(target, "scripts", "board-claude.sh")
  mkdirSync(resolve(target, "scripts"), { recursive: true })
  const promptFile = join(dir, "system-prompt.md")
  const hadMcp = existsSync(mcpJson)
  const hadClaudeMd = existsSync(claudeMd)
  const hadWrapper = existsSync(wrapper)
  const manifest: Manifest = {
    hadMcpJson: hadMcp, mcpJsonBackup: hadMcp ? readFileSync(mcpJson, "utf-8") : undefined,
    hadClaudeMd: hadClaudeMd, claudeMdBackup: hadClaudeMd ? readFileSync(claudeMd, "utf-8") : undefined,
    hadWrapper: hadWrapper, wrapperBackup: hadWrapper ? readFileSync(wrapper, "utf-8") : undefined,
    dataFile: p.dataFile, createdAt: Date.now()
  }
  writeFileSync(mcpJson, JSON.stringify({ mcpServers: { board: { command: p.bunCli, args: [p.mcpEntry], env: { BOARD_DATA_FILE: p.dataFile } } } }, null, 2) + "\n")
  const prior = hadClaudeMd ? stripSegment(readFileSync(claudeMd, "utf-8")) : ""
  writeFileSync(claudeMd, (prior === "" ? CLAUDE_SEGMENT : prior + "\n\n" + CLAUDE_SEGMENT) + "\n")
  writeFileSync(promptFile, SYSTEM_PROMPT + "\n")
  writeFileSync(wrapper, wrapperScript(target, p))
  chmodSync(wrapper, 0o755)
  writeFileSync(manifestFile(target), JSON.stringify(manifest, null, 2) + "\n")
  return claudeStatus(target, p)
}

const wrapperScript = (target: string, p: ClaudeCliPaths): string => [
  "#!/usr/bin/env bash",
  "# app-board gate for Claude Code: refuse to start unless the board is reachable",
  "# and the claude-code executor is declared. Applied by the board web panel",
  "# (Integrations > Claude Code); revert from the same place.",
  "set -euo pipefail",
  'ROOT="$(cd "$(dirname "$0")/.." && pwd)"',
  'BUN="' + p.bunCli + '"',
  'CLAUDE_BIN="' + p.claudeCli + '"',
  'INT="$ROOT/.board-data/claude-int"',
  '[ -f "$INT/system-prompt.md" ] || { echo "board-claude: integration not applied (missing $INT/system-prompt.md)" >&2; exit 1; }',
  '[ -x "$CLAUDE_BIN" ] || { echo "board-claude: claude not found at $CLAUDE_BIN" >&2; exit 1; }',
  'echo "board-claude: preflight - connecting to app-board..." >&2',
  'if ! "$BUN" "' + p.preflightEntry + '" --data-file "' + p.dataFile + '" --mcp "' + p.mcpEntry + '"; then',
  '  echo "board-claude: ABORT - app-board unreachable or claude-code not declared; refusing to run Claude Code." >&2',
  "  exit 1",
  "fi",
  'exec "$CLAUDE_BIN" --append-system-prompt-file "$INT/system-prompt.md" "$@"'
].join("\n") + "\n"

/** revert restores whatever was there before apply */
export const revertClaudeIntegration = (target: string): ClaudeState => {
  const mp = manifestFile(target)
  const empty: ClaudeCliPaths = { bunCli: "", claudeCli: "", mcpEntry: "", preflightEntry: "", dataFile: "" }
  if (!existsSync(mp)) return claudeStatus(target, empty)
  const manifest = JSON.parse(readFileSync(mp, "utf-8")) as Manifest
  const mcpJson = resolve(target, ".mcp.json")
  const claudeMd = resolve(target, "CLAUDE.md")
  const wrapper = resolve(target, "scripts", "board-claude.sh")
  if (existsSync(mcpJson)) rmSync(mcpJson, { force: true })
  if (manifest.hadMcpJson && manifest.mcpJsonBackup !== undefined) writeFileSync(mcpJson, manifest.mcpJsonBackup)
  if (existsSync(claudeMd)) {
    const cleaned = stripSegment(readFileSync(claudeMd, "utf-8"))
    if (manifest.hadClaudeMd && manifest.claudeMdBackup !== undefined) writeFileSync(claudeMd, manifest.claudeMdBackup)
    else if (cleaned === "") rmSync(claudeMd, { force: true })
    else writeFileSync(claudeMd, cleaned + "\n")
  }
  if (existsSync(wrapper)) rmSync(wrapper, { force: true })
  if (manifest.hadWrapper && manifest.wrapperBackup !== undefined) writeFileSync(wrapper, manifest.wrapperBackup)
  rmSync(join(intDir(target), "system-prompt.md"), { force: true })
  rmSync(mp, { force: true })
  if (dirCount(intDir(target)) === 0) { try { rmSync(intDir(target)) } catch { /* empty dir left in place */ } }
  return claudeStatus(target, empty)
}

export const claudeStatus = (target: string, p: ClaudeCliPaths): ClaudeState => {
  const applied = existsSync(manifestFile(target))
  return {
    applied,
    connected: false,
    claudeCliExists: p.claudeCli !== "" && existsSync(p.claudeCli),
    files: {
      mcpJson: existsSync(resolve(target, ".mcp.json")),
      claudeMd: existsSync(resolve(target, "CLAUDE.md")),
      wrapper: existsSync(resolve(target, "scripts", "board-claude.sh")),
      systemPrompt: applied && existsSync(join(intDir(target), "system-prompt.md"))
    }
  }
}

/** live probe: spawn a throwaway board MCP and declare claude-code on it */
export const probeClaudeGate = (p: ClaudeCliPaths): boolean => {
  const res = spawnSync(p.bunCli, [p.preflightEntry, "--data-file", p.dataFile, "--mcp", p.mcpEntry], {
    encoding: "utf-8", timeout: 30_000, env: { ...process.env, BOARD_DATA_FILE: p.dataFile }
  })
  return res.status === 0
}
