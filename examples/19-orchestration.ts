import { Effect, pipe, Schema } from "effect"
import { Agent, AgentContext, Stage, then, Until, type Driver } from "../src/index.js"

/**
 * 示例 19：执行编排接入 Agent —— Stage（每阶段自带解锁配置）。
 *
 * 场景：一个「代码审查」agent。
 *   阶段 0：列出项目文件（list_dir），只读角色
 *   阶段 1：读取关键文件（read_file），解锁提交
 *   阶段 2：提交审查结论（submit），收敛角色
 */

const plan = pipe(
  Stage.guard("list_dir", {
    always: "你是只读代码审查者，只能读不能改。",
    container: ["filesystem"],
    tools: { list_dir: "allow", read_file: "allow", submit: "deny" },
  }),
  then("read_file", {
    always: "你已经看到代码，开始找问题。",
    tools: { submit: "allow", structuredOutput: "show" },
  }),
  then("submit", {
    always: "现在收敛，返回结构化审查结论。",
    tools: { commit: "deny" },
  }),
)

const Review = Schema.Struct({
  summary: Schema.String,
  findings: Schema.Array(Schema.String),
})

const fakeDriver: Driver = {
  id: "fake",
  capabilities: {
    provider: { _tag: "Configurable" }, granularity: "run", thinking: false,
    cancel: false, pause: false, resume: false, fork: "none",
    tools: "native", toolCalls: "observe", structuredOutput: "native", sandbox: "none", subagents: false,
  },
  start: (request) => Effect.succeed({
    step: Effect.succeed({
      _tag: "Result",
      value: {
        summary: "审查完成",
        findings: ["编排已接入 Agent 定义流"],
        _stages: request.context.stages?.marks.map(m => m.tool).join(" → "),
        _gateCount: request.context.gates.length,
      },
    } as any),
  }),
}

const Reviewer = Agent
  .define<string>("Reviewer", (task) => AgentContext.current(task))
  .returns(Until.schema(Review))
  .stages(plan)
  .implementedBy(fakeDriver)

const result = await Effect.runPromise(Reviewer.run("审查 src/core.ts"))

console.log("编排已接入 Agent：")
console.log("  推进路径:", (result.output as any)._stages)
console.log("  阶段门数:", (result.output as any)._gateCount)
console.log("  结论:", result.output.summary)
