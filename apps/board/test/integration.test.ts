/**

 * Claude Code integration: apply is idempotent and reversible; originals are
 * preserved and restored on revert; the gate wrapper refuses to launch claude
 * when the board preflight fails.
 */
import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { applyClaudeIntegration, revertClaudeIntegration, claudeStatus, SEG_START } from "../src/hosts/web/integration/claude.ts"

const newTarget = () => mkdtempSync(join(tmpdir(), "claude-int-"))

const optsFor = (dir: string) => ({
  bunCli: process.execPath,
  claudeCli: process.execPath, // runnable stand-in for the real CLI
  mcpEntry: join(dir, "board-mcp-main.ts"),
  preflightEntry: join(dir, "board-preflight.ts"),
  dataFile: join(dir, "board.json")
})
const countSeg = (text: string) => text.split(SEG_START).length - 1

describe("claude code integration files", () => {
  test("apply writes .mcp.json, CLAUDE.md segment, gate wrapper and manifest", () => {
    const dir = newTarget()
    const st = applyClaudeIntegration(dir, optsFor(dir))
    expect(st.applied).toBe(true)
    const mcp = JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf-8")) as { mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }> }
    expect(mcp.mcpServers.board.env.BOARD_DATA_FILE).toBe(join(dir, "board.json"))
    const claudeMd = readFileSync(join(dir, "CLAUDE.md"), "utf-8")
    expect(countSeg(claudeMd)).toBe(1)
    expect(claudeMd).toContain("board_register_executor")
    const wrapper = readFileSync(join(dir, "scripts", "board-claude.sh"), "utf-8")
    expect(wrapper.startsWith("#!/usr/bin/env bash")).toBe(true)
    expect(wrapper).toContain("board-preflight.ts")
    expect(wrapper).toContain("refusing to run Claude Code")
    expect(existsSync(join(dir, ".board-data", "claude-int", "system-prompt.md"))).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  test("double apply keeps exactly one segment (idempotent)", () => {
    const dir = newTarget()
    writeFileSync(join(dir, "CLAUDE.md"), "user authored notes\n")
    applyClaudeIntegration(dir, optsFor(dir))
    applyClaudeIntegration(dir, optsFor(dir))
    const text = readFileSync(join(dir, "CLAUDE.md"), "utf-8")
    expect(countSeg(text)).toBe(1)
    expect(text).toContain("user authored notes")
    rmSync(dir, { recursive: true, force: true })
  })

  test("revert restores pre-existing CLAUDE.md/.mcp.json and removes gate", () => {
    const dir = newTarget()
    writeFileSync(join(dir, "CLAUDE.md"), "original prose line\n")
    writeFileSync(join(dir, ".mcp.json"), JSON.stringify({ legacy: true }))
    applyClaudeIntegration(dir, optsFor(dir))
    const st = revertClaudeIntegration(dir)
    expect(st.applied).toBe(false)
    expect(readFileSync(join(dir, "CLAUDE.md"), "utf-8")).toBe("original prose line\n")
    expect(JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf-8"))).toEqual({ legacy: true })
    expect(existsSync(join(dir, "scripts", "board-claude.sh"))).toBe(false)
    expect(existsSync(join(dir, ".board-data", "claude-int", "manifest.json"))).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })

  test("revert without apply is a no-op reporting applied=false", () => {
    const dir = newTarget()
    const st = revertClaudeIntegration(dir)
    expect(st.applied).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })

  test("status reflects files and applied flag", () => {
    const dir = newTarget()
    expect(claudeStatus(dir, optsFor(dir)).applied).toBe(false)
    applyClaudeIntegration(dir, optsFor(dir))
    const st = claudeStatus(dir, optsFor(dir))
    expect(st.applied).toBe(true)
    expect(st.files.mcpJson).toBe(true)
    expect(st.files.wrapper).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })
})
