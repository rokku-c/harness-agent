# board v2 · 树状任务版 + 任意 agent 连接同步 + 三态启动控制（设计）

> 状态：design v0.3（2024-09，经 dry-run 模拟（§12）并补非技术走查与评审核对清单（§13）、术语词典（§14）后，待评审拍板 P1）。前置阅读：apps/board/README.md（现状分层）、
> docs/board-ia.md（v1 产品决策）、docs/agentdeck.md（agentdeck/deckconsole 47 轮资产）、
> packages/core + packages/builtin（runtime 编排原语）。
> 本文档 = 决策记录 + 目标架构 + 分阶段实施计划，是 P1 起的实现依据。

## 1. 目标与决策记录

用户需求：
1. **改成树状任务版**：树是核心模型与默认视图，不再只是扁平看板；
2. **整个流程重新考虑与设计**：从「goal 拆成 item、executor 自报」到「树 + 双向同步 + 可复核闭环」；
3. **任意 agent 能连上来，同步任务同步状态**：不止 MCP 自连，还要能托管驱动；
4. 因已对接其他 agent（agentdeck/deckconsole 等），**要能控制启动做任务**：
   ① 直接启动  ② 覆盖配置启动  ③ 隔离启动；
5. **启动（无论哪种）都要求目标机器上有探针（probe）**，探针最好经 MCP 注册回来：
   board 控制的执行单元是「机器上的 probe」，probe 声明自己能启动什么、能隔离到什么程度。

已确认决策（2024-09 评审）：

| # | 决策 | 结论 |
|---|---|---|
| D1 | v1 agent 范围 | **全量**：effect 进程内 + agentdeck 各 kind（claude-code / codex / gemini / pi / custom / claude-cc）+ MCP 任意自连客户端，统一收敛为 AgentInstance / ExecutionRecord |
| D2 | 隔离启动语义 | **三种（环境隔离 / 任务工作区隔离 / OS·能力沙箱）都支持、按 probe 能力参数化**；实现优先级低（「目前不是着急的事情」）；隔离级别是 probe 声明的能力，不承诺能力外的隔离 |
| D3 | 树上的执行单元 | **叶子为默认执行单元；父节点可显式「整体运行」**（递归派叶子，或作为整体委托给一个 agent，由运行策略决定） |
| D4 | 同步模型 | **双向、board 单一事实源**：自连（认领式）与托管（board 驱动）并存；所有写回经服务端状态机 + 版本校验 |
| D5 | 交付方式 | **先落本文档 → 评审 → 按 P1…P5 分阶段实施**，每阶段测试绿再前进 |
| D6 | 启动通道 | 执行单元 = **目标机器上的 probe**；probe 作为 MCP 客户端**注册回来**并声明能力（可启动的 agent kind、隔离级别、工作区能力）；board 以**拉取式命令队列**下发启动意图（NAT/防火墙友好：probe 只主动连出） |

## 2. 复用资产（继承 / 扩展 / 新写）

| 资产 | 去向 |
|---|---|
| domain 状态机 canTransition / Governor（原子 claim、park/wake、priority-FIFO） | **继承**，语义不变 |
| store.ts（Ref 表 + BOARD_DATA_FILE 全量快照单写者）、events.ts（带 ts 的 ring） | **扩展**：表加树字段、agent 与执行记录；事件类型扩 task.* / agent.* / exec.* / launch.* |
| board/contract（BoardApi 切片风格）、web 的 /api→board_* 映射（面板=MCP client） | **扩展**：加树 API 与 launch 面，既有工具保持向后兼容 |
| coordinator（只读 + 建子树） | 保留为**唯一扩树通道之一**（另一为 operator 手工建树） |
| packages/agentdeck（SessionGateway / ConsentLedger / normalizeConfig / CLI 预设 / cliInvocation） | 作为**组件依赖注入**（composition root）；board 核心只定义 LaunchGateway 接口 |
| packages/core + builtin runtime（AgentSession / report_progress / boards / groups / checkpoint） | **进程内 channel bridge**：effect 子 agent 的事件与进度自动转节点事件 |
| packages/script（能力沙箱）、deckconsole UI 经验（busy-409、配置预览、审批流水、单飞、杀进程组） | 隔离 L3 与 UI/协议复用的参考实现 |
| mantis（钉钉 robot/dws 会话 agent） | 范围外（D1 未含）；保留为后续一类 probe 的接入口 |

## 3. 目标概念模型

board（单一事实源，单进程，可快照恢复）：持有 TaskTree(TaskNode)、Governor、EventBus、
AgentInstance（含 probe）、ExecutionRecord。下游三类通道：

1. **MCP 自连（认领式）**：任意 MCP agent（claude-code / 脚本 / 远程）经 board_* 工具认领与上报；
2. **probe（拉取式，核心新增）**：目标机器上的常驻探针，经 MCP 注册回来，声明 launchKinds 与隔离能力，
   轮询 board 的命令队列执行启动，回传进度与终态；本机同样适用（本机 probe 驱动 agentdeck / effect runtime）；
3. **进程内 runtime bridge**：hosts/all 进程里的 FiberAgentRuntime child 事件经 bridge 转节点事件。

三个一等实体：

- **TaskNode（任务树节点）**：nodeId、parentId、kind（goal | group | leaf）、title/body、state、priority、
  requires、dependencies、children（有序）、labels、version。非叶状态 = **rollup 派生（只读）**；叶子沿用 v1 状态机 + Governor。
- **AgentInstance（连接身份）**：agentId、kind、channel（mcp-self | probe | runtime）、capabilities（可启动 kinds / 隔离级别 / 工作区）、status、lastSeen。
- **ExecutionRecord（一次运行绑定）**：runId、nodeId、agentId、channel、mode、configSnapshot、sessionRef、status、transcriptRef、起止时间。
  同节点同时仅允许一个 running（busy-409，复用 deckconsole 的单飞教训）。

## 4. 树域模型规范（P1）

### 4.1 状态
- 叶子：v1 状态机原样（todo / ready / doing / blocked / done / failed / cancelled），canTransition 裁决不变；
- 非叶：状态 = rollup(children) 纯函数派生：
  - done    ⇔ 全部后代叶 done（且无 blocked / doing 叶）；
  - blocked ⇔ 任一后代叶 blocked，或整棵子树当前无法获得所需资源（依赖/资源派生阻塞）；
  - doing   ⇔ 任一后代叶 running；
  - 否则 open；progress = done 叶数 / 总叶数（0..1）。
  - 仅允许的人工 override：cancelled（整树终止）与 overrideState（显式钉住、跳过 rollup，记 overrideBy/At）。
  **默认无 override 时父子状态永不矛盾**（消灭「父 done 子还在跑」的洞）。

### 4.2 树不变量（纯函数 + 单测）
- 插入节点必须给 parentId（根除外），children 保序；**禁止环**（新 parent 不能是自身后代）；
- 删除：children 为空才可删叶；非叶删除 = 标记 cancelled（历史可审计）；
- 深度不做硬限（UI 折叠），同层顺序可交换；
- 节点写回带 version（乐观并发，过期 409）。

### 4.3 API 兼容与扩展
- WorkItem 字段保留，仅补树字段——v1 孤儿 item 即根，parentId/children 已有，**无数据迁移**；
- 新增 board_tree(nodeId?, depth?)（子树快照）；
- v1 工具（board_state / board_view / board_start / ...）全部保留，老 claude 集成不破。

## 5. 连接与探针协议（P2）

### 5.1 统一连接（所有通道 hello 到同一 AgentInstance）
- **MCP 自连（认领式）**：既有 claude.json / CLAUDE.md 注入不变；hello = board_sync；
- **probe（拉取式，核心）**：
  1. probe 启动 → 作为 MCP 客户端连 board → board_sync hello 声明：agentId、kind=probe、host、
     launchKinds、isolation（env | workspace | sandbox 中本机可用的子集）、capabilities；
  2. probe 周期心跳合并拉取：board_poll(agentId) → 返回 board 下发到该 probe 的待执行意图队列
     （launch / stop / status 查询）；
  3. probe 执行后经 board_report_progress / board_report_done|failed / board_events 回传。
  优点：probe 只主动连出（NAT/防火墙友好），board 永不反向连 probe；本地机器同样适用。
- **进程内 runtime bridge**：hosts/all 里 FiberAgentRuntime child 的 AgentSession events / report_progress 转发为节点事件（channel=runtime）。

### 5.2 状态写回约束
- 任何通道只能改**自己持有执行权（running ExecutionRecord）的节点**；
- 迁移必须过 canTransition；每节点 version 递增，写回带 version（过期 409）；
- done/failed 必须落在 ExecutionRecord 上（runId 必填），board 据此 release 资源并 rollup 父链。

### 5.5 MCP 工具面全量规格

v2 的 board_* MCP 接口（工具表 / schema / 时序 / 角色权限矩阵 / v1 兼容矩阵）单独成文：
**docs/board-v2-mcp.md**。

## 6. 启动控制（P3）：三模式 + probe 下发

### 6.1 LaunchGateway（board 核心只依赖此接口，Effect Tag，composition root 注入）

```ts
interface LaunchIntent {
  nodeId: string
  agentId: string            // 目标 probe / AgentInstance
  mode: 'direct' | 'override' | 'isolated'
  kind: string               // agentdeck kind 或 probe 声明 kind
  config?: UnifiedAgentConfig   // override 必带
  isolation?: 'env' | 'workspace' | 'sandbox'  // isolated 必带，须属于 probe.isolation
  runPolicy?: { verify?: 'none' | 'operator' | 'schema' }
}
```

### 6.2 三模式语义
- **① direct 直接启动**：目标 probe 的默认配置立即执行（本机 = effect 默认模型 / 本地 CLI 预设）。
  资源先原子授予（拿不到则 park，grant 后自动继续 launch，复用 v1 onGranted 通道）；
- **② override 覆盖配置启动**：direct + 节点级 UnifiedAgentConfig 覆盖（model / cwd / env / args /
  turnTimeoutMs / consent…）→ normalizeConfig 归一 → **渲染方言调用计划供确认** → 下发。
  核心场景：任务失败后换模型/参数/工作区一键重跑（新 runId，旧记录留审计）；
- **③ isolated 隔离启动**：三档隔离、**以 probe 声明的 isolation 为上限**（D2，实现优先级最低）：
  - env：独立 HOME / TMP / XDG / env 覆盖（agentdeck cli 原生支持）；
  - workspace：任务工作区 = 独立 git worktree / 目录副本 + 产物策略（operator 审阅 diff 汇入或丢弃）；
  - sandbox：OS/容器或 packages/script 能力沙箱；preflight 由 probe 执行并回报，失败显式降级/拒绝，不静默半沙箱。

### 6.3 生命周期
launch(意图) → ExecutionRecord(running) → probe 拉取 → 执行 →
progress / consent 待批（复用 ConsentLedger，operator inline 裁决）→
终态 done / failed → 可选 verify → release 资源 + rollup → 唤醒排队节点。

## 7. 端到端流程（重设计后）

目标进树（根）→ coordinator / operator 展开子树（扩树唯一通道；协调=只建节点不执行）
→ 叶子指派 AgentInstance + 选模式 → launch（资源原子授予 → 工作区就绪（隔离）→ 意图下发 probe）
→ 执行：progress / 事件 / 转录 / consent 回流节点
→ 终态：终答/回执 → 可选 verify（operator / schema）
    ├─ done   → 叶子 done → rollup 父链 → release → wake
    └─ failed → 「覆盖配置重跑」（新 runId）或 block + 原因
重启：快照恢复树与 probe 注册；孤儿 running 记录标 orphan，operator 接管或重跑。

## 8. UI（P4）

- 默认视图 **任务树**：折叠/展开、节点 chips（状态/进度/持有资源/执行 agent）、阻塞高亮、子树进度条；
  Table / Kanban 保留为**叶子投影**（列归属继续由服务端 col.itemIds 决定，三视图一致）；
- 节点详情 + **Launch drawer**：目标 probe/kind 选择、三模式切换、覆盖配置编辑器 + 方言调用计划预览、
  隔离级别下拉（只显示 probe 支持项）、运行策略（verify 方式）；转录/事件/consent 流水内联同意/拒绝；
- 侧栏：Probe / AgentInstance 列表（在线状态、能力、隔离支持）、资源、活动流。

## 9. 模块落点与迁移（遵循 AGENTS.md：每文件≤100 行、按概念拆层、barrel）

apps/board/src 下：
- domain/task-tree.ts、rollup.ts、agents.ts、execution.ts（新增，纯函数）；task-tree 承接 work.ts；
- board/ 增 tree-slice / launch-slice / exec-sync（沿用既有切片风格，context/moveState 复用）；
- launch/contract.ts、dispatch.ts、queue.ts（拉取式命令队列）、deck-bridge.ts、runtime-bridge.ts；
- store.ts 扩 nodes / agents / executions 表；events.ts 扩事件类型；
- hosts/mcp/board-mcp.ts 增 board_sync / board_poll / board_tree / board_report_progress（v1 工具保留）；
- hosts/web/server.ts 与 panel/ 增 tree 与 launch 路由/视图（新默认树视图）；
- package.json 增依赖 @effect-agent/agentdeck（组件层，不进 domain）；
- hosts/all/main.ts 作为 composition root 注入：agentdeck 适配器、probe 注册表、runtime bridge。

## 10. 分阶段实施计划

| 阶段 | 范围 | 验收（测试绿再前进） |
|---|---|---|
| P1 | domain 任务树：TaskNode / rollup / 环保护 / 顺序 + board_tree + 既有测试不破 | rollup 纯函数与树不变量单测；board+domain 全绿 |
| P2 | 连接统一：AgentInstance / ExecutionRecord + board_sync / board_poll + runtime bridge + 事件扩类 | 双通道同事件流测试；MCP e2e；busy-409 |
| P3 | LaunchGateway：direct + override（本机 probe / agentdeck）→ isolated（env → workspace → sandbox，按能力） | scripted probe e2e：三模式启动 → 终态 → verify → 重跑 |
| P4 | UI：树视图 + Launch drawer + probe 列表 + 复核闭环 | web-shell 测试 + 浏览器冒烟 |
| P5（可选） | deckconsole / mantis 收敛为同一 Agent 视图 | 协议一致性与回归基线 |

## 11. 风险与开放问题
- 拉取式下发延迟上限 = probe 轮询间隔（与心跳复用，默认可配 ~1.5s）；实时性要求高时可后续加长连接推送；
- probe 可信度与鉴权：先按本机/内网假设，跨机鉴权留接口（hello token / 白名单）；
- 父节点「整体运行」与子树叶子并发运行的一致性归并规则（D3）需在 P3 细化（runPolicy）；
- 现有 claude-code repo/global 集成（integration/claude*.ts）继续服务「自连认领式」，不受本次影响。

## 12. 工作流模拟验证补遗（dry-run，v0.2）

用确定性机制把端到端流程逐场景跑通后暴露的缺口 G1–G10 与本版决议（模拟过程见评审对话；此处只收决议，各决议作为 P1–P3 的实现约束）：

### 12.1 模拟结论摘要（S1–S7）
- S1 本机 effect 托管启动：目标建树 → coordinator 扩叶（children 有序、依赖边）→ 指派叶子 → launch（原子拿资源）→ runtime child 经 report_progress 回流 → done → rollup 父链。跑通。
- S2 远程 probe 覆盖配置启动 + consent：hello 声明能力 → 意图入队 → poll 取走并 ack → 执行中写工具 ask 上报 → operator 在 board 上裁决 → probe 收回决议重试。跑通（需 G3 的 consent 原语）。
- S3 认领式 vs 托管式竞争同一叶子：托管已 running 时自连 agent 的 start/claim 必须 409；claim_next 只回无 assignee 且 ready 的节点（需 G2 规则）。
- S4 资源冲突与「grant 后自动执行」：拿不到即 park（不持资源），grant 回调才把意图入队投递，投递不可能失败（队列在 board 侧，probe poll 才取）——**修正**：不存在"持资源待投递"的中间态，意图入队永远发生在 acquire 成功之后。
- S5 失败→覆盖配置重跑→隔离工作区：失败先 release 旧资源；isolated 需在工作区就绪后才能执行；产物汇入（merge）与资源 release 的时序需策略化（G6）。
- S6 崩溃重启：快照恢复树与执行记录；所有 running/pending 标 orphan；probe 重连 hello 时认领回自己的孤儿；无人认领的由 operator rerun/cancel（G5）。
- S7 父节点整体运行：父 run = 整体委托 + rollup；执行 agent 经 board_* 更新**已存在**叶子，禁止自建叶（扩树权只归 coordinator/operator），中途放弃 = partial（已 done 叶子保留）。

### 12.2 缺口与决议（P1–P3 的实现约束）

| # | 缺口（模拟暴露） | 决议 |
|---|---|---|
| G1 | 依赖完成不会自动解阻塞（v1 缺口：只有 start 时才查依赖） | 新增**重评估器**：任一节点终态变化后，对被其依赖阻塞的等待者重算——依赖齐 → 回 ready；若节点已有指派与 autoLaunch 策略 → 自动入队 launch。重评估为纯函数，挂在事件后处理 |
| G2 | 认领式与托管指派竞争同一节点无规则 | 叶子可 claim 的条件：state=ready 且无 assignee/pendingLaunch；已指派或被整体委托占用的节点对自连 agent 不可见（claim 白名单）；running 期间一切 start/claim → 409 |
| G3 | 托管式会话的 consent 无协议通道 | 新增原语：probe 以工具调用上报 ask（board_consent_ask），operator 在树 UI/API 裁决（board_consent_resolve），决议随 poll 回投；probe 内部对接 effect-ops 的 awaiting/retry |
| G4 | 意图投递无幂等/确认 | runId 全局唯一；意图队列在 board 侧、probe poll 取走即出队；probe 先 ack（board_exec_ack）再执行，杜绝重复拉活；watchdog 对 running 超过 maxSilence 标 suspect，交 operator |
| G5 | probe 断线/进程崩溃 → 执行悬挂 | 快照记录 ExecutionRecord（含 pendingLaunch）；重启后 running/pending → orphan；probe hello 携带 reconnect 认领自己的孤儿恢复绑定；无主孤儿由 operator rerun/cancel |
| G6 | 隔离产物汇入与资源 release 时序未定义 | runPolicy.merge ∈ none / review / auto：merge=review 时终态后保持持有资源并挂 pendingMerge，operator 点汇入（board_merge）完成后才 release+done；auto 直接汇入；none 不汇入只记录产物路径 |
| G7 | 父节点整体运行与子树并发/扩树规则不清 | 父 run = 整体委托 + rollup，执行 agent 只动已存在叶子（不扩树）；放弃 = partial，已 done 叶子保留；叶子级批量并发由 operator 显式批量 launch，不随父 run 自动展开 |
| G8 | progress 高频事件撑爆事件 ring | 同节点 progress 1s 窗口合并为一条事件；ring 上调至 2000 并分级（control 全留、progress 可裁剪） |
| G9 | 离线判定与 watchdog 阈值未显式 | 心跳/轮询同一时钟：poll 默认 1.5s；lastSeen 超 3×poll 判 offline；running 执行 maxSilence 默认 5min（可配）→ suspect |
| G10 | claim_next 拉活无能力匹配 | claimable 过滤按 agent 能力（launchKinds/capability/labels）与节点所需 kind 匹配，排序沿用 priority→FIFO |

### 12.3 对前文 §5–§7 的修订生效点
- §5.2 写回约束补充 G2 认领规则与 G3 consent 原语；
- §6.1 LaunchGateway 补 runPolicy.merge（G6）；§6.2 ③ isolated 生命周期补「工作区就绪前置 + merge 门 + 清理保留期」；
- §6.3 生命周期补 ack/幂等（G4）与 watchdog（G5/G9）；
- §7 补「执行 agent 不扩树」规则（G7）与重评估器（G1）；
- P2 验收加 consent 双向流与 reconnect 认领用例；P3 验收加 merge 三策略用例。

## 13. 给非技术评审的走查（大白话版，v0.2）

> 这一节写给不看代码的评审人：用一个工作日的场景把 v2 走一遍，
> 末尾附「评审核对清单」。术语看不懂随时看 §14 词典。

### 13.1 一天的场景

**早上 9 点，负责人小周**：把一个目标「发布 2.0 版本」拖进看板，屏幕上出现一棵树的一个根。
看板请内置的"拆活助手"把目标拆开：根下面挂出三个具体活（A 改接口、B 写文档、C 跑回归）。
其中 B 标了"等 A 做完才能开工"。这棵树谁都能看见，谁改了什么、干到哪一步，全看板一个版本。

**9 点 10 分**：小周想用本机最快的 agent 干 A。他点 A → 选「直接开工」。
系统先问"这台机器上要用的资源（一台空闲 GPU）有没有？"——有，锁上；没有就自动把 A 排进队，
谁一释放立刻叫醒它。锁好后，A 开工（界面上 A 从"待办"变"进行中"）。

**9 点 30 分**：A 想往共享目录写文件。系统弹出申请单：工具=写文件、内容摘要。
小周在网页上点「同意」，申请回传，A 继续。全程留痕：谁申请、谁批的、几点。

**9 点 45 分**：A 干完。系统自动做三件事：把 A 标成"完成"；释放那台 GPU；**叫醒等它的 B**
（B 从"卡住等 A"变成"可以开工"）。如果小周之前给 B 也预指了 agent，B 甚至会直接自动开工。

**10 点**：B 第一次跑失败了（超时）。小周没改代码，点 B →「换配置开工」：换成另一个 agent、
多给 60 秒 → 新开一张工单重跑，上一张工单保留着当记录。

**10 点 40 分**：小周要让 C 在"小房间"里跑（怕它乱动共享区）。选 C →「隔离开工」：
系统在一个副本工作区里干活。C 干完只是"草稿完成"，界面出现「并回成果」按钮——
小周审一眼改动，点并回，C 才算真正完成、资源才释放。

**11 点**：小周对根目标点「整体开工」，指派一个 agent 去啃整棵树。
agent 只干树上已有的活（不允许自己偷偷加新任务），每完成一个叶子，树上对应打勾。
它中途放弃：已完成的部分保留，剩下的由小周再指派。

**下午，机器崩了一次**：看板重启后，之前在跑的任务都标成"待认领"；
各台机器上的"接线员"重新连回来时，把自己原来那单认领回去接着干；没人认领的你重派或取消。

### 13.2 评审核对清单（逐条打勾）

1. 大目标下面能挂小目标、再挂具体活，树能折叠展开、完成百分比一眼可见？【P1】
2. 大目标的完成/卡住/进行中状态是自动从子任务汇总的，不会出现"父已完成、子还在跑"的矛盾？【P1】
3. A 干完会自动叫醒"等 A 才能开工"的 B？【P1，G1】
4. 任何 agent（本机/远程）连上来看到的是同一份任务与状态，改动以看板为准、乱改会被拒？【P2】
5. 同一个任务不会同时被两个 agent 干？已指派的任务别人抢不走？【P2，G2】
6. agent 想动重要东西时，申请会弹到任务界面由我审批？【P2/P3，G3 —— 待你拍板的方向】
7. 我能从看板直接指挥开工：直接开工 / 换配置开工 / 隔离开工？【P3】
8. 派单不会重复（每单有编号、接线员收到先回执）？机器断线/崩溃有"待认领+重连认领"兜底？【P3，G4/G5】
9. 隔离开干的成果可以选：自动并回 / 我审完再并回 / 不并回只留地址？【P3，G6】
10. 树上的大目标能"整体开工"，agent 只干已有活、不能自己加子任务？【P3，G7】
11. 不刷屏（进度每秒合并）、失联有明确判定（超过时限标可疑）？【P2/P3，G8/G9】
12. agent 来领活只会领到它干得了的？【P2，G10】

## 14. 术语词典（一句话解释）

- 树节点 / 任务树：大目标挂小目标、小目标挂具体活，像文件夹那样一层层。
- 叶子：最底下真正派给 agent 干的具体活；只有叶子能被"开工"。
- 汇总（rollup）：大目标的状态不是自己记的，是自动看下面所有活算出来的。
- 执行记录（工单）：一次"谁干哪个任务、用什么配置、结果如何"的档案，派单、重跑都留档。
- 探针（probe，接线员）：每台要干活机器上驻着的小程序，主动向看板报到、领活、回报，看板不用反向连它。
- 三种开工：直接（默认配置马上跑）/ 换配置（改设置后跑，常用于失败重跑）/ 隔离（在独立副本里跑）。
- 占资源（claim）：干某个活需要独占的东西（GPU/端口/工作区）要先锁定；锁不到就排队，谁释放叫醒下一个。
- 审批（consent）：agent 要动重要东西前先申请，由人在界面上同意/拒绝，全程留痕。
- 事件流（刷屏控制）：系统把"谁在何时改了什么"广播给所有界面；高频小进度会先合并再广播。
- 单一事实源：任务和状态只有看板这一份权威记录，各界面/各 agent 都同步这一份，不许各存各的。


