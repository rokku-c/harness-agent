import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createMantisPlugin } from "../src/effect-plugin.ts"

test("embedded mantis app serves the MCP-backed API under /mantis, and no panel", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mantis-app-"))
  const plugin = createMantisPlugin(() => ({ workspaceDir: dir, model: {} }))
  const plane = await plugin.load()
  try {
    const health = await plane.handle(new Request("http://host/mantis/api/health"))
    expect(await health.json()).toMatchObject({ ok: true })
    // the platform console renders mantis from its declarative view; the
    // standalone host's built panel is not served a second time here
    for (const path of ["http://host/mantis", "http://host/mantis/app-shell.js"]) {
      expect((await plane.handle(new Request(path))).status).toBe(404)
    }
    // and nothing outside the mount is answered at all
    expect((await plane.handle(new Request("http://host/api/health"))).status).toBe(404)
  } finally {
    await plane.stop?.()
    rmSync(dir, { recursive: true, force: true })
  }
})

