import { expect, test } from "bun:test"
import { makeRegistry, makeRegistryAuth, type McpServer } from "../src/index.ts"

const server: McpServer = {
  serverId: "files",
  name: "files",
  version: "1",
  era: "modern",
  transport: { kind: "streamable-http", endpoint: "https://files" },
}

test("control-plane credentials authorize announce, heartbeat, and withdraw", () => {
  let now = 1
  const registry = makeRegistry({
    now: () => now,
    auth: makeRegistryAuth({ files: { ownerToken: "owner-secret", registrationToken: "reg-secret" } }),
  })

  expect(() => registry.announce(server, "bad")).toThrow()
  const record = registry.register(server, { ownerId: "team-a" })
  expect(record.ownerId).toBe("team-a")
  expect("ownerToken" in record).toBe(false)
  expect("registrationToken" in record).toBe(false)

  now = 2
  registry.announce(server, "reg-secret")
  expect(registry.get("files")?.lastSeen).toBe(2)
  now = 10
  expect(registry.announce(server, "reg-secret").lastSeen).toBe(10)
  expect(registry.heartbeat("files", "owner-secret", now)).toBe(true)
  expect(registry.heartbeat("files", "bad", now)).toBe(false)
  expect(registry.withdraw("files", "bad")).toBe(false)
  expect(registry.withdraw("files", "reg-secret")).toBe(true)
  expect(registry.get("files")).toBeUndefined()
})

test("authenticated controls reject without an auth policy", () => {
  expect(() => makeRegistry().announce(server, "any-token")).toThrow()
  expect(makeRegistry().heartbeat("files", "any-token")).toBe(false)
  expect(makeRegistry().withdraw("files", "any-token")).toBe(false)
})
