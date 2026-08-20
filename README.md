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
import { Agent, AgentContext, Providers, Until } from "effect-agent"

const program = Effect.gen(function*() {
  const driver = yield* Providers.agent()

  const assistant = Agent
    .define<string>(AgentContext.current)
    .returns(Until.stop)
    .implementedBy(driver)

  return yield* assistant.run("用三句话解释 Effect 的依赖注入")
})

const result = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" })))
)

console.log(result.output)
```

## 核心概念

- `Agent`：一个请求的边界（循环契约：输入/输出/资源/执行/停条件）；
- `Context`：Agent 当前获得的输入和状态；
- `Binding`：Agent 可访问的环境资源；
- `Op`：Binding 提供的可执行能力；
- `Container`：一组有边界的 Binding（工具集）；
- `Driver`：模型 SDK 或完整 Agent 的适配器；
- `Until`：观察投影——推进到什么阶段拿什么（`schema`/`toolCall`/`stop`）；
- `Stage`/`Gates`：执行编排——推进路径 + 按阶段解锁工具/容器/规则；
- `Resource`：可访问/可协作的东西（注入/帧视图/租约）；
- `Connection`：把远程资源/容器接过来给 agent（transport 是实现）；
- `Group`/`Organization`：组织 agent 的范围；
- `Messenger`：通信方式（应答/双向/邮件）；
- `Result`：最终输出和执行细节。

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
- [草案](./DRAFT.md)
- [示例](./examples/README.md)
