import { Effect, pipe, Schema } from "effect"
import { Agent, AgentContext, Stage, then, Until, type Driver } from "../src/index.js"

/**
 * 示例 21：执行编排 —— 自由模式 vs 显式编排。
 *
 * 目标：验证同一套 Agent API 能否表达两种极端：
 *   - 自由模式（无 stages/gates）：agent 完全自由跑，评测 LLM 能力用
 *   - 显式编排（stages/gates）：agent 按阶段推进、解锁
 *
 * 这检验框架的「缺省 = 自由」原则（DESIGN）。
 */

const fakeDriver: Driver = {
  id: "fake",
  capabilities: {
    provider: { _tag: "Configurable" }, granularity: "run", thinking: false,
    cancel: false, pause: false, resume: false, fork: "none",
    tools: "native", toolCalls: "observe", structuredOutput: "native", sandbox: "none", subagents: false,
  },
  start: (request) => Effect.succeed({
    step: Effect.succeed({ _tag: "Result", value: { text: "ok", stages: request.context.stages?.marks.map(m => m.tool), gates: request.context.gates.length } } as any),
  }),
}

const Answer = Schema.Struct({ text: Schema.String, stages: Schema.optional(Schema.Array(Schema.String)), gates: Schema.optional(Schema.Number) })

// ── 1. 自由模式：不指定 stages/gates ──
const FreeAgent = Agent
  .define<string>("Free", (t) => AgentContext.current(t))
  .returns(Until.schema(Answer))
  .implementedBy(fakeDriver)

// ── 2. 显式编排：指定 stages/gates ──
const OrchestratedAgent = Agent
  .define<string>("Orchestrated", (t) => AgentContext.current(t))
  .returns(Until.schema(Answer))
  .stages(pipe(
    Stage.guard("search", { tools: { search: "allow", submit: "deny" } }),
    then("read"),
    then("submit", { tools: { submit: "allow" } }),
  ))
  .implementedBy(fakeDriver)

const free = await Effect.runPromise(FreeAgent.run("自由跑"))
const orchestrated = await Effect.runPromise(OrchestratedAgent.run("按阶段跑"))

console.log("自由模式: stages =", free.output.stages?.join(" → ") ?? "(无，自由跑)", "| gates =", free.output.gates ?? 0)
console.log("显式编排: stages =", orchestrated.output.stages?.join(" → "), "| gates =", orchestrated.output.gates)
console.log("\n结论: 同一套 Agent API，缺省即自由，显式即编排。")
