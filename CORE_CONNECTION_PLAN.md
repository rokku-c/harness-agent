# effect-agent Core 与 Connection 架构方案

## 1. 目标

> Core 定义可组合的 Agent 协议，Connection 提供能力实现，应用通过 Effect Layer 完成装配。

同一个 Agent 应该可以通过以下方式定义，并编译为相同的 Manifest：

- Effect-TS DSL；
- TOML；
- API；
- MCP；
- Go 或其他语言 SDK。

同一个 Manifest 应该可以：

- 在本地 Effect Runtime 运行；
- 由 AgentKeeper 长期托管；
- 导出为 MCP；
- 导出为 HTTP API；
- 通过进程或网络桥接到其他语言实现。

JSON 是 Core Manifest 的标准交换格式；TOML、Effect-TS DSL 和其他语言 SDK 都编译到它。

## 2. 总体结构

```text
TOML ───────────┐
Effect-TS DSL ──┤
API / MCP ──────┼──▶ AgentManifest ──▶ Effect Runtime ──▶ Messenger
Go SDK ─────────┘           │                 │
                            │                 ▼
                            │          Connection Registry
                            │           ├── Builtin
                            │           └── External
                            ▼
                    MCP / API / SDK Export
```

系统分为四层：

```text
Core       纯协议、Schema IR、Manifest、组合定律
Runtime    Effect 解释器、Messenger、Keeper、Harness
Builtin    官方能力实现
External   开发者或其他语言提供的 Connection
```

Core 的概念集合保持稳定：`Manifest`、`Schema`、`Delivery`、`Resource`、`Connection` 和组合操作。新增能力优先表现为 Connection 或 Runtime 组合，不新增同义的 Agent、Plugin、Transport、Tool 等核心类型。

Core 只规定这些概念如何组合和验证；外围实现通过依赖注入满足它们。

## 3. Core

Core 只定义数据和协议，不依赖模型 SDK、文件系统、SSH、MCP Server 或具体进程实现。

### 3.0 JSON 交换格式

支持两种 JSON 用法：

1. **JSON Schema**：描述 Manifest、Delivery、Resource 和 Connection 配置的结构；
2. **JSON Manifest**：描述一个具体可运行的 Agent。

示例：

```json
{
  "$schema": "https://effect-agent.dev/schema/manifest/v1.json",
  "version": "1",
  "agent": {
    "receives": { "$ref": "#/schemas/ReviewRequest" },
    "driver": {
      "connection": "builtin.providers",
      "implementation": "default"
    },
    "resources": [
      {
        "id": "project",
        "implementation": {
          "connection": "builtin.project",
          "implementation": "workspace"
        },
        "access": "read",
        "visibility": "abstract"
      }
    ],
    "delivers": [
      {
        "schema": { "$ref": "#/schemas/ReviewFinding" },
        "target": "origin",
        "many": true
      }
    ],
    "until": { "type": "stop" }
  },
  "schemas": {
    "ReviewRequest": {
      "type": "object",
      "properties": { "scope": { "type": "string" } },
      "required": ["scope"],
      "additionalProperties": false
    },
    "ReviewFinding": {
      "type": "object",
      "properties": { "file": { "type": "string" }, "summary": { "type": "string" } },
      "required": ["file", "summary"],
      "additionalProperties": false
    }
  }
}
```

编译入口保持统一：

```ts
const fromJson = Manifest.decodeJson(jsonText)
const fromToml = Manifest.decodeToml(tomlText)
const fromEffect = EffectDsl.compile(definition)

const normalized = Manifest.normalize(fromJson)
```

三种输入在 `normalize` 后必须可以用 `Equal.equals` 比较。JSON Schema 负责跨语言校验，Effect Schema 是 Effect Runtime 对 JSON Schema 的本地编译结果，而不是跨语言协议本身。

### 3.1 AgentManifest

```ts
interface AgentManifest {
  readonly version: "1"
  readonly requires: ManifestRequirements
  readonly receives?: SchemaSpec
  readonly delivers?: ReadonlyArray<DeliverySpec>
  readonly resources: ReadonlyArray<ResourceSpec>
  readonly driver: ConnectionRef
  readonly until: UntilSpec
}

interface ManifestRequirements {
  readonly core: "effect-agent/core@1"
  readonly runtime: string
  readonly schemas: ReadonlyArray<string>
  readonly connections: ReadonlyArray<ConnectionRef>
  readonly drivers: ReadonlyArray<ConnectionRef>
}
```

Agent 不需要业务名称。需要外部寻址、审计或持久化时，由运行实例生成 ID。

### 3.2 Delivery

所有 Agent 交互统一为 Delivery：

```ts
interface Delivery<A = unknown> {
  readonly id: string
  readonly payload: A
  readonly source?: EndpointRef
  readonly target?: EndpointRef
  readonly correlation?: string
  readonly schema?: SchemaRef
}
```

Delivery 支持零次、一次和多次投递。系统不引入 `return`、`reply`、`send` 等不同业务语义。

```ts
Messenger.deliver(delivery)
```

`correlation` 只描述关联关系，不把对等通信降级成 request/response。

### 3.3 SchemaSpec

跨语言核心不能直接使用 Effect Schema。Core 定义最小 Schema AST：

```ts
type SchemaSpec =
  | { readonly type: "string" }
  | { readonly type: "number" }
  | { readonly type: "boolean" }
  | { readonly type: "literal"; readonly values: ReadonlyArray<string> }
  | { readonly type: "array"; readonly items: SchemaSpec }
  | {
      readonly type: "object"
      readonly properties: Readonly<Record<string, SchemaSpec>>
      readonly required: ReadonlyArray<string>
    }
  | { readonly type: "ref"; readonly ref: string }
```

SchemaSpec 分别编译为：

- Effect Schema；
- JSON Schema；
- MCP tool schema；
- OpenAPI schema；
- Go validator 或生成类型。

复杂 Schema 可以引用独立 JSON Schema 文件。

### 3.4 ResourceSpec

```ts
interface ResourceSpec {
  readonly id: string
  readonly implementation: ConnectionRef
  readonly access: "read" | "write"
  readonly scope?: unknown
  readonly visibility?: "visible" | "abstract" | "hidden"
  readonly config?: unknown
}
```

资源语义和物理位置分离。同一个 Project Resource 可以由本地目录、SSH、容器或远程 API 实现。

### 3.5 ConnectionRef

```ts
interface ConnectionRef {
  readonly connection: string
  readonly implementation: string
}
```

ConnectionRef 是 Core 中唯一的外部实现引用。Manifest 只引用 Connection，不加载代码。

### 3.6 Manifest 必须完整声明依赖

TOML 和 JSON 不能依赖隐式的全局 Provider、默认资源或运行时自动注册。每一份 Manifest 都必须声明：

- Core 协议版本；
- Runtime 版本或能力范围；
- 使用的 Schema；
- 所有资源 Connection；
- Driver Connection；
- 每个 Connection 的配置和权限范围。

TOML：

```toml
[requires]
core = "effect-agent/core@1"
runtime = "effect-agent/runtime@1"
schemas = ["./schemas/review.json"]

[[requires.connections]]
connection = "builtin.project"
implementation = "workspace"

[[requires.drivers]]
connection = "builtin.providers"
implementation = "default"
```

JSON：

```json
{
  "requires": {
    "core": "effect-agent/core@1",
    "runtime": "effect-agent/runtime@1",
    "schemas": ["./schemas/review.json"],
    "connections": [
      { "connection": "builtin.project", "implementation": "workspace" }
    ],
    "drivers": [
      { "connection": "builtin.providers", "implementation": "default" }
    ]
  }
}
```

缺少任何运行依赖时，Manifest 编译失败；Runtime 不自动补全依赖。应用仍然通过 Layer 提供具体实现，但必须满足 Manifest 的显式要求。

## 4. TOML 与 Effect-TS 同像

### 4.1 TOML

```toml
version = "1"

[agent]
receives = "ReviewRequest"
driver = "providers/default"
until = "stop"

[[agent.resources]]
id = "project"
connection = "builtin.project"
implementation = "workspace"
access = "read"
visibility = "abstract"

[[agent.delivers]]
schema = "ReviewFinding"
target = "origin"
many = true
```

### 4.2 Effect-TS

```ts
const definition = Agent.define({
  receives: SchemaRef("ReviewRequest"),
  driver: ConnectionRef.make("providers", "default"),
  resources: [
    Resource.read("project", "builtin.project/workspace", {
      visibility: "abstract"
    })
  ],
  delivers: [
    Delivery.to("origin", SchemaRef("ReviewFinding"), { many: true })
  ],
  until: Until.stop
})
```

两者必须产生相同的标准化 Manifest：

```ts
Equal.equals(
  Manifest.normalize(Toml.compile(source)),
  Manifest.normalize(EffectDsl.compile(definition))
)
```

## 5. Runtime

Runtime 使用 Effect 解释 Manifest：

```ts
interface HarnessRuntime {
  readonly compile: (
    manifest: AgentManifest
  ) => Effect.Effect<ComposedAgent, CompileError, ConnectionRegistry>
}
```

Runtime 负责：

- Manifest 解码和标准化；
- Connection 实现解析；
- Resource 权限收敛；
- Driver 选择；
- Messenger Delivery；
- AgentKeeper 生命周期；
- Scope、Fiber、Queue、Stream 和错误通道。

Runtime 不实现具体外围能力。

## 6. Connection

### 6.1 Connection 定义

```ts
interface Connection<R = never> {
  readonly id: string
  readonly implementations: ReadonlyMap<string, Implementation<any, any, any, R>>
}

interface Implementation<I, O, E, R> {
  readonly input: SchemaSpec
  readonly output: SchemaSpec
  readonly execute: (input: I) => Effect.Effect<O, E, R>
}
```

示例：

```ts
const JiraConnection = Connection.make({
  id: "acme.jira",
  implementations: {
    search: Implementation.make({
      input: SearchInput,
      output: SearchResult,
      execute: Jira.search
    }),
    update: Implementation.make({
      input: UpdateInput,
      output: UpdateResult,
      execute: Jira.update
    })
  }
})
```

### 6.2 Connection Registry

Connection 不修改全局状态。应用显式注入 Registry：

```ts
class ConnectionRegistry extends Context.Tag(
  "EffectAgent/ConnectionRegistry"
)<ConnectionRegistry, ConnectionRegistryService>() {}
```

```ts
const ConnectionsLive = ConnectionRegistry.layer([
  Builtin.project(),
  Builtin.providers(),
  JiraConnection
])
```

未注入的实现返回 `MissingConnection` 或 `MissingImplementation`。

### 6.3 冲突规则

同一个 `connection/implementation` 不允许重复注册，不使用后加载覆盖前加载。

```ts
Connection.combine:
  (left, right) => Either.Either<Connection, ConnectionConflict>
```

这保证组合结果可审计，并允许验证结合律。

## 7. Builtin

Builtin 与外部 Connection 使用完全相同的接口：

```text
builtin.providers
builtin.project
builtin.filesystem
builtin.process
builtin.ssh
builtin.mcp
```

应用显式选择 Builtin：

```ts
ConnectionRegistry.layer([
  Builtin.project(),
  Builtin.ssh()
])
```

Builtin 不自动加载，也不拥有 Core 私有通道。如果 Builtin 需要额外特权，说明 Connection 接口尚未完整。

## 8. 外部实现接入

### 8.1 JavaScript / TypeScript

```ts
const JsConnection = ModuleConnection.make({
  id: "company.rules",
  module: "./rules.js",
  exports: ["validate", "transform"]
})
```

动态模块加载必须由宿主显式授权，TOML 不能直接加载任意模块。

### 8.2 Process Bridge

```toml
[connections.company-go]
kind = "process"
command = "./company-agent"
protocol = "effect-agent-rpc-v1"
```

协议建议使用 stdio JSON-RPC，支持：

- Schema 握手；
- Delivery；
- 取消；
- 流式事件；
- 超时；
- 健康检查。

### 8.3 Go

Go SDK 实现相同协议：

```go
type Implementation interface {
    Execute(
        context.Context,
        json.RawMessage,
    ) (json.RawMessage, error)
}
```

优先使用独立进程或网络协议，不绑定 Node ABI。

### 8.4 Goja

Goja 作为 Go Runtime 内的 JS Implementation Adapter：

```toml
[connections.rules]
kind = "goja"
module = "./rules.js"
```

Goja 必须限制文件、网络、模块加载、执行时间和内存。它不是 Core Runtime。

### 8.5 MCP 与 HTTP

MCP 和 HTTP 都实现为 Connection Adapter：

```text
Manifest Resource ⇄ MCP Resource
Implementation ⇄ MCP Tool
Delivery ⇄ MCP notification
AgentManifest ⇄ HTTP/OpenAPI endpoint
```

同一个 Manifest 可以同时导入或导出 MCP/API。

## 9. 组合定律

### 9.1 Agent 组合

Agent 使用 Effect 或 Stream 的 Kleisli 组合：

```ts
compose(compose(a, b), c)
compose(a, compose(b, c))
```

在相同 Layer、TestClock 和 TestRandom 下，两者标准化后的 Delivery 序列应该相等。

### 9.2 Manifest 组合

Manifest 使用可失败的 Semigroup：

```ts
combine:
  (left, right) => Either.Either<AgentManifest, ManifestConflict>
```

标准化规则包括：

- Schema ref 规范化；
- Resource 按稳定 ID 排序和去重；
- 权限只允许收窄或显式合并；
- Connection 冲突失败；
- Delivery 顺序语义明确。

### 9.3 验证

使用 property-based tests 验证：

- Manifest 组合结合律；
- Connection 组合结合律；
- Effect 顺序组合结合律；
- Stream 多 Delivery 组合结合律；
- TOML 与 Effect-TS 编译同像；
- JSON Schema 往返稳定性。

## 10. 安全边界

- TOML 只引用已注入 Connection；
- TOML 不执行任意代码；
- Connection 由应用显式注入；
- Resource scope 在 Runtime 统一校验；
- 写权限不能因组合静默扩大；
- 所有输入输出在实现边界进行 Schema 校验；
- 外部进程使用 Scope 管理；
- Bridge 支持取消、超时和输出大小限制；
- 动态 JS/Goja 加载必须显式授权。

## 11. 推荐包结构

```text
packages/
├── core/
│   ├── manifest.ts
│   ├── schema.ts
│   ├── delivery.ts
│   ├── resource.ts
│   ├── implementation.ts
│   └── algebra.ts
├── runtime-effect/
│   ├── compiler.ts
│   ├── messenger.ts
│   ├── keeper.ts
│   ├── harness.ts
│   └── registry.ts
├── toml/
├── builtin/
├── adapter-mcp/
├── adapter-http/
├── bridge-js/
├── bridge-process/
└── sdk-go/
```

MVP 阶段可以保留单仓库目录，但模块依赖必须遵守：

```text
core ← runtime ← builtin / external adapters
```

Core 不能反向依赖 Runtime 或 Builtin。

## 12. 实施阶段

### Phase 1：Core IR

- 定义 SchemaSpec；
- 定义 AgentManifest；
- 定义 Delivery、ResourceSpec、ImplementationRef；
- 实现 Effect Schema 校验和 normalize；
- 编写组合定律测试。

### Phase 2：双入口同像

- Effect-TS DSL → Manifest；
- TOML → Manifest；
- 验证两者标准化结果相等；
- 将现有 Agent Builder 适配到 Manifest。

### Phase 3：Effect Runtime

- ConnectionRegistry Tag + Layer；
- Manifest Compiler；
- Messenger Delivery Stream；
- AgentKeeper；
- 将现有 Driver 接入 Registry。

### Phase 4：Builtin

- Provider；
- Project；
- Filesystem；
- Process；
- SSH；
- MCP。

现有实现逐个迁移为普通 Connection，不保留特殊入口。

### Phase 5：外部协议

- MCP import/export；
- HTTP/OpenAPI export；
- stdio JSON-RPC Bridge；
- JavaScript Module Connection。

### Phase 6：多语言

- Go 协议 SDK；
- Go Runtime 示例；
- Goja Adapter；
- 跨语言契约测试。

## 13. MVP 验收

- TOML 与 Effect-TS 可以定义同一个 Agent；
- 两种定义编译为相同 Manifest；
- Manifest 可以通过 Effect Runtime 运行；
- Runtime 只通过 ConnectionRegistry 获取实现；
- Builtin 和外部 Connection 使用同一接口；
- 同一 Agent 可以导出为 MCP Tool；
- Delivery 支持零次、一次和多次；
- Connection 和 Manifest 组合通过结合律测试；
- 未注入 Connection、Schema 错误和权限冲突均在执行前失败；
- Core 不依赖任何具体 SDK 或外围实现。
