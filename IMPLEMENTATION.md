# Implementation

本文记录当前代码已经实现的能力。目标设计见 [DRAFT.md](./DRAFT.md)。

## 模块

```text
src/core.ts               Context、Binding、Op、Driver、Session
src/agent.ts              Agent Builder 与 map/reduce
src/providers/index.ts    Provider 配置与 Driver 路由
src/providers/native.ts   OpenAI/Anthropic 官方 SDK Driver
src/providers/vercel.ts   Vercel AI SDK Driver
src/composed/             Claude Code、Codex、Pi Driver
src/hooks.ts              Harness 生命周期观测
src/ssh.ts                SSH 文件资源
src/defaults.ts           运行默认值
```

## Agent 运行

```text
Agent.define
  → Context + Until + Access
  → Driver.start
  → DriverSession.step
  → Session.run
  → Result { output, details }
```

`Agent.map` 和 `Agent.reduce` 使用 Effect 并发运行多个 Agent。

## Provider

Provider 配置来自 TOML，可通过 `Providers.layer(...)` 注入：

```toml
default = "reasoner"

[providers.reasoner]
api = "openai.responses"
model = "gpt-5.2"
apiKey = "${OPENAI_API_KEY}"
```

支持：

- `openai.responses`
- `openai.chat`
- `openai.completions`
- `anthropic.messages`

`driver = "native"` 使用官方 SDK；`driver = "vercel"` 使用 Vercel AI SDK。

## 工具与结构化输出

Binding `read` 在 Driver 启动前物化到 Context。获准的 Binding Ops 自动投影为底层工具。

`Until.schema`：

- Native：合成 output tool，并对入参做 Schema 校验；
- Vercel：默认使用 output tool，也可使用 JSON output；
- Claude Code：使用 SDK structured output；
- Codex：使用原生 output schema；
- Pi：注入 typed output tool。

工具循环和 Schema 修正循环默认持续到成功或 API 失败；可以配置 guard rail。

## Composed Driver

| Driver | Binding Ops | Schema 输出 | 子 Agent | 沙盒 |
|---|---:|---:|---:|---:|
| Claude Code | MCP | 原生 | 已接入 | delegated |
| Codex | 未接入 | 原生 | 未接入 | enforced |
| Pi | custom tools | output tool | 未接入 | none |

Claude Code 支持临时配置目录、Skill 注入、原生 Hook、MCP 工具和配置化会话。

## Hook

`Harness.withHooks(driver, ...hooks)` 观察：

- `RunStarted`
- `DriverPrepared`
- `ToolStarted`
- `ToolCompleted`
- `Detail`
- `Output`
- `RunFailed`
- `RunCompleted`

外部 SDK 原生 Hook 保留在对应 Driver 配置中，不伪装成跨 Driver Hook。

## Predictive Harness

`PredictiveHarness.withPrediction` 为所有注入的 Binding Ops 增加统一执行管线：

```text
读取历史误差 → 预测工具结果 → 执行工具 → 校验预测 → 错误时写入记忆
```

预测和校验本身都是普通 `AgentProgram`；记忆通过 `PredictionMemory` Tag + Layer 注入。预测正确时不写入误差记忆，判断错误时记录工具、输入、预测、实际输出、原因和学习。

## SSH

`SshConnection(uri)` 将远程文件读写包装为 Container 和 Binding Ops。它支持 SSH URI 与用户 SSH config。

当前 SSH 实现仍有裸 Promise、同步 IO 和普通 `Error`，需要按 `AGENTS.md` 收敛成细粒度 Effect 与 TaggedError。

## 已知问题

- `AgentBuilder.subagents()` 的定义尚未完整传入运行 Context；
- 部分 SDK 边界存在较多 `as any`；
- 默认输出 token 与部分测试断言可能不同步；
- `AgentKeeper` 尚未实现；
- 资源位置可见性（`visibility` 三态）和 Harness 自我 Binding 尚未实现；
- **当前 `AgentKeeper.send` 是同步 RPC（`Effect<Result>`）；非阻塞异步 Delivery 是未来协议**。`Messenger.deliver` 目前只是 `agent.run(payload)` 的转发，`source`/`target`/`correlation` 尚未被消费。方案见 CORE_CONNECTION_PLAN 3.10；
- **`harness` 叠加是洋葱式：先包的后触发**。`Harness.withHooks(PredictiveHarness.withPrediction(driver), hooks)` 里 hook 事件包住 predict→execute→assess 全过程；反过来则 hook 只见裸 execute。

## 架构现状

当前实现支持的是“单次 Agent 的组合型架构”，还不是完整的有状态多 Agent Runtime。

| 架构 | 当前实现 | 状态 |
|---|---|---|
| 单 Agent | `Agent.run` | 原生支持 |
| Pipeline | 上一个 `Result` 作为下一个输入 | 可手工组合 |
| Fan-out | `Agent.map` | 支持 |
| Fan-in / Reduce | `Agent.reduce` | 支持 |
| 多 Provider 对比 | 多个 Agent 并发执行 | 支持 |
| Blackboard | 共享 `Ref` 或 Binding | 可手工组合 |
| Supervisor / Worker | 并发 Agent 加汇总 Agent | 可手工组合 |
| Peer-to-peer | 共享状态或手工传递结果 | 非一等能力 |
| Composed Agent | `ComposedAgent.make(agent)` | 最小包装 |
| 长期托管 | `AgentKeeper` | 最小版本 |
| MCP 能力 | Binding Ops 投影为 MCP | Claude Code 已支持 |
| SSH 环境 | SSH Connection → Binding | 已支持 |

### AgentKeeper 的当前语义

`AgentKeeper` 使用 `Queue + Deferred + PubSub + Scope + Fiber` 托管一个 `AgentProgram`：

```text
Queue<Input>
  → agent.run(input)
  → Result / KeeperEvent
```

它是长期任务执行器，不是带持续认知上下文的会话。每次 `send` 都创建新的 Context 和 Driver Session。当前默认串行处理，尚未提供并发度、任务优先级、指定任务取消、上下文累积、Session resume 或长期记忆。

### ComposedAgent 的当前语义

`ComposedAgent.make(agent)` 当前是可复用程序的类型标记和薄包装，复用原有 `AgentProgram` 执行模型。它尚未成为：

- 可作为另一个 Agent Driver 的完整运行时；
- 自动封装内部 Binding、权限和生命周期的容器；
- 通用动态子 Agent 或拓扑节点。

### 尚未支持的架构能力

- 通用 Supervisor：任务分配、Worker 状态、重启和超时；
- 运行中的 Peer-to-peer Agent 寻址与通信；
- 动态创建、连接、销毁和重配 Agent；
- Keeper 间的持久消息、跨进程传输和崩溃恢复；
- 有状态会话、上下文压缩和长期记忆；
- Harness 自身 Binding 和资源位置可见性策略。

这些能力目前不要通过增加 `Pipeline`、`Worker`、`Supervisor` 等专用 Agent 类型来模拟。优先完善 `ComposedAgent → AgentKeeper → Harness` 的生命周期链；只有出现跨进程、持久化、事件回放或复杂路由需求时，再引入独立 Message 层。

## 配置边界

- 通用 Provider 配置放在 `[providers.*]`；
- Claude Code 等完整 Agent 放在 `[composedAgents.*]`；
- Binding 权限由 `.uses/.writes` 声明；
- Driver 通过 `Capabilities` 如实报告已接入能力。

## 验证

```sh
bun install
bun run typecheck
bun test
bun run example
```
