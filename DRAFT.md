# effect-agent

`effect-agent` 是建立在 Effect v3 上的统一 Agent 编程模型。

> Agent 是由 Context 触发、通过 Binding 作用于环境、由 Driver 执行并返回 Result 的 Effect 程序。

## 1. 最小示例

```ts
const Assistant = Agent
  .define<string>()
  .returns(Until.stop)
  .implementedBy(driver)

const result = yield* Assistant.run("解释 Effect 的依赖注入")
```

这个定义只有三部分：

```text
Context → Driver → Result
```

需要环境能力时再注入 Binding：

```ts
const Assistant = Agent
  .define<string>()
  .returns(Until.stop)
  .uses(Project)
  .implementedBy(driver)
```

## 2. 核心模型

```text
Context    Agent 当前获得的认知状态
Binding    Agent 可访问的环境资源
Op         Binding 提供的可执行能力
Container  一组有边界的 Binding
Connection 远程资源连接
Until      本次运行的结束条件
Driver     具体 Agent 执行器
Session    可逐步推进的运行实例
Result     最终输出与过程细节
```

### Context

Context 是一次运行的唯一输入：

- `always`：整个运行期间稳定的必要规则；
- `messages`：本 run 接收的消息序列（投递填充，只读；归一化 Message，与 Anthropic/OpenAI 同义，可互相转换，支持多媒体）；
- `access`：本次运行允许访问的 Binding；
- `until`：结束条件；
- `details`：可观测过程。

核心 harness 不出现 `prompt` 概念。输入完全通过 Messenger Delivery 传输，业务只读 `messages`；
业务代码优先传递结构化数据，不负责拼装 Driver Prompt。Driver 将 Context 投影为底层 SDK 所需的消息、指令和工具（渲染是驱动/适配职责，见 builtin/src/render.ts）。

### Binding 与 Op

Binding 表达环境资源：

```ts
interface Binding<A, E, R> {
  readonly uri: string
  readonly read?: Effect.Effect<unknown, E, R>
  readonly typed?: Effect.Effect<A, E, R>
  readonly ops?: ReadonlyArray<Op<any, any, any, any>>
}
```

- `read` 将资源内容注入 Context（materialize 时归一化为 user `Message`）；
- `typed` 供确定性 Effect 程序读取；
- `ops` 允许 Agent 主动操作资源。

Op 使用 Schema 定义输入输出，副作用保留在 Effect 中：

```ts
const ReadFile = Op.read({
  name: "project.readFile",
  description: "读取项目文件",
  input: Schema.Struct({ path: Schema.String }),
  output: Schema.String,
  execute: ({ path }) => Project.readFile(path)
})
```

`.uses(binding)` 只允许读取；`.writes(binding)` 同时允许写 Op。更细的路径、主机和资源范围由 Binding 自身定义。

### Driver

Driver 把统一 Context 投影到具体运行时：

```ts
interface Driver<R> {
  readonly capabilities: Capabilities
  readonly start: (request: DriverContext) =>
    Effect.Effect<DriverSession, AgentError, R>
}
```

官方模型 SDK、Claude Code、Codex 和 Pi 都只是 Driver。业务 Agent 不感知工具协议、MCP 通道或 SDK 会话格式。

### Until 与 Result

`Until` 描述单次运行边界：

- `Until.stop`：完整运行；
- `Until.schema(schema)`：返回经过 Schema 校验的值；
- `Until.text/thinking/toolCall`：只在 Driver 能力支持时使用。

```ts
interface Result<A> {
  readonly output: A
  readonly details: ReadonlyArray<Detail>
}
```

Driver 不支持所需边界时，运行前以 `UnsupportedCapability` 失败。

## 3. 架构就是能力组合

Agent 不需要业务名称。变量名用于代码可读性；运行 ID 只在观测和外部寻址时生成。

常见架构使用现有 Effect 与 Agent 组合表达：

```ts
// 并行探索
const results = yield* Agent.map(agents, input)

// 并行后收敛
const result = yield* Agent.reduce(agents, input, select)

// Pipeline
const draft = yield* analyse.run(input)
const output = yield* review.run(draft.output)

// Blackboard
const program = Effect.all([left.run(input), right.run(input)]).pipe(
  Effect.provide(Blackboard.layer())
)
```

Pipeline、Supervisor、Worker、Peer、Blackboard 和 Delegate 是组合方式，不是不同种类的 Agent。

## 4. AgentKeeper

Agent 表达一次运行。长期存活的 Agent 由可选的 `AgentKeeper` 托管：

```text
Queue<Input> → Agent.run(input) → Stream<Result>
```

```ts
interface AgentKeeper<I, O, E = never> {
  readonly send: (input: I) => Effect.Effect<void, E>
  readonly results: Stream.Stream<Result<O>, E>
  readonly shutdown: Effect.Effect<void>
}
```

AgentKeeper 使用 `Queue`、`Stream`、`Fiber` 和 `Scope` 管理输入排队、背压、并发、取消、重启和关闭。

消息架构只在 Keeper 之间需要异步、跨进程或持久化通信时引入。它是扩展，不是 Agent 核心。

## 5. 资源与位置

资源的语义身份与物理连接分离。

同一个 Project Binding 可以由本地目录或 SSH Layer 提供：

```ts
const Local = Project.layer({ root: "." })
const Remote = Project.layerSsh({ uri: "ssh://host/workspace" })
```

Agent 只依赖 Project 能力。资源策略决定是否向 Driver 暴露主机、路径和连接类型：

- `visible`：Agent 能区分物理位置；
- `abstract`：只暴露资源语义；
- `hidden`：完全隐藏传输和位置。

## 6. Harness 自我指涉

Harness 本身可以作为 Binding 注入：

```ts
const Self = Harness.binding({
  read: ["architecture", "runs", "events"],
  ops: ["run", "cancel", "delegate"]
})
```

Agent 因而能在权限范围内观察和使用 Harness。自我指涉仍受 Binding 权限、Schema、预算和审计约束。

## 7. MCP

Binding Ops 是统一能力边界，也应是 MCP 的优先映射单位：

```text
Binding Op ⇄ MCP Tool
Binding.read ⇄ MCP Resource
Harness event ⇄ MCP notification
```

这使 Claude Code 等外部 Agent 可以使用 Harness；外部 Agent 也可以通过文件和进程 Binding 编写并运行新的 Harness 程序。

MCP 是 Adapter，不进入 Agent 定义。

## 8. 依赖注入

外部依赖全部使用 `Context.Tag + Layer`：

```ts
const program = Effect.gen(function*() {
  const project = yield* Project
  const driver = yield* Providers.agent()
  return yield* makeAgent(project, driver).run(input)
}).pipe(
  Effect.provide(Project.layer({ root: "." })),
  Effect.provide(Providers.layer({ path: "config.toml" }))
)
```

Layer 决定具体资源和 Driver；Agent 定义只声明能力需求。

## 9. 设计优先级

1. 简洁：最少概念、最短定义、最小协议；
2. 依赖注入：实现由 Layer 提供；
3. 架构定义：组合关系先于运行细节；
4. 自我指涉：Harness 能作为受限环境被 Agent 使用；
5. MCP：能力拥有稳定外部协议；
6. 资源定义：语义、位置和可见性独立。

## 10. Effect 约束

- 副作用返回 `Effect`；
- 外部 Promise 使用细粒度 `Effect.tryPromise`；
- SDK 回调是唯一允许的 `Runtime.runPromise` 边界；
- 迭代使用递归 Effect、`Effect.iterate`、`Stream` 或 `Ref`；
- 外部依赖使用 `Context.Tag + Layer`；
- 领域错误使用 `Data.TaggedError`；
- 数据契约使用 `Schema`；
- 生命周期资源使用 `Scope`；
- 并发使用 Effect Fiber，不维护裸 Promise 任务。

## 11. 当前边界与下一步

当前已经实现核心 Agent、Context、Binding、Op、Driver、Session、Provider、Composed Agent、Hook 和 SSH Connection。

下一步只增加一个主要抽象：`AgentKeeper`。在它被实际场景验证前，不把 Message、Envelope、Inbox、Link 或专用架构类型加入核心。

