# @effect-agent/ioecc

**IOECC（Input / Output / Effect / Connection / Control）—— 基于 Effect v3 的声明式 Agent 底座。**

Agent 是对五个正交维度的**纯描述**，不执行、不携带操作契约。驱动、执行、连接都在「compile」时注入（`EffectAgent.gen`），于是同一个描述可以被不同的 driver / Connection 实现解释，从而获得多运行时、可观测、可组合的 Agent 系统。

## 核心概念

IOECC 的五个正交维度：

| 维度 | 名称 | 含义 |
| --- | --- | --- |
| I | `input` | Agent 接收的数据形状（`Schema`） |
| O | `output` | Agent 产出给下游的数据形状（`Schema`） |
| E | `effects` | 对世界的影响声明：哪个 Connection 的外部受可观测影响 |
| C | `connections` | 世界：Agent 连接的环境 / 容器（抽象边界，非运行时实现） |
| C | `controls` | 对自身的控制声明：静态 Trigger 或动态干预（Fork/Stop/Retry） |

几个关键结论，理解了它们就理解了整个底座：

- **Agent 是纯描述**（被动黑盒），不执行，不携带操作契约。它的五个字段全是形状与声明。
- **Driver = Agent**。任何 Agent 都可以当 driver——五维度填 provider 适配即可，因此驱动是**递归**的。一个 agent 可以有 **n 个** driver（`drivers` 数组）。具体 driver 是 Agent 实例，内部可以有自己的方法（如 `run`），但那是具体 driver 自己的，非核心强制。
- **Control 是类**：用户继承 `Control<I, O>`，写 `constructor`（构造）与 `run(...)`（逻辑，用具体 driver 的能力写）。
- **`EffectAgent.gen({五维度}, [drivers], impls?)` 产出 `Program`**，带 `drive` / `execute` / `decode`；`drive` 执行 driver 声明的 control，`execute` 按 connection 路由 Effect，`decode` 用 output Schema 解码。
- **驱动靠 driver 声明的 control**——不是 driver.run，而是 driver 在 `controls` 里声明的 Control 实现。
- **拓扑由 Connection 长出来**——多个 Agent 共享同一个 Connection 实现即协作，这是外围概念而非核心。

## 快速开始（约 20 行）

一个最小 agent：声明 + 驱动。

```ts
import { Effect, Schema } from "effect"
import { Control, Driver, EffectAgent } from "@effect-agent/ioecc"

// 1) 一个 Control 实现：用「具体 driver 的能力」写逻辑（这里 cast 到带 run 的 driver）
class RunLogic<I, O> extends Control<I, O> {
  constructor() { super("RunLogic") }
  run(_i: I, _o: O, _e: readonly any[], _cn: readonly any[], _ct: readonly any[], d: Driver): Effect.Effect<O, Error> {
    const concrete = d as unknown as { run: (i: I) => Effect.Effect<O, Error> }
    return concrete.run(_i)                 // 具体 driver 的实现能力
  }
}

// 2) driver 是 Agent（五维度），声明自己的 control（能力）+ 具体 run 方法
const driver = {
  input: Schema.String,
  output: Schema.String,
  effects: [],
  connections: [],
  controls: [new RunLogic<string, string>()],   // driver 声明 control
  drivers: [],
  run: (input: string) => Effect.succeed(`driven:${input}`),
}

// 3) gen：五维度 + drivers（n 个）作入参，直接产出可运行程序
const agent = EffectAgent.gen({
  input: Schema.String,
  output: Schema.String,
  effects: [],
  connections: [],
  controls: [],
}, [driver])

// 4) 驱动：执行 driver 声明的 control（RunLogic → driver.run）
const out = await Effect.runPromise(agent.drive(0, "hello"))
console.log(out)
```

## 完整示例：天气记录 Agent

完整代码在 [`examples/01-weather-record.ts`](./examples/01-weather-record.ts)。

一个天气记录 agent 声明对三个 World 的影响（WeatherApp / Logs / Filesystem），三种操作契约通过同一个 driver 驱动的 Control 执行：

```ts
import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, Driver, EffectAgent } from "@effect-agent/ioecc"

// E：只声明「哪个 Connection 的外部受影响」，不携带操作契约
const fetchWeather = { _tag: "FetchWeather", connection: "WeatherApp" } as const
const logInfo     = { _tag: "LogInfo",     connection: "Logs" }         as const
const writeFile   = { _tag: "WriteFile",   connection: "Filesystem" }   as const

// Control 实现：经具体 driver 的 run 驱动
class RunLogic<I, O> extends Control<I, O> {
  constructor() { super("RunLogic") }
  run(_i: I, _o: O, _e: readonly any[], _cn: readonly any[], _ct: readonly any[], d: Driver): Effect.Effect<O, Error> {
    const concrete = d as unknown as { run: (i: I) => Effect.Effect<O, Error> }
    return concrete.run(_i)
  }
}

// driver：Agent（五维度），声明 RunLogic control + 具体 run
const driver = {
  input: Schema.Struct({ city: Schema.String }),
  output: Schema.String,
  effects: [],
  connections: [],
  controls: [new RunLogic<{ city: string }, string>()],
  drivers: [],
  run: (input: { city: string }) => Effect.succeed(`Sunny in ${input.city}`),
}

// Connections 实现（操作契约在 compile 侧注入）
const impls = new Map<string, ConnectionImpl>([
  ["WeatherApp",  { handle: () => Effect.succeed("Sunny") }],
  ["Logs",        { handle: () => Effect.succeed(undefined) }],
  ["Filesystem",  { handle: () => Effect.succeed(undefined) }],
])

// gen：五维度 + drivers（n 个）+ impls，产出可运行程序
const program = EffectAgent.gen({
  input: Schema.Struct({ city: Schema.String }),
  output: Schema.Void,
  effects: [fetchWeather, logInfo, writeFile],
  connections: [{ name: "WeatherApp" }, { name: "Logs" }, { name: "Filesystem" }],
  controls: [],           // 控制由 driver 声明（RunLogic）
}, [driver], impls)

// 跑：先看描述，再执行
console.log(JSON.stringify(program.agent, null, 2))   // 此处注入 drivers，可读描述
const out = await Effect.runPromise(program.drive(0, { city: "Shanghai" }))
console.log("查询天气 →", out)
```

## 组合 / 拓扑：两 Agent 共享 Connection

完整代码在 [`examples/02-composed.ts`](./examples/02-composed.ts)。

Agent 之间**不直接调用**，而是共享同一个 Connection（如共享黑板 / 消息总线）。每个 agent 用 `EffectAgent.gen`（五维度 + drivers）声明；同一个 Connection 实现注入两者，证明「拓扑由 Connection 长出来，不是核心概念」。

```ts
// 共享 Bus Connection（拓扑长出来）
const sharedBus: ConnectionImpl = {
  handle: (e) => e._tag === "Publish" ? Effect.succeed("published") : Effect.succeed("consumed"),
}

// Agent A：生产者（定时发布到 Bus）
const producer = EffectAgent.gen({
  input: Schema.Void, output: Schema.Void,
  effects: [publish],
  connections: [{ name: "Bus" }],
  controls: [],
}, [driver], new Map([["Bus", sharedBus]]))

// Agent B：消费者（从 Bus 消费，通告到 Logs）
const consumer = EffectAgent.gen({
  input: Schema.Unknown, output: Schema.Void,
  effects: [consume, announce],
  connections: [{ name: "Bus" }, { name: "Logs" }],
  controls: [],
}, [driver], new Map([["Bus", sharedBus], ["Logs", { handle: () => Effect.succeed(undefined) }]]))

// 各自执行自己的 Effect——共享的 sharedBus 连接了这两个 Agent
const out      = await Effect.runPromise(producer.execute(publish))
const consumed = await Effect.runPromise(consumer.execute(consume))
```

## 与 effect-agent 主包的关系

`@effect-agent/ioecc` 是**独立底座**：它只定义概念（`concept.ts`）、声明编译（`gen.ts`）与 compiler（`compiler.ts`），是可运行的核心原语。上层 **effect-agent** 主包在此之上构建更完整的 Agent 运行时（提供具体 driver、更深度的观测 / 编排与工具链），面向特定使用场景。ioecc 本身不含任何运行时 driver、不绑定具体 provider，也不隐含某个 Agent 引擎——它是一个纯粹描述 + 可注入解释的声明式底座。

## 源码地图

- `src/concept.ts` —— 概念：`Effect`、`Control`（类）、`Connection`、`Agent`、`Driver`、`ConnectionImpl`、`CompileEnv`
- `src/gen.ts` —— `EffectAgent.gen` / `EffectAgent.make`、`Program`、`control` 工厂
- `src/compiler.ts` —— 任意 Agent 作 driver 的编译型（保留 `ConnectionImpl` 类型）
- `examples/` —— 完整可运行示例（01 天气记录、02 组成 / 拓扑）
- `test/core.test.ts` —— 用法测试（driver 声明 control、execute 路由、多 driver、观测）

运行示例：`bun examples/01-weather-record.ts`
