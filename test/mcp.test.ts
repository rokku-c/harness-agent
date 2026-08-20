import { describe, expect, test } from "bun:test"
import { defaultToSchema, EffectAgent } from "../src/index.js"
import { EffectAgentMcp } from "../packages/builtin/src/mcp.js"
import type { Driver } from "../src/index.js"
import { Effect } from "effect"

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

describe("EffectAgentMcp（GOAL 被 agent 消费）", () => {
  test("把 agent 暴露为 MCP 工具", () => {
    const ir = EffectAgent.gen(function*() {
      yield EffectAgent.define("reviewer")
      yield EffectAgent.role("审查项目")
      yield EffectAgent.produces({ kind: "stop" })
      yield EffectAgent.driver("composed", "claude-code")
    })
    const mcp = EffectAgentMcp.make({
      agents: [{
        name: "reviewer",
        ir,
        env: {
          resolveDriver: () => fakeDriver(() => "ok"),
          toSchema: defaultToSchema,
        },
      }],
    })
    // MCP server 构造成功（有 registered tools）。
    expect(mcp).toBeDefined()
  })

  test("validate 校验一份 IR 描述", async () => {
    const valid = await Effect.runPromise(EffectAgentMcp.validate({
      id: "a",
      produces: { kind: "stop" },
      driver: { kind: "composed", name: "claude-code" },
    }))
    expect(valid.id).toBe("a")

    const bad = await Effect.runPromiseExit(EffectAgentMcp.validate({ id: 42 }))
    expect(bad._tag).toBe("Failure")
  })
})
