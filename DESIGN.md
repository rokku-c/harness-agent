# DESIGN — effect-agent 设计

> 本文档记录 effect-agent 的核心设计（正式版）。概念以近期确认的为准。
> 扩展（TOML/MCP/API 等）不属于核心设计，由核心「长出」，不在本文档设计。

## 第一性原理

一切 agent 的本质是 **LLM 请求**。抽象只做一件事：把「请求之间怎么配合」从手写变成声明。

- 用户表达意图，宿主决定机制；
- 底层全是 LLM 请求；抽象是「请求之间关系」的声明化。

## 概念全景

```
Agent        —— 一个请求的边界（循环契约）
Stage        —— 推进路径（里程碑，每节点带解锁）
Until        —— 观察投影（推进到哪拿什么）
Gate         —— 解锁投影（到哪改世界/解锁工具）
Resource     —— 可访问/可协作的东西
Container    —— 工具集（派生 toolCall）
Mgmt         —— 管理容器（容器+资源两身份，能建）
Connection   —— 把远程资源/容器接过来给 agent
Group/Org    —— 组织 agent 的范围
Messenger    —— 通信方式
```

## Agent —— 一个请求的边界

Agent 是一个持续运行的循环：`LLM 请求 → 结果 → 工具 → 新上下文 → 再请求`。

```
Agent = 循环契约
  ├─ exchange  单次交换形状（输入/输出 schema）
  ├─ resources 操作什么（封闭/开放 → 影响强/弱）
  ├─ driver    靠谁执行（execution family + capabilities）
  └─ until     观察投影：推进到哪拿什么
```

### 输入输出模式

输入输出是 0..n × 0..n（循环的天然性质），schema 是「单次交换的形状」：

| 输入 | 输出 | 例子 |
|---|---|---|
| 0 | 1..n | 定时/事件触发 agent |
| 1 | 1 | request/response |
| 1..n | 1..n | 长跑 agent（Claude Code） |
| 1..n | 0 | 静默执行（只写资源） |

- 0 用字段缺席表达（无 receives = producer；无 delivers = sink）；
- 1×1（单次调用）是循环的一个投影，不是独立形态；
- schema 嵌在 exchange，不与循环平级。

## Stage / Until / Gate —— 执行编排

让 agent 以「我们想要的方式」工作。effect-ts 组合子，Gate 内联在 Stage 节点上（无索引）：

```ts
const plan = pipe(
  Stage.guard("list_dir", {
    always: "你是只读审查者",
    container: [filesystem],
    tools: { list_dir: "allow", read_file: "allow", submit: "deny" },
  }),
  then("read_file", {
    always: "你已经看到代码，开始找问题。",
    tools: { submit: "allow", structuredOutput: "show" },
  }),
  then("submit", {
    always: "现在收敛，返回 Review",
    tools: { commit: "deny" },
  }),
)

const Reviewer = Agent
  .define<string>(/* ... */)
  .returns(Until.schema(Review))
  .stages(plan)
  .implementedBy(driver)
```

- **Stage**：推进路径，每节点 = 到达某工具调用 + 解锁配置；
- **Until**：观察投影（`schema`/`toolCall`/`stop`），推进到哪拿什么；
- **Gate**：解锁投影（`always` 改规则 / `container` 挂载 / `tools` 控制 show/hide/allow/deny）；
- 缺省（无 stages）= 自由，全可见全可用（评测场景）。

## Resource —— 可访问/可协作的东西

资源语义与物理位置分离（本地目录 / SSH / 远程 API 同一 Resource）。

```
Resource
  ├─ 注入形式  direct | auto | managed（managed=注入管理工具+自动调第一个）
  ├─ 帧视图    1 | 2 | inf（工具结果留几帧；inf=append-only，cache 友好）
  ├─ 租约      声明谁在用 + 过期（不是所有权，是占用声明）
  └─ 实现      = 特殊 Container（管理工具就是一组 ops）
```

## Mgmt —— 管理容器

「能创建/管理 X 的东西」递归概念。两个固定身份——是容器，也是资源：

```
Mgmt = 管理 X（可建，readonly | writable 模式）
     + 是容器（管理工具 = 一组 ops）
     + 是资源（可寻址、可挂载/注入/访问）
```

递归来自「Mgmt 是资源 → 能被资源管理器管理」，不需要「本身是 X」。

| Mgmt | 管理 | 能建 |
|---|---|---|
| ResourceMgmt | 资源 | 虚拟资源（协作媒介：任务队列/黑板） |
| ContainerMgmt | 容器 | 新容器（新 workspace/工具集） |

## Connection / Group / Messenger —— 端点间关系

三个**平级独立**概念，各解决一个问题：

```
Connection   接入远程世界（transport 是底层实现）
Group/Org    组织 agent 的范围
Messenger    通信方式
```

- **Connection**：把远程 resource/container 接过来给 agent。transport 是实现（SSH transport → Connection → 虚拟文件系统 Container）。
- **Group/Org**：放特殊资源的容器，装 N 个 agent。Group 是最小单元；Organization 由 Group 组成，必须有 OfficeGroup。虚拟范围可重叠；不定义就是单独 agent。
- **Messenger**：通信方式，agent/group/org 都可以有。三种模式：应答（request/response）、双向（持续对话流）、邮件（异步投递）。

**核心约束**：agent 是唯一可活动实体。group/org 可声明自己的 Messenger，但实际发/收消息的是成员 agent。

## 两条对称属性

agent 系统既是「被描述的对象」，也是「描述/观测它的主体」：

1. **可描述** —— agent 可被 agent/人定义并运行（meta-agent 定义新 agent）；
2. **可观测/介入** —— agent 可被人/agent 观测（状态/进度/结果）和介入（暂停/改方向/注入/取消）。

观测/介入分两维：主体（人/agent）、通道（web/mcp/api/agent 直连）。因为 agent 也是主体，观测/介入接口必须能被 agent 访问（mcp/api 必须），web 只是给人用的一种形态。

## 双基座

同一份描述，两个基座解释：

```
本地 harness  → fibers + 进程桥
Cloudflare    → Durable Object + DO 间消息
```

进抽象的是「消息/契约/协商」，沉到基座的是「执行/传输/持久化」。

## 当前实现状态

- ✅ `Agent` 定义流（define/returns/stages/uses/implementedBy）
- ✅ 核心无 prompt 概念：`Context.messages` 是归一化 `Message`（与 Anthropic/OpenAI 同义，可互相转换，支持多媒体）
- ✅ `Stage`/`Until`/`Gate` 组合子 + 接入 Agent
- ✅ `Resource` 抽象（注入/帧视图/租约/边界）在 packages/core
- ✅ `Mgmt`（ResourceMgmt）在 packages/builtin/containers
- ✅ `Group`/`Organization` + `Messenger` 通信模式（reply/two-way/mail）
- ✅ monorepo：core（抽象）/ builtin（实现）/ community（扩展）
- 🔶 阶段推进引擎未实现（编排能表达、未真正驱动按阶段跑）
- 🔶 `Connection` 接入远程的抽象待完善

## Context —— 四维认知模型（无 prompt 概念）

核心 harness 不出现 `prompt` 概念。`Context` 是 agent 运行时的唯一事实源，由投递填充、
业务只读。四维：

```
Context
  ├─ always    持久指令（身份/规则/护栏），可配置是否可变；不可变时禁止改变
  ├─ messages  本 run 接收的消息序列（投递填充，业务不直接构造，只读）
  ├─ until     期望输出（观察投影）
  └─ details   内部过程（thinking/text/toolCall —— 驱动支持时填充）
```

- **`messages`** 是归一化 `Message`，与 Anthropic message API / OpenAI chat / responses 同义：
  `{ role, content: string | Block[] }`，Block 覆盖 text / image（url | base64）/ tool_call / tool_result，
  支持多媒体。`toAnthropic(message)` / `toOpenAI(message)` 双向转换。
- **输入完全通过 Messenger Delivery 传输**，不保留 `Context.input`。
- **渲染是驱动/适配职责**：驱动用 `render`/`renderSystem`（packages/builtin/src/render.ts）
  把 `Context` 投影成具体 SDK 所需的 prompt 文本。核心不关心渲染。
- `Agent.define<I>()` 只声明接收类型，不构造 Context；业务输入经 `toMessage` 归一化注入。

