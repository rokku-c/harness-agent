import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { createAgentdPlugin } from "../src/effect-plugin.ts"
import { effectApp } from "../src/effect-app.ts"
import { effectConfig } from "../src/effect-config.ts"

test("agentd pushes code artifacts and refuses one the machine cannot run", async () => {
  const host = makePluginHost()
  const config = effectConfig.schema.parse({
    machines: [{ machineId: "m1", name: "Local", capabilities: ["abi:effect-1", "runtime:os"] }],
    agents: [{ agentId: "a1", machineId: "m1", kind: "effect", version: "1" }],
    bundles: [
      { bundleId: "io.effect-agent.kernel", version: "1.0.0", abi: "effect-1", kind: "kernel", bootstrapAbi: "bootstrap-1" },
      { bundleId: "board", version: "1.0.0", abi: "effect-1" },
      // built for the browser: this machine runs OS, so the push must be refused
      { bundleId: "widget", version: "1.0.0", abi: "effect-1", runtimes: ["browser"] },
    ],
    bundleBindings: [{ agentId: "a1", bundleIds: ["io.effect-agent.kernel@1.0.0", "board@1.0.0"] }],
  })
  await host.register({ ...createAgentdPlugin(() => config), routes: effectApp.routes })
  try {
    const plan = await (await host.handle(new Request("http://host/agentd/plan?agentId=a1"))).json() as {
      ok: boolean; revision: number; changes: readonly string[]; desired: { artifacts: ReadonlyArray<{ kind: string }> }
    }
    expect(plan.ok).toBe(true)
    expect(plan.changes).toEqual(["install io.effect-agent.kernel@1.0.0 (kernel)", "install board@1.0.0 (app)"])
    expect(plan.desired.artifacts.map((a) => a.kind)).toEqual(["kernel", "app"])
    const accepted = await host.handle(new Request("http://host/agentd/report", { method: "POST", body: JSON.stringify({ agentId: "a1", revision: plan.revision }) }))
    expect(accepted.status).toBe(200)
  } finally { await host.close() }
})

test("rebinding to another artifact version is a binding change, and the plan shows the diff", async () => {
  const plugin = createAgentdPlugin(() => effectConfig.schema.parse({
    machines: [{ machineId: "m1", name: "Local", capabilities: ["abi:effect-1", "runtime:os"] }],
    agents: [{ agentId: "a1", machineId: "m1", kind: "effect", version: "1" }],
    bundles: [
      { bundleId: "board", version: "0.13.0", abi: "effect-1" },
      { bundleId: "board", version: "1.0.0", abi: "effect-1" },
    ],
    bundleBindings: [{ agentId: "a1", bundleIds: ["board@1.0.0"] }],
  }))
  const host = makePluginHost(); await host.register({ ...plugin, routes: effectApp.routes })
  try {
    const plane = await plugin.load?.() as { tools: ReadonlyArray<{ name: string; handler: (args: unknown) => unknown }> }
    const bind = plane.tools.find((t) => t.name === "agentd_bind_bundles")!
    const planTool = plane.tools.find((t) => t.name === "agentd_plan_bundles")!
    const forward = await (await host.handle(new Request("http://host/agentd/plan?agentId=a1"))).json() as { revision: number; desired: unknown }
    expect((forward.desired as { artifacts: ReadonlyArray<{ version: string }> }).artifacts[0].version).toBe("1.0.0")
    bind.handler({ agentId: "a1", bundleIds: ["board@0.13.0"] })
    const back = planTool.handler({ agentId: "a1", reported: forward.desired }) as { changes: readonly string[]; desired: { artifacts: ReadonlyArray<{ version: string }> } }
    expect(back.changes).toEqual(["install board@0.13.0 (app)", "remove board@1.0.0"])
    expect(back.desired.artifacts[0].version).toBe("0.13.0")
  } finally { await host.close() }
})

test("a push of an artifact the machine cannot run is refused with the reason, not a generic error", async () => {
  const host = makePluginHost()
  const config = effectConfig.schema.parse({
    machines: [{ machineId: "m1", name: "Local", capabilities: ["runtime:browser"] }],
    agents: [{ agentId: "a1", machineId: "m1", kind: "effect", version: "1" }],
    bundles: [{ bundleId: "board", version: "1.0.0", abi: "effect-1", runtimes: ["os"] }],
    bundleBindings: [{ agentId: "a1", bundleIds: ["board@1.0.0"] }],
  })
  await host.register({ ...createAgentdPlugin(() => config), routes: effectApp.routes })
  try {
    const refused = await host.handle(new Request("http://host/agentd/plan?agentId=a1"))
    expect(refused.status).toBe(400)
    expect(((await refused.json()) as { error: string }).error).toContain('declares runtimes [os] but the host runtime is "browser"')
  } finally { await host.close() }
})

test("a config that conflates the two ABI lines is rejected at parse time", () => {
  const base = { agents: [{ agentId: "a1", machineId: "m1", kind: "effect", version: "1" }] }
  expect(() => effectConfig.schema.parse({ ...base, bundles: [{ bundleId: "k", version: "1", abi: "effect-1", kind: "kernel" }] }))
    .toThrow(/must declare bootstrapAbi/)
  expect(() => effectConfig.schema.parse({ ...base, bundles: [{ bundleId: "b", version: "1", abi: "effect-1", bootstrapAbi: "bootstrap-1" }] }))
    .toThrow(/must not declare bootstrapAbi/)
})
