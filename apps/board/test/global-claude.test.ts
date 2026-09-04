/**

 * Global (user-level) Claude Code integration: merges board into ~/.claude.json,
 * appends the declaration segment to ~/.claude/CLAUDE.md, reversible + idempotent.
 */
import { describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { applyGlobalClaudeIntegration, revertGlobalClaudeIntegration, globalClaudeStatus } from "../src/hosts/web/integration/claude-global.ts"

const opts = {
  bunCli: process.execPath,
  claudeCli: process.execPath,
  mcpEntry: "/abs/board-mcp-main.ts",
  preflightEntry: "/abs/board-preflight.ts",
  dataFile: "/abs/board.json"
}
const seg = "<!-- app-board:claude-code:start -->"
const newHome = () => {
  const h = mkdtempSync(join(tmpdir(), "claude-global-"))
  mkdirSync(join(h, ".claude"), { recursive: true })
  return h
}
const countSeg = (text: string) => text.split(seg).length - 1

describe("global claude code integration", () => {
  test("apply merges board server into ~/.claude.json and CLAUDE.md segment", () => {
    const h = newHome()
    writeFileSync(join(h, ".claude.json"), JSON.stringify({ mcpServers: { other: { command: "x" } } }))
    writeFileSync(join(h, ".claude", "CLAUDE.md"), "my global notes\n")
    const st = applyGlobalClaudeIntegration(h, opts)
    expect(st.applied).toBe(true)
    const cfg = JSON.parse(readFileSync(join(h, ".claude.json"), "utf-8"))
    expect(cfg.mcpServers.other.command).toBe("x")
    expect(cfg.mcpServers.board.env.BOARD_DATA_FILE).toBe("/abs/board.json")
    const md = readFileSync(join(h, ".claude", "CLAUDE.md"), "utf-8")
    expect(md).toContain("my global notes")
    expect(countSeg(md)).toBe(1)
    expect(existsSync(join(h, ".claude", "app-board-int", "manifest.json"))).toBe(true)
    rmSync(h, { recursive: true, force: true })
  })

  test("double apply keeps one segment and preserves unrelated keys", () => {
    const h = newHome()
    writeFileSync(join(h, ".claude.json"), JSON.stringify({ primaryApiKey: "k", mcpServers: { z: { x: 1 } } }))
    applyGlobalClaudeIntegration(h, opts)
    applyGlobalClaudeIntegration(h, opts)
    const cfg = JSON.parse(readFileSync(join(h, ".claude.json"), "utf-8"))
    expect(cfg.primaryApiKey).toBe("k")
    expect(Object.keys(cfg.mcpServers).sort()).toEqual(["board", "z"])
    expect(countSeg(readFileSync(join(h, ".claude", "CLAUDE.md"), "utf-8"))).toBe(1)
    rmSync(h, { recursive: true, force: true })
  })

  test("revert restores the exact original files", () => {
    const h = newHome()
    const origJson = JSON.stringify({ mcpServers: { mine: { command: "keep" } } })
    const origMd = "my notes, untouched\n"
    writeFileSync(join(h, ".claude.json"), origJson)
    writeFileSync(join(h, ".claude", "CLAUDE.md"), origMd)
    applyGlobalClaudeIntegration(h, opts)
    const st = revertGlobalClaudeIntegration(h, opts)
    expect(st.applied).toBe(false)
    expect(readFileSync(join(h, ".claude.json"), "utf-8")).toBe(origJson)
    expect(readFileSync(join(h, ".claude", "CLAUDE.md"), "utf-8")).toBe(origMd)
    expect(existsSync(join(h, ".claude", "app-board-int", "manifest.json"))).toBe(false)
    rmSync(h, { recursive: true, force: true })
  })

  test("status detects applied state", () => {
    const h = newHome()
    expect(globalClaudeStatus(h, opts, false).applied).toBe(false)
    applyGlobalClaudeIntegration(h, opts)
    const st = globalClaudeStatus(h, opts, false)
    expect(st.applied).toBe(true)
    expect(st.boardInUserJson).toBe(true)
    expect(st.userClaudeMd).toBe(true)
    rmSync(h, { recursive: true, force: true })
  })
})
