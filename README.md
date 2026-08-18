# effect-agent

基于 Effect v3 的统一 Agent 编程模型。

> Agent 是由 Context 触发、通过 Binding 作用于环境、由 Driver 执行并返回 Result 的 Effect 程序。

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

- `Context`：Agent 当前获得的输入和状态；
- `Binding`：Agent 可访问的环境资源；
- `Op`：Binding 提供的可执行能力；
- `Driver`：模型 SDK 或完整 Agent 的适配器；
- `Until`：一次运行的结束条件；
- `Result`：最终输出和执行细节。

## 开发

```sh
bun install
bun run typecheck
bun test
bun run example
```

## 文档

- [设计草案](./DRAFT.md)
- [实现状态](./IMPLEMENTATION.md)
- [Core 与 Connection 架构方案](./CORE_CONNECTION_PLAN.md)
- [示例](./examples/README.md)
- [开发规范](./AGENTS.md)
