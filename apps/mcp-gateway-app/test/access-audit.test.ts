import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { makeRegistry } from "@effect-agent/mcp-registry"
import { createMcpGatewayPlugin } from "../src/effect-plugin.ts"
import { makeAuditLog, previewAccess } from "../src/access-audit.ts"

const server = { serverId: "files", name: "files", version: "1", era: "modern" as const, transport: { kind: "streamable-http" as const, endpoint: "http://files.invalid/mcp" } }
const config = {
  sets: [
    { setId: "safe", name: "Safe", servers: ["files"], allowTools: ["read"] },
    { setId: "danger", name: "Danger", servers: ["missing"], denyTools: ["write"] },
  ],
  bindings: [{ agentId: "agent-1", setIds: ["safe", "danger"] }],
  defaultAction: "deny" as const, captureArgs: false,
}

test("previewAccess explains every effective denial reason", () => {
  const registry = makeRegistry()
  registry.register(server)
  const allowed = previewAccess(config, registry, "agent-1", "read")
  expect(allowed.allowed).toBe(true)
  expect(allowed.sets.map((set) => set.setId)).toEqual(["safe", "danger"])

  const denied = previewAccess(config, registry, "agent-1", "write")
  expect(denied.allowed).toBe(false)
  expect(denied.reasons).toContain("safe allowlist does not include write")
  expect(denied.reasons).toContain("danger explicitly denies write")
  expect(denied.reasons).toContain("danger has no reachable server")

  const unbound = previewAccess(config, registry, "nobody", "read")
  expect(unbound.bound).toBe(false)
  expect(unbound.allowed).toBe(false)
  expect(unbound.reasons[0]).toBe("no set bound to this agent")
})

test("gateway serves access previews and exposes an audit surface", async () => {
  const registry = makeRegistry(), host = makePluginHost()
  registry.register(server)
  await host.register({ ...createMcpGatewayPlugin(() => config, { mcpRegistry: registry, fetch }), routes: [{ path: "/mcp-gateway", match: "prefix" }] })
  try {
    const preview = await host.handle(new Request("http://host/mcp-gateway/access?agent=agent-1&tool=write"))
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
