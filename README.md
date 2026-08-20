# effect-agent

基于 Effect v3 的统一 Agent 编程模型。

> Agent 是由 Context 触发、通过 Binding 作用于环境、由 Driver 执行并返回 Result 的 Effect 程序。

## 快速开始

```sh
bun install
# 配置 provider（默认读取 config.toml 与 .env，均被 gitignore 忽略）
cp agents.example.toml config.toml
# 在 .env 里填 API key，或在 config.toml 里直接写 apiKey = "sk-..."
bun run example            # 列出所有示例
bun run example 01-text    # 运行某个示例
```

`config.toml` 声明 provider（`[providers.<name>]`）与驱动选择（`driver = "native" | "vercel" | "effect"`）。示例都默认读取根目录 `config.toml`；缺配置时运行会以 `ProviderConfigError` 失败。

## 示例

```ts
import { Effect } from "effect"
import { Agent, Providers, Until } from "effect-agent"

const program = Effect.gen(function*() {
  const driver = yield* Providers.agent()

  const assistant = Agent
    .define<string>()
    .returns(Until.stop)
    .implementedBy(driver)

  return yield* assistant.run("用三句话解释 Effect 的依赖注入")
})

const result = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" })))
)

console.log(result.output)
```

也可以声明式描述 agent（编译器形态），编译成 IR 再运行：

```ts
import { EffectAgent, defaultToSchema } from "effect-agent"

const ir = EffectAgent.gen(function*() {
  yield EffectAgent.define("reviewer")
  yield EffectAgent.produces({ kind: "stop" })
  yield EffectAgent.driver("composed", "claude-code")
})
// ir: AgentIR —— 纯数据描述，可序列化、可被 meta-agent 生成
const program = EffectAgent.compile(ir, { resolveDriver, toSchema: defaultToSchema })
```

## 核心概念

- `Agent`：一个请求的边界（循环契约：输入/输出/资源/执行/停条件）；
- `Context`：Agent 的认知状态（`messages`/`always`/`until`/`details`，无 prompt 概念）；
- `Binding`：Agent 可访问的环境资源；
- `Op`：Binding 提供的可执行能力；
- `Container`：一组有边界的 Binding（工具集）；
- `Driver`：模型 SDK 或完整 Agent 的适配器；
- `Until`：观察投影——推进到什么阶段拿什么（`schema`/`toolCall`/`stop`）；
- `Stage`/`Gates`：执行编排——推进路径 + 按阶段解锁工具/容器/规则（已实现 `runStaged` 引擎）；
- `Resource`：可访问/可协作的东西（注入/帧视图/租约）；
- `Connection`：把远程资源/容器接过来给 agent（`makeConnection` 通用工厂 + ssh/http transport）；
- `Group`/`Organization`：组织 agent 的范围；
- `Messenger`：通信方式（应答/双向/邮件）；
- `AgentIR`/`EffectAgent`：agent 编译器——声明式描述语言，compile 成可运行程序；
- `Session` 介入：pause/resume/cancel/redirect（GOAL「可观测/介入」）；
- `EffectAgentMcp`：把 agent 暴露为 MCP 工具（GOAL「被其他 agent 消费」）；
- `Result`：最终输出和执行细节。

## MCP 服务器

```sh
bun run mcp-server          # 启动 stdio MCP 服务器，暴露 agent 工具
claude mcp add effect-agent -- bun run /path/to/src/mcp-server.ts
```

## 开发

```sh
bun install
bun run typecheck
bun test
bun run example
```

## 文档

- [目标](./GOAL.md)
- [设计](./DESIGN.md)
- [指南](./GUIDELINES.md)
- [草案](./DRAFT.md)
- [示例](./examples/README.md)
