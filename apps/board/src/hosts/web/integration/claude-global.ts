/**

 * Global (user-level) Claude Code integration: registers the board MCP server
 * in ~/.claude.json and appends the declaration segment to ~/.claude/CLAUDE.md
 * so board_* tools + rules are present in EVERY directory, not just the repo.
 * Same reversible semantics as the repo-level integration: whole originals are
 * backed up under ~/.claude/app-board-int and restored on revert. Home is
 * injected so tests run against a temp dir.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CLAUDE_SEGMENT, SEG_START, probeClaudeGate, stripSegment, type ClaudeCliPaths, type ClaudeState } from "./claude.ts"

const intDir = (home: string) => join(home, ".claude", "app-board-int")
const userJson = (home: string) => join(home, ".claude.json")
const userMd = (home: string) => join(home, ".claude", "CLAUDE.md")

export interface GlobalClaudeState {
  scope: "global"
  home: string
  applied: boolean
  connected: boolean
  boardInUserJson: boolean
  userClaudeMd: boolean
  files: ClaudeState["files"]
  error?: string
}

const toState = (home: string, p: ClaudeCliPaths, applied: boolean, probe: boolean, error?: string): GlobalClaudeState => {
  let connected = false
  if (probe && applied && p.bunCli !== "") {
    try { connected = probeClaudeGate(p) } catch { /* keep false */ }
  }
  let boardInUserJson = false
  try {
    const cfg = JSON.parse(readFileSync(userJson(home), "utf-8")) as { mcpServers?: Record<string, unknown> }
    boardInUserJson = cfg.mcpServers !== undefined && cfg.mcpServers["board"] !== undefined
  } catch { /* absent/unparseable */ }
  const md = existsSync(userMd(home)) ? readFileSync(userMd(home), "utf-8") : ""
  return {
    scope: "global",
    home,
    applied,
    connected,
    boardInUserJson,
    userClaudeMd: md.indexOf(SEG_START) >= 0,
    files: {
      mcpJson: boardInUserJson,
      claudeMd: md.indexOf(SEG_START) >= 0,
      wrapper: false,
      systemPrompt: false
    },
    error
  }
}

/** server def identical to the repo .mcp.json entry */
const serverDef = (p: ClaudeCliPaths) => ({
  command: p.bunCli,
  args: [p.mcpEntry],
  env: { BOARD_DATA_FILE: p.dataFile }
})

/** apply to the USER level (idempotent: reverted first) */
export const applyGlobalClaudeIntegration = (home: string, p: ClaudeCliPaths): GlobalClaudeState => {
  const dir = intDir(home)
  mkdirSync(dir, { recursive: true })
  mkdirSync(join(home, ".claude"), { recursive: true })
  if (existsSync(join(dir, "manifest.json"))) revertGlobalClaudeIntegration(home)

  // backup whole originals (first time only, before touching anything)
  const jsonPath = userJson(home)
  const hadJson = existsSync(jsonPath)
  if (hadJson) writeFileSync(join(dir, "claude.json.orig"), readFileSync(jsonPath, "utf-8"))
  const mdPath = userMd(home)
  const hadMd = existsSync(mdPath)
  if (hadMd) writeFileSync(join(dir, "CLAUDE.md.orig"), readFileSync(mdPath, "utf-8"))

  // merge board server into ~/.claude.json
  let cfg: { mcpServers?: Record<string, unknown> } = {}
  if (hadJson) cfg = JSON.parse(readFileSync(jsonPath, "utf-8"))
  cfg.mcpServers = { ...(cfg.mcpServers ?? {}), board: serverDef(p) }
  writeFileSync(jsonPath, JSON.stringify(cfg, null, 2) + "\n")

  // merge declaration segment into ~/.claude/CLAUDE.md
  const prior = hadMd ? stripSegment(readFileSync(mdPath, "utf-8")) : ""
  writeFileSync(mdPath, (prior === "" ? CLAUDE_SEGMENT : prior + "\n\n" + CLAUDE_SEGMENT) + "\n")

  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ hadJson, hadMd, at: Date.now() }, null, 2) + "\n")
  return toState(home, p, true, false)
}

/** revert: restore originals from backups (or surgically remove board parts) */
export const revertGlobalClaudeIntegration = (home: string, p?: ClaudeCliPaths): GlobalClaudeState => {
  const dir = intDir(home)
  const empty: ClaudeCliPaths = { bunCli: "", claudeCli: "", mcpEntry: "", preflightEntry: "", dataFile: "" }
  if (!existsSync(join(dir, "manifest.json"))) return toState(home, p ?? empty, false, false)

  const jsonOrig = join(dir, "claude.json.orig")
  const jsonPath = userJson(home)
  if (existsSync(jsonOrig)) writeFileSync(jsonPath, readFileSync(jsonOrig, "utf-8"))
  else if (existsSync(jsonPath)) {
    const cfg = JSON.parse(readFileSync(jsonPath, "utf-8")) as { mcpServers?: Record<string, unknown> }
    if (cfg.mcpServers !== undefined) {
      delete cfg.mcpServers["board"]
      if (Object.keys(cfg.mcpServers).length === 0) delete cfg.mcpServers
      writeFileSync(jsonPath, JSON.stringify(cfg, null, 2) + "\n")
    }
  }
  const mdOrig = join(dir, "CLAUDE.md.orig")
  const mdPath = userMd(home)
  if (existsSync(mdOrig)) writeFileSync(mdPath, readFileSync(mdOrig, "utf-8"))
  else if (existsSync(mdPath)) {
    const cleaned = stripSegment(readFileSync(mdPath, "utf-8"))
    if (cleaned === "") rmSync(mdPath, { force: true })
    else writeFileSync(mdPath, cleaned + "\n")
  }
  rmSync(join(dir, "claude.json.orig"), { force: true })
  rmSync(join(dir, "CLAUDE.md.orig"), { force: true })
  rmSync(join(dir, "manifest.json"), { force: true })
  return toState(home, p ?? empty, false, false)
}

export const globalClaudeStatus = (home: string, p: ClaudeCliPaths, probe: boolean): GlobalClaudeState => {
  const applied = existsSync(join(intDir(home), "manifest.json"))
  if (!applied && probe) return toState(home, p, false, probe)
  return toState(home, p, applied, probe)
}
