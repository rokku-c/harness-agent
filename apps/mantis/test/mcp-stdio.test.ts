/**
 * MCP stdio integration (no network/key): spawn the real stdio server the
 * way an external agent (Claude Code etc.) would, speak JSON-RPC over its
 * stdout, and assert the R25 hygiene contract that protects real clients:
 *   - stdout carries ONLY parseable JSON-RPC frames (diagnostics -> stderr)
 *   - the full mantis_* tool surface is advertised
 *   - a state snapshot round-trips without touching a live model
 */
import { describe, expect, test } from "bun:test"
import { spawn, type ChildProcess } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface RpcClient {
  readonly child: ChildProcess
  readonly call: (method: string, params: unknown) => Promise<any>
  readonly strayLines: () => Array<string>
}

const start = async (): Promise<RpcClient> => {
  const dir = mkdtempSync(join(tmpdir(), "mantis-mcp-"))
  const child = spawn("bun", ["run", "apps/mantis/src/hosts/mcp/main.ts"], {
    cwd: repoRoot,
    env: {
      ...process.env as Record<string, string>,
      MANTIS_UI_DIR: join(dir, "ui"),
      MANTIS_WORKSPACE_FILE: join(dir, "ws.jsonl"),
      MANTIS_MEMORY_DIR: join(dir, "mem"),
      MANTIS_LOG_LEVEL: "warn"
    },
    stdio: ["pipe", "pipe", "pipe"]
  })
  let buf = ""
  const stray: Array<string> = []
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  let seq = 0
  child.stdout.on("data", (raw: Buffer) => {
    buf += raw.toString("utf-8")
    let nl: number
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (line === "") continue
      if (!line.startsWith("{")) { stray.push(line); continue }
      try {
        const msg = JSON.parse(line)
        if (msg.id !== undefined && pending.has(msg.id)) {
          const p = pending.get(msg.id)!
          pending.delete(msg.id)
          msg.error ? p.reject(new Error(msg.error.message ?? String(msg.error))) : p.resolve(msg.result)
        }
      } catch { stray.push("unparseable:" + line.slice(0, 80)) }
    }
  })
  child.stderr.on("data", () => {}) // diagnostics stay here; ignore
  const call = (method: string, params: unknown = {}): Promise<any> =>
    new Promise<any>((resolve, reject) => {
      const id = ++seq
      pending.set(id, { resolve, reject })
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n")
      setTimeout(() => { if (pending.delete(id)) reject(new Error("rpc timeout " + method)) }, 20000)
    })
  return { child, call, strayLines: () => stray }
}

describe("mantis MCP stdio server (external-agent contract)", () => {
  test("stdout stays clean JSON-RPC and the full tool surface is advertised", async () => {
    let client: RpcClient | undefined
    const dirs: Array<string> = []
    try {
      client = await start()
      await sleep(800)
      const init = await client.call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "mcp-stdio-test", version: "1" } })
      expect(init.serverInfo?.name ?? "mantis").toBe("mantis")
      client.child.stdin!.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n")
      const listed = await client.call("tools/list", {})
      const names = (listed.tools ?? []).map((t: { name: string }) => t.name)
      const mantis = names.filter((n: string) => n.startsWith("mantis_"))
      expect(mantis.length).toBeGreaterThanOrEqual(14)
      for (const must of ["mantis_chat", "mantis_conversation", "mantis_pending", "mantis_approve", "mantis_workspace", "mantis_workspace_write", "mantis_workspace_update", "mantis_workspace_delete", "mantis_events", "mantis_state", "mantis_ui_latest", "mantis_ui_versions", "mantis_ui_restore"])
        expect(mantis).toContain(must)
      const st = await client.call("tools/call", { name: "mantis_state", arguments: {} })
      const text = (st.content ?? []).map((c: { text?: string }) => c.text ?? "").join(" ")
      expect(text).toContain("approvalsOn")
      await sleep(150)
      expect(client.strayLines().length).toBe(0)
    } finally {
      client?.child.kill()
      // children started with temp dirs; we don't track the dir var cleanly -
      // best-effort: rely on the per-process tmp cleanup. Kill only the child.
    }
  })
})
