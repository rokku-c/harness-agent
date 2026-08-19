import { pipe, Schema } from "effect"
import { Gate, Stage, then, Until } from "../src/index.js"

/**
 * 示例 17：执行编排 —— Stage / Until / Gates 组合子。
 *
 * 目标：让 agent 以「我们想要的方式」工作——推进到什么阶段、拿什么、什么可用。
 *
 * 场景：一个「代码审查」agent。
 *   阶段 0：列出项目文件（list_dir）
 *   阶段 1：读取关键文件（read_file）
 *   阶段 2：提交审查结论（submit）
 */

// ── 1. Stage：推进路径（pipe 风格）──
const plan = pipe(
  Stage.guard("list_dir"),
  then("read_file"),
  then("submit"),
)

console.log("Stage 推进路径:", plan.marks.join(" → "))

// ── 2. Gates：解锁投影 ──
const gates = [
  Gate.at(0, {
    always: "你是只读代码审查者，只能读不能改。",
    container: ["filesystem"],
    tools: { list_dir: "allow", read_file: "allow", submit: "deny" },
  }),
  Gate.at(1, {
    always: "你已经看到代码，开始找问题。",
    tools: { submit: "allow", structuredOutput: "show" },
  }),
  Gate.at(2, {
    always: "现在收敛，返回结构化审查结论。",
    tools: { commit: "deny" },
  }),
]

// ── 3. Until：观察投影 ──
const Review = Schema.Struct({
  summary: Schema.String,
  findings: Schema.Array(Schema.String),
})

const until = Until.schema(Review)     // 推进到产出符合 Review

console.log("Gates 阶段数:", gates.length)
console.log("Until:", until._tag === "Schema" ? "等 schema 产出" : until._tag)

console.log("\n编排完成：")
console.log("  推进:", plan.marks.map(m => `→${m}`).join(" "))
console.log("  观察:", "产出 Review 结构")
console.log("  约束:", "阶段0禁submit → 阶段1解锁 → 阶段2禁commit")
