# effect-agent

> 概念与 API 草案 · Draft 0.6（已有可运行骨架）

## 1. 项目定义

`effect-agent` 是一套建立在 Effect 上的统一 Agent 编程模型。

系统不把 LLM Model 设为基础概念。无论底层是一次模型调用、完整工具循环，还是 Claude Code、Codex、OpenCode、Pi 这样的外部 Agent，对业务程序都只表现为 `Agent`。

```text
Agent<Input, Output, Error, Requirements>
    = Input → Effect<Output, Error, Requirements>
```

所有 Agent 都能：

- 读取 Context；
- 使用 Binding 提供的内容；
- 在权限允许时调用 Binding Ops；
- 按 Until 条件持续执行；
- 返回 Text、Thinking、ToolCall 或结构化值；
- 通过 Effect 表达错误、依赖、取消和生命周期。

## 2. Agent 实现类型

```text
Agent
└── ComposedAgent
```

### 2.1 Agent

普通 Agent 由 effect-agent 自己驱动：

```text
Context
→ LLM Provider
→ Text / Thinking / ToolCall
→ Binding Op
→ ToolResult
→ Context
→ Until
```

OpenAI、Anthropic、Gemini 或本地推理引擎只是 Agent 的内部 Provider，不进入业务 API。

### 2.2 ComposedAgent

ComposedAgent 是一个已经拥有自身循环、工具系统和运行时的外部完整 Agent。

典型适配目标：

- Claude Code SDK；
- OpenAI Codex SDK；
- OpenCode SDK / Server；
- Pi SDK；
- CLI、RPC、HTTP 或其他 Agent runtime。

effect-agent 将其视为黑盒，不重写其内部决策过程。

```text
effect-agent Context / Bindings
             │
             ▼
      ComposedAgent Adapter
             │
             ▼
 Claude Code / Codex / OpenCode / Pi
             │
             ▼
   normalized Context events
```

## 3. 设计原则

### 3.1 业务逻辑优先

业务代码描述 Agent 如何协作、数据如何流动、最终如何决策。

SDK 初始化、Provider、API Key、进程管理、Tool 协议和 Layer 装配只出现在实现边界。

### 3.2 所有外部事物都是 Effect 依赖

PullRequest、Workspace、用户连接、输出目标以及其他 Agent 都通过 Effect Tag 声明。

```ts
const pullRequest = yield* PullRequest
const reviewer = yield* Reviewer
```

最终应用通过 Layer 提供具体实现。

### 3.3 Schema 可选

- 只需让 Agent 理解内容：实现 `read`；
- 确定性程序需要取值：实现 `typed`；
- 允许 Agent 操作外部对象：提供 `ops`；
- 需要提交确定性结果：实现 `write`。

### 3.4 权限不是 Prompt

未显式授权的写操作不会注入 Agent，也不会授权给 ComposedAgent Adapter。

### 3.5 不伪造能力

如果外部 Agent SDK 不支持 Tool 注入、Thinking、结构化输出、取消或恢复，Adapter 必须在 Capabilities 中如实声明，并返回明确错误或使用显式降级策略。

## 4. 总体模型

```text
External World
      │
      ▼
   Binding ───── read ─────► Context
      │                         │
      ├────── typed ─────► Business Logic
      │                         │
      └────── ops ───────► Container
                                │
                                ▼
Context ─────────────────────► Agent
                                │
                                ▼
                         Context Events
                                │
                                ▼
                              Until
```

根概念：

1. `Content`
2. `Context`
3. `Binding`
4. `Op`
5. `Container`
6. `Agent`
7. `ComposedAgent`
8. `Until`
9. `Connection`

## 5. Content 与 Context

### 5.1 Content

```ts
type Content =
  | Text
  | Image
  | Audio
  | File
  | Json
  | ReadonlyArray<Content>
```

Content 可以直接进入 Agent Context，不要求业务程序理解内部结构。

### 5.2 Context

```ts
type ContextEntry =
  | Instruction
  | Content
  | Thinking
  | Text
  | ToolCall
  | ToolResult
  | StructuredValue
  | Signal
```

Context 是不可变、可追加、可投影的认知状态：

```ts
context.text()
context.thinking()
context.toolCalls()
context.typed(Schema)
context.lastText()
```

### 5.3 Adapter 事件归一化

ComposedAgent Adapter 将外部 SDK 事件尽可能映射成 ContextEntry：

```text
assistant message   → Text
reasoning event     → Thinking
tool invocation     → ToolCall
tool result         → ToolResult
file/artifact       → Content / Artifact
completion          → Signal
```

未暴露的事件不能被推测。例如 SDK 不提供 Thinking，则 Context 中不存在 Thinking。

## 6. Binding

Binding 将 Effect 依赖连接到外部对象：

```text
Effect Tag ← Binding → External Object
```

### 6.1 Readable

```ts
interface Readable<E = never, R = never> {
  readonly read: Effect.Effect<Content, E, R>
}
```

`read` 内容自动加入 Agent Context。

### 6.2 Typed

```ts
interface Typed<A, E = Schema.ParseError, R = never> {
  readonly typed: Effect.Effect<A, E, R>
}
```

`typed` 为确定性业务程序提供经过验证的值。

### 6.3 Operable

```ts
interface Operable<Ops extends Op.Any> {
  readonly ops: ReadonlyArray<Ops>
}
```

Ops 可以自动转换为 Agent Tool Definitions。

### 6.4 Writable

```ts
interface Writable<A, E = never, R = never> {
  readonly write: (value: A) => Effect.Effect<void, E, R>
}
```

Writable 用于将确定性结果提交到外部系统。

## 7. Op

Op 是 Binding 允许 Agent 调用的结构化操作。

```ts
const ReadFile = Op.read(
  "workspace.readFile",
  Schema.Struct({ path: Schema.String }),
  FileContent
)

const WriteFile = Op.write(
  "workspace.writeFile",
  Schema.Struct({
    path: Schema.String,
    content: Schema.String
  }),
  Schema.Void
)
```

每个 Op 包含：

- 唯一名称；
- 描述；
- 输入 Schema；
- 输出 Schema；
- read/write 副作用等级；
- Effect 实现接口；
- 失败语义 [onError]：["retry"]（默认）——执行失败转为结构化工具结果 [{ error, retryable }] 返回给模型重试；["fail"]——失败直接传播为 run 级 [AgentFailure]（控制面工具逃生阀）。失败消息截断约 2000 字符、不含堆栈；[tool.failed] 是未来事件协议中的对应表示。

## 8. Container

Container 是 Agent 可见外部世界的运行时集合：

```ts
interface Container {
  readonly bindings: Binding.Registry
}
```

Container 负责：

- 注册和枚举 Binding；
- 读取 Content；
- 收集 Ops；
- 根据 Agent 权限过滤 Ops；
- 管理 Binding 生命周期；
- 隔离副作用；
- 为 Agent Adapter 提供能力描述。

### 8.1 Effect R 与 Registry

Effect 的 `R` 在编译期表达依赖，但 TypeScript 类型在运行时被擦除。

因此：

- Effect Tag 表达静态依赖；
- Binding Layer 注册运行时描述；
- Container Registry 支持运行时 Tool 枚举和注入。

## 9. Agent

### 9.1 基础接口

```ts
interface AgentService {
  readonly capabilities: Agent.Capabilities

  readonly iterate: <A>(
    until: Until<A>
  ) => (
    context?: Context
  ) => Effect.Effect<A, Agent.Error, Container | HarnessPolicy>
}
```

```ts
class Agent extends Effect.Tag("Agent")<Agent, AgentService>() {}
```

业务代码不关心这是 effect-agent 直接驱动的 Agent，还是由 ComposedAgent 适配的外部 Agent。

### 9.2 Capabilities

```ts
interface AgentCapabilities {
  readonly input: ReadonlySet<"text" | "image" | "audio" | "file">
  readonly output: ReadonlySet<"text" | "thinking" | "toolCall">

  readonly providers:
    | { readonly _tag: "Fixed"; readonly provider: string }
    | { readonly _tag: "Restricted"; readonly providers: ReadonlySet<string> }
    | { readonly _tag: "Configurable" }

  readonly control: {
    readonly granularity: "event" | "turn" | "run"
    readonly pause: boolean
    readonly cancel: boolean
    readonly resume: boolean
  }

  readonly tools: {
    readonly injection: "native" | "mcp" | "none"
    readonly visibleCalls: boolean
    readonly interceptBeforeExecution: boolean
  }

  readonly structuredOutput:
    | "native"
    | "tool"
    | "text"
    | "none"

  readonly sandbox:
    | "enforced"
    | "delegated"
    | "none"

  readonly externalSideEffects: boolean
}
```

Capabilities 用于运行时协商和提前失败，不用于在业务代码里写 SDK 特判。

Capabilities 描述客观事实，不是期望配置。例如 Codex Adapter 只能使用 OpenAI Provider，就必须声明 `Fixed("openai")`，不能因为业务请求了 Anthropic 而静默换模型。

### 9.3 Requirements

每次 Agent 调用会从 Until、Bindings、输出和策略推导 Requirements：

```ts
interface AgentRequirements {
  readonly provider?: ProviderRequirement
  readonly control: ControlRequirement
  readonly tools: ToolRequirement
  readonly structuredOutput: StructuredOutputRequirement
  readonly sandbox: SandboxRequirement
}
```

运行前执行协商：

```text
Requirements ⊆ Capabilities  → 允许执行
Requirements ⊄ Capabilities  → UnsupportedCapability
```

默认不允许静默降级。例如：

- 请求 `Until.thinking`，但 SDK 不暴露 Thinking：失败；
- 请求 `Until.toolCall`，但不能在执行前截获 ToolCall：失败；
- Agent 需要 Binding Ops，但 SDK 不支持 Tool/MCP 注入：失败；
- Agent 要求 sandbox，但外部 Agent 无法隔离：失败；
- 要求指定 Provider，但外部 Agent 只允许固定 Provider：失败。

显式声明的 FallbackPolicy 可以允许降级，但降级结果必须进入类型、事件或 telemetry，不能悄悄发生。

## 10. Agent 实现

普通 Agent 由 effect-agent 完整控制其 Context、Op 调度和迭代过程。

```ts
const ReviewAgentLive = Agent.layer({
  provider: AnthropicProvider,
  context: DefaultContextCodec,
  tools: ContainerTools
})
```

这里的 Provider 是实现细节：

```text
OpenAI
Anthropic
Google
local inference
@effect/ai LanguageModel
```

业务层不会出现 `Model` Tag 或 `Model.iterate`。

### 10.1 Tool 自动注入

Agent 的流程：

```text
Container Binding Ops
→ Tool Definitions
→ Provider request
→ ToolCall
→ Schema decode
→ Op Effect
→ ToolResult
→ Context
```

## 11. ComposedAgent

### 11.1 定义

ComposedAgent 将外部完整 Agent 适配为标准 AgentService：

```ts
const ClaudeCodeLive = ComposedAgent.layer(ClaudeCode, {
  sdk: ClaudeCodeSdk,
  codec: ClaudeCodeContextCodec,
  capabilities: ClaudeCodeCapabilities
})
```

业务使用时只看到 Agent：

```ts
const claude = yield* ClaudeCode
const result = yield* claude.iterate(Until.stop)(context)
```

### 11.2 黑盒边界

effect-agent 可以控制：

- 传入的 Context；
- 显式授权的 Container/Workspace；
- SDK 暴露的 Tool/MCP 注册；
- 事件订阅；
- 取消和资源清理；
- 输出归一化。

effect-agent 不假设能够控制：

- 外部 Agent 的内部 Prompt；
- 内部 planning loop；
- 内部 context compaction；
- SDK 未暴露的 ToolCall；
- SDK 未暴露的 Thinking；
- 外部 Agent 自己发起的网络请求。

### 11.3 Binding Ops 注入

Adapter 按能力选择注入方式：

```text
native  SDK 原生 Tool API
mcp     将 Binding Ops 暴露为临时 MCP Server
prompt  只提供描述，不允许实际 Op 调用
none    不注入 Ops
```

`prompt` 不能被视为真正的 Tool 能力，也不能授予副作用权限。

### 11.4 Container 授权

ComposedAgent 可能直接修改 Workspace，因此必须显式声明：

```ts
const ClaudeCoder = Agent.make("ClaudeCoder").pipe(
  Agent.uses(Task),
  Agent.uses(Workspace),
  Agent.writes(Workspace),
  Agent.implementedBy(ClaudeCode)
)
```

Adapter 只把获准 Workspace 传给外部 Agent。未声明 writes 时，应使用只读挂载、临时副本或拒绝启动。

### 11.5 SDK 生命周期

ComposedAgent 是 scoped resource：

```text
acquire SDK session/process
→ stream normalized events
→ interrupt/cancel
→ release process/session/temp resources
```

Effect Scope 负责成功、失败和取消时的清理。

### 11.6 Provider 约束

ComposedAgent 可以有三类 Provider 能力：

```text
Fixed         只能使用一个固定供应商
Restricted    可以在有限供应商集合中选择
Configurable  可以由依赖方提供任意兼容供应商
```

Provider 选择属于 Adapter 配置，不属于通用 Agent 业务逻辑：

```ts
const codex = yield* Codex
// 使用 Codex Adapter 的默认 OpenAI 配置
```

如果业务明确依赖某种 Provider 特性，应额外声明 Feature requirement，而不是假设所有 Agent 都支持。

Provider 能力必须精确到协议/API，而不是只精确到厂商：

```text
openai.responses    ≠ openai.chat
openai.chat         ≠ openai.completions
anthropic.messages  ≠ anthropic.agent-sdk
openai.responses    ≠ openai.codex
```

它们的消息格式、工具调用、结构化输出、状态管理和事件粒度可能不同。配置层使用 TOML 声明精确 API，并通过 Effect Layer 提供给 Agent 实现；业务 Agent 仍然不直接依赖 Model。

```ts
const driver = yield* Providers.agent("reasoner")
const review = yield* PRReview(driver).run(diff)
```

TOML 中 `${KEY}` 或 `env:KEY` 从环境读取，默认先加载 `.env`。环境引用解析失败必须在建立 Driver 前失败。

### 11.7 控制粒度

```text
event  可以观察并停在 Text / Thinking / ToolCall 等细粒度事件
turn   只能在一次完整 Agent turn 结束后取得控制
run    只能等待外部 Agent 整体完成
```

Pause、Cancel、Resume 分别声明，不能从控制粒度推断。

例如某个 SDK 可以 stream Text，但无法暂停内部执行，则它可以声明：

```ts
control: {
  granularity: "event",
  pause: false,
  cancel: true,
  resume: false
}
```

看到事件不代表能够停在该事件上。`Until.toolCall` 还要求 `interceptBeforeExecution: true`，否则外部 Agent 可能已经执行了副作用。

### 11.8 Tool 与结构化输出

Tool 注入和结构化输出是相关但不同的能力：

```text
structuredOutput = native  SDK 原生 Schema 输出
structuredOutput = tool    通过强制 ToolCall 得到对象
structuredOutput = text    从最终文本解析对象
structuredOutput = none    无可靠结构化输出路径
```

如果 Adapter 只能通过 ToolCall 产生对象，而它又不支持 Tool 注入，那么 `Until.schema` 不可用。

`text` 模式必须明确标记为文本解析，其可靠性和 repair 次数由 HarnessPolicy 控制；不能伪装成 `native`。

### 11.9 Sandbox 与副作用

```text
enforced   effect-agent 能强制文件、进程、网络边界
delegated  依赖外部 Agent 自己的权限/沙盒机制
none       无法可靠限制副作用
```

对于 `sandbox: none` 且 `externalSideEffects: true` 的 Agent：

- 默认不能运行；
- 必须显式提供 UnsafeSideEffects 授权；
- 即使 Agent 没有声明 writes，也不能假设它是只读的；
- Adapter 应尽可能在临时副本或隔离环境中启动。

### 11.10 Extensions

外部 Agent 的专属能力不应污染通用 Agent API，例如：

- Claude Code plan mode、permission mode、hooks；
- Codex approval policy、reasoning effort；
- OpenCode session、provider routing；
- Pi extensions、custom commands。

默认注入只产生默认配置：

```ts
const claude = yield* ClaudeCode
// ClaudeCode.Default
```

需要专属特性时必须显式声明额外依赖：

```ts
const Planner = Agent.make("Planner").pipe(
  Agent.implementedBy(ClaudeCode),
  Agent.usesExtension(ClaudeCode.PlanMode)
)
```

其 Effect requirements 会包含：

```ts
ClaudeCode | ClaudeCode.PlanMode
```

最终应用提供配置：

```ts
Planner.pipe(
  Effect.provide(ClaudeCode.Default),
  Effect.provide(ClaudeCode.PlanMode.Live)
)
```

不声明 `usesExtension` 时，Agent 只能得到 Adapter 默认配置。这样业务对专属能力的依赖是显式、可替换、可测试的。

### 11.11 Harness Hook 与原生 Hook

`HarnessHook` 属于 effect-agent，生命周期由 Harness 产生，适用于所有 Agent：run、framework tool、output、error 和 completion。它用于日志、telemetry、审计、业务通知或通过 Effect 调用其他依赖。

外部 ComposedAgent 自身的 Hook 属于 Extension。例如 Claude Code 的 PreToolUse、PostToolUse、Stop Hook 使用 Claude SDK 自己的 matcher、事件结构和控制返回值，只能通过 `claudeCodeHooks` 显式使用。

两者不得共用 `hooks` 名称，也不能把外部 SDK 没有暴露的内部事件伪装成 Harness 事件：

```text
HarnessHook       effect-agent 生命周期，跨 Agent
claudeCodeHooks   Claude Agent SDK 原生能力，仅 Claude Code
```

## 12. Until

Until 同时适用于普通 Agent 和 ComposedAgent。

```ts
Agent.iterate(Until.text)
Agent.iterate(Until.thinking)
Agent.iterate(Until.toolCall)
Agent.iterate(Until.stop)
Agent.iterate(Until.schema(Review))
```

### 12.1 Until.text

返回下一段 Text。要求 Agent 暴露 Text event；若还要求命中后立即暂停，则控制粒度必须允许暂停。

### 12.2 Until.thinking

返回下一段 Thinking。要求 Agent 暴露 Thinking，并具有满足调用语义的控制粒度；否则提前返回 UnsupportedCapability。

### 12.3 Until.toolCall

返回下一个可见 ToolCall，并保证暂不执行。要求 `visibleCalls: true` 和 `interceptBeforeExecution: true`，否则提前返回 UnsupportedCapability。

### 12.4 Until.stop

持续运行 Agent，直到其完成当前任务，然后返回最后一段 Text。

```text
Until.stop = Until.lastText
```

对于普通 Agent，“完成”通常表示没有待执行 ToolCall。对于 ComposedAgent，“完成”由 SDK completion event 映射而来，因此只要求 run-level 控制。

### 12.5 Until.schema

持续运行直到 Context 中出现能够被 Schema 解码的值。

```ts
Agent.iterate(Until.schema(Review))
```

Until.schema 必须先匹配 `native`、`tool` 或显式允许的 `text` 策略。如果为 `none`，则在启动前失败。文本 Schema decode 和修复迭代由 HarnessPolicy 控制。

## 13. Agent 定义与输出

### 13.1 结构化输出 Agent

```ts
const PRReview = Agent.make("PRReview").pipe(
  Agent.uses(PullRequest),
  Agent.returns(Review),
  Agent.implementedBy(ReviewAgent)
)
```

### 13.2 修改 Container 的 Agent

```ts
const CodingAgent = Agent.make("CodingAgent").pipe(
  Agent.uses(Task),
  Agent.uses(Workspace),
  Agent.writes(Workspace),
  Agent.returns(ChangeSummary),
  Agent.implementedBy(Codex)
)
```

### 13.3 纯副作用 Agent

```ts
const ApplyPatch = Agent.make("ApplyPatch").pipe(
  Agent.uses(Task),
  Agent.writes(Workspace),
  Agent.until(Until.stop),
  Agent.implementedBy(OpenCode)
)
```

### 13.4 输出不变量

每个可运行 Agent 必须至少声明一种可观察输出：

```text
returns(Schema)   结构化返回值
writes(Binding)   明确获准的外部副作用
```

两者都没有时，Agent 不可执行。

### 13.5 副作用不变量

- `uses(Binding)` 允许 read、typed 和 read ops；
- `writes(Binding)` 允许 write ops 或将可写资源交给 ComposedAgent；
- 未授权 write ops 不会注入 Agent；
- 未授权资源不会以可写形式传给 ComposedAgent；
- `externalSideEffects: true` 的 ComposedAgent 若无法隔离副作用，必须要求显式策略授权。

## 14. Agent 组合

其他 Agent 也是 Effect 依赖：

```ts
class SecurityReviewer extends Agent.Tag("SecurityReviewer")<
  SecurityReviewer,
  typeof Findings
>() {}

class Coder extends Agent.Tag("Coder")<Coder, typeof ChangeSummary>() {}
```

业务组合：

```ts
const Workflow = Effect.gen(function*() {
  const security = yield* SecurityReviewer
  const coder = yield* Coder

  const [findings, change] = yield* Effect.all([
    security.iterate(Until.schema(Findings))(),
    coder.iterate(Until.schema(ChangeSummary))()
  ])

  return { findings, change }
})
```

SecurityReviewer 可以是普通 Agent，Coder 可以是 Codex ComposedAgent；业务流程无需知道。

## 15. Endpoint

Endpoint 是面向用户或程序的双向 Binding：

```ts
type Endpoint<Input, Output> =
  Binding.Readable &
  Binding.Typed<Input> &
  Binding.Writable<Output>
```

CLI、HTTP endpoint、Web UI、DingTalk 和 Agent-to-Agent 是不同 Layer。

Endpoint Projection 控制是否对外暴露 Text、Thinking、ToolCall、Artifact 和 typed output。

Endpoint 关注交互语义；Connection 关注远程资源的传输和会话。远程 Endpoint 可以在实现层依赖 Connection。

## 16. HarnessPolicy

HarnessPolicy 是 Effect 依赖或 Context.Reference：

```ts
interface HarnessPolicy {
  readonly maxIterations: number
  readonly maxToolCalls: number
  readonly structuredOutputRepairs: number
  readonly toolConcurrency: number
  readonly allowExternalSideEffects: boolean
}
```

超时、重试和取消使用 Effect 原生算子：

```ts
program.pipe(
  Effect.retry(schedule),
  Effect.timeout("5 minutes")
)
```

## 17. URI 与可寻址性

大部分 effect-agent 概念都具有稳定 URI：

```text
ea://<registry>/<kind>/<identity>/<subresource>?<query>#<fragment>
```

示例：

```text
ea://local/agents/pr-review
ea://local/agents/pr-review/instances/run-42
ea://local/contexts/run-42/nodes/n17
ea://runner-1/containers/workspace-8
ea://runner-1/containers/workspace-8/files/src/index.ts
ea://github/bindings/pull-request/1234
ea://local/artifacts/report-9
ea://local/connections/ssh-runner-1
```

标准 kind：

```text
agents
contexts
containers
bindings
connections
artifacts
```

### 17.1 ResourceRef

```ts
interface ResourceRef<Kind extends Resource.Kind = Resource.Kind> {
  readonly uri: ResourceUri<Kind>
}
```

Agent、Context Node、Container、Binding、Connection 和 Artifact 都可以通过 ResourceRef 引用，而不要求对象位于当前进程。

### 17.2 Resolver

```ts
class ResourceResolver extends Effect.Tag("ResourceResolver")<
  ResourceResolver,
  {
    readonly resolve: <A>(ref: ResourceRef) =>
      Effect.Effect<A, ResolveError, ConnectionRegistry>
  }
>() {}
```

Resolver 根据 registry、kind 和 URI authority 找到本地对象或对应 Connection。

### 17.3 URI 不是权限

URI 只提供身份和地址，不携带授权：

- URI 中不得放 API Key、密码或 bearer token；
- 能解析 URI 不代表可以 read、typed、op 或 write；
- 权限仍由 Effect 依赖、Binding capability、Container policy 和 Connection credentials 决定；
- Agent 不能通过构造 URI 绕过 `uses` / `writes`。

## 18. Connection

Connection 是访问远程资源的传输与会话抽象。

```ts
interface ConnectionService {
  readonly uri: ResourceUri<"connections">
  readonly open: Effect.Effect<void, ConnectionError, Scope.Scope>
  readonly describe: Effect.Effect<RemoteCapabilities, ConnectionError>
  readonly request: (request: RemoteRequest) =>
    Effect.Effect<RemoteResponse, ConnectionError>
  readonly events: Stream.Stream<RemoteEvent, ConnectionError>
}
```

Connection 实现可以是：

```text
in-process
SSH
HTTP / WebSocket
RPC
MCP
SDK session
message queue
```

### 18.1 Connection Registry

Connection 建立后向 Registry 注册它可以访问的资源：

```ts
yield* registry.register(connection, [
  ContainerRef.make("ea://runner-1/containers/workspace-8"),
  BindingRef.make("ea://runner-1/bindings/filesystem-8")
])
```

注册内容包括：

- URI；
- kind；
- read / typed / ops / write capabilities；
- Agent capabilities；
- sandbox 和副作用等级；
- 生命周期和租约；
- transport metadata。

### 18.2 外部 URI

外部协议 URI 可以映射到规范 ea URI：

```text
ssh://user@runner/workspace
    ↕ Connection registration
ea://runner-1/containers/workspace-8
```

业务层保存 ea URI；Connection Layer 保存 SSH hostname、认证方式和协议细节。

## 19. 远程 Container

Container 可以在本地，也可以完全位于远程机器。

```ts
const workspace = yield* Container.resolve(
  "ea://runner-1/containers/workspace-8"
)
```

调用方获得的是 Container Handle：

```ts
interface ContainerHandle extends ResourceRef<"containers"> {
  readonly bindings: Effect.Effect<Binding.Registry, ContainerError>
  readonly read: (path: ResourcePath) => Effect.Effect<Content, ContainerError>
  readonly typed: <A>(path: ResourcePath, schema: Schema.Schema<A>) =>
    Effect.Effect<A, ContainerError | Schema.ParseError>
  readonly op: (call: OpCall) => Effect.Effect<OpResult, ContainerError>
}
```

Handle 的方法由底层 Connection 转发。业务代码不区分本地和远程 Container。

### 19.1 运行完成后的访问

Container 生命周期必须显式声明：

```text
scoped     Agent Scope 结束即释放
retained   运行结束后继续存在，可通过 URI 访问
leased     在租约到期前可访问
external   生命周期由外部系统管理
```

Agent 运行结果可以返回 ContainerRef 或 ArtifactRef：

```ts
const result = {
  workspace: ContainerRef("ea://runner-1/containers/workspace-8"),
  patch: ArtifactRef("ea://runner-1/artifacts/patch-21")
}
```

之后仍可通过 Resolver 和 Connection 访问：

```ts
const workspace = yield* ResourceResolver.resolve(result.workspace)
const diff = yield* workspace.read("git/diff")
```

## 20. Context Graph 与 Fork

Context 不是单一数组，而是不可变节点组成的 DAG：

```ts
interface ContextNode extends ResourceRef<"contexts"> {
  readonly id: NodeId
  readonly parents: ReadonlyArray<NodeId>
  readonly entries: ReadonlyArray<ContextEntry>
}
```

每个 Agent 迭代都会产生新节点。任意节点都可以作为新分支起点。

### 20.1 简单表达

```ts
const branch = yield* agent.fork(node)
```

Node 可以是 Handle 或 URI：

```ts
const branch = yield* agent.fork(
  "ea://local/contexts/run-42/nodes/n17"
)
```

Fork 返回一个新的 Agent Handle：

```ts
Effect.Effect<Agent.Handle, ForkError, ContextStore | ContainerFork>
```

新分支：

- 共享 fork 点之前的不可变 Context；
- fork 点之后拥有独立 Context head；
- 保留来源 Agent、节点和 Container lineage；
- 可以使用不同 Instruction、Until、Extension 或 Agent 实现继续探索。

### 20.2 Context Fork 与 Container Fork

两者必须区分：

```text
Context fork    复制认知分支，始终可以廉价完成
Container fork  复制或隔离世界状态，需要 Container capability
```

Container Fork capabilities：

```text
shared    多分支共享同一世界；写操作可能相互影响
snapshot  从指定版本创建快照
clone     完整复制 Container
cow       Copy-on-write 分支
none      不支持世界状态分叉
```

如果 Agent 已产生或可能产生副作用，调用方必须明确选择 Container fork 语义。不能只 fork Context 后假装外部世界也回到了过去。

### 20.3 ComposedAgent Fork

ComposedAgent 的 fork 能力取决于 SDK：

- 支持 session clone/resume：可保留外部 Agent 内部状态；
- 只支持重新发送历史：通过 Context replay 创建近似 fork；
- 无法导出状态：只能从规范 Context 启动新 session；
- 无法复现内部状态时，必须标记为 `replayed`，不能声称 exact fork。

## 21. 多 Agent Map / Reduce 探索

探索不需要新的 Orchestrator 或其他 Agent 子类型。使用 Fork、Effect 并发和任意普通 Agent 即可表达。

### 21.1 Map

从同一节点创建多个分支，并行探索：

```ts
const candidates = yield* Effect.forEach(
  strategies,
  strategy =>
    agent.fork(node).pipe(
      Effect.flatMap(branch => branch.with(strategy)),
      Effect.flatMap(branch =>
        branch.iterate(Until.schema(Candidate))()
      )
    ),
  { concurrency: "unbounded" }
)
```

也可以让不同 Agent 实现探索同一问题：

```ts
const candidates = yield* Effect.all({
  claude: ClaudeCodeAgent.iterate(Until.schema(Candidate))(context),
  codex: CodexAgent.iterate(Until.schema(Candidate))(context),
  opencode: OpenCodeAgent.iterate(Until.schema(Candidate))(context),
  pi: PiAgent.iterate(Until.schema(Candidate))(context)
})
```

### 21.2 Reduce

任意 Agent 都可以将候选集合归约成最佳结果：

```ts
const best = yield* agent.iterate(Until.schema(Decision))(
  Context.make("选择最可靠的候选结果", candidates)
)
```

这里的 `agent` 没有特殊类型。选择行为完全来自当前 Context、instructions、Until 和 Agent 实现。

完整模式：

```text
Context Node
→ fork N branches
→ map: N Agents explore
→ collect typed Candidates
→ reduce: ordinary Agent
→ Decision + selected Candidate
```

归约输出应包含选择理由和来源 branch URI：

```ts
const Decision = Schema.Struct({
  selected: ResourceUri.schema("contexts"),
  reason: Schema.String,
  confidence: Schema.Number
})
```

这让选择过程可追踪，也允许之后重新打开未被选中的分支。

## 22. Agent Self

Agent 自身也具有 URI，并可作为只读 Binding 注入：

```ts
class Self extends Binding.Tag("Self")<
  Self,
  Binding.Readable & Binding.Typed<Agent.Descriptor>
>() {}
```

Agent 可以访问：

- 自身 identity 和 definition URI；
- 当前 instance URI；
- 当前 Context head URI；
- Container URI；
- Capabilities 和 Requirements；
- 已声明的 Extensions；
- 允许访问的 branch 和 Artifact URI。

如果显式授予 Self Ops，还可以：

```text
self.fork
self.inspectBranch
self.resolveArtifact
self.requestExtension
```

### 22.1 自操作安全边界

- Self 默认只读；
- `self.fork` 需要 Fork capability；
- Self URI 不携带凭证；
- Agent 不能修改自身 definition、权限或 Layer；
- `requestExtension` 只产生请求，不能自行获得依赖；
- 所有自操作仍受 Container 和 Connection policy 控制。

URI 让 Agent 能谈论和操作自身，但不会自动获得更高权限。

## 23. ComposedAgent Adapter API 草案

```ts
const ClaudeCodeLive = ComposedAgent.sdk(ClaudeCode, {
  acquire: ClaudeCodeSdk.create,
  send: (session, context) => session.query(context),
  events: session => session.events,
  cancel: session => session.cancel(),
  codec: ClaudeCodeCodec,
  tools: "mcp",
  capabilities: {
    input: new Set(["text", "image", "file"]),
    output: new Set(["text", "thinking", "toolCall"]),
    providers: { _tag: "Fixed", provider: "anthropic" },
    control: {
      granularity: "event",
      pause: false,
      cancel: true,
      resume: true
    },
    tools: {
      injection: "mcp",
      visibleCalls: true,
      interceptBeforeExecution: false
    },
    structuredOutput: "text",
    sandbox: "delegated",
    externalSideEffects: true
  }
})
```

Codex、OpenCode 和 Pi 使用同一 Adapter 契约，只替换 SDK codec 与 capabilities。

Adapter 还可以声明专属 Extensions，但这些 Extensions 不进入通用 AgentService：

```ts
extensions: {
  PlanMode: ClaudeCode.PlanMode,
  PermissionMode: ClaudeCode.PermissionMode,
  Hooks: ClaudeCode.Hooks
}
```

## 24. 与 @effect/ai 的关系

```text
Agent Provider        → @effect/ai LanguageModel
Context               → @effect/ai Prompt / Response
Op                    → @effect/ai Tool
Op Registry           → @effect/ai Toolkit
```

这些映射都位于 Agent 实现内部。

业务 API 中不再出现 `Model`。

## 25. 明确废弃的概念

不再把以下概念暴露为业务基础抽象：

```text
Model
LanguageModel
Provider
Tool
ToolKit
```

它们属于 Agent 实现层。

业务代码统一使用：

```ts
const agent = yield* SomeAgent
const result = yield* agent.iterate(Until.schema(Output))(context)
```

## 26. MVP

第一阶段实现：

1. Content 与 Context；
2. Binding.Readable / Typed / Operable / Writable；
3. Op.read / Op.write；
4. Container Registry 和权限过滤；
5. AgentService 与 Capabilities；
6. Agent + 一个 @effect/ai Provider；
7. Until.text / thinking / toolCall / stop / schema；
8. Agent uses / writes / returns 输出不变量；
9. ComposedAgent Adapter SPI；
10. 一个 ComposedAgent 适配器作为验证；
11. ResourceUri、ResourceRef 与本地 Resolver；
12. Context DAG 与 Context-only fork；
13. Connection Registry 与一个 SSH/远程 Container Spike；
14. Effect map + ordinary Agent reduce 示例；
15. ScriptedAgent 与 MemoryContainer 测试。

## 27. 需要继续验证的问题

1. 第一版优先适配 Claude Code、Codex、OpenCode 还是 Pi。
2. 各 SDK 是否支持自定义 Tool 或 MCP 注入。
3. ComposedAgent 如何可靠限制 Workspace 路径与网络访问。
4. 外部 Agent 的 session resume 如何映射到 Effect Scope。
5. Until.toolCall 对不暴露内部 ToolCall 的 SDK 是否只能报 UnsupportedCapability。
6. structured output repair 应由 Adapter 还是通用 Harness 实现。
7. ComposedAgent 自带 Tools 与 Binding Ops 名称冲突如何处理。
8. Agent Builder 如何在类型层保证 returns/writes 至少存在一个。
9. Agent-to-Agent 是否直接使用 Agent Tag，还是通过 Connection Binding。
10. Adapter 的事件丢失、乱序和重复如何归一化。
11. URI registry 的全局身份、重命名和失效语义。
12. retained/leased Container 的清理责任和租约续期。
13. Fork 后 Container shared/snapshot/clone/cow 的默认选择。
14. ComposedAgent replay fork 与 exact fork 如何进入结果类型。
15. 多分支 Reduce 阶段是否允许执行归约的 Agent 请求某个分支继续探索。
16. Self Ops 如何防止递归 fork 和资源耗尽。

## 28. 最终命题

> Binding 把外部世界变成 Content、typed value 和 Ops。  
> Container 收集 Binding，并施加权限边界。  
> Agent 是唯一的智能执行抽象。  
> Agent 由 effect-agent 驱动，ComposedAgent 适配外部完整 Agent。  
> Until 定义 Agent 何时返回以及返回什么。  
> Context DAG 允许 Agent 从任意节点 Fork。  
> Effect map 与普通 Agent reduce 表达多 Agent 探索和选择。  
> Connection 注册远程资源，URI 统一标识和解析整个 Agent 世界。  
> Effect 负责依赖、错误、并发、取消和生命周期。
