import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { makeEgressRouter } from "@effect-agent/effect-network"
import { registerEffectApp } from "../src/index.ts"

test("app SDK registers routes/tools and binds all outbound requests to its egress policy", async () => {
  const host = makePluginHost(), registry = makeEffectRegistry()
  const seen: string[] = []
  const network = makeEgressRouter({ role: "main", localSend: async (input) => {
    seen.push(new Request(input).url); return Response.json({ outgoing: true })
  } })
  const dispose = await registerEffectApp({ host, registry, network }, {
    id: "demo", egress: "local-only", routes: [{ path: "/demo" }],
    createPlugin: (_config, ctx) => ({ id: "demo", load: async () => ({
      handle: async () => ctx.fetch("https://test.invalid/path"),
      tools: [{ name: "read", handler: () => "value" }],
    }) }),
  })
  expect(await (await host.handle(new Request("http://port-a/demo"))).json()).toEqual({ outgoing: true })
  expect(seen).toEqual(["https://test.invalid/path"])
  expect(registry.tools().map((t) => t.key)).toEqual(["demo.read"])
  await host.disable("demo")
  expect(registry.tools()).toEqual([])
  await host.enable("demo")
  expect(registry.tools().map((t) => t.key)).toEqual(["demo.read"])
  await dispose()
  expect(host.routes()).toEqual([])
  expect(registry.tools()).toEqual([])
  await expect(network.fetch("demo", "https://test.invalid")).rejects.toThrow()
  await host.close()
})
