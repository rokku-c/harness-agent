/**
 * Sandbox set-up for 10-script-sandbox.ts: which runtime this host gets, and
 * the seed tool catalogue the scripts are allowed to call.
 */
import { IsolatedVmRuntime, NodeVmRuntime, type ToolDef } from "@effect-agent/script"

// Runtime probe: bun's V8 ABI cannot load isolated-vm (a native module) → fall back to the node:vm skeleton;
// under node, use real isolation. Real deployments should ensure node + isolated-vm.
export const Runtime =
  (await import("isolated-vm").then(() => true).catch(() => false))
    ? IsolatedVmRuntime
    : NodeVmRuntime

/* ---------- 1. native tools (seed api) ---------- */
export const weather: ToolDef = {
  name: "weather.lookup",
  description: "look up weather for a city",
  semver: "1.0.0",
  input: { type: "object", properties: { city: { type: "string" } } },
  output: { type: "object", properties: { temp: { type: "number" } } },
  deps: [],
  impl: { kind: "native", execute: async () => ({ temp: 24 }) }
}
export const notes: ToolDef = {
  name: "notes.read",
  description: "read today's notes",
  semver: "1.0.0",
  input: { type: "object" },
  output: { type: "object", properties: { text: { type: "string" } } },
  deps: [],
  impl: { kind: "native", execute: async () => ({ text: "buy milk" }) }
}
export const registry = new Map<string, ToolDef>([["weather.lookup", weather], ["notes.read", notes]])
