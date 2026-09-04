# board v2 · MCP 接口设计（board_* v2 spec）

> 状态：design v0.1（2024-09）。依据：docs/board-v2.md（§5 连接与探针协议、§6 启动控制、§12 缺口决议 G1–G10）。
> 这份规格是 P2/P3 里 hosts/mcp 与 hosts/web 路由的实现蓝本；所有响应与 v1 一致：单段 text 的 JSON，
> 成功 {ok:true,...}，失败 {ok:false, detail}（detail 带 E_ 错误码，见 §7）。

## 1. 角色与通道（谁可以调什么）

| 角色 | 是谁 | 能力 | 传输 |
|---|---|---|---|
| operator | 人（web 面板 / HTTP API）或协调 agent | 读全部；建树；指派；launch / cancel_exec / merge / consent_resolve；扩树 | 面板 /api（内部 = 同一 MCP 面，in-process） |
| coordinator | 内置拆活 agent（effect-agent session） | 读 + board_create_item（建子树，唯一扩树写通道） | 进程内 binding / MCP stdio |
| agent（认领式） | claude-code、脚本、任意 MCP 客户端（自连） | 领活、start、报进度、report done/failed；只能动自己持有 run 的叶子 | MCP stdio（本机）/ streamable HTTP（远程） |
| probe（接线员） | 目标机器驻场程序，驱动 agentdeck / 本地 CLI / runtime child | 注册、poll 拉命令、ack、执行上报、consent_ask | MCP stdio（本机）/ streamable HTTP（远程，推荐） |

三种通道连的是同一个 MCP server、同一份 board：面板的 /api 是 in-process MCP client；
probe 与自连 agent 走同一套 board_* 工具，只是角色不同，server 按注册时的身份执行权限矩阵（§8）。

## 2. 传输与部署（与 v1 的差异）

| 传输 | 适用 | 说明 |
|---|---|---|
| MCP stdio | 本机：claude code wrapper、probe 本机、coordinator | 既有 hosts/mcp/main.ts；单进程共享 board |
| MCP streamable HTTP | 远程 probe / 远程自连 agent（跨机） | 新增：hosts/web/server.ts 旁挂 /mcp（同一 Bun.serve），启动参数 BOARD_MCP_HTTP=1；跨机默认要求 BOARD_PROBE_TOKEN（hello 携带；未配置 token 时仅限本机） |
| 进程内 in-memory | 面板（MCP client） | 既有 InMemoryTransport |

协议版本：board.v2@1（server 在 hello 响应里回显）。兼容原则：v1 工具签名不动、语义只增不缩（§9 矩阵）。

## 3. 新工具全表（按分组）

### A 会话 / 发现

| 工具 | 角色 | 说明 |
|---|---|---|
| board_sync | 任何客户端第一个调用 | hello：注册身份 + 声明能力 + （probe）reconnect 孤儿认领；返回 server 能力与游标（§4.1） |
| board_heartbeat | agent（v1 保留） | 保活；probe 用 board_poll 的 heartbeat 代替 |

### B 只读

| 工具 | 角色 | 说明 |
|---|---|---|
| board_state / board_view / board_get_item / board_list | 全部 | v1 保留；state 增树统计；view 仍为叶子列投影 |
| board_tree | 全部 | v2：按 nodeId 取子树，含 rollup 摘要（§4.2） |
| board_events | 全部 | v1 保留（游标重放）；事件类型扩 task.* / exec.* / agent.* / launch.* |

### C 认领式执行（agent 角色）

| 工具 | 角色 | 说明 |
|---|---|---|
| board_claim_next | agent | 拉一个可认领叶子（ready、无 assignee/pending），返回 nodeId 供 board_start；不占位（原子动作仍在 board_start） |
| board_start | agent | v1 语义 + 返回 runId；同节点已有 running / 已指派他人 → E_BUSY / E_LOCKED（§4.3） |
| board_report_progress | agent / probe | 进度上报（runId 必填；同节点 1s 窗口合并，G8） |
| board_report_done / board_report_failed | agent / probe | v1 语义 + runId 必填；终态自动 release + rollup + 唤醒（G1） |
| board_cancel | agent（自己 run）/ operator | v1 保留 |

### D probe 命令通道

| 工具 | 角色 | 说明 |
|---|---|---|
| board_poll | probe | 拉取命令（launch / stop / consent_resolve / merge）；命令至少一次投递（未 ack 不下队列），probe 按 runId/askId 幂等去重（G4）；携带 running 状态与心跳（§4.4） |
| board_exec_ack | probe | 已开始/已结束某 run 的回执（可见性用，非投递保证） |

### E 托管执行（operator）

| 工具 | 角色 | 说明 |
|---|---|---|
| board_launch | operator | 三模式启动（direct / override / isolated），资源原子授予后按 channel 派发（§4.5） |
| board_cancel_exec | operator | 终止一次运行：probe 收 stop 命令；runtime child 收 interrupt；认领式 agent 收 unassign 事件 |
| board_merge | operator | 隔离工作区成果并回（runPolicy.merge=review 的门），转 probe 执行 merge 命令（G6） |

### F 审批（consent）

| 工具 | 角色 | 说明 |
|---|---|---|
| board_consent_ask | agent / probe | 上报待批申请（tool + input 摘要），入事件流与待批池（G3） |
| board_consent_resolve | operator | 裁决（allow/deny + by）；决议随 probe 下一次 poll 回投（命令 kind=consent_resolve） |
| board_consent_pending | operator | 查询待批列表 |

### G 扩树 / 资源 / 兼容

| 工具 | 角色 | 说明 |
|---|---|---|
| board_coordinate | operator | v1 保留；现可作用于任意非叶节点（其子树上下文并入提示） |
| board_create_item / board_create_resource / board_register_executor | operator / coordinator | v1 保留（register_executor 与 board_sync 并存：hello 是推荐路径） |

## 4. 关键工具 schema 与语义

### 4.1 board_sync（hello / 注册）

入参（JSON）：

    {
      "agentId": string,            // 身份：probe 用 host 相关唯一名，agent 用自身 id
      "kind": "agent" | "probe",    // 认领式 或 接线员
      "agentKind"?: string,         // 能代表的 agent 类型：claude-code / codex / effect / custom / ...
      "capabilities"?: {
        "launchKinds"?: string[],               // probe 可启动的 agent 类型（对应 agentdeck kind）
        "isolation"?: Array<"env"|"workspace"|"sandbox">,  // probe 支持到哪档隔离
        "claimKinds"?: string[],                // 认领式 agent 声明能领哪些类型（过滤 board_claim_next）
        "pollIntervalMs"?: number               // probe 轮询间隔（默认 1500，下限 500）
      },
      "reconnect"?: { "runIds": string[] }      // probe 崩溃重启：申报自己仍在跑的 run（孤儿接管）
    }

出参：{ ok, agentId, registered, epoch, server: { protocol, tree, launch, consent },
cursor: { eventsTs, seq }, assignments?: [{nodeId,title,state,runId?}],
orphans?: [{runId,nodeId,state}] }。

语义：upsert AgentInstance；kind=agent → 认领通道；kind=probe → 命令通道；
reconnect 里命中板端 orphan 记录的 run 绑定回该 probe 并恢复 running，未申报的孤儿留在池中等 operator 处理（G5）。

### 4.2 board_tree

入参：{ nodeId?: string（缺省=根）, depth?: number, include?: "open" | "all" }
出参：{ ok, root, nodes: [Node], summary: { leaves, doneLeaves, blockedLeaves, progress } }；
Node = { nodeId, parentId, kind: goal|group|leaf, title, state, priority, assigneeId?,
runId?, requires, dependencies, children（有序 id 列表）, progress?, blockedReason?, version }。
state 对非叶恒为 rollup 派生值（服务端算好下发，客户端不做二次推导）。

### 4.3 board_start（v1 扩展）

入参：{ itemId, executorId }（不变）；出参新增 runId：{ ok, runId?, state, detail? }。
规则（G2）：叶子处于 running（任一 run）→ E_BUSY；叶子 assignee 存在且 != executorId → E_LOCKED；
依赖未齐 → blocked（既有）；requires 资源原子授予或 park（既有）；成功即生成 ExecutionRecord 并返回 runId，
后续一切上报必须携带该 runId（孤儿/断线追责的锚）。

### 4.4 board_poll（命令通道核心）

入参：{ agentId, ack?: string[], running?: [{runId, status}], heartbeat: true }
出参：{ ok, seq, ts, commands: Command[] }
Command =
  { id, kind: "launch", runId, nodeId, prompt, mode, kind, config?, isolation?, merge: "none"|"review"|"auto" }
  | { id, kind: "stop", runId }
  | { id, kind: "consent_resolve", askId, allow }
  | { id, kind: "merge", runId }

投递语义（G4）：命令在 probe ack 前不出队 → 崩溃后重 poll 会再次收到；probe 按 runId/askId 幂等去重后执行。
running 数组让板端 watchdog 看到真实存活；heartbeat 刷新 lastSeen（G9：3×pollInterval 判离线）。

### 4.5 board_launch（三模式，operator）

入参（JSON）：

    {
      "nodeId": string,
      "mode": "direct" | "override" | "isolated",
      "agentId": string,          // 目标 AgentInstance（probe 或本机 runtime）
      "kind"?: string,            // 要启动的 agent 类型（agentdeck kind / probe launchKinds）
      "config"?: object,          // override 必带：UnifiedAgentConfig 方言原样，服务端 normalizeConfig
      "isolation"?: "env" | "workspace" | "sandbox",  // isolated 必带；须在 probe.isolation 内，否则 E_PREFLIGHT
      "runPolicy"?: { verify?: "none"|"operator"|"schema", merge?: "none"|"review"|"auto" },
      "prompt"?: string           // 缺省 = 服务端按节点+祖先+依赖渲染的子树简报
    }

流程：校验模式与能力 → 资源原子授予（不足则 park，grant 回调自动续启，R2）→ 生成 runId 与 ExecutionRecord
→ 按 channel 派发：probe → 命令队列（等 poll）；runtime → bridge 拉起 child；mcp-self agent → 仅打 assignee + 事件
（agent 经 board_start 接管）。出参：{ ok, runId, state, handoff: "queued" | "executing" | "assigned" }。

### 4.6 board_consent_ask / board_consent_resolve

ask：{ runId, tool, input } → { ok, askId }（入待批池 + 事件流）；
resolve：{ askId, allow, by? } → { ok }；决议入 probe 命令队列（consent_resolve），或认领式 agent 自行轮询
board_consent_pending / 事件重放。幂等：已裁决 askId 再 resolve 返回 false 且不翻转（沿用 agentdeck ConsentLedger 语义）。

## 5. 关键时序（ASCII）

### 5.1 probe 注册与拉活（含孤儿接管）

    probe                          board
      |-- board_sync {kind:probe, caps, reconnect:{runIds}} -->|
      |<-- {ok, epoch, orphans:[...], seq:0} ------------------|
      |-- board_poll {agentId, heartbeat, running:[runId..]} ->|   (每 1.5s)
      |<-- {seq:7, commands:[launch{runId,nodeId,...}]} -------|
      |  幂等去重 runId → 驱动本机 agentdeck / CLI 开工
      |-- board_exec_ack {runId} ----------------------------->|
      |-- board_report_progress {runId, percent} -------------->|
      |-- board_consent_ask {runId, tool, input} -------------->|
      |   (operator 在面板点同意: board_consent_resolve)
      |-- board_poll ... -->|<-- {commands:[consent_resolve{askId,allow}]}
      |  重发该轮 → agent 继续
      |-- board_report_done {runId, result} ------------------>|  (release + rollup + wake)

### 5.2 认领式自连 agent

    agent                          board
      |-- board_sync {kind:agent, claimKinds:[...]} -->|
      |-- board_claim_next {kinds:[...]} ------------->|
      |<-- {node: {nodeId, title, body}} --------------|
      |-- board_start {itemId, executorId} ----------->|  (资源原子授予 / park; 生成 runId)
      |<-- {ok, runId, state:"doing"} -----------------|
      |-- board_report_progress / board_report_done -->|

### 5.3 operator 托管启动（override + 隔离 + merge）

    operator(web)        board             probe(目标机)
      |-- board_launch {nodeId, mode:"override", agentId:pr,
      |    kind:"codex", config:{timeout+60s}} -->|
      |<-- {ok, runId, handoff:"queued"} ---------|
      |                      |-- board_poll -->|   |-- 取到 launch 命令 → 执行 → 上报
      |   (isolated: probe 先建隔离工作区 → 执行 → done(draft, merge=review))
      |-- board_merge {runId, apply:true} ------>|   (operator 审 diff 后)
      |                      |-- merge 命令 ---->|   |-- 并回 → report_done(最终) → release

### 5.4 失败 → 覆盖配置重跑

    run1 failed(timeout) → release → 节点 failed(result: 超时摘要)
    operator: board_launch {nodeId, mode:"override", 换 kind/config}
      → 新 runId(run2)；run1 记录保留审计；节点 doing → ... → done

## 6. 事件类型扩展（board_events 的 payload）

| 类型 | 携带 | 说明 |
|---|---|---|
| task.created / task.state | nodeId, state | v1 item.* 的 v2 命名；兼容期内双发别名 |
| task.assigned | nodeId, agentId | 指派（含 launch 落 agent） |
| task.progress | nodeId, runId, percent, text | 1s 窗口合并（G8） |
| exec.launched / exec.acked / exec.finished | runId, nodeId, mode | 托管生命周期 |
| exec.orphan / exec.resumed | runId, nodeId | 重启与 probe 重连 |
| agent.online / agent.offline | agentId | lastSeen 判定（G9） |
| consent.asked / consent.resolved | askId, runId, tool, by | 审批留痕 |
| launch.* | runId, nodeId, mode, kind | 审计 |

## 7. 错误码（ok:false + detail 前缀）

| 码 | 含义 | 典型触发 |
|---|---|---|
| E_NOT_FOUND | 节点 / run / ask 不存在 | 任意工具 |
| E_ILLEGAL | 非法状态迁移（canTransition 拒绝） | report / block / start |
| E_BUSY | 同节点已有 running 执行 | board_start / board_launch |
| E_LOCKED | 节点已指派他人 / 被整体委托占用 | board_start / claim |
| E_CONFLICT | version 过期（乐观并发） | 带旧 version 的写回 |
| E_ORPHAN | run 不再绑定该 agent / probe | report / ack |
| E_PREFLIGHT | 能力不满足（isolation 越界 / preflight 失败） | board_launch |
| E_TERMINAL | 对已终态 run 重复终报 | report_done / failed |
| E_AUTH | 跨机未带 / 错 token | board_sync |

## 8. 角色 × 工具 权限矩阵（摘录关键行）

| 工具 | operator | coordinator | agent | probe |
|---|---|---|---|---|
| board_tree / state / view / events | ✓ | ✓ | ✓ | ✓ |
| board_create_item | ✓ | ✓ | ✗（G7：执行者不扩树） | ✗ |
| board_claim_next / board_start / report_* | — | — | ✓（仅自己 run） | ✓（代本机 agent） |
| board_poll / board_exec_ack | ✗ | ✗ | ✗ | ✓ |
| board_launch / cancel_exec / merge / consent_resolve | ✓ | — | ✗ | ✗ |
| board_consent_ask | — | — | ✓ | ✓ |

## 9. v1 → v2 兼容矩阵

| v1 工具 | v2 变化 | 老 claude-code 集成影响 |
|---|---|---|
| board_state | 响应增树统计字段（老字段不变） | 无 |
| board_view / get_item / list / events / coordinate / create_item / create_resource | 语义不变（coordinate 可作用非叶） | 无 |
| board_start | 响应新增 runId 字段 | 无（老代码忽略新字段） |
| board_report_done / failed | 入参新增可选 runId | 无（缺省=按 itemId + executor 的唯一 running 推断，单飞前提下仍成立） |
| board_register_executor | 保留；推荐改用 board_sync | 无 |

## 10. 实现顺序（对应 P2/P3）

1. P2：board_sync + board_tree + board_start 返 runId + report_progress + 事件扩类（认领式闭环）；
2. P2：board_poll / board_exec_ack + orphan / reconnect（probe 命令通道 v1：只 launch + stop + heartbeat）；
3. P3：board_launch 三模式 + consent_ask/resolve + merge 命令 + streamable HTTP 传输 + token。

## 11. 开放问题（实现前定）

- 远程 probe 是否同时提供轻量 JSON /api/probe/* 别名（无 MCP SDK 也能接）——倾向：提供，与 MCP 工具一一对应；
- streamable HTTP 的会话语义：建议每 probe 一个长会话 + 心跳保活，断线由 lastSeen 判定；
- board_sync 的跨机鉴权最小形态：BOARD_PROBE_TOKEN 预共享，hello 出示；是否需要更细粒度（按 probe 白名单）后议。
