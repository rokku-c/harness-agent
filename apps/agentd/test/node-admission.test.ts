/**
 * §8.3 over HTTP: a node's own declaration is what gates its deployment, and an
 * announce *replaces* that declaration.
 *
 * The second test is the reason this file exists, and the reason the gate is not
 * in `bindNode`. A rule enforced where the binding is stored would keep passing
 * it — the binding was legal when it was written — so a node that has since
 * disowned `ops` would be handed `ops::board@1.0.0` on every beat. One rule, read
 * where the current declaration is.
 */

import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { createAgentdPlugin } from "../src/effect-plugin.ts"
import { effectApp } from "../src/effect-app.ts"
import { effectConfig } from "../src/effect-config.ts"

const READY = ["abi:effect-1", "runtime:os"]

/** A node seeded from config with one app placed at `ops`, as §8.1 shows. */
const seeded = (namespaces: readonly string[]) => effectConfig.schema.parse({
  machines: [{ machineId: "node-1", name: "Container", capabilities: READY, namespaces }],
  bundles: [{ bundleId: "board", version: "1.0.0", abi: "effect-1" }],
  nodeBindings: [{ nodeId: "node-1", apps: [{ bundleId: "board", version: "1.0.0", ns: "ops" }] }],
})

type Host = ReturnType<typeof makePluginHost>
const declaration = (namespaces: readonly string[]) =>
  ({ machineId: "node-1", name: "Container", status: "online", capabilities: READY, namespaces })

const withHost = async (namespaces: readonly string[], body: (host: Host) => Promise<void>): Promise<void> => {
  const host = makePluginHost()
  await host.register({ ...createAgentdPlugin(() => seeded(namespaces)), routes: effectApp.routes })
  try { await body(host) } finally { await host.close() }
}
const plan = async (host: Host): Promise<{ status: number; body: { changes?: readonly string[]; error?: string } }> => {
  const response = await host.handle(new Request("http://host/agentd/node/plan?nodeId=node-1"))
  return { status: response.status, body: await response.json() }
}
const announce = (host: Host, namespaces: readonly string[]): Promise<Response> =>
  host.handle(new Request("http://host/agentd/node/announce", {
    method: "POST", body: JSON.stringify({ machine: declaration(namespaces) }),
  }))

test("a node seeded with the domain its app sits in plans that app", async () => {
  await withHost(["ops"], async (host) => {
    const first = await plan(host)
    expect(first.status).toBe(200)
    expect(first.body.changes).toEqual(["place ops::board@1.0.0"])
  })
})

test("a node that disowns the domain stops the deployment, though the binding never changed", async () => {
  await withHost(["ops"], async (host) => {
    expect((await plan(host)).status).toBe(200)

    // The same machine, now saying it carries elsewhere. Nothing about the
    // binding moved: this is the announcement, and only the announcement.
    expect((await announce(host, ["workspace-b"])).status).toBe(200)

    const after = await plan(host)
    expect(after.status).toBe(400)
    expect(after.body.error).toContain('does not carry namespace "ops"')
  })
})

test("a node that widens its declaration admits a placement config never allowed", async () => {
  await withHost([], async (host) => {
    // Seeded carrying nothing, so the seeded placement is refused — an empty
    // allowlist denies rather than meaning "anything".
    expect((await plan(host)).status).toBe(400)

    expect((await announce(host, ["ops"])).status).toBe(200)
    expect((await plan(host)).status).toBe(200)
  })
})

test("a declaration states a ceiling the plan respects, and may state none", async () => {
  await withHost(["ops"], async (host) => {
    // Announced without `maxApps`: one app is well under a ceiling nobody set,
    // which is a different statement from a ceiling of zero.
    expect((await announce(host, ["ops"])).status).toBe(200)
    expect((await plan(host)).status).toBe(200)

    const refused = await host.handle(new Request("http://host/agentd/node/announce", {
      method: "POST", body: JSON.stringify({ machine: { ...declaration(["ops"]), maxApps: 0 } }),
    }))
    expect(refused.status).toBe(200)
    const after = await plan(host)
    expect(after.status).toBe(400)
    expect(after.body.error).toContain("carries at most 0 apps")
  })
})
