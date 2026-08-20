import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { resolve } from "node:path"
import type { Driver } from "../src/index.js"
import { render, renderSystem } from "../packages/builtin/src/render.js"
import {
  compileSpec,
  decodeAgentSpec,
  fieldToSchema,
  makeBuilder,
  renderSpec,
  resolveOps,
  type Field
} from "../examples/lib/agent-spec.js"

const decode = <A>(schema: Schema.Schema<A, any, never>, value: unknown): Effect.Effect<A, unknown, never> =>
  Schema.decodeUnknown(schema)(value)

// ── fieldToSchema：Field DSL → Effect Schema 编译器 ──

describe("fieldToSchema", () => {
  test("compiles string / number / boolean", async () => {
    expect(await Effect.runPromise(decode(fieldToSchema({ kind: "string" }), "abc"))).toBe("abc")
    expect(await Effect.runPromise(decode(fieldToSchema({ kind: "number" }), 42))).toBe(42)
    expect(await Effect.runPromise(decode(fieldToSchema({ kind: "boolean" }), true))).toBe(true)
  })

  test("compiles enum into a union of literals", async () => {
    const schema = fieldToSchema({ kind: "enum", values: ["low", "high"] })
    expect(await Effect.runPromise(decode(schema, "high"))).toBe("high")
    expect((await Effect.runPromiseExit(decode(schema, "med")))._tag).toBe("Failure")
  })

  test("compiles array", async () => {
    const schema = fieldToSchema({ kind: "array", element: { kind: "string" } })
    expect(await Effect.runPromise(decode(schema, ["a", "b"]))).toEqual(["a", "b"])
  })

  test("compiles nested object", async () => {
    const schema = fieldToSchema({
      kind: "object",
      properties: [{ name: "name", field: { kind: "string" } }]
    })
    expect(await Effect.runPromise(decode(schema, { name: "x" }))).toEqual({ name: "x" })
  })

  test("rejects an unknown kind", () => {
    expect(() => fieldToSchema({ kind: "date" } as never)).toThrow()
  })
})

// ── makeBuilder：宿主把 spec 的 system + ops 绑成 AgentBuilder ──

describe("makeBuilder", () => {
  test("binds an unknown tool by throwing", () => {
    expect(() => makeBuilder("X", "sys", { _tag: "Stop" }, [
      { tool: "doesNotExist", access: "read", args: [] }
    ])).toThrow(/未知工具/)
  })
})

// ── resolveOps：工具选择 → 宿主 Binding ──

describe("resolveOps", () => {
  test("resolves known tools into bindings", () => {
    const bindings = resolveOps([
      { tool: "projectReadFile", access: "read", args: [] },
      { tool: "projectWriteFile", access: "write", args: [] }
    ])
    expect(bindings.length).toBe(2)
    expect(bindings[0]!.ops?.[0]?.name).toBe("meta.readFile")
    expect(bindings[1]!.ops?.[0]?.name).toBe("meta.writeFile")
  })

  test("throws on an unknown tool", () => {
    expect(() => resolveOps([
      { tool: "nope", access: "read", args: [] }
    ])).toThrow(/未知工具/)
  })
})

// ── compileSpec：Route A 运行时动态组装 ──

describe("compileSpec", () => {
  test("produces a runnable agent on a fake driver", async () => {
    const spec: FieldSpec = {
      id: "FakeReviewer",
      system: "你是一个审查员。",
      driver: "fake",
      output: [
        { name: "summary", field: { kind: "string" } },
        { name: "verdict", field: { kind: "enum", values: ["ok", "bad"] } }
      ],
      ops: [{ tool: "projectReadFile", access: "read", args: [] }],
      subagents: []
    }
    const calls: string[] = []
    const fakeDriver: Driver = {
      id: "fake",
      capabilities: {
        provider: { _tag: "Configurable" }, granularity: "event", thinking: false, cancel: false,
        pause: false, resume: false, fork: "none", tools: "native", toolCalls: "observe",
        structuredOutput: "native", sandbox: "none", subagents: false
      },
      start: (request) => Effect.sync(() => {
        // 与真实 driver（如 Codex）一致：system + current 拼成完整 prompt。
        calls.push([renderSystem(request.context), render(request.context)].filter(Boolean).join("\n\n"))
        return {
          step: Effect.succeed({ _tag: "Result", value: { summary: "干净", verdict: "ok" } })
        }
      })
    }
    const program = compileSpec(spec, { selectDriver: () => fakeDriver })
    const result = await Effect.runPromise(program.run("审查 src/core.ts") as never) as unknown as { output: unknown }
    expect(result.output).toEqual({ summary: "干净", verdict: "ok" })
    expect(calls[0]).toContain("Act on the supplied context")
    expect(calls[0]).toContain("审查 src/core.ts")
  })
})

/** 精确字面量类型，避免 field.kind 被拓宽成 string。 */
type FieldSpec = {
  id: string
  system: string
  driver: string
  output: ReadonlyArray<{ name: string; field: Field }>
  ops: ReadonlyArray<{ tool: string; access: "read" | "write"; args: ReadonlyArray<{ name: string; value: string }> }>
  subagents: ReadonlyArray<{ id: string; system: string; ops: FieldSpec["ops"] }>
}

// ── decodeAgentSpec：meta-agent 输出契约 ──

describe("decodeAgentSpec", () => {
  test("decodes a valid spec", async () => {
    const spec = await Effect.runPromise(decodeAgentSpec({
      id: "A", system: "s", driver: "reasoner", output: [{ name: "x", field: { kind: "string" } }],
      ops: [], subagents: []
    }))
    expect(spec.id).toBe("A")
  })

  test("rejects a malformed spec", async () => {
    const exit = await Effect.runPromiseExit(decodeAgentSpec({ id: 42 }))
    expect(exit._tag).toBe("Failure")
  })
})

// ── renderSpec：Route B 渲染源码 ──

describe("renderSpec", () => {
  test("writes a syntactically valid TS file", async () => {
    const spec: FieldSpec = {
      id: "RenderedAgent",
      system: "你是审查员。",
      driver: "claude-code",
      output: [{ name: "verdict", field: { kind: "enum", values: ["ok", "bad"] } }],
      ops: [{ tool: "projectReadFile", access: "read", args: [] }],
      subagents: []
    }
    const path = resolve("test/.tmp-rendered-agent.ts")
    const written = await Effect.runPromise(renderSpec(spec, path))
    expect(written).toBe(path)
    const source = await Bun.file(path).text()
    expect(source).toContain("Agent")
    expect(source).toContain("Until.schema(GeneratedOutput)")
    expect(source).toContain('TOOLS["projectReadFile"]')

    // 用 TypeScript transpile 做语法校验（不产生文件、不检查类型）。
    const ts = await import("typescript")
    const result = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.NodeNext, target: ts.ScriptTarget.ES2023 },
      fileName: path
    })
    expect(result.diagnostics?.length ?? 0).toBe(0)
  })
})
