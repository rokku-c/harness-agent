import { expect, test } from "bun:test"
import { makeRegistry, type McpServer, type RegistryAuth } from "../src/index.ts"

const server = (serverId: string): McpServer => ({
  serverId,
  name: serverId,
  version: "1",
  era: "modern",
  transport: { kind: "stdio" },
})
const auth: RegistryAuth = { authorize: (token) => token === "secret" }

test("configure applies immediately and restores only its own generation", () => {
  let now = 0
  const registry = makeRegistry({ now: () => now })
  const restoreAuth = registry.configure({ auth, heartbeatTtlMs: 10, offlineAfterMs: 20 })
  expect(() => registry.announce(server("dynamic"), "secret")).not.toThrow()
  const restoreNewer = registry.configure({ heartbeatTtlMs: 5 })
  restoreAuth()
  expect(registry.get("dynamic", 6)?.status).toBe("warn")
  restoreNewer()
  expect(registry.get("dynamic", 6)?.status).toBe("healthy")
  now = 21
  expect(registry.get("dynamic")?.status).toBe("offline")
  const revokeAuth = registry.configure({ auth: undefined })
  expect(registry.heartbeat("dynamic", "secret")).toBe(false)
  revokeAuth()
  expect(registry.heartbeat("dynamic", "secret")).toBe(true)
})

test("static registrations do not expire while announced records do", () => {
  const registry = makeRegistry({ now: () => 0, auth, heartbeatTtlMs: 10, offlineAfterMs: 20 })
  registry.register(server("static"))
  registry.announce(server("dynamic"), "secret")
  expect(registry.get("static", 100)?.status).toBe("healthy")
  expect(registry.get("dynamic", 100)?.status).toBe("offline")
  expect("token" in (registry.get("dynamic") ?? {})).toBe(false)
})
