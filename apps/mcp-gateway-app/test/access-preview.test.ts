import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { makeMcpSetRegistry, makeRegistrySetResolver } from "@effect-agent/mcp-gateway"
import { makeRegistry } from "@effect-agent/mcp-registry"
import { createMcpGatewayPlugin } from "../src/effect-plugin.ts"
import { makeAuditLog } from "../src/audit-log.ts"
import { previewAccess, type AccessConfig } from "../src/access-preview.ts"

const server = { serverId: "files", name: "files", version: "1", era: "modern" as const, transport: { kind: "streamable-http" as const, endpoint: "http://files.invalid/mcp" } }
const config = {
  sets: [
    { setId: "safe", name: "Safe", servers: ["files"], allowTools: ["read"] },
    { setId: "danger", name: "Danger", servers: ["missing"], denyTools: ["write"] },
  ],
  bindings: [{ agentId: "app:agent-1", setIds: ["safe", "danger"] }],
  databaseFile: ":memory:", captureArgs: false,
}

/** The engine the plugin builds, built the same way — the preview asks this one. */
const surfacesOf = (value: AccessConfig) => {
  const registry = makeRegistry()
  registry.register(server)
  const sets = makeMcpSetRegistry({ resolver: makeRegistrySetResolver(registry) })
  for (const set of value.sets) sets.registerSet(set)
  for (const binding of value.bindings) sets.bindAgent(binding)
  return { config: value, registry, sets }
}

test("previewAccess reads its verdict off the gateway's own set registry", () => {
  const allowed = previewAccess(surfacesOf(config), "app:agent-1", "read")
  expect(allowed.allowed).toBe(true)
  expect(allowed.sets.map((set) => set.setId)).toEqual(["safe", "danger"])

  // "safe" is the first bound set with a reachable server, so the gateway
  // answers from it alone and never consults "danger" — whose deny is not the
  // reason for anything. Reading every bound set reports a reason the gateway's
  // own rule never reaches, and a grant in a later set erases an earlier deny.
  const denied = previewAccess(surfacesOf(config), "app:agent-1", "write")
  expect(denied.allowed).toBe(false)
  expect(denied.reasons).toEqual(["safe allowlist does not include write"])

  // the denying set first: it decides, and its own deny is the reason
  const refusing = { ...config, bindings: [{ agentId: "app:agent-1", setIds: ["safe"] }], sets: [{ setId: "safe", name: "Safe", servers: ["files"], denyTools: ["write"] }] }
  const refused = previewAccess(surfacesOf(refusing), "app:agent-1", "write")
  expect(refused.allowed).toBe(false)
  expect(refused.reasons).toEqual(["safe explicitly denies write"])

  // no bound set reaches a server at all: the gateway has nothing to decide on
  const dark = { ...config, bindings: [{ agentId: "app:agent-1", setIds: ["safe"] }], sets: [{ setId: "safe", name: "Safe", servers: ["missing"] }] }
  const unreachable = previewAccess(surfacesOf(dark), "app:agent-1", "read")
  expect(unreachable.allowed).toBe(false)
  expect(unreachable.reasons).toEqual(["no bound set has a reachable server"])

  // one fact, one sentence: an agent with no binding is unbound whether or not
  // a tool was named, so the page cannot say it two ways
  const unbound = previewAccess(surfacesOf(config), "nobody", "read")
  expect(unbound.bound).toBe(false)
  expect(unbound.allowed).toBe(false)
  expect(unbound.reasons).toEqual(["no set bound to this agent"])
  expect(previewAccess(surfacesOf(config), "nobody").reasons).toEqual(["no set bound to this agent"])
})

test("gateway serves access previews and exposes an audit surface", async () => {
  const registry = makeRegistry(), host = makePluginHost()
  registry.register(server)
  await host.register({ ...createMcpGatewayPlugin(() => config, { mcpRegistry: registry, fetch }), routes: [{ path: "/mcp-gateway", match: "prefix" }] })
  try {
    const preview = await host.handle(new Request("http://host/mcp-gateway/access?agent=app:agent-1&tool=write"))
    expect(preview.status).toBe(200)
    expect(await preview.json()).toMatchObject({ ok: true, access: { allowed: false } })
    const missing = await host.handle(new Request("http://host/mcp-gateway/access"))
    expect(missing.status).toBe(400)
    const audit = await host.handle(new Request("http://host/mcp-gateway/audit"))
    expect(await audit.json()).toMatchObject({ ok: true, events: [] })
  } finally { await host.close() }
})

test("audit log keeps only the newest bounded events, newest first", () => {
  const audit = makeAuditLog(2)
  audit.record({ callId: "1", type: "call", at: 1 })
  audit.record({ callId: "2", type: "error", at: 2, decision: "deny", detail: "denied_by_rule" })
  audit.record({ callId: "3", type: "response", at: 3, decision: "allow" })
  expect(audit.list().map((event) => event.callId)).toEqual(["3", "2"])
})
