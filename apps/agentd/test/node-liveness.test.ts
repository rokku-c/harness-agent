/**
 * §8.5-1 over HTTP: the verbs a probe calls and the read an operator uses, on
 * the app's own surface. The lease *mechanism* is `packages/agentd`; what only
 * shows up here is the transport — that the credential is a header, that a
 * malformed declaration is the caller's 400 rather than the server's 500, and
 * that a node's own `status` and the server's observation stay two answers.
 */

import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { createAgentdPlugin } from "../src/effect-plugin.ts"
import { effectApp } from "../src/effect-app.ts"
import { effectConfig } from "../src/effect-config.ts"

const config = (over: Record<string, unknown> = {}) => effectConfig.schema.parse({
  machines: [{ machineId: "node-1", name: "Container", capabilities: ["abi:effect-1", "bootstrap:bootstrap-1", "runtime:os"], namespaces: ["ops"] }],
  bundles: [
    { bundleId: "io.effect-agent.kernel", version: "1.0.0", abi: "effect-1", kind: "kernel", bootstrapAbi: "bootstrap-1" },
    { bundleId: "board", version: "1.0.0", abi: "effect-1" },
  ],
  nodeBindings: [{ nodeId: "node-1", kernelId: "io.effect-agent.kernel@1.0.0", apps: [{ bundleId: "board", version: "1.0.0", ns: "ops" }] }],
  ...over,
})

const osNode = { machineId: "node-1", name: "Container", status: "online", capabilities: ["abi:effect-1", "bootstrap:bootstrap-1", "runtime:os"], namespaces: ["ops"] }
const post = (path: string, body: unknown, token?: string): Request =>
  new Request(`http://host/agentd/node/${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    ...(token === undefined ? {} : { headers: { authorization: `Bearer ${token}` } }),
  })

/** Run `body` against a freshly loaded plugin, and always close the host. */
const withHost = async (seed: unknown, body: (host: ReturnType<typeof makePluginHost>) => Promise<void>): Promise<void> => {
  const host = makePluginHost()
  await host.register({ ...createAgentdPlugin(() => seed), routes: effectApp.routes })
  try { await body(host) } finally { await host.close() }
}

test("a machine seeded from config is offline until it announces, and reports itself online the whole time", async () => {
  await withHost(config(), async (host) => {
    // The seeded machine says `status: "online"` because that is what the config
    // says about it. Nobody has heard from it.
    const status = await (await host.handle(new Request("http://host/agentd"))).json() as {
      machines: ReadonlyArray<{ machineId: string; status: string; reportedAt: number }>
      nodeLiveness: { tokenRequired: boolean; nodes: ReadonlyArray<{ nodeId: string; online: boolean; withdrawn: boolean }> }
    }
    expect(status.machines[0].status).toBe("online")
    expect(status.machines[0].reportedAt).toBe(0)
    expect(status.nodeLiveness).toEqual({ tokenRequired: false, nodes: [{ nodeId: "node-1", online: false, withdrawn: false }] })

    const announced = await host.handle(post("announce", { machine: osNode }))
    expect(announced.status).toBe(200)
    const { presence } = await announced.json() as { presence: { online: boolean; lastSeen: number } }
    expect(presence.online).toBe(true)
    // The observation, stamped by the server, is what `reportedAt` now carries.
    expect(presence.lastSeen).toBeGreaterThan(0)

    const after = await (await host.handle(new Request("http://host/agentd/node/presence?nodeId=node-1"))).json() as { presence: { online: boolean } }
    expect(after.presence.online).toBe(true)
  })
})

test("an offline node's desired set still reads — presence is not a gate on the deployment", async () => {
  await withHost(config(), async (host) => {
    // Never announced: the node is down as far as the lease is concerned.
    const down = await (await host.handle(new Request("http://host/agentd/node/presence?nodeId=node-1"))).json() as { presence: { online: boolean } }
    expect(down.presence.online).toBe(false)

    const desired = await (await host.handle(new Request("http://host/agentd/node?nodeId=node-1"))).json() as {
      ok: boolean; desired: { apps: ReadonlyArray<{ ns: string }>; revision: number }
    }
    expect(desired.ok).toBe(true)
    expect(desired.desired.apps.map((app) => app.ns)).toEqual(["ops"])
    // ...and can be receipted, because a node that says "I am down" is not a
    // node that has been withdrawn, and the desired set is the recovery source.
    const report = await host.handle(post("report", { nodeId: "node-1", revision: desired.desired.revision }))
    expect(report.status).toBe(200)
  })
})

test("a malformed declaration is a 400 naming the field, and does not half-announce", async () => {
  await withHost(config(), async (host) => {
    // `capabilities` omitted, as an older probe might: refused rather than
    // defaulted to `[]`, which would silently wipe what the node can run and
    // make every later plan refuse with no hint why.
    const refused = await host.handle(post("announce", { machine: { machineId: "node-1", name: "Container", status: "online" } }))
    expect(refused.status).toBe(400)
    const { error } = await refused.json() as { error: string }
    expect(error).toContain("capabilities")

    // A refused announce left no trace: the node is exactly as it was.
    const read = await (await host.handle(new Request("http://host/agentd/node/presence?nodeId=node-1"))).json() as { presence: { online: boolean } }
    expect(read.presence.online).toBe(false)
  })
})

test("a node does not get to state when it was seen", async () => {
  await withHost(config(), async (host) => {
    for (const path of ["announce", "heartbeat"]) {
      const refused = await host.handle(post(path, path === "announce" ? { machine: osNode, at: 1 } : { nodeId: "node-1", at: 1 }))
      expect(refused.status).toBe(400)
      expect((await refused.json() as { error: string }).error).toBe("liveness time is set by the server")
    }
    // Nothing got through on the way to being refused.
    const read = await (await host.handle(new Request("http://host/agentd/node/presence?nodeId=node-1"))).json() as { presence: { online: boolean } }
    expect(read.presence.online).toBe(false)
  })
})

test("with a node token configured, the probe's token is a header and refusals change nothing", async () => {
  await withHost(config({ nodeToken: "fleet-secret" }), async (host) => {
    expect((await (await host.handle(new Request("http://host/agentd/node/presence"))).json() as { tokenRequired: boolean }).tokenRequired).toBe(true)

    expect((await host.handle(post("announce", { machine: osNode }))).status).toBe(401)
    expect((await host.handle(post("announce", { machine: osNode }, "wrong"))).status).toBe(401)
    // A body-borne token is not a credential here — the header is.
    expect((await host.handle(post("announce", { machine: osNode, token: "fleet-secret" }))).status).toBe(401)

    expect((await host.handle(post("announce", { machine: osNode }, "fleet-secret"))).status).toBe(200)
    expect((await host.handle(post("heartbeat", { nodeId: "node-1" }, "wrong"))).status).toBe(401)
    const beat = await host.handle(post("heartbeat", { nodeId: "node-1" }, "fleet-secret"))
    expect((await beat.json() as { presence: { online: boolean } }).presence.online).toBe(true)

    const gone = await host.handle(post("withdraw", { nodeId: "node-1" }, "fleet-secret"))
    expect((await gone.json() as { presence: { withdrawn: boolean } }).presence.withdrawn).toBe(true)
    // Withdrawn is gone: a heartbeat has to say hello again, not nudge.
    expect((await host.handle(post("heartbeat", { nodeId: "node-1" }, "fleet-secret"))).status).toBe(404)
  })
})

test("reading the presence of a node that was never declared is a 404", async () => {
  await withHost(config(), async (host) => {
    const missing = await host.handle(new Request("http://host/agentd/node/presence?nodeId=node-9"))
    expect(missing.status).toBe(404)
    expect((await missing.json() as { error: string }).error).toBe("node not found")
  })
})
