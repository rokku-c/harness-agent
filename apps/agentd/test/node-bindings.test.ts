import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { createAgentdPlugin } from "../src/effect-plugin.ts"
import { effectApp } from "../src/effect-app.ts"
import { effectConfig } from "../src/effect-config.ts"

/** A node seeded from config with a kernel and one app placed at two namespaces. */
const nodeConfig = (over: Record<string, unknown> = {}) => effectConfig.schema.parse({
  machines: [{ machineId: "node-1", name: "Container", capabilities: ["abi:effect-1", "bootstrap:bootstrap-1", "runtime:os"], namespaces: ["ops", "workspace-b"] }],
  bundles: [
    { bundleId: "io.effect-agent.kernel", version: "1.0.0", abi: "effect-1", kind: "kernel", bootstrapAbi: "bootstrap-1" },
    { bundleId: "board", version: "1.0.0", abi: "effect-1" },
  ],
  nodeBindings: [{
    nodeId: "node-1",
    kernelId: "io.effect-agent.kernel@1.0.0",
    apps: [{ bundleId: "board", version: "1.0.0", ns: "ops" }, { bundleId: "board", version: "1.0.0", ns: "workspace-b" }],
  }],
  ...over,
})

test("a node is seeded from config and its whole deployment is planned over HTTP", async () => {
  const host = makePluginHost()
  await host.register({ ...createAgentdPlugin(() => nodeConfig()), routes: effectApp.routes })
  try {
    const plan = await (await host.handle(new Request("http://host/agentd/node/plan?nodeId=node-1"))).json() as {
      ok: boolean; revision: number; changes: readonly string[]
      desired: { kernel: { kind: string }; apps: ReadonlyArray<{ ns: string }> }
    }
    expect(plan.ok).toBe(true)
    expect(plan.desired.kernel.kind).toBe("kernel")
    expect(plan.desired.apps.map((app) => app.ns)).toEqual(["ops", "workspace-b"])
    expect(plan.changes).toEqual(["install io.effect-agent.kernel@1.0.0 (kernel)", "place ops::board@1.0.0", "place workspace-b::board@1.0.0"])

    // The receipt goes back against that revision — the same 409 rule as agents.
    const accepted = await host.handle(new Request("http://host/agentd/node/report", { method: "POST", body: JSON.stringify({ nodeId: "node-1", revision: plan.revision }) }))
    expect(accepted.status).toBe(200)
    const stale = await host.handle(new Request("http://host/agentd/node/report", { method: "POST", body: JSON.stringify({ nodeId: "node-1", revision: plan.revision - 1 }) }))
    expect(stale.status).toBe(409)
  } finally { await host.close() }
})

test("a node-level refusal names the placement and the machine, not just the plan", async () => {
  const host = makePluginHost()
  // The node runs OS; the placed app declares browser-only.
  const config = nodeConfig({
    bundles: [
      { bundleId: "io.effect-agent.kernel", version: "1.0.0", abi: "effect-1", kind: "kernel", bootstrapAbi: "bootstrap-1" },
      { bundleId: "board", version: "1.0.0", abi: "effect-1", runtimes: ["browser"] },
    ],
  })
  await host.register({ ...createAgentdPlugin(() => config), routes: effectApp.routes })
  try {
    const refused = await host.handle(new Request("http://host/agentd/node/plan?nodeId=node-1"))
    expect(refused.status).toBe(400)
    const { error } = await refused.json() as { error: string }
    // Which placement, at which namespace, on which machine — the set makes this
    // question necessary, and a bare "cannot push" would not answer it.
    expect(error).toContain("cannot place ops::board@1.0.0 on node-1:")
    expect(error).toContain("runtime")
  } finally { await host.close() }
})

test("rolling one app back on a node is a binding change", async () => {
  const config = nodeConfig({
    bundles: [
      { bundleId: "io.effect-agent.kernel", version: "1.0.0", abi: "effect-1", kind: "kernel", bootstrapAbi: "bootstrap-1" },
      { bundleId: "board", version: "0.13.0", abi: "effect-1" },
      { bundleId: "board", version: "1.0.0", abi: "effect-1" },
    ],
    nodeBindings: [{ nodeId: "node-1", kernelId: "io.effect-agent.kernel@1.0.0", apps: [{ bundleId: "board", version: "1.0.0", ns: "ops" }] }],
  })
  const plugin = createAgentdPlugin(() => config)
  const host = makePluginHost(); await host.register({ ...plugin, routes: effectApp.routes })
  try {
    const plane = await plugin.load?.() as { tools: ReadonlyArray<{ name: string; handler: (args: unknown) => unknown }> }
    const bind = plane.tools.find((t) => t.name === "agentd_bind_node")!
    const planTool = plane.tools.find((t) => t.name === "agentd_plan_node")!
    const before = await (await host.handle(new Request("http://host/agentd/node/plan?nodeId=node-1"))).json() as { desired: unknown }
    expect((before.desired as { apps: ReadonlyArray<{ version: string }> }).apps[0].version).toBe("1.0.0")

    // Back to the older version — no second rollback mechanism, just a rebind.
    bind.handler({ nodeId: "node-1", kernelId: "io.effect-agent.kernel@1.0.0", apps: [{ bundleId: "board", version: "0.13.0", ns: "ops" }] })
    const after = planTool.handler({ nodeId: "node-1", reported: before.desired }) as { changes: readonly string[]; desired: { apps: ReadonlyArray<{ version: string }> } }
    expect(after.changes).toEqual(["place ops::board@0.13.0", "remove ops::board@1.0.0"])
    expect(after.desired.apps[0].version).toBe("0.13.0")
  } finally { await host.close() }
})

test("a node binding that puts a kernel in an app slot is refused at seed time", async () => {
  // The *shape* is legal — a placement just names a published artifact, and
  // `io.effect-agent.kernel@1.0.0` is published. It is the placement that is a
  // category error, so the refusal belongs to the control plane, which is the
  // only thing that can see the artifact's `kind`, rather than the config
  // schema, which deliberately cannot.
  const plugin = createAgentdPlugin(() => nodeConfig({
    nodeBindings: [{ nodeId: "node-1", kernelId: "io.effect-agent.kernel@1.0.0", apps: [{ bundleId: "io.effect-agent.kernel", version: "1.0.0", ns: "ops" }] }],
  }))
  await expect(plugin.load?.()).rejects.toThrow(/kernel artifact; a node app placement must be an app/)
})
