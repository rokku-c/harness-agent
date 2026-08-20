import { Effect, pipe, Schema } from "effect"
import { Context, Stage, then, runStagedDriver, type Driver } from "../src/index.js"

/**
 * 示例 27：阶段推进引擎 —— 按 Stage.marks 逐步推进，每个工具调用到达就解锁下一阶段 Gate。
 *
 * 场景：一个「结构化审查」agent（fake driver，不耗 API）。
 *   阶段 0：列出项目文件（list_dir）→ 解锁「只读审查者」规则 + 禁用 submit
 *   阶段 1：读取关键文件（read_file）→ 解锁「开始找问题」
 *   阶段 2：提交审查结论（submit）→ 解锁「现在收敛」
 */

const plan = pipe(
  Stage.guard("list_dir", {
    always: "你是只读代码审查者，只能读不能改。",
    tools: { list_dir: "allow", read_file: "allow", submit: "deny" },
  }),
  then("read_file", {
    always: "你已经看到代码，开始找问题。",
    tools: { submit: "allow" },
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

/** fake driver：逐事件 emit 工具调用（按 stage 顺序），最后 emit Result —— 不碰真实 LLM。 */
const stagedFakeDriver: Driver = {
  id: "fake-staged",
  capabilities: {
    provider: { _tag: "Configurable" }, granularity: "event", thinking: false,
    cancel: false, pause: false, resume: false, fork: "none",
    tools: "native", toolCalls: "intercept", structuredOutput: "native", sandbox: "none", subagents: false,
  },
  start: () => Effect.sync(() => {
    let i = 0
    const marks = ["list_dir", "read_file", "submit"]
    return {
      step: Effect.sync(() => {
        if (i < marks.length) {
          const name = marks[i]!
          i += 1
          return { _tag: "Detail", detail: { _tag: "ToolCall", id: `t${i}`, name, input: {} } } as const
        }
        return {
          _tag: "Result",
          value: {
            summary: "审查完成",
            findings: ["阶段引擎按 marks 逐步推进，gate 随阶段解锁"],
          },
        } as const
      }),
    }
  }),
}

const context = Context.with({
  messages: [{ role: "user", content: "审查 src/core.ts" }],
  always: [{ _tag: "Always", text: "审查代码" }],
})

const result = await Effect.runPromise(runStagedDriver(stagedFakeDriver, context, plan))

console.log("阶段推进引擎（fake driver，不耗 API）：")
console.log("  到达工具:", result.reachedTools.join(" → "))
console.log("  每阶段解锁指令:", result.gatesApplied.map((g) => `"${g.always}"`).join(", "))
console.log("  里程碑阶段索引:", result.progression.map((p) => p.index).join(" → "))
console.log("  结论:", (result.output as any).summary)
console.log("  findings:", (result.output as any).findings.join(" / "))
