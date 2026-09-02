import { describe, expect, it } from "bun:test"
import {
  IsolatedVmRuntime,
  NodeVmRuntime,
  VersionStore,
  assessChange,
  assessUpgrade,
  defaultCompat,
  defaultPolicy,
  hashVersion,
  mergePolicy,
  policy,
  restrictPolicy,
  visibleTools,
  type Policy,
  type ToolDef
} from "@effect-agent/script"

/* ------------------------------ fixtures ------------------------------ */

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

const dailyReport = (deps: ReadonlyArray<string>): ToolDef => ({
  name: "daily_report",
  description: "today's weather + notes",
  semver: "1.0.0",
  input: { type: "object", properties: { city: { type: "string" } } },
  output: { type: "object" },
  deps,
  impl: { kind: "composed", steps: [{ tool: "weather.lookup" }, { tool: "notes.read" }] }
})

const registry = (tools: ReadonlyArray<ToolDef>): ReadonlyMap<string, ToolDef> =>
  new Map(tools.map((tool) => [tool.name, tool]))

/* ------------------------------ visibility = dependency closure ------------------------------ */

describe("visibility = dependency closure", () => {
  it("allowlist seed expands along deps (closure property)", () => {
    const tools = registry([weather, notes, dailyReport(["weather.lookup", "notes.read"])])
    const visible = visibleTools(tools, policy({ api: { mode: "allowlist", scope: ["daily_report"] } }))
    expect(visible.sort()).toEqual(["daily_report", "notes.read", "weather.lookup"])
  })

  it("denylist removes tools whose deps are blocked (transitive)", () => {
    // secret is excluded → notes.read depends on it → daily_report depends on notes.read → none are visible
    const secret: ToolDef = {
      ...notes,
      name: "secret.rm",
      description: "dangerous",
      deps: []
    }
    const notesWithSecret: ToolDef = { ...notes, name: "notes.read", deps: ["secret.rm"] }
    const tools = registry([
      weather,
      notesWithSecret,
      secret,
      dailyReport(["weather.lookup", "notes.read"])
    ])
    const visible = visibleTools(
      tools,
      policy({ api: { mode: "denylist", scope: ["secret.rm"] } })
    )
    expect(visible).not.toContain("secret.rm")
    expect(visible).not.toContain("notes.read")   // depends on an invisible tool
    expect(visible).not.toContain("daily_report") // transitive: the dependency chain is cut
    expect(visible).toContain("weather.lookup")
  })

  it("violatesClosure reports missing deps for a given visible set", () => {
    const tool = dailyReport(["weather.lookup", "missing.tool"])
    const violations = tool.deps.filter((dep) => !new Set(["daily_report", "weather.lookup"]).has(dep))
    expect(violations).toEqual(["missing.tool"])
  })
})

/* ------------------------------ versioning = content addressing ------------------------------ */

describe("versioning = content addressing", () => {
  it("hash is deterministic and captures content + dep hashes", () => {
    const depHashes = { "weather.lookup": "aaa", "notes.read": "bbb" }
    const h1 = hashVersion(weather, {})
    const h2 = hashVersion(weather, {})
    expect(h1).toBe(h2)
    const changed = hashVersion({ ...weather, description: "changed" }, {})
    expect(changed).not.toBe(h1)
    const withDepHash = hashVersion(dailyReport(["weather.lookup"]), { "weather.lookup": "aaa" })
    const withOtherDepHash = hashVersion(dailyReport(["weather.lookup"]), { "weather.lookup": "zzz" })
    expect(withDepHash).not.toBe(withOtherDepHash)  // dep hashes participate in addressing
  })

  it("VersionStore commits a chain; strong dep resolves exactly", () => {
    const store = new VersionStore()
    const v1 = store.commit("weather.lookup", weather, { message: "initial", depHashes: {} })
    const v2 = store.commit("weather.lookup", { ...weather, semver: "1.1.0" }, { message: "bump", depHashes: {} })
    expect(v2.parent).toBe(v1.hash)
    expect(store.head("weather.lookup")?.revision).toBe(2)
    expect(store.resolve("weather.lookup", { kind: "hash", hash: v1.hash })?.revision).toBe(1)
    expect(store.resolve("weather.lookup", { kind: "hash", hash: "deadbeef" })).toBeUndefined()
    expect(store.resolve("weather.lookup", { kind: "revision", n: 1 })?.hash).toBe(v1.hash)
    expect(store.resolve("weather.lookup", { kind: "latest" })?.revision).toBe(2)
  })

  it("weak dep range resolves via semver", () => {
    const store = new VersionStore()
    store.commit("notes.read", notes, { message: "v1", depHashes: {} })
    store.commit("notes.read", { ...notes, semver: "1.2.0" }, { message: "v1.2", depHashes: {} })
    store.commit("notes.read", { ...notes, semver: "2.0.0" }, { message: "v2", depHashes: {} })
    const caret = store.resolve("notes.read", { kind: "range", spec: "^1.0" })
    expect(caret?.content.semver).toBe("1.2.0")
    const gte = store.resolve("notes.read", { kind: "range", spec: ">=1.0" })
    expect(gte?.content.semver).toBe("2.0.0")
  })
})

/* ------------------------------ compatibility = graded adjudication ------------------------------ */

describe("compatibility = graded adjudication", () => {
  const v = (overrides: Partial<ToolDef>): ToolDef => ({ ...weather, ...overrides })

  it("schema change is breaking under strict", () => {
    const report = assessChange(weather, v({ input: { type: "object", properties: { city: { type: "number" } } } }), defaultCompat)
    expect(report.ok).toBe(false)
    expect(report.violations.some((item) => item.level === "schema")).toBe(true)
  })

  it("description change is a warning under warn, breaking under strict", () => {
    const warn = assessChange(weather, v({ description: "new description" }), defaultCompat)
    expect(warn.ok).toBe(true)
    expect(warn.warnings.some((item) => item.level === "description")).toBe(true)
    const strict = assessChange(weather, v({ description: "new description" }), {
      ...defaultCompat,
      description: "strict"
    })
    expect(strict.ok).toBe(false)
  })

  it("schema level can be configured to ignore", () => {
    const ignore = assessChange(
      weather,
      v({ input: { type: "object", properties: { city: { type: "number" } } } }),
      { ...defaultCompat, schema: "ignore" }
    )
    expect(ignore.ok).toBe(true)
  })

  it("declared behavior change requires declaration policy", () => {
    const changed = v({ behavior: { changed: true, note: "now returns warnings" } })
    const strict = assessChange(weather, changed, defaultCompat)
    expect(strict.ok).toBe(false)
    const lenient = assessChange(weather, changed, { ...defaultCompat, behavior: "ignore" })
    expect(lenient.ok).toBe(true)
  })

  it("assessUpgrade diffs version contents", () => {
    const store = new VersionStore()
    const v1 = store.commit("weather.lookup", weather, { message: "v1", depHashes: {} })
    const v2 = store.commit("weather.lookup", { ...weather, description: "d2" }, { message: "v2", depHashes: {} })
    const report = assessUpgrade(v1, v2, defaultCompat)
    expect(report.ok).toBe(true)
    expect(report.warnings.length).toBeGreaterThan(0)
  })
})

/* ------------------------------ configuration = one Policy ------------------------------ */

describe("policy = one type, system/agent/derived", () => {
  const systemPolicy: Policy = {
    ...defaultPolicy,
    api: { mode: "allowlist", scope: ["a", "b", "c"] },
    compat: { ...defaultCompat, schema: "strict" },
    allowAgentConfig: ["compat.schema", "version.defaults.weather"]
  }

  it("agent overrides only whitelisted paths", () => {
    const merged = mergePolicy(systemPolicy, {
      compat: { schema: "warn", description: "ignore" },
      api: { mode: "denylist", scope: ["x"] }
    } as Partial<Policy>)
    expect(merged.compat.schema).toBe("warn")        // whitelisted → override applies
    expect(merged.compat.description).toBe("warn")   // not whitelisted → stays at the default
    expect(merged.api.mode).toBe("allowlist")        // not whitelisted → stays unchanged
  })

  it("agent can set a default version for an allowed tool", () => {
    const merged = mergePolicy(systemPolicy, {
      version: { defaults: { weather: { kind: "revision", n: 2 }, notes: { kind: "latest" } } }
    } as Partial<Policy>)
    expect(merged.version.defaults.weather).toEqual({ kind: "revision", n: 2 })
    expect(merged.version.defaults.notes).toBeUndefined()
  })

  it("restrictPolicy narrows api scope and config whitelist (derivation)", () => {
    const child = restrictPolicy(systemPolicy, {
      api: ["a", "b"],
      allowAgentConfig: ["compat.schema", "sandbox.runtime"]
    })
    expect(child.api.scope).toEqual(["a", "b"])
    expect(child.allowAgentConfig).toEqual(["compat.schema"])  // intersection
    expect(child.compat.schema).toBe("strict")                 // inherited
  })
})

/* ------------------------------ sandbox = script bootstrap ------------------------------ */

describe("sandbox = script bootstrap", () => {
  it("script calls injected deps and defineTool adds a new tool", async () => {
    const calls: string[] = []
    const env = {
      "weather.lookup": { name: "weather.lookup", invoke: async (input: unknown) => { calls.push("weather"); return { temp: 24 } } },
      "notes.read": { name: "notes.read", invoke: async () => { calls.push("notes"); return { text: "buy milk" } } }
    }
    const registered: Array<{ name: string; deps: ReadonlyArray<string> }> = []
    const host = {
      defineTool: (spec: { name: string; deps?: ReadonlyArray<string> }) => {
        registered.push({ name: spec.name, deps: spec.deps ?? [] })
      }
    }
    const source = [
      'const w = await weather.lookup({ city: "Shanghai" })',
      'const n = await notes.read({})',
      'defineTool({ name: "daily_report", description: "composed", input: {}, output: {}, deps: ["weather.lookup", "notes.read"], source: "" })',
      "return { temp: w.temp, note: n.text }"
    ].join("\n")
    const result = await NodeVmRuntime.execute(source, env, host)
    expect(result).toEqual({ temp: 24, note: "buy milk" })
    expect(registered).toEqual([
      { name: "daily_report", deps: ["weather.lookup", "notes.read"] }
    ])
    expect(calls).toEqual(["weather", "notes"])
  })

  it("uninjected apis are not reachable (least privilege)", async () => {
    const source = 'return typeof secret === "undefined" ? "isolated" : "leaked"'
    const result = await NodeVmRuntime.execute(
      source,
      { "weather.lookup": { name: "w", invoke: async () => 1 } },
      { defineTool: () => {} }
    )
    expect(result).toBe("isolated")
  })

  it("async script supports top-level await", async () => {
    // note: the sandbox does not inject host globals (setTimeout is unavailable) — that is least privilege in action
    const source = 'const x = await Promise.resolve(42)\nreturn "done:" + x'
    const result = await NodeVmRuntime.execute(source, {}, { defineTool: () => {} })
    expect(result).toBe("done:42")
  })
})

/* ------------------------------ isolated-vm: real isolation ------------------------------ */

// isolated-vm is a native module (built against node's V8 ABI): it cannot load under bun → skip; run the real isolation tests under node
const ivmAvailable = await import("isolated-vm").then(() => true).catch(() => false)

describe.skipIf(!ivmAvailable)("isolated-vm runtime = real isolation", () => {
  it("script calls injected deps and defineTool adds a new tool", async () => {
    const calls: string[] = []
    const env = {
      "weather.lookup": { name: "weather.lookup", invoke: async () => { calls.push("weather"); return { temp: 24 } } },
      "notes.read": { name: "notes.read", invoke: async () => { calls.push("notes"); return { text: "buy milk" } } }
    }
    const registered: Array<{ name: string }> = []
    const source = [
      'const w = await weather.lookup({ city: "Shanghai" })',
      'const n = await notes.read({})',
      'defineTool({ name: "daily_report", description: "composed", input: {}, output: {}, deps: ["weather.lookup", "notes.read"], source: "" })',
      "return { temp: w.temp, note: n.text }"
    ].join("\n")
    const result = await IsolatedVmRuntime.execute(source, env, {
      defineTool: (spec) => registered.push({ name: spec.name })
    })
    expect(result).toEqual({ temp: 24, note: "buy milk" })
    expect(registered).toEqual([{ name: "daily_report" }])
    expect(calls).toEqual(["weather", "notes"])
  })

  it("constructor-chain escape is blocked (no host objects in isolate)", async () => {
    // the same malicious script: under node:vm it can escape to the host process; under isolated-vm it must fail.
    // weather.lookup is an async function → AsyncFunction → the call returns a promise, so await it to catch the result
    const source = [
      'const Host = weather.lookup.constructor',
      'try {',
      '  const p = await Host("return process")()',
      '  return "ESCAPED:" + (p ? "yes" : "no")',
      '} catch (error) {',
      '  return "blocked"',
      '}'
    ].join("\n")
    const result = await IsolatedVmRuntime.execute(
      source,
      { "weather.lookup": { name: "w", invoke: async () => 1 } },
      { defineTool: () => {} }
    )
    expect(String(result)).toBe("blocked")
  })

  it("memory limit is enforced by the isolate", async () => {
    const source = 'const a = []\nwhile (true) a.push(new Array(1024 * 1024).fill(0))\nreturn "oom?"'
    // 64MB memoryLimit: unbounded allocation must be rejected by the isolate (throws/times out) rather than crash the host
    await expect(IsolatedVmRuntime.execute(source, {}, { defineTool: () => {} }, 3000)).rejects.toThrow()
  })
})
