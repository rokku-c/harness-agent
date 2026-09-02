/**
 * Capability script sandbox demo: script bootstrapping + closure
 * visibility + content-addressed versions + compatibility adjudication +
 * configuration derivation. Shows the recursive "scope + policy"
 * unification applied across the four layers of tools/versions/config/agents.
 */
import {
  IsolatedVmRuntime,
  NodeVmRuntime,
  VersionStore,
  assessChange,
  defaultCompat,
  defaultPolicy,
  mergePolicy,
  restrictPolicy,
  visibleTools,
  type Policy,
  type ToolDef
} from "@effect-agent/script"

// Runtime probe: bun's V8 ABI cannot load isolated-vm (a native module) → fall back to the node:vm skeleton;
// under node, use real isolation. Real deployments should ensure node + isolated-vm.
const Runtime =
  (await import("isolated-vm").then(() => true).catch(() => false))
    ? IsolatedVmRuntime
    : NodeVmRuntime
console.log("runtime:", Runtime.runtime)

/* ---------- 1. native tools (seed api) ---------- */
const weather: ToolDef = {
  name: "weather.lookup",
  description: "look up weather for a city",
  semver: "1.0.0",
  input: { type: "object", properties: { city: { type: "string" } } },
  output: { type: "object", properties: { temp: { type: "number" } } },
  deps: [],
  impl: { kind: "native", execute: async () => ({ temp: 24 }) }
}
const notes: ToolDef = {
  name: "notes.read",
  description: "read today's notes",
  semver: "1.0.0",
  input: { type: "object" },
  output: { type: "object", properties: { text: { type: "string" } } },
  deps: [],
  impl: { kind: "native", execute: async () => ({ text: "buy milk" }) }
}
const registry = new Map<string, ToolDef>([["weather.lookup", weather], ["notes.read", notes]])

/* ---------- 2. script bootstrapping: compose two tools, return is data ---------- */
// Convention: the script's last statement is return { ... }; a define field in the object declares a new tool (the host extracts and registers it),
// the remaining fields are the script result. The return value is the API (homoiconic: code produces data, the host consumes data).
const composedSource = [
  'const w = await weather.lookup({ city: "Shanghai" })',
  'const n = await notes.read({})',
  'return {',
  '  temp: w.temp,',
  '  note: n.text,',
  '  define: {',
  '    name: "daily_report",',
  '    description: "today weather + note summary",',
  '    semver: "1.0.0",',
  '    input: { type: "object", properties: { city: { type: "string" } } },',
  '    output: { type: "object" },',
  '    deps: ["weather.lookup", "notes.read"],',
  '    source: "composed"',
  '  }',
  '}'
].join("\n")

const registered: ToolDef[] = []
const result = await Runtime.execute(composedSource, {
  "weather.lookup": { name: "weather.lookup", invoke: weather.impl.kind === "native" ? weather.impl.execute : async () => null },
  "notes.read": { name: "notes.read", invoke: notes.impl.kind === "native" ? notes.impl.execute : async () => null }
}, {
  defineTool: () => {} // keep the global defineTool optional; this demo uses the return.define convention
})

// Extract the tool definition from the return value: the script's define field → ToolDef → register
const define = (result as { define?: Record<string, unknown> }).define
if (define !== undefined) {
  const def: ToolDef = {
    name: String(define.name),
    description: String(define.description),
    semver: define.semver as string | undefined,
    input: define.input as ToolDef["input"],
    output: define.output as ToolDef["output"],
    deps: (define.deps as ReadonlyArray<string>) ?? [],
    impl: { kind: "script", lang: "js", source: String(define.source) }
  }
  registered.push(def)
  registry.set(def.name, def)
}
const { define: _ignored, ...resultValue } = result as Record<string, unknown>
console.log("1) script return value:", JSON.stringify(resultValue))
const daily = registered[0]!
console.log("2) bootstrapped new tool:", daily.name, "deps =", daily.deps)

/* ---------- 3. closure visibility: scope seed → dependency closure ---------- */
const policy: Policy = {
  ...defaultPolicy,
  api: { mode: "allowlist", scope: ["daily_report"] },
  allowAgentConfig: ["compat.schema", "version.defaults.daily_report"]
}
const visible = visibleTools(registry, policy)
console.log("3) visible closure (seed=daily_report):", visible)

/* ---------- 4. content-addressed versions: hash locks the dependency closure ---------- */
const store = new VersionStore()
const depHashes = {
  "weather.lookup": store.commit("weather.lookup", weather, { message: "v1", depHashes: {} }).hash,
  "notes.read": store.commit("notes.read", notes, { message: "v1", depHashes: {} }).hash
}
const v1 = store.commit("daily_report", daily, { message: "composed v1", depHashes })
const v2 = store.commit("daily_report", { ...daily, description: "today weather + note (v2)" }, { message: "description update", depHashes })
console.log("4) v1 hash =", v1.hash.slice(0, 12), "… | v2 parent = v1:", v2.parent === v1.hash)
console.log("   strong dep resolution @v1hash → revision", store.resolve("daily_report", { kind: "hash", hash: v1.hash })?.revision)

/* ---------- 5. compatibility adjudication: schema change rejected under strict; description change passes with warn ---------- */
const schemaBump = assessChange(weather, { ...weather, input: { type: "object", properties: { city: { type: "number" } } } }, defaultCompat)
const descBump = assessChange(weather, { ...weather, description: "look up weather (v2)" }, defaultCompat)
console.log("5) schema change ok =", schemaBump.ok, "| description change ok =", descBump.ok, "(warnings:", descBump.warnings.length, ")")

/* ---------- 6. configuration derivation: system→agent→sub-agent, scope narrows layer by layer ---------- */
const systemPolicy = restrictPolicy(policy, { api: ["daily_report", "weather.lookup"], allowAgentConfig: ["compat.schema"] })
const agentMerged = mergePolicy(systemPolicy, { compat: { schema: "ignore" } } as Partial<Policy>)
const child = restrictPolicy(agentMerged, { api: ["daily_report"] })
console.log("6) system scope =", systemPolicy.api.scope, "| agent override schema→ignore:", agentMerged.compat.schema)
console.log("   sub-agent scope =", child.api.scope, "| sub-agent configurable items =", child.allowAgentConfig)
