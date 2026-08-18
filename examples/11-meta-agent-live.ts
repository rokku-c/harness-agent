/**
 * 示例 11（Route A）—— meta-agent 运行时动态组装一个 Agent，并立即运行它。
 *
 * 流程：
 *   1) 原生 provider 驱动跑 meta-agent（输出被 AgentSpec Schema 强制校验）；
 *   2) 宿主 compileSpec 把 spec 编译成 AgentProgram；
 *   3) 立即用同一个原生驱动运行生成的 Agent，返回结构化输出。
 *
 * 与 12 的区别：这里不生成源码，spec 只活在运行时。Route B（渲染源码）见 12。
 *
 * 用法：
 *   bun run example meta-agent-live                    # 用 config.toml 的 default provider
 *   bun run example meta-agent-live "<要求>"           # 自定义要求
 *   bun run example meta-agent-live "<要求>" --provider reasoner
 *   META_AGENT_VERBOSE=1 bun run example meta-agent-live ...   # 打印 spec 审计信息
 *
 * 示例要求：
 *   "做一个审查 agent：只读查看 src/，产出结构化发现（severity / file / title / recommendation）"
 */
import { Effect, Schema } from "effect"
import {
  Agent,
  AgentContext,
  Harness,
  Providers,
  Until,
  type Result
} from "effect-agent"
import { DetailHook } from "./hooks/detailed-review.js"
import {
  compileSpec,
  decodeAgentSpec,
  emitSpecEvent,
  makeMetaAgent,
  selectDriver
} from "./lib/agent-spec.js"

const args = Bun.argv.slice(3)
const providerFlag = args.indexOf("--provider")
const providerName = providerFlag !== -1 ? args[providerFlag + 1] : undefined
const positional = args.filter((arg) => !arg.startsWith("-"))
const requirement =
  positional[0] ??
  "做一个审查 agent：只读查看 src/，产出结构化发现（severity / file / title / recommendation）"

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

  // 2) 宿主把 spec 编译成可运行的 AgentProgram（运行时动态组装）。
  //    claude-code / codex / pi 路由到 ComposedAgent，其余按 provider 名路由到原生驱动。
  const generated = compileSpec(spec, { selectDriver: (name) => selectDriver(name, providers) })

  // 3) 用同一个原生驱动运行生成的 Agent。
  const task = positional[1] ?? "运行生成的任务"
  const result = yield* generated.run(task)

  return { spec, result }
})

const { spec, result } = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" }))) as never
) as unknown as {
  spec: { id: string; driver: string; output: Array<{ name: string }>; ops: Array<{ tool: string }> }
  result: Result<unknown>
}

console.log("\n=== meta-agent 产出的 AgentSpec ===")
console.log(JSON.stringify(spec, null, 2))
console.log("\n=== 生成的 Agent 运行结果 ===")
console.log(JSON.stringify(result.output, null, 2))
