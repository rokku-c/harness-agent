import { expect, test } from "bun:test"

import {
  ERA_RANK,
  makeRegistry,
  statusFor,
  type McpServer,
} from "../src/index.ts"

const T = 1_000_000 // fixed "now" for deterministic heartbeats
const clock = () => T

const board: McpServer = {
  serverId: "effect-board",
  name: "effect-board",
  version: "v0.13.0",
  namespace: "io.effect-agent/board",
  era: "modern",
  transport: { kind: "stdio", endpoint: "in-process" },
  capabilities: { tools: 41, resources: 2, apps: 1 },
  apps: ["ui://board/console"],
}

const legacyShim: McpServer = {
  serverId: "legacy-shim",
  name: "legacy-shim",
  version: "v0.2.1",
  namespace: "dev.local/sh",
  era: "legacy",
  transport: { kind: "stdio", endpoint: "child proc" },
  capabilities: { tools: 4 },
}

function registry() {
  return makeRegistry({ heartbeatTtlMs: 2_000, offlineAfterMs: 60_000, now: clock })
}

test("statusFor derives healthy/warn/offline from heartbeat age", () => {
  expect(statusFor(0, 1_000, 2_000, 60_000)).toBe("healthy")
  expect(statusFor(0, 3_000, 2_000, 60_000)).toBe("warn")
  expect(statusFor(0, 70_000, 2_000, 60_000)).toBe("offline")
})

test("era rank prefers modern over legacy", () => {
  expect(ERA_RANK.modern).toBeLessThan(ERA_RANK.auto)
  expect(ERA_RANK.auto).toBeLessThan(ERA_RANK.legacy)
})

test("register/list/get and heartbeat transitions", () => {
  const reg = registry()
  reg.register(board)
  reg.register(legacyShim)

  expect(reg.list().map((r) => r.serverId).sort()).toEqual(["effect-board", "legacy-shim"])

  // Freshly registered -> healthy.
  expect(reg.get("effect-board")?.status).toBe("healthy")

  // A recent heartbeat keeps a server healthy.
  reg.touch("effect-board", T - 1_000)
  expect(reg.get("effect-board", T)?.status).toBe("healthy")

  // Static registrations remain available without heartbeat expiry.
  reg.touch("legacy-shim", 0)
  expect(reg.get("legacy-shim", T)?.status).toBe("healthy")

  expect(reg.unregister("effect-board")).toBe(true)
  expect(reg.get("effect-board")).toBeUndefined()
  expect(reg.touch("effect-board", T)).toBe(false)
})
