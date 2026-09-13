import { expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { z } from "@effect-agent/effect-config"
import { registerEffectApp } from "@effect-agent/effect-apps"
import { startEffectServerYaml } from "../src/main.ts"

const req = (path: string) => new Request("http://127.0.0.1" + path)

const withHome = async (body: (home: string, file: string) => Promise<void>) => {
  const dir = mkdtempSync(join(tmpdir(), "effect-operations-"))
  mkdirSync(join(dir, "apps"), { recursive: true })
  const file = join(dir, "effect.yaml")
  writeFileSync(file, JSON.stringify({ roots: ["apps"], enabled: [] }))
  try {
    await body(dir, file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test("the node operation surface lists the host's privileged plane, with schemas", async () => {
  await withHome(async (_home, file) => {
    const app = await startEffectServerYaml(file, { configFile: ":memory:" })
    try {
      const response = await app.host.handle(req("/-/operations"))
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe("application/json")

      const rows = (await response.json()) as Array<Record<string, unknown>>
      expect(rows.map((row) => row.address)).toEqual([
        "host::lifecycle::list",
        "host::lifecycle::enable",
        "host::lifecycle::disable",
        "host::lifecycle::reload",
        "host::lifecycle::unregister",
      ])
      for (const row of rows) {
        expect(row.privileged).toBe(true)
        expect(row.inputSchema).toBeDefined()
        expect(row.outputSchema).toBeDefined()
        expect(row.description).toBeTruthy()
        // describing is not doing: the served form carries no behaviour
        expect(row).not.toHaveProperty("invoke")
      }
      expect(rows[1].inputSchema).toEqual({
        type: "object",
        properties: { id: { type: "string", description: "target plugin id" } },
        required: ["id"],
        additionalProperties: false,
      })
    } finally { await app.stop() }
  })
})

test("an app's tools appear in the same table, unprivileged", async () => {
  await withHome(async (_home, file) => {
    const app = await startEffectServerYaml(file, { configFile: ":memory:" })
    const dispose = await registerEffectApp(
      { ...app, activeConfig: (id) => app.configRuntime.active(id) },
      {
        id: "notes",
        config: { appId: "notes", schema: z.object({ label: z.string().default("n") }) },
        plugin: {
          id: "notes",
          load: async () => ({
            canHandle: () => false,
            handle: async () => new Response(null),
            tools: [{
              name: "ping",
              description: "ping the notes app",
              inputSchema: { type: "object", properties: {}, additionalProperties: false },
              handler: async () => ({ ok: true }),
            }],
          }),
        },
      },
    )
    try {
      const rows = (await (await app.host.handle(req("/-/operations"))).json()) as Array<Record<string, unknown>>
      // the live catalog addresses apps as `<namespace>::<appId>`
      const ping = rows.find((row) => row.address === "ops::notes::interface::ping")

      expect(ping).toBeDefined()
      expect(ping!.privileged).toBe(false)
      expect(ping!.node).toBe("ops::notes")
      expect(ping!.description).toBe("ping the notes app")
      // the registry's normalized projection of the tool's input contract
      expect((ping!.inputSchema as { properties: unknown }).properties).toEqual({})
      // host operations are still there — one table, not two
      expect(rows.filter((row) => row.privileged)).toHaveLength(5)
    } finally { await dispose(); await app.stop() }
  })
})
