/**
 * Capability script sandbox demo: script bootstrapping + closure
 * visibility + content-addressed versions + compatibility adjudication +
 * configuration derivation. Shows the recursive "scope + policy"
 * unification applied across the four layers of tools/versions/config/agents.
 *
 * Stage 1's seed api and the runtime probe live in ./lib/script-sandbox-setup.ts,
 * the "return { define }" bootstrapping convention in ./lib/script-bootstrap.ts.
 */
import {
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
import { notes, registry, Runtime, weather } from "./lib/script-sandbox-setup.ts"
import { composedSource, toolFromResult } from "./lib/script-bootstrap.ts"

console.log("runtime:", Runtime.runtime)

/* ---------- 2. script bootstrapping: compose two tools, return is data ---------- */
const registered: ToolDef[] = []
const result = await Runtime.execute(composedSource, {
  "weather.lookup": { name: "weather.lookup", invoke: weather.impl.kind === "native" ? weather.impl.execute : async () => null },
  "notes.read": { name: "notes.read", invoke: notes.impl.kind === "native" ? notes.impl.execute : async () => null }
}, {
  defineTool: () => {} // keep the global defineTool optional; this demo uses the return.define convention
})

const defined = toolFromResult(result)
if (defined !== undefined) {
  registered.push(defined)
  registry.set(defined.name, defined)
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
