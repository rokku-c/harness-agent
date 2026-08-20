/**
 * 由 meta-agent 生成的 Agent（examples/12-meta-agent-render.ts 产出）。
 * spec: RenderedAgent / driver: claude-code
 * 结构由宿主 renderSpec 渲染，可 review 后自行修改。
 *
 * 直跑：bun run examples/generated/RenderedAgent.ts -- "<task>"
 */
import { Effect, Schema } from "effect"
import { Agent, ClaudeCode, ConsoleHook, Context, Harness, Until, type Driver } from "effect-agent"
import { TOOLS } from "../lib/agent-spec.js"

// 生成的输出 Schema（宿主从 spec.output 编译）。
export const GeneratedOutput = Schema.Struct({
    "verdict": Schema.Union(...["ok","bad"].map((v) => Schema.Literal(v)))
})

export const makeGeneratedAgent = (driver: Driver) => {
  let builder = Agent
    .define<string>()
    .returns(Until.schema(GeneratedOutput))

  // 宿主工具注册表：execute 全部由宿主实现。
  builder = builder.uses(TOOLS["projectReadFile"]({}))

  // 运行时派生的子代理（仅在 driver 支持时可用，如 claude-code）。


  return builder
}

// 直跑模式：bun run examples/generated/RenderedAgent.ts -- "<task>"
if (process.argv[1] && import.meta.path === process.argv[1]) {
  const driver = Harness.withHooks(ClaudeCode.make(), ConsoleHook)
  const task = process.argv[2] ?? "运行生成的任务"
  Effect.runPromise(makeGeneratedAgent(driver).implementedBy(driver).run(task))
    .then((result) => { console.log(JSON.stringify(result.output, null, 2)); process.exit(0) })
    .catch((cause) => { console.error(cause); process.exit(1) })
}
