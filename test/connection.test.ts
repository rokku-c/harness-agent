import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { any, bind, cascade, connection, memoryNotationStore, named, namedShaped, shaped, type ToolNamesOf } from "../src/index.ts"
import type { Connection } from "../src/index.ts"

// every tool-bearing connection carries its prose store - descriptions
// resolve at bind time and exist only on the bound tool
const weatherStore = () => memoryNotationStore([{ target: "tool:lookup", instructions: ["Look up current weather."] }])
const grafanaStore = () => memoryNotationStore([{ target: "tool:list_dashboards", instructions: ["List the dashboards."] }])

const grafana = connection("grafana", [
  { name: "list_dashboards", input: { type: "object" }, output: { type: "array" }, execute: () => Effect.succeed([]) }
], grafanaStore())
const weather = connection("weather", [
  { name: "lookup", input: { type: "object" }, output: { type: "object" }, execute: () => Effect.succeed({}) }
], weatherStore())

describe("connection declarations", () => {
  test("any: accepts any connection under the fixed prefix", () => {
    const bound = bind(any("mcp__"), grafana)
    expect(bound.map((tool) => tool.boundName)).toEqual(["mcp__list_dashboards"])
  })

  test("any: default prefix is mcp__", () => {
    expect(bind(any(), weather).map((tool) => tool.boundName)).toEqual(["mcp__lookup"])
  })

  test("named: accepts the declared name, prefixes with it", () => {
    const bound = bind(named("grafana"), grafana)
    expect(bound.map((tool) => tool.boundName)).toEqual(["grafana__list_dashboards"])
  })

  test("named: rejects an unlisted connection name", () => {
    expect(() => bind(named("grafana"), weather)).toThrow(/not accepted/)
  })

  test("shaped: verifies the tool schemas match", () => {
    const bound = bind(shaped([{ name: "lookup", input: { type: "object" }, output: { type: "object" } }]), weather)
    expect(bound).toHaveLength(1)
  })

  test("shaped: fails loud on a missing tool or schema mismatch", () => {
    expect(() => bind(shaped([{ name: "nope", input: {}, output: {} }]), weather)).toThrow(/missing tool/)
    expect(() => bind(shaped([{ name: "lookup", input: { type: "string" }, output: { type: "object" } }]), weather))
      .toThrow(/does not match/)
  })

  test("named+shaped: both constraints apply", () => {
    expect(bind(namedShaped(["grafana"], [{ name: "list_dashboards", input: { type: "object" }, output: { type: "array" } }]), grafana))
      .toHaveLength(1)
    expect(() => bind(namedShaped(["weather"], [{ name: "lookup", input: { type: "object" }, output: { type: "object" } }]), grafana))
      .toThrow(/not accepted/)
  })

  test("cascade: a connection tree flattens to member-prefixed tools", () => {
    const stack = connection("stack", [], undefined) as Connection & { members?: ReadonlyArray<Connection> }
    stack.members = [grafana, weather]
    const bound = bind(cascade([]), stack)
    expect(bound.map((tool) => tool.boundName)).toEqual([
      "stack__grafana__list_dashboards",
      "stack__weather__lookup"
    ])
  })

  test("cascade: nested cascades deepen the prefix (the tree flattens fully)", () => {
    const inner = connection("inner", [], undefined) as Connection & { members?: ReadonlyArray<Connection> }
    inner.members = [weather]
    const outer = connection("outer", [], undefined) as Connection & { members?: ReadonlyArray<Connection> }
    outer.members = [grafana, inner]
    const bound = bind(cascade([]), outer)
    expect(bound.map((tool) => tool.boundName)).toEqual([
      "outer__grafana__list_dashboards",
      "outer__inner__weather__lookup"
    ])
  })

  test("prose: every bound tool's description resolves from the connection's store", () => {
    const bound = bind(named("weather"), weather)
    expect(String(bound[0]?.description)).toBe("Look up current weather.")
  })

  test("prose: fails loud when the connection carries no store", () => {
    const bare = connection("weather", [{ name: "lookup", input: { type: "object" }, output: { type: "object" }, execute: () => Effect.succeed({}) }])
    expect(() => bind(named("weather"), bare)).toThrow(/has no notation store/)
  })

  test("prose: fails loud when the store lacks the tool's entry", () => {
    const wrongStore = connection("weather", [
      { name: "lookup", input: { type: "object" }, output: { type: "object" }, execute: () => Effect.succeed({}) }
    ], memoryNotationStore([{ target: "tool:other", instructions: ["unrelated"] }]))
    expect(() => bind(named("weather"), wrongStore)).toThrow(/no notation entry for tool "lookup"/)
  })

  test("a tool-bearing connection needs no store only when it has no tools", () => {
    const empty = connection("empty", [])
    expect(bind(any(), empty)).toHaveLength(0)
  })
})

describe("type-level tool names", () => {
  test("ToolNamesOf composes literal prefixes from the spec", () => {
    const spec = {
      dashboards: named("grafana"),
      monitoring: any("mcp__"),
      db: shaped([{ name: "query", input: { type: "object" }, output: { type: "object" } }]),
      ns: namedShaped(["docs"], [{ name: "search", input: { type: "object" }, output: { type: "object" } }]),
      stack: cascade([])
    }
    // per-slot assertions: each slot's contribution is derived at the type level
    const a1: "db__query" extends ToolNamesOf<typeof spec> ? true : false = true
    const a2: "grafana__list_dashboards" extends ToolNamesOf<Pick<typeof spec, "dashboards">> ? true : false = true
    const a3: "docs__search" extends ToolNamesOf<Pick<typeof spec, "ns">> ? true : false = true
    const a4: "mcp__anything" extends ToolNamesOf<Pick<typeof spec, "monitoring">> ? true : false = true
    void a1; void a2; void a3; void a4
  })
})
