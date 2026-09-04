import { describe, expect, test } from "bun:test"
import { isOffline, supportsLaunch, type AgentInstance } from "../src/domain.ts"

const probe: AgentInstance = {
  agentId: "probe-1", kind: "probe", channel: "probe", status: "online", lastSeen: 1000,
  capabilities: { launchKinds: ["codex"], claimKinds: [], isolation: ["env"], pollIntervalMs: 1000 }
}

describe("agent connection capabilities", () => {
  test("checks launch kind and isolation together", () => {
    expect(supportsLaunch(probe, "codex", "env")).toBe(true)
    expect(supportsLaunch(probe, "claude", "env")).toBe(false)
    expect(supportsLaunch(probe, "codex", "sandbox")).toBe(false)
  })
  test("marks a silent probe offline after three polling windows", () => {
    expect(isOffline(probe, 3999)).toBe(false)
    expect(isOffline(probe, 4001)).toBe(true)
  })
})
