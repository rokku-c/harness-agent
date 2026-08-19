import { pipe, Schema } from "effect"
import { Stage, then, Until } from "../src/index.js"

/**
 * 示例 20：执行编排 —— 分阶段解锁不同世界。
 *
 * 场景：一个「项目调研 + 产出建议」agent。
 *   阶段 0：先读项目文档（doc 容器，只读）
 *   阶段 1：再查代码（code 容器，只读）
 *   阶段 2：最后给建议（解锁结构化输出 + 提交）
 */

const plan = pipe(
  Stage.guard("doc.search", {
    always: "你是项目调研者，只读文档，先了解项目背景。",
    container: ["doc"],
    tools: { doc_search: "allow", code_search: "deny", submit: "deny" },
  }),
  then("code.search", {
    always: "背景清楚了，现在深入代码，关注实现与潜在问题。",
    container: ["code"],
    tools: { code_search: "allow", submit: "deny" },
  }),
  then("submit", {
    always: "调研完成，现在收敛成可执行的建议。",
    tools: { structuredOutput: "show", submit: "allow" },
  }),
)

const Advice = Schema.Struct({
  title: Schema.String,
  rationale: Schema.String,
  steps: Schema.Array(Schema.String),
})

const until = Until.schema(Advice)

// 评估：不同阶段 agent 能看到/用到的东西
console.log("阶段容器解锁:")
plan.marks.forEach((mark, i) => {
  const tools = Object.entries(mark.gate?.tools ?? {})
    .filter(([, access]) => access === "allow" || access === "show")
    .map(([name]) => name)
  console.log(`  阶段${i}: ${mark.tool} 角色「${mark.gate?.always?.slice(0, 12)}…」 容器[${mark.gate?.container?.join(", ") ?? "无"}] 可用[${tools.join(", ")}]`)
})
console.log("\n观察:", until._tag === "Schema" ? "产出 Advice 结构" : until._tag)
