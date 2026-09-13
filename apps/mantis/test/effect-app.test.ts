import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createMantisPlugin } from "../src/effect-plugin.ts"

test("embedded mantis app serves its real panel and MCP-backed API under /mantis", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mantis-app-"))
  const plugin = createMantisPlugin(() => ({ workspaceDir: dir, model: {} }))
  const plane = await plugin.load()
  try {
    const page = await plane.handle(new Request("http://host/mantis", { headers: { accept: "text/html" } }))
    expect(page.status).toBe(200)
    expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8")
    const client = await plane.handle(new Request("http://host/mantis/app-shell.js"))
    expect(client.status).toBe(200)
    const health = await plane.handle(new Request("http://host/mantis/api/health"))
    expect(await health.json()).toMatchObject({ ok: true })
  } finally {
    await plane.stop?.()
    rmSync(dir, { recursive: true, force: true })
  }
})

