# GUIDELINES —— 如何设计一个 Agent

> 定义 agent 不是写代码，是回答五个问题：**干什么 / 靠谁跑 / 碰什么 / 怎么跑 / 谁在边上**。
> 每个问题对应一组抽象。按下面的逻辑图走，缺省即自由，显式即约束。
>
> 本文档每个符号都是真实 API，与代码一一对应。

## 一、总览：五个决策点

```mermaid
flowchart TD
    A["1. 干什么<br/>Agent.define&lt;I&gt;() + Until<br/><i>输入/输出契约</i>"] --> B["2. 靠谁跑<br/>driver<br/><i>Provider / ComposedAgent / SDK</i>"]
    B --> C["3. 碰什么<br/>Container(Binding+Ops)<br/><i>← Connection 接入</i>"]
    C --> D["4. 怎么跑<br/>Stage / Until / Gate 编排<br/><i>缺省 = 自由</i>"]
    D --> E["5. 谁在边上<br/>Group / Org / Messenger<br/>+ Harness hook"]
```

**核心原则**：
- 纯 agent = 只回答 1、2。
- 越靠近真实世界 = 回答得越多。
- 每个决策点都有缺省值，不回答 = 用缺省（自由跑）。

---

## 二、决策逻辑图（详细版）

### 2.1 干什么 —— 输入 / 输出

```mermaid
flowchart LR
    Q{"接收什么？"} -->|"单次 request/response"| DEF["Agent.define&lt;Input&gt;()<br/><i>只声明类型，不构造 Context</i>"]
    Q -->|"多次投递（长跑）"| MSG["Agent.define&lt;Input&gt;()<br/>+ Messenger 反复 deliver"]
    DEF --> OUT{"产出形态？"}
    MSG --> OUT
    OUT -->|"只要文本"| STOP["Until.stop"]
    OUT -->|"结构化对象"| SCH["Until.schema(OutputSchema)"]
    OUT -->|"中途拿工具调用"| TC["Until.toolCall()"]
    OUT -->|"中途拿思考"| TH["Until.thinking()<br/><i>需 driver 支持</i>"]
```

> 输入完全通过 **Delivery** 传输，`define<I>()` 不接收 Context 构造。
> 业务输入在 `run(input)` 时经 `toMessage` 归一化注入 `messages`。

### 2.2 靠谁跑 —— 选 driver

```mermaid
flowchart TD
    Q{"谁执行这个 agent？"} -->|"有 config.toml"| P["Providers.agent(&quot;reasoner&quot;)<br/><i>缺省用 config.toml 的 default</i>"]
    Q -->|"完整外部 agent"| CA["ComposedAgent 系列<br/>ClaudeCode.make()<br/>CodexAgent.make()<br/>PiAgent.make()"]
    Q -->|"官方 SDK 直连"| NA["原生驱动<br/>NativeAgent.make()<br/>VercelAgent.make()<br/>EffectAgent.make()"]
    Q -->|"自定义"| CUSTOM["实现 Driver 接口<br/>capabilities + start(DriverContext)"]
    P -.->|implementedBy| AG
    CA -.->|implementedBy| AG
    NA -.->|implementedBy| AG
    CUSTOM -.->|implementedBy| AG
    AG["同一个 Agent 定义<br/>可 harness 多个 runtime<br/><i>examples/05</i>"]
```

> driver 是唯一的执行者。agent 定义不绑定 driver，`implementedBy(driver)` 才绑定。
> ComposedAgent 也可以把一个已完成的 Harness Agent「命名」成可复用组合程序，
> 再用 AgentKeeper 保持存活（examples/16）。

### 2.3 碰什么 —— 世界抽象成 Container

```mermaid
flowchart TD
    Q{"要不要接触环境？"} -->|"纯推理 / 问答"| N["跳过 —— agent 已完整"]
    Q -->|"要"| ENV["环境抽象成 Container<br/><i>一组有边界的 Binding + Op</i>"]
    ENV -->|"本地项目"| PROJ["ProjectEnvironment.make({ root, scope, write })"]
    ENV -->|"远程主机"| SSH["SshConnection(uri).open<br/><i>→ 远程文件系统容器</i>"]
    ENV -->|"自建环境"| BUILD["Op.read / Op.write + Uri<br/>造 Binding（数据库/API/文件）"]
    PROJ --> INJ{"怎么注入 agent？"}
    SSH --> INJ
    BUILD --> INJ
    INJ -->|"只读"| U["uses(binding)"]
    INJ -->|"读写"| W["writes(binding)"]
    ENV -.->|"远程资源接入"| CONN["Connection<br/>把远程世界接过来<br/>变成本地 Container"]
```

> **关键心智**：环境永远是 Container。本地目录、SSH 远程、远程 API 是同一个抽象
> （Resource 语义与物理位置分离）。`Connection` 只是「把远程世界接过来变成本地 Container」。

### 2.4 怎么跑 —— 编排（缺省 = 自由）

```mermaid
flowchart TD
    Q{"要不要约束行为路径？"} -->|"自由探索 / 评测 LLM"| FREE["不调 stages()<br/><i>缺省即自由，全可见全可用</i>"]
    Q -->|"按阶段推进 + 解锁"| PLAN["const plan = pipe(<br/>Stage.guard(&quot;list_dir&quot;, { always, tools }),<br/>then(&quot;read_file&quot;, { tools }),<br/>then(&quot;submit&quot;, { tools }))"]
    PLAN --> ST["Agent.define&lt;I&gt;().stages(plan)..."]
```

> Stage = 推进路径，Gate = 每阶段的解锁（改 always / 挂容器 / 控工具）。

### 2.5 谁在边上 —— 关系 + 观测

```mermaid
flowchart TD
    Q{"一个 agent 够吗？要不要观测？"} -->|"运行时子代理"| SUB["subagents(program)<br/><i>主模型通过 delegate 工具调用</i>"]
    Q -->|"多 agent 协作"| GRP["Group / Organization<br/>+ broadcast / sendTo<br/>+ Messenger（reply / two-way / mail）"]
    Q -->|"观测 / 介入"| HOOK["Harness.withHooks(driver, hook)<br/><i>RunStarted / Detail / Output / RunFailed...</i>"]
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

```mermaid
flowchart LR
    subgraph AGENT["Agent 定义"]
        DEF["define&lt;I&gt; → until<br/>→ stages → subagents"]
    end
    DRIVER["driver<br/><i>Provider / ComposedAgent / Native</i>"]
    WORLD["world<br/><i>Container(Binding + Ops)</i>"]
    CONN["Connection<br/><i>远程接入</i>"]
    REL["关系 + 观测<br/><i>Group / Messenger / Hook</i>"]
    DEF ---|implementedBy| DRIVER
    DEF ---|uses / writes| WORLD
    CONN -.->|接入| WORLD
    AGENT --- REL
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
