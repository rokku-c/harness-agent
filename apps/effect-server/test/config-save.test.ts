import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { z } from "@effect-agent/effect-config"
import { memoryConfigs as makeConfigRegistry } from "./config-helpers.ts"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { makeConsolePlugin } from "../src/console-plugin.ts"

const setup = async () => {
  const configs = makeConfigRegistry()
  configs.register({ appId: "demo", schema: z.object({ enabled: z.boolean().default(false), port: z.number().default(1) }) })
  const host = makePluginHost()
  await host.register(makeConsolePlugin({ configs, registry: makeEffectRegistry() }))
  const request = (id: string, method = "GET", body?: unknown) => host.handle(new Request(`http://test/console/api/config/${id}`, {
    method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  }))
  return { host, request }
}
test("configuration save validates JSON shape and values before touching authority", async () => {
  const { host, request } = await setup()
  try {
    expect((await request("missing", "POST", { override: {}, strategy: "apply" })).status).toBe(404)
    expect((await request("demo", "POST", { override: [], strategy: "apply" })).status).toBe(400)
    expect((await request("demo", "POST", { override: { port: "bad" }, strategy: "apply" })).status).toBe(400)
    expect((await (await request("demo")).json()).value).toEqual({ enabled: false, port: 1 })
    expect((await request("demo", "POST", { override: { enabled: true, port: 2 }, strategy: "restart" })).status).toBe(200)
    const out = await (await request("demo")).json()
    expect(out.value).toEqual({ enabled: true, port: 2 })
    expect(out.pendingRestart).toBe(true)
    expect((await (await request("demo/apply", "POST")).json()).pendingRestart).toBe(false)
    expect((await request("demo", "POST", { override: {}, unset: ["enabled"], strategy: "apply" })).status).toBe(200)
    expect((await (await request("demo")).json()).value.enabled).toBe(false)
    expect((await request("demo", "POST", { override: {}, unset: "enabled", strategy: "apply" })).status).toBe(400)
    expect((await request("demo", "DELETE")).status).toBe(405)
  } finally { await host.close() }
})
