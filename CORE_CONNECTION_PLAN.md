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

Agent 核心定义由三要素构成：**输入输出模式**（接口）、**资源**（操作对象）、**影响**（操作后果）。

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

**v0 原型**：`examples/lib/agent-spec.ts` 已实现一套接近 Manifest 的受控结构——`AgentSpec`（Schema 校验）、`TOOLS` 注册表 + `resolveOps`（资源按名引用，execute 全宿主实现）、`selectDriver`（driver 路由）、`outputSchemaOf`（delivers 输出）、`renderSpec`/`compileSpec`（双入口）。Manifest 是这套原型的**泛化 + 跨语言序列化**，而不是另起炉灶：TOML/JSON 是 `AgentSpec` 的跨语言形态，`requires.connections` 对应 `resolveOps` 的注册表查询。MVP 优先复用 agent-spec 的 Schema/render 管线，避免并行编译逻辑。

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

资源是「可访问/可协作的东西」。资源语义和物理位置分离——同一个 Project Resource 可以由本地目录、SSH、容器或远程 API 实现。

```ts
interface ResourceSpec {
  readonly id: string
  readonly implementation: ConnectionRef
  readonly access: "read" | "write"
  readonly scope?: unknown
  readonly visibility?: "visible" | "abstract" | "hidden"
  /** 注入形式。 */
  readonly injection?: "direct" | "auto" | "managed"
  /** 租约：谁在用 + 过期。不是所有权，是「当前占用声明」。 */
  readonly lease?: { readonly holder?: string; readonly expiresAt?: string }
  /** 实现上是一种特殊 Container。 */
  readonly container?: ContainerSpec
  readonly config?: unknown
}
```

#### 注入形式

资源进入 agent 的方式，三档：

| 档位 | 行为 |
|---|---|
| `direct` | 直接把描述型资源塞进上下文（普通描述型资源用这个） |
| `auto` | 默认：注入「资源管理工具」，agent 按需访问 |
| `managed` | 注入管理工具 + 宿主自动调用第一个（如列出资源，让 agent 开局就看到） |

#### 帧视图模式

资源的管理工具调用结果在上下文留几帧（继承自 Container）：

| 值 | 行为 |
|---|---|
| `1` | 每次调用后，之前的工具结果删除（只留当前） |
| `2` | 保留最近 2 个 |
| `inf` / `0` | 不管，工具调用结果 append-only（对模型 cache 友好） |

#### 租约（协作）

资源不是「被拥有」，而是「被声明使用」——声明当前占用者 + 过期时间。过期后其他 agent 可用。支持锁定/协商/共享探索：多个 agent 竞争时协商谁用，共同探索场景可声明不加锁。

#### Mgmt —— 管理容器（统一概念）

「能创建/管理 X 的东西」是递归概念。统一为 `Mgmt`：**两个固定身份——是容器，也是资源**，与它管理什么无关。

```
Mgmt = 管理 X（可建，readonly | writable 模式）
     + 是容器（管理工具 = 一组 ops）
     + 是资源（可寻址、可挂载/注入/访问）
```

**递归的统一来源**：Mgmt 是资源 → 资源管理器能管理「资源」，而 Mgmt 本身是资源 → 能管理 Mgmt 自身（自我管理/嵌套管理）。不需要「本身是 X」这条。

| Mgmt | 管理什么 | 能建什么 | 身份 |
|---|---|---|---|
| `ResourceMgmt` | 资源 | 虚拟资源（`effect://self/tasks/task-1.md`） | 容器 + 资源 |
| `ContainerMgmt` | 容器 | 新容器（新 workspace/工具集） | 容器 + 资源 |
| `AgentMgmt` | （先不定义） | — | — |

创建模式（readonly/writable）：readonly 只能读/列；writable 能创建虚拟资源。这使得 agent 能创建虚拟资源作为协作媒介（任务队列/黑板），其他 agent 声明锁定后执行。

### 3.5 ConnectionRef

```ts
interface ConnectionRef {
  readonly connection: string
  readonly implementation: string
}
```

ConnectionRef 是 Core 中唯一的外部实现引用。Manifest 只引用 Connection，不加载代码。

### 3.5.1 端点间关系：Connection / Group+Org / Messenger

三个**平级独立概念**，各自解决一个问题，不互相嵌套：

```
Connection   接入远程世界（transport 是底层实现）
Group/Org    组织 agent 的范围（装 agent 的容器）
Messenger    通信方式（agent/group/org 都可以有）
```

#### Connection —— 接入远程

把远程 resource/container 接过来给 agent。`transport` 是它的底层实现概念（如通过 SSH transport 实现的 Connection，接到一个文件系统 Container，形成一个虚拟文件系统）。

#### Group / Organization —— 组织范围

放特殊资源的容器，把 N 个 agent 放一起。**不是现在的 Container**（只是类比，装的是 agent 不是 binding）。虚拟范围可以重叠（一个 agent 可同时在多个 group）；不定义 group 就是单独 agent。

- **Group**：最小组织单元（装 agent 的集合）；
- **Organization**：由多个 Group 组成，且**必须有一个 OfficeGroup**（一个特殊的、必须存在的 Group）。

#### Messenger —— 通信方式

代表「具体怎么通信」的机制。**agent 可以有，group 和 organization 也可以有**（不是只有 agent 才有）。支持三种通信模式：

| 模式 | 语义 |
|---|---|
| **应答通信** | request/response：A 问 B，B 答（同步等答复） |
| **双向通信** | 持续双向对话流：不是一问一答，是长期双向交流 |
| **邮件通信** | 异步投递：像邮件，投递后不等待立即回复 |

通信的具体方式（delegate/query/notify/subscribe 等）由 Messenger 承载。

#### 核心约束：agent 是唯一可活动实体

group/org 可以声明自己的 Messenger 方式，但**实际发出/接收消息的是成员 agent**，不是 group/org 这个抽象本身。group/org 只是组织范围（容器），它们自己不会活动——通信这类活动只能由 agent 执行。因此 group 的通信方式最终「挂到」成员 agent 上，由 agent 实际执行。

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

### 3.7 现有模型 → Manifest 映射

Manifest 不是另起炉灶的并行模型，而是**现有 `Agent.define` / Builder 模型的可序列化视图**。现有代码写的是 Effect-TS 定义，Manifest 是它的声明形式；两者是同一 Agent 的两种声明方式，`normalize` 后必须 `Equal.equals` 相等。

映射规则：

| 现有模型 | Manifest | 说明 |
|---|---|---|
| `Agent.define(id, input)` | `receives` | `input: (I) => Context` 的 `I` 类型 → `receives` 的 SchemaSpec |
| `AgentBuilder.uses(binding)` | `resources[]` | `binding` → `ResourceSpec`，`binding.uri` → `resource.id`，`Access.write` → `access` |
| `Binding.read` | Resource 的读取能力 | 实现层：`materialize` 把 read 结果拼进 Context 等价于 Resource 的 `read` Implementation |
| `Binding.ops[]` | `implementation` 下的 `Implementation[]` | `Op.name` → `Implementation.id`，`Op.input/output` → `Implementation.input/output`，`Op.execute` → `Implementation.execute` |
| `AgentBuilder.returns(Until)` | `until` + `delivers[]` | `Until.schema(S)` → `delivers[{ schema: S, target: "origin", many: false }]` + `until: { type: "stop" }`；`Until.stop` → `delivers[{ schema: Text, target: "origin" }]` |
| `AgentBuilder.subagents()` | `resources[]`（派生子 Agent） | `SubagentProgram` → 子 Manifest，`until`/`access`/`context` 映射同本表 |
| `implementedBy(driver)` | `driver` | `driver.id` + `capabilities` → `driver: ConnectionRef("builtin.providers", driver.id)` |
| `AgentProgram.run(input)` | `compile(manifest)` 的产物 | `run = deliver(manifest, payload)`；同步拿 `Result<O>` 走 AgentKeeper（见 3.10），非阻塞则走 Messenger 事件流 |
| `Context.current`（运行期输入） | Delivery 的 `payload` | 运行期值，非声明 |
| `Capabilities` | `requires.drivers` 的能力约束 | 见 3.8 |

**Phase 2 的「双入口同像」由此落地**：TOML/JSON/Effect-TS 三个入口都声明**同一个 Manifest**，而不是「现有 Builder 模型」vs「新 Manifest 模型」两套并存。`fromEffect(Agent.define(...))` 直接产出 Manifest，`compile(manifest)` 能跑回现有 `AgentProgram` 语义。

现有代码无需重写：`Agent.define` 仍是业务入口，Manifest 是它的**可序列化投影**。需要外部寻址/审计/持久化时用 Manifest；纯内存组合时直接用 Builder。

### 3.8 Capabilities 能力约束

现有 `requireUntil` / `requireSubagents` 在运行前用 `UnsupportedCapability` 失败，把「driver 不支持所需能力」从运行期错误提前到协商期。Manifest 世界必须保留这条协商路径，否则 `Until.schema` 遇到 `structuredOutput: "none"` 的 driver 会在编译后才发现。

`AgentManifest.requires` 增加能力约束（3.1 的 `ManifestRequirements` 扩展为完整形态）：

```ts
interface ManifestRequirements {
  readonly core: "effect-agent/core@1"
  readonly runtime: string
  readonly schemas: ReadonlyArray<string>
  readonly connections: ReadonlyArray<ConnectionRef>
  readonly drivers: ReadonlyArray<ConnectionRef>
  /** 能力需求：与 Capabilities 矩阵对应，compile() 时对 driver 校验。 */
  readonly capabilities?: {
    readonly structuredOutput?: "native" | "tool" | "text" | "none"
    readonly granularity?: "event" | "turn" | "run"
    readonly toolCalls?: "intercept" | "observe" | "none"
    readonly subagents?: boolean
    readonly thinking?: boolean
  }
}
```

`compile()` 在解析 driver 后对照其 `Capabilities` 校验 `requires.capabilities`，不满足返回 `UnsupportedCapability`。TOML 同像：

```toml
[agent.requires.capabilities]
structuredOutput = "native"
granularity = "event"
```

### 3.9 requires 校验的编译期 / 运行期分工

`Manifest.requires.connections` 是运行期值，Effect `Layer` 的类型系统（`R`）只能在编译期静态保证类型，无法静态验证「运行期 Registry 里有这个 Connection」。校验分两层：

1. **TypeScript 层（编译期）**：`ConnectionRef` 用连接引用的联合类型表达，`requires.drivers` / `requires.connections` 的类型从注入的 Connection Registry 推导。写错连接名在编译期报错。
2. **运行期（compile 阶段）**：`compile(manifest)` 从 `ConnectionRegistry` 解析每个 `ConnectionRef`，缺失返回 `MissingConnection` / `MissingImplementation`（见 6.2）。`requireUntil` / `requireSubagents` 在此阶段执行，能力不满足返回 `UnsupportedCapability`。

两层都满足才产出 `ComposedAgent`。跨语言（Go/Rust）没有 TS 类型系统，只靠运行期 Registry 校验——这是 6.2 的职责，TypeScript 层的联合类型是「本地加速」，不是协议。

### 3.10 Deliver 的 RPC 语义澄清

概念上「Delivery 不是 request/response」，`correlation` 只描述关联。但现有 `AgentKeeper.send` 返回 `Effect<Result>`（同步 RPC），这是文档与实现的正面冲突。收敛规则：

- **`Messenger.deliver(delivery)` 是非阻塞投递**（`Effect<void>`），这是 Core 语义——投递不等待响应。
- **`AgentKeeper.send` 是 request/response 特例**，它内部 = `deliver(delivery)` + `await` 该 delivery 的 `correlation` 对应的结果。Keeper 是「投递 + 关联等待」的组合，不是普通投递。
- 后续非阻塞通道（事件流、Stream）通过 `Messenger` 表达；`Keeper` 只为需要同步结果的场景提供便捷层。

这样「概念不 RPC、Keeper 是 RPC」不再冲突：RPC 是 Keeper 的**组合语义**，不是 Delivery 的**基本语义**。

### 3.11 visibility 三态定位

`resources.visibility`（visible/abstract/hidden）当前零实现。明确其层级：

- **Core 层（Manifest）**：`visibility` 是声明，描述「资源位置是否对 Agent 可见」。
- **Runtime 层**：`compile()` 执行可见性策略——`visible` 注入资源位置、`abstract` 提供访问但不暴露位置、`hidden` 完全隔离。

MVP（Phase 1-3）不实现 visible/abstract/hidden 的执行差异，统一按 `visible` 处理。`visibility` 字段保留在 Schema 里但标注为「MVP 后启用」，避免一个文档化零实现的概念悬挂在验收标准里。

### 3.12 执行编排：Stage / Until / Gates

**目标**：让 agent 以「我们想要的方式」工作——推进到什么阶段、拿什么、什么可用。三个概念，各自独立，effect-ts 组合子表达。

**关系一句话**：`Stage` 是共享的推进进度，`Until` 看进度拿东西（观察），`Gates` 按进度改世界（挂载资源/变更规则/解锁工具）。策略（注入/受限/自由）是 Gates 的实现细节，不进描述。

#### Stage —— 推进路径（里程碑）

agent 一次运行的推进路径，由「到达某工具调用」作为阶段标记：

```ts
const plan =
  Stage.guard(tool("list_dir"))
       .then  (tool("read_file"))
       .then  (tool("submit"))
```

- 阶段 = 链上的位置，用工具名标识（不用索引）；
- `guard` 是第一步，`.then` 是后续推进；
- Stage 是纯数据（可序列化），也是观察/解锁的单一事实源。

#### Until —— 观察投影（推进到哪，拿什么）

从推进路径里挑「到达某阶段时，拿到什么」：

```ts
const until = plan.observe(at.toolCall("submit"))    // 推进到 submit 出现，拿它的调用
const until = plan.observe(at.schema(Review))        // 推进到产出符合 Review，拿结果
```

- Until 描述**推进到哪个阶段拿什么**，不描述「停」；
- 停（`.stop`）是独立算子，且依赖 Agent 能力（外部 composed agent 可能不支持暂停）；
- 缺省（无 observe）= 完整跑完，不中途拿（评测 LLM 能力场景）。

#### Gates —— 解锁投影（到哪个阶段，世界变成什么样）

按阶段**变更 agent 能触及的世界**——挂载资源、变更规则、解锁/约束工具。字段名即动作，没有多余的 `inject` 包装：

```ts
Gate = {
  at: StageRef,              // 到哪个阶段生效
  always?: string,           // 变更持久指令（system prompt / 角色规则）
  container?: ContainerRef,  // 挂载容器 → 派生工具进 toolCall 列表
  resource?: ResourceRef,    // 挂载资源（SSH / DB / 远程目录）
  allow?: string[],          // 可用
  deny?: string[],           // 可见但不可用（调用时失败）
  show?: string[],           // 可见
  hide?: string[],           // 不可见
}
```

**工具/上下文由注入的世界派生，不直接注入**：

```
挂载 container(filesystem)  → 派生 read_file/write_file/list_dir → 进 LLM toolCall
变更 always("你是收敛者")    → 派生 system prompt / 角色规则 → 影响行为
```

- 没有「直接注入上下文片段」——上下文永远由容器/always 派生；
- `show/hide` 管可见性，`allow/deny` 管可用性（两个正交维度）；
- 缺省（无 gates）= 自由，全可见全可用（评测场景）。

#### 组合

```ts
const plan =
  Stage.guard(tool("list_dir"))
       .then  (tool("read_file"), gates: {
         always: "你是只读审查者",
         container: [filesystem],
         allow: ["submit"],
       })
       .then  (tool("submit"), gates: {
         always: "现在收敛，返回 Review",
         show:   ["structuredOutput"],
         deny:   ["commit"],
       })
       .observe(at.schema(Review))
```

**阶段是共享事实**：`Until` 和 `Gates` 都引用同一条 Stage 路径，不各自定义阶段，避免漂移。宿主只推进一个 Stage，观察/解锁自动同步。

#### 与现有 `Until` 的关系

现有 `Until.schema(S)` / `Until.stop` / `Until.toolCall` 是这里的**特例**：
- `Until.schema(S)` → `observe(at.schema(S))`
- `Until.stop` → `observe(at.end)` + `.stop`
- `Until.toolCall` → `observe(at.toolCall(...))`

新设计不推翻现有 API，而是把它扩展为「推进路径 + 观察 + 解锁」的组合。

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
- **实现 `fromEffect(Agent.define(...))`：把现有 Builder 定义投影为 Manifest（3.7 映射表）**；
- **验证投影后的 Manifest `normalize` 后与手写 TOML 定义 `Equal.equals` 相等**；
- 现有 Agent 业务代码保持 `Agent.define` 入口，Manifest 只是可序列化投影。

### Phase 3：Effect Runtime

- ConnectionRegistry Tag + Layer；
- Manifest Compiler（含 `requires.capabilities` 对照 driver Capabilities 校验，见 3.8）；
- Messenger Delivery Stream（非阻塞投递，见 3.10）；
- AgentKeeper（投递 + correlation 等待的 RPC 便捷层）；
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
- **现有 `Agent.define(...).uses(...).returns(...)` 可以直接投影为 Manifest（3.7），不用重写业务代码**；
- 两种定义编译为相同 Manifest；
- Manifest 可以通过 Effect Runtime 运行；
- Runtime 只通过 ConnectionRegistry 获取实现；
- Builtin 和外部 Connection 使用同一接口；
- 同一 Agent 可以导出为 MCP Tool；
- Delivery 支持零次、一次和多次；
- Connection 和 Manifest 组合通过结合律测试；
- 未注入 Connection、Schema 错误和权限冲突均在执行前失败；
- `requires.capabilities` 在 compile 阶段对照 driver Capabilities 校验（3.8）；
- Core 不依赖任何具体 SDK 或外围实现；
- **`visibility` 三态不在 MVP 验收内（3.11），MVP 统一按 `visible` 处理**。
