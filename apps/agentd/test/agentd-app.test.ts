import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { createAgentdPlugin } from "../src/effect-plugin.ts"
test("agentd is a port-free host plugin with a machine-control tool surface", async () => {
  const host = makePluginHost(); await host.register(createAgentdPlugin())
  expect((await (await host.handle(new Request("http://host/agentd"))).json()).app).toBe("agentd")
  expect(host.routes()).toEqual([{ appId: "agentd", path: "/agentd", match: "prefix" }])
  await host.close()
})
