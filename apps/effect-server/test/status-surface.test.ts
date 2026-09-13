import { expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { startEffectServerYaml } from "../src/main.ts"

const req = (path: string, init?: RequestInit) => new Request("http://127.0.0.1" + path, init)

test("read-only status lists enabled services while lifecycle control stays gated", async () => {
  const dir = mkdtempSync(join(tmpdir(), "effect-status-"))
  mkdirSync(join(dir, "apps"), { recursive: true })
  const file = join(dir, "effect.yaml")
  writeFileSync(file, JSON.stringify({ roots: ["apps"], enabled: [] }))
  try {
    const app = await startEffectServerYaml(file, { configFile: ":memory:" })
    try {
      const response = await app.host.handle(req("/-/status"))
      expect(response.status).toBe(200)
      const rows = (await response.json()) as Array<{ id: string; enabled: boolean; priority: number }>
      expect(rows.find((row) => row.id === "platform-network")).toMatchObject({ enabled: true })
      // describing the node is always safe; mutating it stays behind the control flag.
      expect((await app.host.handle(req("/-/planes"))).status).toBe(404)
      expect((await app.host.handle(req("/-/status", { method: "POST" }))).status).not.toBe(200)
    } finally { await app.stop() }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
