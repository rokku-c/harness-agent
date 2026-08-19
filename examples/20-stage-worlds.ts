import { pipe, Schema } from "effect"
import { Gate, Stage, then, Until } from "../src/index.js"

/**
 * 示例 18：执行编排 —— 分阶段解锁不同世界。
 *
 * 目标：验证 Stage/Until/Gates 能表达「不同阶段 agent 触及不同世界」的场景。
 *
 * 场景：一个「项目调研 + 产出建议」agent。
 *   阶段 0：先读项目文档（doc 容器，只读）
 *   阶段 1：再查代码（code 容器，只读）
 *   阶段 2：最后给建议（解锁结构化输出 + 提交）
 *
 * 验证点：
 *   - 不同阶段挂载不同容器（doc → code）
 *   - 角色随阶段变化（调研者 → 建议者）
 *   - 结构化输出只在最后阶段解锁
 */

const plan = pipe(
  Stage.guard("doc.search"),      // 阶段0：查文档
  then("code.search"),            // 阶段1：查代码
  then("submit"),                 // 阶段2：提交建议
)

const gates = [
  Gate.at(0, {
    always: "你是项目调研者，只读文档，先了解项目背景。",
    container: ["doc"],           // 阶段0：只有文档容器
    tools: { doc_search: "allow", code_search: "deny", submit: "deny" },
  }),
  Gate.at(1, {
    always: "背景清楚了，现在深入代码，关注实现与潜在问题。",
    container: ["code"],          // 阶段1：解锁代码容器
    tools: { code_search: "allow", submit: "deny" },
  }),
  Gate.at(2, {
    always: "调研完成，现在收敛成可执行的建议。",
    tools: { structuredOutput: "show", submit: "allow" },
  }),
]

const Advice = Schema.Struct({
  title: Schema.String,
  rationale: Schema.String,
  steps: Schema.Array(Schema.String),
})

const until = Until.schema(Advice)

// 评估：不同阶段 agent 能看到/用到的东西
console.log("阶段容器解锁:")
for (const g of gates) {
  const tools = Object.entries(g.tools ?? {})
    .filter(([, access]) => access === "allow" || access === "show")
    .map(([name]) => name)
  console.log(`  阶段${g.at}: 角色「${g.always?.slice(0, 12)}…」 容器[${g.container?.join(", ") ?? "无"}] 可用[${tools.join(", ")}]`)
}
console.log("\n观察:", until._tag === "Schema" ? "产出 Advice 结构" : until._tag)
