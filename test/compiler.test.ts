import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  AgentIRSchema,
  defaultToSchema,
  EffectAgent,
  type Driver,
} from "../src/index.js"

/** 一个 fake driver：把 context.messages 文本喂给 step 返回的固定值。 */
const fakeDriver = (respond: (prompt: string) => unknown): Driver => ({
  id: "fake",
  capabilities: {
    provider: { _tag: "Configurable" }, granularity: "event", thinking: false, cancel: false,
    pause: false, resume: false, fork: "none", tools: "native", toolCalls: "observe",
    structuredOutput: "native", sandbox: "none", subagents: false
  },
  start: (request) => Effect.sync(() => ({
    step: Effect.succeed({
      _tag: "Result",
      value: respond(request.context.messages.map((m) => m.content).join(" "))
    })
  }))
})

/** review 输出：{ verdict: "ok" | "revise" } 的 JSON Schema。 */
const reviewJson = {
  type: "object" as const,
  properties: { verdict: { type: "string" as const } },
  required: ["verdict"],
}

const driver = fakeDriver((input) => input.includes("问题")
  ? { verdict: "ok" }
  : { verdict: "revise" })

describe("EffectAgent 编译器", () => {
  test("gen 收集 IR（纯数据描述）", () => {
    const ir = EffectAgent.gen(function*() {
      yield EffectAgent.define("reviewer")
      yield EffectAgent.role("审查项目")
      yield EffectAgent.produces({ kind: "stop" })
      yield EffectAgent.driver("composed", "claude-code")
    })
    expect(ir.id).toBe("reviewer")
    expect(ir.role).toBe("审查项目")
    expect(ir.produces).toEqual({ kind: "stop" })
    expect(ir.driver).toEqual({ kind: "composed", name: "claude-code" })
  })

  test("IR 可 JSON 序列化（Schema 往返）", async () => {
    const ir = EffectAgent.gen(function*() {
      yield EffectAgent.define("reviewer")
      yield EffectAgent.produces({ kind: "schema", schema: reviewJson })
      yield EffectAgent.driver("composed", "claude-code")
    })
    // encode → JSON → decode
    const encoded = await Effect.runPromise(Schema.encode(AgentIRSchema)(ir))
    const json = JSON.parse(JSON.stringify(encoded))
    const decoded = await Effect.runPromise(Schema.decodeUnknown(AgentIRSchema)(json))
    expect(decoded.id).toBe("reviewer")
    expect(decoded.produces.kind).toBe("schema")
  })

  test("compile 把 IR 编译成可运行 AgentProgram", async () => {
    const ir = EffectAgent.gen(function*() {
      yield EffectAgent.define("reviewer")
      yield EffectAgent.produces({ kind: "schema", schema: reviewJson })
      yield EffectAgent.driver("composed", "claude-code")
    })

    const program = EffectAgent.compile(ir, {
      resolveDriver: () => driver,
      toSchema: defaultToSchema,
    })

    const result = await Effect.runPromise(program.run("有个问题"))
    expect((result.output as { verdict: string }).verdict).toBe("ok")
  })

  test("gen 产出 IR 后再编译 —— 描述与运行分离", async () => {
    // 第一步：gen 产出纯数据 IR。
    const ir = EffectAgent.gen(function*() {
      yield EffectAgent.define("planner")
      yield EffectAgent.produces({ kind: "stop" })
      yield EffectAgent.driver("provider", "reasoner")
    })
    // IR 是纯数据（可 JSON 序列化）。
    expect(JSON.stringify(ir)).toContain('"id":"planner"')

    // 第二步：compile 把 IR 编译到具体 driver。
    const program = EffectAgent.compile(ir, {
      resolveDriver: (ref) => {
        expect(ref).toEqual({ kind: "provider", name: "reasoner" })
        return fakeDriver(() => "ok")
      },
      toSchema: defaultToSchema,
    })
    const result = await Effect.runPromise(program.run("task"))
    expect(result.output).toBe("ok")
  })
})
