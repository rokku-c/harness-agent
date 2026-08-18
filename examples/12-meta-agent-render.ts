/**
 * 示例 12（Route B）—— meta-agent 产出 AgentSpec，宿主把 spec 渲染成一份可 review 的源码文件。
 *
 * 流程：
 *   1) 原生 provider 驱动跑 meta-agent（输出被 AgentSpec Schema 强制校验）；
 *   2) 宿主 renderSpec 把 spec 渲染成 `examples/generated/<id>.ts`（类型安全、可 review、可直跑）；
 *   3) 打印生成文件的路径和内容概要。
 *
 * 与 11 的区别：Route A 的产物只活在运行时；Route B 的产物是真实源码，可以人工 review、
 * 修改后再跑。生成的源码里的 execute 全部来自宿主工具注册表（TOOLS），LLM 从未写过副作用。
 *
 * 用法：
 *   bun run example meta-agent-render                       # 用 config.toml 的 default provider
 *   bun run example meta-agent-render "<要求>"              # 自定义要求
 *   bun run example meta-agent-render "<要求>" --provider reasoner
 *   META_AGENT_VERBOSE=1 bun run example meta-agent-render ...   # 打印 spec 审计信息
 *
 * 运行生成的 Agent：
 *   bun run examples/generated/<id>.ts -- "<任务>"
 */
import { Effect } from "effect"
import { resolve } from "node:path"
import {
  Harness,
  Providers
} from "effect-agent"
import { DetailHook } from "./hooks/detailed-review.js"
import {
  decodeAgentSpec,
  emitSpecEvent,
  makeMetaAgent,
  renderSpec
} from "./lib/agent-spec.js"

const args = Bun.argv.slice(3)
const providerFlag = args.indexOf("--provider")
const providerName = providerFlag !== -1 ? args[providerFlag + 1] : undefined
const positional = args.filter((arg) => !arg.startsWith("-"))
const requirement =
  positional[0] ??
  "做一个审查 agent：只读查看 src/，产出结构化发现（severity / file / title / recommendation）"

const outDir = resolve(import.meta.dir, "generated")

const program = Effect.gen(function*() {
  const providers = yield* Providers
  // 原生驱动：一次普通 provider 调用，输出被 AgentSpec Schema 校验。
  const native = providers.agent(providerName)
  const observed = Harness.withHooks(native, DetailHook)

  // 1) meta-agent：把用户要求编译成一份 AgentSpec。
  const meta = makeMetaAgent(observed)
  const specResult = yield* meta.run(requirement)
  const spec = yield* decodeAgentSpec(specResult.output)
  yield* emitSpecEvent(`AgentSpec 产出: driver=${spec.driver} ops=${spec.ops.map((o) => o.tool).join(",")} output=${spec.output.map((o) => o.name).join(",")}`)

  // 2) 宿主把 spec 渲染成可 review / 可直跑的源码文件（Route B）。
  const outPath = resolve(outDir, `${spec.id}.ts`)
  const written = yield* renderSpec(spec, outPath)

  return { spec, written }
})

const { spec, written } = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" })))
) as unknown as {
  spec: { id: string; driver: string; output: Array<{ name: string }>; ops: Array<{ tool: string }> }
  written: string
}

console.log("\n=== meta-agent 产出的 AgentSpec ===")
console.log(JSON.stringify(spec, null, 2))
console.log("\n=== 生成的源码文件 ===")
console.log(`  写入: ${written}`)
console.log(`  直跑: bun run examples/generated/${spec.id}.ts -- "<任务>"`)
