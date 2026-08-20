# GUIDELINES —— 如何设计一个 Agent

> 定义 agent 不是写代码，是回答五个问题：**干什么 / 靠谁跑 / 碰什么 / 怎么跑 / 谁在边上**。
> 每个问题对应一组抽象。按下面的逻辑图走，缺省即自由，显式即约束。
>
> 本文档每个符号都是真实 API，与代码一一对应。

## 一、总览：五个决策点

```
        ┌─────────────────────────────────────────────┐
        │          1. 干什么（输入/输出契约）            │
        │   Agent.define<I>() + Until（期望输出）        │
        └──────────────────┬──────────────────────────┘
                           ▼
        ┌─────────────────────────────────────────────┐
        │          2. 靠谁跑（执行）                    │
        │   driver：Provider / ComposedAgent / SDK      │
        └──────────────────┬──────────────────────────┘
                           ▼
        ┌─────────────────────────────────────────────┐
        │          3. 碰什么（世界）                    │
        │   Container(Binding+Ops) ← Connection 接入   │
        └──────────────────┬──────────────────────────┘
                           ▼
        ┌─────────────────────────────────────────────┐
        │          4. 怎么跑（行为）                    │
        │   Stage/Until/Gate 编排  （缺省=自由）        │
        └──────────────────┬──────────────────────────┘
                           ▼
        ┌─────────────────────────────────────────────┐
        │          5. 谁在边上（关系 + 观测）           │
        │   Group/Org/Messenger + Harness hook         │
        └─────────────────────────────────────────────┘
```

**核心原则**：
- 纯 agent = 只回答 1、2。
- 越靠近真实世界 = 回答得越多。
- 每个决策点都有缺省值，不回答 = 用缺省（自由跑）。

---

## 二、决策逻辑图（详细版）

### 2.1 干什么 —— 输入 / 输出

```
需求：我的 agent 接收什么、产出什么？
│
├─ 只接收一个输入（request/response 型）
│     Agent.define<Input>()            ← 只声明类型，不构造 Context
│
├─ 接收多次投递（长跑型，经 Messenger）
│     Agent.define<Input>()  + 由 Messenger 反复 deliver
│
└─ 产出形态？
      ├─ 只要文本          → .returns(Until.stop)
      ├─ 要结构化对象      → .returns(Until.schema(OutputSchema))
      ├─ 中途拿工具调用    → .returns(Until.toolCall())
      └─ 中途拿思考        → .returns(Until.thinking())   [需 driver 支持]
```

> 输入完全通过 **Delivery** 传输，`define<I>()` 不接收 Context 构造。
> 业务输入在 `run(input)` 时经 `toMessage` 归一化注入 `messages`。

### 2.2 靠谁跑 —— 选 driver

```
需求：谁执行这个 agent？
│
├─ 我有 config.toml（配好 provider）     → Providers.agent("reasoner")
│     const driver = yield* Providers.agent()      // 缺省用 config.toml 的 default
│
├─ 我想用「完整外部 agent」              → ComposedAgent 系列
│     ClaudeCode.make()   // Claude Code（最强观测/子代理）
│     CodexAgent.make()   // OpenAI Codex
│     PiAgent.make()      // pi-coding-agent
│
│     注：ComposedAgent 也可以把一个已完成的 Harness Agent「命名」成可复用的
│     组合程序，再用 AgentKeeper 保持存活（examples/16）。
│
├─ 我直接接官方 SDK                     → 原生驱动
│     NativeAgent.make({ client, api, model })
│     VercelAgent.make({ model })        // @ai-sdk 兼容层
│     EffectAgent.make({ api, model })   // @effect/ai
│
└─ 我写自己的 driver
      // 实现 Driver 接口：capabilities + start(DriverContext)
      const myDriver: Driver = { id, capabilities, start: ... }
```

> driver 是唯一的执行者。agent 定义不绑定 driver，`implementedBy(driver)` 才绑定。
> 同一个 `Agent.define` 可以 harness 三个 runtime（见 examples/05）。

### 2.3 碰什么 —— 世界抽象成 Container

```
需求：agent 要不要接触环境？
│
├─ 不需要（纯推理 / 问答）              → 跳过这步，agent 已完整
│
├─ 需要 —— 环境抽象成 Container（一组有边界的 Binding+Ops）
│
│     ▸ 本地项目                         → ProjectEnvironment.make({ root, scope, write })
│     ▸ 远程主机（SSH）                  → SshConnection(uri).open → 容器
│     ▸ 自建环境（数据库/API/文件）      → 用 Op.read / Op.write + Uri 造 Binding
│
│           Op = 一个可执行能力（Schema 定输入输出，Effect 留副作用）
│           Binding = 一组 Op + uri（资源句柄）
│           Container = 一组 Binding（工具集）
│
├─ 远程资源怎么接入？                    → Connection
│     SshConnection("ssh://root@host/tmp/test1").open
│       → ContainersService（远程文件系统，像本地一样注入）
│
└─ 怎么注入 agent？
      .uses(binding)      // 只读注入
      .writes(binding)    // 读写注入（Op.access 控制）
```

> **关键心智**：环境永远是 Container。本地目录、SSH 远程、远程 API 是同一个抽象
> （Resource 语义与物理位置分离）。`Connection` 只是「把远程世界接过来变成本地 Container」。

### 2.4 怎么跑 —— 编排（缺省 = 自由）

```
需求：要不要约束 agent 的行为路径？
│
├─ 不要（评测 LLM 能力 / 自由探索）      → 不调 .stages()，自由跑
│
├─ 要 —— 按阶段推进 + 按阶段解锁
│     const plan = pipe(
│       Stage.guard("list_dir", { always: "...", tools: { submit: "deny" } }),
│       then("read_file",  { tools: { submit: "allow" } }),
│       then("submit",     { tools: { structuredOutput: "show" } }),
│     )
│     Agent.define<I>().stages(plan)...
│
└─ 结束条件                          → Until（2.1 已选）
```

> Stage = 推进路径，Gate = 每阶段的解锁（改 always / 挂容器 / 控工具）。

### 2.5 谁在边上 —— 关系 + 观测

```
需求：一个 agent 够吗？要不要看它？
│
├─ 要子代理（运行时派生）               → .subagents(program)
│     const reviewer: SubagentProgram = {
│       id: "reviewer", until: Until.stop,
│       access: [...], context: (goal) => ...,
│     }
│     Agent.define<I>().subagents(reviewer)...
│
├─ 要多个 agent 协作                    → Group / Organization / Messenger
│     makeGroup("team", [a, b, c])
│     broadcast(group, delivery)    // 扇出
│     sendTo(group, "a", delivery)  // 点对点
│     Messenger：reply（应答）/ two-way（双向流）/ mail（异步投递）
│
└─ 要观测 / 介入                       → Harness.withHooks(driver, hook)
      const hook = Harness.hook("name", (event) => Effect.sync(() => { ... }))
      const observed = Harness.withHooks(driver, DetailHook)
      // 事件：RunStarted / DriverPrepared / ToolStarted / ToolCompleted /
      //        Detail / Output / RunFailed / RunCompleted
```

---

## 三、快速决策表

| 你的需求 | 用的抽象 | 代码 |
|---|---|---|
| 纯问答 | `define` + `Until.stop` | `Agent.define<string>().returns(Until.stop).implementedBy(driver)` |
| 结构化输出 | `Until.schema` | `.returns(Until.schema(Output))` |
| 走 config.toml | `Providers` | `yield* Providers.agent()` |
| 用 Claude Code | `ClaudeCode.make()` | `.implementedBy(ClaudeCode.make())` |
| 读本地项目 | `ProjectEnvironment` | `.uses(ProjectEnvironment.make({ root }))` |
| 写远程 SSH | `SshConnection` | `.writes((yield* SshConnection(uri).open).bindings[0])` |
| 按阶段推进 | `Stage`/`then` | `.stages(pipe(Stage.guard(...), then(...)))` |
| 运行时子代理 | `SubagentProgram` | `.subagents({ id, until, access, context })` |
| 多 agent 扇出 | `Group` + `broadcast` | `broadcast(makeGroup("t", agents), delivery)` |
| 观测运行 | `Harness.withHooks` | `Harness.withHooks(driver, DetailHook)` |

---

## 四、心智模型

```
    ┌────────────────────────────────────────────┐
    │                  Agent                     │
    │  define<I> → until → stages → subagents     │
    └──┬──────────────────────────────┬───────────┘
       │ 靠谁跑 (driver)              │ 碰什么 (world)
       ▼                              ▼
  Provider / ComposedAgent       Container(Binding+Ops)
  / NativeAgent / ...                 ▲
                                      │ 远程接入
                                  Connection
    ┌────────────────────────────────────────────┐
    │           关系 (Group/Org) + 观测 (Hook)     │
    └────────────────────────────────────────────┘
```

**一句话记忆**：
- `Agent.define` 是「我」，`driver` 是「手脚」，`Container` 是「环境」，`Stage` 是「计划」，`Group/Messenger` 是「团队」，`Harness.hook` 是「镜子」。

---

## 五、示例索引

| 想看的场景 | 示例 |
|---|---|
| 最小文本 agent | `examples/01-text.ts` |
| 结构化输出 | `examples/02-object.ts` |
| 注入工具 | `examples/03-tool.ts` |
| 同一个定义 harness 多 runtime | `examples/05-composed-agents.ts` |
| Claude Code + 项目工具 | `examples/07-review-project.ts` |
| 运行时子代理 | `examples/08-subagents.ts` |
| 远程 SSH 世界 | `examples/09-ssh-game.ts` |
| 多 agent 黑板协作 | `examples/10-blackboard-puzzle.ts` |
| 多角色 swarm + 监督 | `examples/13-agent-swarm.ts` |
| 编排（Stage/Gate） | `examples/19-orchestration.ts` |
| 自由 vs 编排对比 | `examples/21-free-vs-orchestrated.ts` |
| 顾问架构（agent 作工具） | `examples/22-advisor.ts` |
| 观测 hook | `examples/hooks/detailed-review.ts` |
