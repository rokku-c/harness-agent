import { expect, test } from "bun:test"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import { makePluginHost } from "@effect-agent/effect-host"
import { makeMonitorPlane } from "../src/monitor-plane.ts"
import { memoryConfigs } from "./config-helpers.ts"

test("mirror resolves the same scoped, validated action as the agent", async () => {
  const registry = makeEffectRegistry(), host = makePluginHost()
  let calls = 0
  registry.registerInterface({ id: "a", tools: [{ name: "echo", input: z.object({ text: z.string() }), handler: (input) => { calls++; return (input as { text: string }).text } }] })
  registry.registerInterface({ id: "b", tools: [{ name: "secret", handler: () => { calls++; return "secret" } }] })
  await host.register(makeMonitorPlane({ registry, configs: memoryConfigs(), authorize: (id) => id === "a" }))
  const call = (id: string, tool: string, args: unknown) => host.handle(new Request(`http://test/-/mirror/${id}/call`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool, args }),
  }))
  try {
    expect((await call("a", "secret", {})).status).toBe(400)
    expect((await call("b", "secret", {})).status).toBe(400)
    expect((await call("a", "echo", { text: 1 })).status).toBe(400)
    expect(calls).toBe(0)
    expect(await (await call("a", "echo", { text: "hello" })).json()).toEqual({ ok: true, result: "hello" })
    expect(calls).toBe(1)
    expect((await call("missing", "echo", {})).status).toBe(404)
    const view = await (await host.handle(new Request("http://test/-/mirror/a"))).json()
    expect(view.actions.map((a: { name: string }) => a.name)).toEqual(["echo"])
  } finally { await host.close() }
})
