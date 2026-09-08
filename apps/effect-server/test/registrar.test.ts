import { expect, test } from "bun:test"

import { makeEffectRegistry, invoke } from "@effect-agent/effect-interface"
import { registerMcpPlugin } from "../src/registrar.ts"

const FIXTURE = new URL("./fixtures/time-server.ts", import.meta.url).pathname

test("stdio plugin registers its tools as an effect-interface and proxies calls", async () => {
  const registry = makeEffectRegistry()
  const close = await registerMcpPlugin(registry, {
    id: "apps/time-server",
    transport: "stdio",
    command: process.execPath,
    args: [FIXTURE],
  })

  const schemas = registry.schemas()
  expect(schemas.map((s) => s.name).sort()).toEqual(["apps/time-server.echo", "apps/time-server.now"])
  // discovered tools carry JSON-Schema inputSchema (exportable, no zod needed)
  const echoSchema = schemas.find((s) => s.name === "apps/time-server.echo")
  expect(echoSchema?.parameters).toBeDefined()

  const entry = registry.tools().find((t) => t.key === "apps/time-server.echo")
  expect(entry).toBeDefined()
  const out = await invoke(entry!.tool, { text: "hi from stdio" })
  expect(out).toMatchObject({ ok: true, text: "hi from stdio" })

  // disposer unregisters exactly this interface and closes the child
  await close()
  expect(registry.schemas()).toHaveLength(0)
})
