# dsh Connection Adapter 设计（v2.1）

> v2.1 依据第二轮评审修正：compile 信封解包、PubSub 生命周期、冒烟门控与进程树残留、事件语义文档化。
> 目标：让 DeepSeek Harness（dsh）成为 effect-agent 的一个 **Connection**——业务程序通过
> `ConnectionRuntime.invoke("dsh.agent.run", ...)` 驱动一个真实的 dsh runtime 子进程（方向 B）。

## 1. 背景与事实

- 连接内核 `packages/core/src/connection.ts`：`ConnectionSpec` → `ConnectionAdapter` →
  `ConnectionSession`。已支持 priority / failover / capability 选择、注册/注销自动关会话、
  `ConnectionEvent` 事件流。**本任务不改内核**。
- **内核信封**：`packages/core/src/agent.ts` 的 `compile` 生成
  `run: (input) => runtime.invoke(entry.connection, entry.capability, { input, agent: ir })`——
  经 AgentProgram 图调用的 `invoke` 收到的是 **`{ input, agent }` 信封**，不是裸业务入参。
- dsh 官方 TS 客户端 `@deepseek-ai/dsh-sdk-client`（0.1.1-rc.2，
  `/Volumes/CaseSensitive/macOS/repos/deepseek-harness/packages/sdk/client`）：
  `DeepSeekHarness({ launch, provider, model, maxTokens })` 懒启动、`start()` 显式握手（memoize）、
  `run(input, {sessionId?, onNotification?})` → `RunResult { sessionId, finalResponse, events, notifications }`、
  `session(id)`、`close()` 必须调用以回收子进程；低层 `HarnessClient`（start/prompt/subscribe/close）。
- 该包 peerDependencies 指向 dsh 仓库内 workspace 包，npm 可用性**未验证**；tsconfig 覆盖
  `examples/**`，不能引入无法解析的依赖。
- 既有 adapter 参考：`mcp-sdk.ts`（生命周期）、`direct-core.ts`（信封取 `request.input` 的做法）；
  可注入 client 参考 `src/composed/pi.ts` 的 `createSession?`。

## 2. 设计决策（v2.1，遵守）

1. **注入优先，无硬依赖**：adapter 本体绝不 import `@deepseek-ai/dsh-sdk-client`；用本地结构性类型
   `DshHarnessLike`；真实 client 由调用方注入或经懒加载器获得。typecheck 恒绿、测试可注入 fake。
2. **能力面最小且诚实——只有一个 capability `dsh.agent.run`**：
   input `{ prompt: string, sessionId?: string }`，output `{ sessionId: string, finalResponse: string }`。
   `session.open` 砍掉（v1 语义是伪造能力；`agent.run` 的 sessionId 已覆盖多会话；`session(id)`
   真实语义待 P2 冒烟后再决定是否单独暴露）。命名遵循 `core.*` 前缀约定；跨 wire（ACP）命名是 P2-b 开放决策。
3. **生命周期：mcp-sdk 模式，不用 acquireRelease 双 owner**：
   - connect 内构造 client 并**主动 `start()` 握手**——失败提前暴露，由内核 `ConnectionOpenError`
     聚合 attempts 并触发 failover（符合 §3.5/§9.2 提前失败哲学）。
   - 返回的 `session.close` = `client.close().pipe(Effect.ignore).pipe(Effect.zipRight(PubSub.shutdown))`
     ——**顺序关键**：`Effect.zipRight` 左失败不执行右，若写成 `client.close() zipRight PubSub.shutdown`，
     close 失败会跳过 shutdown，恰好复现要防的"events 流悬挂"；`Effect.ignore` 必须包在 zipRight 之前。
     `PubSub.shutdown` 是 Effect 3.x 稳定 API（仓库已在用 `PubSub.unbounded`/`Stream.fromPubSub`）。
     **不要**给 `Stream.fromPubSub` 传 `{ shutdown: true }`——观察者提前结束流会连带杀掉 PubSub，
     形成消费者驱动的竞态；显式 shutdown 保持单一 owner，与 mcp-sdk 模式一致。
   - `Effect.acquireRelease` 仅用于 connect 自身失败时清理半开 client。
   - **`DshHarnessLike.start` 必须可重复调用**（SDK 的 start 是 memoize 的，天然满足；fake 要实现为幂等）。
4. **错误映射保留上下文**：自定义 `Data.TaggedError`（`DshConnectionError`），消息带
   `"dsh adapter: "` 前缀，字段保留 `capability`（invoke 失败时的能力名）+ `cause` + 结构化信息
   （JSON-RPC code/data、exitCode、stderr 尾）。
5. **懒加载器**：`packages/builtin/src/dsh-sdk.d.ts` 最小 ambient 声明 +
   `loadDshSdk()` 动态 import，SDK 未安装时抛清晰错误。
6. **事件流：live onNotification 单一事件源（B7）**：
   - `client.run(prompt, { sessionId?, onNotification })`——adapter **始终**传 options，SDK 在 run 期间
     每次通知回调 `onNotification`；回调把通知发布为 `ConnectionEvent`（kind `"dsh." + method`，payload 透传
     `params`），`session.events` = 内部 PubSub + `Stream.fromPubSub`；fake 可验证。
   - **语义声明**：通知是 run 期间的**实时流**（wire order 严格 FIFO）；`RunResult.events` 回放已移除
     （B7），结果类型上保留 `events` 字段仅为兼容，不再发布。
   - **观测性不变量**：`onNotification` 回调**绝不抛错**——内部 `Effect.runSync(publish)` 包 try/catch
     （`runSync` 同步执行保证 FIFO；一个未捕获的抛错会 reject SDK run promise、杀死 run）。
   - events 是**尽力而为的观测流**：PubSub 无订阅者时 publish 即丢弃；订阅者滞后时队列无界——
     不引入丢弃语义，文档声明即可。
7. **单 connection = 单串行 agent 进程 + 一条会话线**：内核 per-spec 单例 session，并发 invoke 串行
   排队（SDK run 队列到 idle）。此语义写入文档，不做并发池。
8. **依赖接线是显式验收项**：实际尝试 `bun add --no-save @deepseek-ai/dsh-sdk-client@0.1.1-rc.2`
   和 `file:../deepseek-harness/packages/sdk/client` 链接 + typecheck 冒烟，记录结果；不可装则回到注入模式。
9. **真实联动是硬验收**（**双门控**：`DSH_ROOT` 存在 **且** `DEEPSEEK_API_KEY`（及可选 BASE_URL）
   已配置，缺任一即 self-skip 并记录，对齐 dsh keyless 测试哲学）：
   - 启动形态用 **`node <dsh>/lib/bin.js <临时cordis.yml>`**（README 示例形态，直接子进程即 runtime；
     cordis 覆盖用临时 cordis.yml 而非 CLI flag），避免 wrapper 派生的孙进程残留；
   - 冒烟前**预检 dsh 构建产物**（`lib/bin.js`、SDK client 的 `lib`），缺失给出清晰错误而不是
     让第一次失败看起来像 adapter bug；
   - `run("你好")` → 打印 finalResponse → **查进程树**（过滤 dsh/lib/bin.js 相关）确认无残留子进程。

## 3. 文件布局

| 文件 | 内容 |
|---|---|
| `packages/builtin/src/dsh-sdk.d.ts` | ambient 声明（最小类型面） |
| `packages/builtin/src/adapters/dsh-sdk.ts` | `DshHarnessLike`、`dshSdkAdapter(options?)`、`dshConnectionSpec()`、`DshConnectionError`、信封解包、能力分发、事件透传、eager start、close 生命周期 |
| `packages/builtin/src/index.ts` | 追加导出 `./adapters/dsh-sdk.js` |
| `test/dsh-sdk-adapter.test.ts` | fake client 单元测试 + `ConnectionRuntime`/compile 集成测试 |
| `docs/dsh-connection.md` | 本文档 |

签名：

```ts
export interface DshHarnessLike {
  readonly start: () => Promise<void>                    // 幂等、可重复调用
  readonly run: (input: string, options?: { sessionId?: string }) => Promise<{
    sessionId: string; finalResponse: string; events?: unknown[]; notifications?: unknown[]
  }>
  readonly close: () => Promise<void>                    // 幂等
}

export interface DshSdkAdapterOptions {
  readonly client?: () => DshHarnessLike
  readonly launch?: { readonly command: string; readonly args: string[] }
  readonly provider?: string
  readonly model?: string
  readonly maxTokens?: number
}

export const dshSdkAdapter = (options?: DshSdkAdapterOptions): ConnectionAdapter

export const dshConnectionSpec = (options: {
  readonly id: string
  readonly adapters: ReadonlyArray<AdapterRef>
  readonly selection?: AdapterSelection
  readonly metadata?: Record<string, JsonValue>
}): ConnectionSpec                                  // 内含 dsh.agent.run 完整 CapabilitySpec（input/output JsonSchema）
```

## 4. 实现要点

- `capabilities = new Set(["dsh.agent.run"])`。
- `connect(spec, ref)`：
  1. 读 `ref.config`（JsonValue）：`{ launch?, provider?, model?, maxTokens? }`；`launch` 缺省时支持
     `DSH_ROOT` 环境解析（ref.config 优先，缺省走 env），runtime 的 cordis.yml 经 `DSH_CORDIS_CONFIG`
     环境通道提供（bin 自身通道，env 优先于 argv；也可在 ref.config.launch 显式给出）；
     malformed 的 `ref.config.launch` **fail-loud**（抛 `DshConnectionError`），不回退到 options/env；
     `provider/model/maxTokens` 允许缺省（交给 runtime 默认）。
  2. client 来源：注入 `options.client()` → 否则 `loadDshSdk()` 构造 `DeepSeekHarness`。
  3. **eager `start()`**（`Effect.tryPromise`；失败 → 关闭半开 client 并失败，由内核聚合
     `ConnectionOpenError`、参与 failover）。
  4. 建 PubSub；返回 `ConnectionSession`：`capabilities = spec 要求 ∩ adapter 能力`、
     `invoke` 按名分发、`events = Stream.fromPubSub`、`close = client.close().pipe(Effect.ignore).pipe(Effect.zipRight(PubSub.shutdown))`（顺序见决策 3）。
- `invoke("dsh.agent.run", raw)`：
  1. **解信封**（用窄类型守卫，避免裸 any）：
     `const isEnvelope = (v: unknown): v is { input: unknown } => typeof v === "object" && v !== null && "input" in v`；
     `const input = isEnvelope(raw) ? raw.input : raw`。
     **注释写明理由**：本 capability 的声明 schema 是 `{ prompt, sessionId }`，合法入参永远不含 `input`
     键，所以出现 `input` 键只能是 `compile` 的信封（`{ input, agent }`）；直接 `runtime.invoke`
     传裸入参。将来若加含 `input` 字段的 capability，此启发式不可复用，需要换显式信封标记。
  2. 校验 `{ prompt: string, sessionId? }`（用 `dshConnectionSpec` 里的 CapabilitySpec 形状）。
  3. `client.run(prompt, { ...(sessionId ? { sessionId } : {}), onNotification })` → run 期间每次
     SDK 通知经 `onNotification` 实时发布为 `ConnectionEvent`（`dsh.<method>`）→ 返回
     `{ sessionId, finalResponse }`（`RunResult.events` 不再回放，B7）。
- 未知 capability → `DshConnectionError`；所有 invoke 走 `Effect.tryPromise`，错误保留 cause 与结构化字段。

## 5. 验收标准

1. `bun run typecheck` 通过；`bun test` 全绿。新增测试至少覆盖：
   - connect 时 eager start 失败 → 连接失败（可被 `ConnectionOpenError` 聚合、参与 failover）；
   - `dsh.agent.run` 从 fake 取 finalResponse 并返回 `{sessionId, finalResponse}`；
   - **经 `compile` 的 AgentProgram 图 invoke 是必过项**（信封解包正确；单测绿、集成红是本次最大风险点）；
   - live 通知经 `onNotification` 发布为 `ConnectionEvent`（`dsh.session.event`/`dsh.session.status`/
     `dsh.subagent.started`，payload 透传、wire order FIFO；订阅 `session.events` 可收到）；
   - `RunResult.events` 不回放（单一 live 事件源）；onNotification 抛错不杀 run；
   - **close 后已订阅的 events 流正常终止、不悬挂**（PubSub.shutdown 生效）；
   - 未知 capability 失败；close 幂等（重复调用不抛）；
   - 错误保留结构化字段（cause / code / exitCode / stderr 尾）；
   - 并发首次 invoke 行为记录（见 Known-Limitation，只观察/记录，不为此改内核）。
2. `packages/core` 与 `src/` 既有语义零改动。
3. 依赖接线尝试有记录（no-save install 或 file: link + typecheck 冒烟的结果）。
4. 冒烟双门控（DSH_ROOT && DEEPSEEK_API_KEY）；存在时真实跑通且查进程树无残留；缺任一则 self-skip 并记录。
5. 交付说明：改动文件清单、自测结果、设计偏差（如有）与理由。

## Known-Limitation（写进 adapter 文件头注释 + 本文档）

- **并发首次 invoke 竞态（内核既有）**：`open()` 先 `Ref.get` 再 connect，两个 fiber 并发首次
  invoke 同一 spec 会各起一个 dsh 子进程，后写者覆盖 map、败者 client 不被 close（子进程泄漏）。
  eager start + 重量级子进程放大该风险。**本任务不改内核**；P2 候选：内核 `open()` 改
  Ref-modify 单飞（CAS 或 connecting map）。测试只记录行为。
- **events 是尽力而为**：无订阅者即丢弃；订阅者滞后时队列无界（live 通知无界队列背压——文档声明，
  不引入丢弃语义）。
- **单 connection 串行**：一个 dsh connection = 一个串行 agent 进程 + 一条会话线，无并发池。

## 6. dsh.* 事件命名空间（B7）

live 通知以 `ConnectionEvent { connectionId, adapter, kind: "dsh.<method>", payload }` 发布，
`method`/`payload` 与 SDK 通知 **1:1 透传、不归一化**（稳定性契约：这是设计决策——观测方按 SDK
语义消费；归一化留给上层语义层）。已验证 kind：

| kind | payload（SDK params 透传） | 含义 |
| --- | --- | --- |
| `dsh.session.event` | `{ sessionId, event }` | 会话内的一个事件（assistant/message 等） |
| `dsh.session.status` | `{ sessionId, status }` | 会话状态迁移（`idle` 等） |
| `dsh.subagent.started` | `{ parentSessionId, childSessionId }` | 子 agent 会话建立 |
| `dsh.<method>`（通配） | 任意 | 其它 SDK 通知方法，同样 1:1 透传 |

- **48 种事件类型**：`event` 载荷的类型全集由 `@deepseek-ai/dsh-session` 的 `SessionEventMap` 定义
  （不在此复制 48 行——以该包为唯一事实源）。
- **wire order**：`onNotification` 回调内 `Effect.runSync(publish)` 同步执行，通知按 SDK 发出顺序
  严格 FIFO 入流；同批次（lossless 收集）的定界方式是**按 `session.status` 的 `idle` 收口**——
  `receipt`（invoke 受理）到 `idle` 之间的通知即该次 run 的完整批次。
- **断流语义（诚实）**：SDK run 断流（进程退出/JSON-RPC 中断）→ `invoke` 以 `DshConnectionError`
  失败传播（含结构化 cause/exitCode/stderr 尾）；已入流的部分通知保留，不伪造补齐。
- **背压**：PubSub 无界队列，滞后订阅者不阻塞 run（文档声明，不引入丢弃语义）。
- **血缘层边界**：委托在 runtime 内（dsh 自己管理子 agent 树）；`dsh.subagent.*` 事件暴露子会话
  建立，但**上层扇出血缘需要 P12 的 run/session id**（本层不伪造全局 id）。
- **并发语义**：单串行 runtime 进程、常驻形态按 run 观测；C 窗口 = `receipt → idle` 对齐 SDK
  活动区间，**pre-receipt 与 run 间事件不流式**（非债——它们是上一个 run 的尾部或下一个的前奏）；
  未来连续观测 = B 式持久订阅，opt-in。
- **events.md**：`docs/events.md` 的 kernel 事件表保持 5 kind；本命名空间是 dsh adapter 的
  ConnectionEvent 扩展，指向本节。

## 7. 概念定位与后续

- **概念注记**：`dsh.agent.run` 语义上是"外部完整 Agent"（DRAFT §11 ComposedAgent），本阶段以
  connection 层最小可用形态承载；`DshHarnessLike` 设计为可被将来 ComposedAgent 形态复用。
- **真实联动示例** `examples/08-dsh-connection.ts`：依赖接线完成后补，**标注所用 IR**（不抢先固化
  P0 的 canonical IR）。
- **phase 2（B7 后收窄）**：`session(id)` 语义冒烟后决定是否暴露会话 capability；实时事件已落地
  （live onNotification，见 dsh.* 命名空间节）；剩余：ACP 第二条 wire（命名与 failover 语义是开放决策）、
  方向 A（effect-agent 作为 dsh 插件）依赖 P0 后单独设计。
- **P2 内核候选**：`open()` 单飞修复（并发首次 invoke 竞态）。

## 8. 与整体路线的关系

- 工作在 connection 层，**不依赖 P0 统一 IR**；示例的 IR 选择属于 P0 决策，不得在示例里悄悄拍板。
- 事件流消费方依赖 P0(b)（修 Until 语义）；修好之前 dsh connection 对业务程序是"黑盒 run 一次"，已知且接受。
