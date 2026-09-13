# 架构重梳理：SDK · 行为内核 · 操作集合 · 热更新与回滚

> 状态：design v0.1（2026-09-10）。本文是**平台级**架构重梳理，把已有实现收进一条主线。
> 既有分层文档见 `layers.md`（包分层）、`effect-unified-on-mcp.md`（MCP 映射）、
> `effect-bundle-mesh.md`（bundle/回注册/mesh）、`effect-planes-permissions.md`（plane 与权限）、
> `platform-network.md`（端口/路由/出口 + agentd/mcpset）。`architecture.md` 是 mantis 专属，不是平台。
>
> **已定决策（2026-09-10）**：① 内核热更新粒度 = **K2** —— 内核自身也是可热换的制品，host 只留最小底座；
> ② **app 自身也要能热更新** —— 单点替换、爆炸半径小于内核热换、独立目标。详见 §6。
> ③ 支持**容器节点** —— 一个节点承接多个 app 的部署，部署单位从 app 变成"节点 × app 集合"。详见 §8。

## 0. 目标（用户原话）

> 我们提供的是 **SDK 和内置 app**。app 用 SDK 开发时，会自动把我们的**行为模式代码**带上
> （定义了**所有用户能做的操作集合**，包括 host 与非 host 节点）；启动后，app 自己的行为之外，
> 使用 SDK 的行为**由我们的代码操纵**；这个**核心代码可以热更新**；host 可以对**兼容**的 app
> **推送升级热更新**，**崩溃了也能回滚**。

**追加（2026-09-10）**：
- app 是分布式的 → **同一个 app 制品要能跑在 OS / 浏览器 / JS 沙箱**三档，沙箱最轻量（见 §7）。
- 除内核外，**app 自身也要能热更新**（见 §6.4，是独立目标，不只是内核热换的彩排）。
- 支持**容器节点**：一个节点（机器/容器/宿主）可**承接多个 app 的部署**（见 §8）。

## 1. 术语定名

| 词 | 含义 | 一句话判据 |
|---|---|---|
| **操作集合 (Operation Set)** | 一个节点上"所有能被做的操作"的完整清单 | 不是散落的函数，而是可枚举、可导出 schema、可授权的一份清单 |
| **内核 (Kernel)** | 我们随 SDK 提供、**操纵 app 非领域行为**的代码 | app 作者不写它；它由 SDK 自动附着 |
| **节点 (Node)** | 操作集合的承载者 = `(namespace, appId)` | 分 **host 节点**（平台自身）与 **app 节点**（各 app） |
| **声明层 / 领域层 / 内核层** | 一次 app 开发的三种归属 | 见 §3 |

## 2. 诉求 ↔ 现状映射

| # | 诉求 | 现状 | 证据 |
|---|---|---|---|
| a | 我们提供 SDK + 内置 app | **已有**：`packages/effect-*` 是 SDK，`apps/*` 是内置 app | 49 个包；`bun run check:boundary` 0 error |
| b | 用 SDK 开发时**自动带上行为模式代码** | **部分已有**：`registerEffectApp` 自动注册 config schema、egress、UI/HTML、interface tools、console path，并在失败时回滚 | `packages/effect-apps/src/registration/register.ts:9-37`；`metadata.ts:20-38` |
| b' | 它定义**所有能做的操作集合** | **缺**：操作集合今天**没有单一模型**，散在 descriptor 各字段 + MCP 投影里；host 节点的特权面更是散落的 control 路由 | §4 |
| c | 启动后 SDK 行为**由我们的代码操纵** | **已有**：插件生命周期、路由分发、config 热读、UI 托管、MCP/agent 面、权限、observe 全由内核包住 app 的 `load()` | `packages/effect-apps/src/registration/runtime.ts:6-19`（含注释 "Instance interfaces live exactly as long as the loaded app, including reloads"）；`effect-host/src/lifecycle.ts` |
| d | **核心代码可热更新** | **半有**：插件可运行时 `enable/disable/unregister`，bundle 可重复加载；但**没有版本化内核制品、没有影子/暂存槽、没有内核↔app 版本协商** | `effect-host/src/lifecycle.ts:19-52`；`/-/planes/:id/(enable|disable)` `effect-host/src/control.ts:9` |
| e | host 对**兼容** app **推送升级** | **缺**：`abi: "effect-1"` 只被声明、**无任何校验代码**；也无 bundle 分发通道（agentd 只推 MCP 配置） | `effect-bundle/src/manifest.ts:9`；全仓 `abi` 仅出现在 board 清单与 test fixture |
| f | 崩溃可**回滚** | **缺**：只有配置侧的"失败不再重试"，没有上一可用版本指针；`.effect-bundles/` 里已同时存在两个 board 版本却无索引 | `apps/effect-server/src/boot/runtime.ts:33,38-44`（`failedReloads`）；`.effect-bundles/io.effect-agent.board@{0.13.0,1.0.0}.effect-bundle` |

## 3. 归属三分（本方案的主轴）

一次 app 开发 = 三种归属，**互相不改写**：

```text
┌── 声明层 Declaration ── app 作者写「纯数据」
│     tools(zod) · routes · config schema · ui view · egress · requires
│     = 操作集合的「源」
├── 领域层 Domain ─────── app 作者写「命令式」
│     每个操作的 handler 实现（业务语义）
└── 内核层 Kernel ─────── 我们写，随 SDK 版本走
      回注册/注销 · 路由分发 · config 解析与热读 · UI 托管 · MCP/agent 面 ·
      权限(planes) · parity/observe · 生命周期(加载/enable/升级/回滚)
      = 操作集合的「生成器 + 执行器」
```

**规则**：
1. app 只声明 + 实现领域 handler；**不 import 内核实现细节**（边界检查已强制：`check-boundary.ts` R5）。
2. 内核通过**包装**注入，不靠约定：`withAppRuntime` 已经是这个形状——它包住 `plugin.load()`，
   自动把 tools 注册成 interface、把 `stop()` 串成"先撤注册、再停 app"。
3. 内核语义变化 = 换内核版本，app 声明不动（见 §5）。

## 4. 操作集合：统一词表

把"能做的一切"收进一张**节点级平面表**（沿用 `effect-planes-permissions.md` §1 的四 plane + 特权 plane）：

| Plane | 寻址 | 内容 | MCP 投影 | 谁能声明 |
|---|---|---|---|---|
| interface | `ns::appId.tool` | zod 化的操作 | `tools/list`/`tools/call` | app（领域）+ 内核（通用） |
| ui | `ui://ns/appId/<view>` | 语言无关 UiDocument | resources | app |
| storage | `store://ns/appId/<key>` | 文档式 KV | resources/templates | app（数据） |
| config | `config://ns/appId` + `config_set` | schema 驱动配置 | resource + 写 tool | app |
| **lifecycle（特权）** | `ns::host.lifecycle` | enable / disable / unregister / **stage / activate / rollback** | 仅 host 节点 | **只有内核** |

要点：
- **host 节点与 app 节点共用同一张表**，差别只在特权 plane：host 有 lifecycle（升级/回滚），app 没有。
  这是"包括 host 和非 host 节点"的落点。
- 操作集合由内核从声明层**自动生成**——这就是用户说的"自动把行为模式的代码带上"。
- 已有实现把一部分做成了：`listAppTools / resolveAppTool / invokeAppTool`（`packages/effect-apps/src/tools.ts:21-39`）
  提供**对所有 app 统一的** list/resolve/validate/invoke 入口（`apps_list/app_read/app_call` 面）。

**已落地（2026-09-10，P2-A）**——host 特权面进同一张表，三块：
- **声明**：`packages/effect-host/src/operations.ts`。`/-/planes` 的四个操作（list / enable / disable /
  unregister）原本只是 `control.ts` 里的正则；现在是 `HOST_OPERATIONS` 数据，每条带 `method`、`path` 模板、
  `inputSchema`、`outputSchema`。`control.ts` 只剩执行：`matchHostOperation` → `runHostOperation`。
  **这不是新增一层，而是把已有的那层写下来**——路径形状从此只有一处（测试锁死这条等式）。
- **合表**：`packages/effect-apps/src/operations.ts`。`makeNodeOperationTable(host, apps)` 把
  host 的 lifecycle 与每个 app 的 interface 工具放进同一张 `NodeOperation` 表，地址
  `${node}::${plane}::${name}`（host 侧即 `host::lifecycle::enable`；app 侧的 node 本身是
  `ns::appId`，所以形如 `ops::notes::interface::ping`）。特权是**条目上的属性**（`privileged`），
  不是第二张表：只有 host 节点有 lifecycle，app 永远没有。
- **服务**：`GET /-/operations`（`apps/effect-server/src/boot/infra.ts`）返回 JSON-safe 投影
  （`nodeOperationSummary`，**不含 `invoke`**）。列与做分开：这个路由只描述，动手仍走 `/-/planes`
  那条已经声明过的路径。

两个刻意的性质（都写在 `operations.ts` 注释里）：`list()` 是**视图不是快照**，每次重读 catalog，
所以热换（§6.4）后立刻反映、没有需要失效的缓存——快照工具面正是 `ToolSurface` 修过的那类 bug；
app 面的可见性直接继承 `listAppTools` 的 `authorize("interface")`，被拒的 plane **根本不在表里**，
而不是"在表里但调不动"。

## 5. 内核版本与兼容

**今天**：`bundleId` 带 semver（`io.effect-agent.board@1.0.0`），manifest 有 `abi: "effect-1"`，
config 有 `revision`（`effect-config/src/contract.ts:43`，SQLite 持久化）——**但 abi 从不被校验**。

**要定**：
- `abi`（major，兼容线，如 `effect-1`）——决定"能不能装"。
- `kernelVersion`（semver，内核自身）——决定"行为是否一致"。
- app 声明 `kernel: "^1.2"` 或 `abi: effect-1`；**加载前 gate**，不满足即**拒绝加载并明确报错**
  （沿用仓库取向：不符结构明确失败，不静默降级）。
- 内核与 app 的**双向**兼容：新内核必须能跑声明了旧 abi 的 app；新 app 声明高于宿主的内核 → 拒装。

**已落地（2026-09-10，P0）**：`packages/effect-bundle/src/compat.ts` 实现上面这条 gate——
`KERNEL_ABI = "effect-1"` 是宿主实现的线，`assessBundleCompat(声明, 宿主能力)` 返回
`{ok}` / `{ok:false, reason:{code: abi-unparseable | abi-mismatch | runtime-unsupported}}`；
`loadEffectBundle` 在 `import(entry)` **之前**调用它，所以不兼容制品**一行都不执行**。
认不出的 abi（非 `effect-<major>`）判 `abi-unparseable` 而非默默放行——沿用"不符结构明确失败"的取向。

**两条 ABI 线（K2 决定后，见 §6）**：

| 线 | 两端 | 变化频率 | 判定 |
|---|---|---|---|
| `bootstrap ABI` | host 底座 ↔ 内核制品 | 极低 | 内核声明它要的 bootstrap ABI；不满足即拒换内核 |
| `effect-N` | 内核制品 ↔ app 制品 | 中 | app 声明所需；内核声明它实现的区间；**换内核前先查全部已加载 app** |

**已有同类机制的现成先例（应当复用，不要再造第二套）**：`docs/script-sandbox.md` §4/§5 已经实现了一整套
**内容寻址版本 + 分级兼容裁决**：四级破坏（schema / deps / description / behavior）、
`CompatPolicy` 可配 `strict|warn|ignore`、`assessUpgrade(store, from, to, policy): UpgradeReport`，
并且**升级与回滚走同一个裁决函数**（§5.2 明写 *"Upgrade direction: old→new (apply the new version)
and new→old (rollback) use the same adjudication function"*）。§0 把这套总结为 *"one recursive
mechanism"*——工具级 / 版本级 / 配置级 / agent 级递归共用"scope + policy"一个模式。
**内核与 app 的版本兼容、回滚裁决应收敛到这一套**，而不是另立 semver 规则。

**已落地（2026-09-10，P4）**：这套裁决已抽成**零依赖**的 `packages/effect-compat`
（`assessChange` / `assessUpgrade` / `assessRollback` / `defaultCompat` / `CompatPolicy`），
`packages/script` 与 `effect-apps` 都从它取，杜绝"第二套"。抽包的理由是依赖方向：
`packages/script` 依赖原生 `isolated-vm`，app 层不该为了裁决把它拖进来。
`assessRollback(from, to)` 就是 `assessUpgrade(to, from)`——回滚即反向升级，一行之差。
输入放宽为结构化的 `AssessableTool` 与 `VersionLike<T>`，所以工具面（§4 的操作集合）与
版本制品（§5 的 bundle）能共用同一个判定器。

**已落地（2026-09-10，P2-B）——两条线都成了代码的一部分**：
- `packages/effect-bundle/src/kernel.ts`：`KernelDeclaration`（`bootstrapAbi` + `abi` + `runtimes`）、
  `assessKernelCompat` / `assertKernelCompat` / `KernelIncompatibleError`、
  **`assessKernelAgainst(kernel, apps, host)`**——后者就是 §5 要求的"换内核前先查全部已加载 app"：
  把**内核当成 host** 去跑同一个 `assessBundleCompat`，返回被这版内核打断的 app 清单（空 = 全部保住）。
- 判定逻辑没有第二套：`assessAbiLine` / `assessRuntime` 由两条线共用，`Incompatibility` 多了个
  `line: "bootstrap" | "effect"` 字段——出问题时日志里能直接看出**是哪条线**断的。
- 测试锁住了两件事：内核要 `bootstrap-2` 而 host 只有 `bootstrap-1` → 拒（`abi-mismatch`，`line: bootstrap`）；
  一个 `abi: effect-2` 的内核对着已加载的 `effect-1` app → `assessKernelAgainst` 逐个点名。
- `apps/effect-server/src/boot/kernel.ts` 声明本进程的内核，`bootRuntime` 在**建任何状态之前**先 gate；
  内核也可以通过 `EffectServerOptions.kernel` 传入（supervisor 将来就从制品仓传它进来）。

## 6. 生命周期：加载 / 热更新 / 回滚（**已定 K2**）

**已定（2026-09-10）**：内核自身也是可热换的制品，host 只保留最小底座。
即——"内核代码可热更新"是真的热更新，不是"升级 = 重启 host"。

### 6.1 host 不变式（永不被热换）

| 不变式 | 内容 | 现状 |
|---|---|---|
| 进程与入口 | 进程、socket/listener、**路由表分发点**（内核换，入口不换） | `effect-network/src/listeners.ts` 已有托管监听器 |
| 制品仓 | `.effect-bundles/<bundleId>@<version>/` + `kernel-state.json`（active/previous/abi/health） | 目录布局已有，索引缺 |
| 监管者 | supervisor：暂存 → 健康检查 → 原子翻转 → 提交/回滚 → boot 恢复 | **缺** |
| 引导 ABI | host ↔ 内核的契约（§5 两条 ABI 线） | **已声明并已行使**（`effect-bundle/src/kernel.ts`，P2-B；P5 第二段起 supervisor 真的从制品仓取内核，错配会开火）。**未被行使**的是 ② 档——见下 |

除上表外的一切——plugin host、各 registry、config runtime、UI 托管、planes、observe、MCP 面、console——
都是**内核制品**。今天的 `apps/effect-server/src/boot/runtime.ts:17-72` 正是这个"内核 + 底座"的混合体，
K2 要求把它**拆开**：底座留在 host，其余成为内核 bundle。**已拆（P5 第二段）**——见下。

**实现逼出来的一次修正（2026-09-10，P5 第二段）**：真去拆的时候，上表下面那句话按字面做是**做不成**的，
必须改一条判据：

> **内核是代码。任何握着进程级句柄的东西都不是。**

- SQLite store 与 listener 正是 P1 在 §7.6 点名的三个"进程级活句柄"里的两个。把它们放进内核，
  兼容热换就会把这些句柄连根拔起——而这恰恰是 §7.6 说"真正阻塞档①"的东西。所以它们是**服务**：
  bootstrap 建一次，交给每一个内核 revision。
- **app 注册表（plugin host）也必须是 host 不变式**，这条是硬的：如果每个内核自带一个 host，
  换内核就会把每个已装载的 app 一起丢掉——那是 §6.3-**②**（全量重建），而用户明确说过
  **兼容内核不许逼 app 重建**。app 只向那个稳定的 host 注册一次，内核只拥有自己的 plane。
- 于是"内核制品"= **行为**（plane 的实现 + 组合它们的逻辑），"host"= **状态与句柄**。
  这也解释了 §6.3-① 里那句"并交接内核自身的运行态"：在这一版里它**自动成立**，因为运行态本来就在
  host 手上；将来某个内核要有自己的态，交接才需要真做——**那时才是缺口**。
- 落到代码：`KERNEL_PLANES`（槽位 id 与 priority）是**host 的数据**，`planeStandIn` 每个槽位注册一次、
  永不重注册（路由表不动），翻转就是 stand-in 里面那一个指针。

**已落地（2026-09-10，P2-B）与未落地，分清**：
- 落地的是**契约**：内核现在声明自己要哪条 bootstrap 线、实现对 app 的哪条 `effect-N` 线，
  `bootRuntime` 在开数据库之前先 gate（`assertKernelBootable`）。判定用的是 §5 的同一套函数。
- **未落地的是"内核以制品形态加载"**。这一步被有意押后到 P5：可热换的内核需要 supervisor
  （暂存 → 健康检查 → 原子翻转 → 提交/回滚）在旁边，否则换内核就等于 §6.3-① 明确禁止的那种窗口
  （新内核已可见、旧内核已卸载、失败只能靠重建补）。所以 P2 只把**料**备齐，不单独引入内核热换。
- 因此 `assertKernelBootable` 今天**不可能对真实错配开火**：host 与内核同一次构建出来，两边的常量
  必然相等。它成为真正的闸门，是在 supervisor 能从制品仓取出**另一个**内核的那一刻（P5/P6）。

### 6.2 双缓冲切换（内核级）

```text
        ┌── kernel A (active，正在服务) ─────────────┐
host ───┤                                            ├─ 路由分发点（唯一，不动）
        └── kernel B (staged，已加载但不接管路由) ────┘
   stage B ─► 兼容矩阵(§5 两线 + 全部已加载 app) ─► 健康检查
        ├─ 失败 ─► 丢弃 B；A 继续服务，**无感**
        └─ 通过 ─► 原子翻转分发点 ─► A 进入 draining ─► commit(A 变 previous)
                     └─ 翻转后异常 ─► **翻回 A**（A 在 commit 前绝不卸载）
```

**核心不变量：A 在 commit 之前绝不卸载**。这就是"旧内核已被卸载后无法回滚"的解药，
也是 K2 相对 K1 唯一真正难的地方——K1 把这个问题回避了，K2 必须用双缓冲正面解决。

**已落地（2026-09-10，P5-1）——状态机与指针，未接线**：
- `packages/effect-bundle/src/repo.ts`：制品仓索引 `kernel-state.json`（active / previous / condemned）。
  写盘是**原子**的（临时文件 + rename）——写到一半崩掉会同时丢掉 active 和回滚目标，比索引过期更糟。
  缺文件 = 空仓（首次启动）；**文件损坏 = 报错**，不猜该跑哪个内核。
  `condemned` 记录本机已经失败过的 revision：不重试，避免"启动 → 崩 → 回退 → 再启动"的循环。
- `packages/effect-bundle/src/supervisor.ts`：`makeKernelSupervisor({repo, load, activate, probe, apps, host})`，
  给出 `boot(shipped?)` / `stage(revision)` / `state()` / `active()` / `previous()`。
  顺序严格照 §6.2：`stage → §5 矩阵 → load → probe → activate（翻转）→ persist → dispose(A)`。
  翻转本身抛错就**把 A 放回前面**——A 从未停止，所以"放回去"不会因为这次交换引入的原因失败。
- 内核是泛型 `K`：这状态机关心的是 revision 与指针，不关心内核是什么。`load` 是注入的，
  今天返回本仓库的内核，将来返回编译好的制品——**切换逻辑不变**。
- 测试锁住的是不变量本身：翻转发生在旧内核停止**之前**（断言 `activate:B` 早于 `stop:A`）、
  被拒的候选**一行都没执行**、候选体检不过只丢弃候选、翻转失败翻回 A、boot 回退到 previous 并告警、
  已 condemned 的 revision 下次不再重试。

**这一点没做，说清楚**：supervisor **还没有接进 `bootRuntime`**。接线要同时具备"稳定 facade"
（§6.3-①：host 交给 app 的必须是 facade 而不是内核的具体对象）和切换期请求保护（§6.5-5），
否则 `activate` 只能是空操作——而空操作的双缓冲是自欺。另外今天 `load(revision)` 对任何 revision
都构建同一个内核（内核还不是制品），所以"回退"在真实进程里没有可回退的对象。两者一起做才不是演戏：
那是 P5 的第二段（内核制品化 + facade + 请求保护）。

> **上面这段是 P5 第一段时的状态，P5 第二段（2026-09-10）已经把它补上**：现在 `activate` 是
> `dispatch-point.ts` 里的一次指针赋值，`load(revision)` 会从一个**制品目录** `import()` 内核，
> `retire` 等旧内核的在途请求走完才让它停。下面这张图和上面这段记录的是同一件事的两个时点，
> 保留原文是为了不把"当初为什么押后"抹掉。

**已落地（2026-09-10，P5 第二段）——接进真实进程**：
- 分发表不变：`KERNEL_PLANES` 的每个槽位在 host 上有一个**稳定 stand-in**，注册一次，
  id 与 priority 属于 host。换内核时路由表**一个字节都不动**（§6.3-① 的字面兑现）。
- 翻转：stand-in 的 `handle` 走 `point.run(...)`，进入时抓住当时的那个内核。所以
  "已在服务中的请求跟着 A 走完、新请求落到 B"是**机制**而不是承诺。
- 旧的停止点：`dispose: (kernel) => { await point.retire(kernel); await kernel.dispose() }`，
  而 `retire` **会拒绝**退休当前在服务的内核——"先翻转再停"从注释变成了一条会抛错的约束。
- stage 期间还有一道 host 侧的检查：候选内核必须**填满所有已启用槽位**（`probe`）。
  少填一个槽位意味着路由表里留着一个按 URL 可达的洞——必须在旧内核还在服务时就拒掉，
  而不是等第一条打到洞里的请求。
- 两档的现状：**两档都已通**。① 兼容原地热换是纯平移；② 不兼容 → 重建 app 也已落地
  （2026-09-10，见 §6.3 的「档② 已落地」）。**只有 host 注入 `rebuild` 能力时 ② 才可用**；
  没注入的主机行为与从前逐字一致（拒换）。

**两档代价完全不同**：兼容内核的翻转只是 facade 之后的实现替换（§6.3-①，**app 不动**）；
不兼容才走全量重建（§6.3-②）。

### 6.3 内核热换的两档：兼容则原地换，不兼容才重建 app

**用户澄清（2026-09-10）**：*兼容的内核**不需要** app 重建——直接（远程）热更新内核即可*。
所以下面的重建流程不是"唯一可行模型"，而是**第二档**：

| 档 | 条件 | 动作 | 对 app |
|---|---|---|---|
| **① 原地热换** | 内核**兼容**（abi 不变 **且** 内核自有运行态可交接） | host 把 facade 后面绑定的实现由 A 换成 B，并交接内核自身的运行态 | **零重建**，app 的 loaded plane 不动 |
| **② 全量重建** | 内核**不兼容**（abi 变 / 内核内部态结构变 / 有 app 抓住了内核具体对象） | `drain(apps) → unload(apps) → 装载 B → B 重放声明层的 registerEffectApp → 健康检查 → commit` | 全部 app 重建 |

**档① 成立的机制前提**：**host 交给 app 的必须是稳定 facade，而不是内核的具体对象**。
`EffectBundleApi`（`effect-bundle/src/load.ts:20-31`）与 `EffectAppHost`
（`effect-apps/src/descriptor.ts:29-40`）**就是这个 facade 接缝**。app 只拿 facade，内核在 facade 后面插拔，
于是"换内核" = 换绑定，app 与路由表内容都不动。这也是 §3 规则 1（app 不 import 内核实现细节）的
**运行时对应物**：编译期禁 import，运行期禁抓对象。

**档② 可行的依据**：声明层是纯数据、领域 handler 从 bundle 重新 import、状态在 SQLite/config store；
且"实例接口的生命周期与 app 完全一致，含 reload"本就是现有语义（`registration/runtime.ts:6`）。
（`packages/effect-apps/src/registration/runtime.ts:6`，注释明写 *including reloads*）。
**前提**：切换窗口内 app 的内存态必须可重建——哪个 app 有不可重建的内存态，就是这次架构重梳理的检查清单。

**档② 已落地（2026-09-10）**——两档现在都在：

- **supervisor 一侧**（`packages/effect-bundle/src/supervisor.ts`）：新增注入能力
  `rebuild?: { teardown(); replay() }`。supervisor 是泛型 K，它不知道 app 是什么，
  **装卸 app 是 host 的事**——与它今天只通过 `apps(): BundleDeclaration[]` 参与矩阵是同一个分工。
  注入了就按 `teardown → adopt(B)（load+probe）→ activate(B) → replay → persist → dispose(A)` 走；
  **没注入则与从前逐字一致**（拒换）——② 是能力，不是默认。
- **哪一条拒绝才触发 ②**：只有 `apps`（effect 线）拒绝走重建。`incompatible` 是 host↔kernel 的
  bootstrap 线，**重建 app 也救不了一个本机跑不了的内核**，所以即使注入了 `rebuild` 也照旧拒。
- **每一步失败都回到 A，且把 app 层放回去**：`adopt` 失败 → 重放 app（A 从未停）；
  `activate` 失败 → dispose B、切回 A、重放；`replay` 失败 → 切回 A、dispose B、**再试一次重放**，
  再失败则抛错并明说「this node needs a restart」。这条不是装饰：**报告一次看起来成功的回滚比失败本身更糟**，
  所以 `rebuild-failed` 事件带 `restored: boolean`。
- **§6.2 的核心不变式在 ② 里仍然成立**（A 在 commit 前绝不被 `dispose`），这也是上面每条失败都有退路的原因。
  但 ② 的窗口确实比 ① 长，这一条**如实记下、不掩盖**：app 层在翻转**之前**就下线了
  （测试断言的正是这个次序：`load:demo-app → stop:demo-app → load:B → load:demo-app`）。
- **产品接线**（`apps/effect-server/src/boot/runtime.ts`）：`rebuild.replay` 就是**再跑一次 `bootManifests`**，
  与 boot 同一条路径——重建出来的 app 集不能是一条更薄的、会与第一条漂移的注册路径；
  `teardown` 反序 dispose 现有 `disposers`。
- **第三种处置已落地（2026-09-10）**——「**只挂起**不兼容 app」：`rebuild.teardown/replay` 收的是
  **名字子集**（矩阵点名的那几个），能活的那些**一次都没被碰过**。三条定见写在实现里：
  挂起**保留槽位**（归还时回到原位，`stop()` 仍按反序装载次序拆除）；矩阵判的是**已加载**而非
  **可发现**（磁盘上没启用的 bundle 声明不了任何事）；制品的 `appId` 与 `effect.yaml` 的 `id`
  **不一致就直接拒**（否则会挂起错的那个）。
  如实记下今天的收益来自哪里：矩阵只点名**做过声明**的 app，所以今天能活下来的正是那些**没带
  `effect.bundle.json`** 的 app——「没人做过的声明不算声明」。② 从前会把它们全部拆掉，这一段消掉的就是这份误伤。

### 6.4 app 热换（单点，**独立目标**）

**要求（用户 2026-09-10）**：除了内核，**app 自己也要能热更新**。这不是内核切换的副产品——两者爆炸半径不同：

| | 内核热换（§6.2） | **app 热换（本节）** |
|---|---|---|
| 影响范围 | **全部** app 随内核重建 | **单个** app；其余 app 不中断 |
| 触发者 | host / supervisor | host，或该 app 自己的发布流程 |
| 状态 | 全靠声明层重放 + store | 前后版本**共享同一份 store**，连续性更强 |
| 窗口 | 较长（全量重建） | 极短（一次注册替换） |

**流程**：`stage(appId@v2) → 健康检查（对同一 store）→ 原子替换该 app 的 route/interface 注册
→ drain v1 在飞请求 → dispose v1`。

**已有原语说明单点热换本就是 SDK 的设计意图**：
- `registerMap` 用**代际令牌**而非值比较，注释明写 *"Track generations, not just values:
  replacement HTML/UI may be identical"*（`packages/effect-apps/src/registration/metadata.ts:6-18`）
  ——**这就是为单点热替换 UI/HTML 准备的**。
- `withAppRuntime` 把 interface 注册的作用域绑到该 app 的 loaded 生命周期，`stop` 时先撤注册再停 app
  （`registration/runtime.ts:12-17`）——单点 reload 时工具会自动正确重注册。
- `host.unregister(id, expectedPlugin)` 的身份校验保证"替换 v1 不会误删 v2"（`effect-host/src/lifecycle.ts:11-17`）。

**必须一起解决的三件事**：
1. **工具面兼容**：v2 的 tool schema 变了，正连着旧 schema 的 agent 会打空。用 §5 那套分级裁决
   （schema 破坏 = `strict`）决定放行 / 告警；并靠 **MCP `notifications/tools/list_changed`** 通知已连接方。
2. **两版本共存窗口**：drain 期间 v1/v2 同时在，`namespace` 是否要带实例/版本（呼应 §10-Q9）。
3. **回滚粒度要细到 app**，不只是内核（见 §6.5-7）。

**已落地（2026-09-10，P4）**——两半，分别在两个包里：

- **世代槽** `packages/effect-apps/src/registration/generations.ts`：`makeAppSlot(host, appId, {onChange})`
  给出 `install / rollback / unload / current / previous / generations`。
  流程是 `install → 读回工具面 → 裁决 → 健康探针 → commit（退休旧世代）`，任一步失败都 **restore 回上一个世代**。
  裁决用 `assessSurfaceChange`（两代同名工具走 `assessChange`；工具**消失**按 `schema` 级；工具**新增**不算破坏）。
- **工具面** `packages/effect-mcp/src/node-server/tools.ts`：`ToolSurface.refresh()` 对账 MCP server 的工具表
  并 `sendToolListChanged()`（SDK 自带 `isConnected()` 保护，未连接时安全）。`buildNodeMcpServer` 的返回值
  现在是 `NodeMcpServer = McpServer & { toolSurface }`，既有用法不受影响。
  **为什么必须先有它**：`registerTools` 原来在构建时快照 `registry.tools()`，热换后连接中的 agent 拿着过期清单，
  所以"发通知"之前得先让工具表是**动态**的。
- 接线：`makeAppSlot` 的 `onChange` 就是接缝——`makeAppSlot(host, id, { onChange: () => surface.refresh() })`。

**与 §6.5-1「暂存槽」的偏离（如实记录）**：没有做"影子身份"（`id#staged` 那种不接管路由的暂存）。
原因：`effect-host` 的 `register()` 本就是**按 id 覆盖**（`lifecycle.ts:26` 先 unload 旧的再装新的），
而所有 disposer 都是身份/代际守卫的（`registry.ts:83`、`metadata.ts:6-18`），所以"装新版"本身即切换点。
代价是**存在一个窗口**：v2 已可见、裁决与探针未过而 v1 已被 unload——失败靠 restore 补回来，而不是靠"旧的从未下线"。
这正是 §6.3-① 想避免的那种窗口，所以它**不能直接当内核热换用**（内核热换仍需 §6.2 的 A/B 双缓冲）。
待拍板：见 §11-Q3 / Q15。

### 6.5 要新增的原语

1. **暂存槽**（内核级与 app 级共用）：`register` 但**不接管路由**的影子身份（如 `id#staged`）。
   *内核级已落地，但不需要影子身份*：`supervisor.stage()` 本来就是"load 进一个槽、**不动分发点**"，
   翻转是显式的一次指针赋值（§6.2）。app 级做不到这一点，是因为 app 的切换点就是 `register` 本身
   （见 §6.4 的偏离说明）。
2. **健康检查钩子**：`LoadedPlane` 增可选 `health?()`；无则退化为"load 未抛错 + 冒烟请求"。
   *app 级已落地*为 `InstallOptions.probe(generation)`（不依赖 `LoadedPlane` 改型）。
3. **制品仓索引 + active/previous 指针**：`kernel-state.json`，内核与 app 都记。
   *内核那一半已落地*（`effect-bundle/src/repo.ts`，P5-1：active/previous/condemned + 原子写）；
   **app 侧未做**（`AppSlot.previous()` 还只在内存里）。
4. **boot 期崩溃回滚**：active 制品 load 失败 → 取 previous 启动 + 告警。
   *已落地并接进真实进程*（`supervisor.boot()`，P5-1；`main.ts` 传 `.effect-bundles/kernel-state.json`，
   P5 第二段）——坏 revision 记入 `condemned` 于是不会每次启动重演同一个失败，回退结果可从 `kernelBoot()` 读出。
5. **切换期请求保护**：分发点翻转是原子的，但 app 层重建**不是**；窗口内的请求要排队或落回 A。
   *已落地*（`packages/effect-host/src/dispatch-point.ts`，P5 第二段）：`run` 进入时抓住当前目标并计数，
   `retire` 等它归零，**且拒绝退休当前在服务的内核**。测试断言的是那条真正的性质——
   翻转已提交、新请求已由新内核应答时，旧内核仍在回答它手上那条在途请求，之后才 `dispose`。
   注意它保护的是**内核级**翻转；app 级的重建窗口（§6.4 的偏离）不在这条里。
6. **兼容矩阵判定器**：内核声明实现的 `effect-N` 区间 × 每个已加载 app 的需求 → 放行/拒换/只挂起不兼容 app。
   *三半均已落地*：单制品那一半是 `effect-bundle/src/compat.ts`（P0），内核 × 全部 app 那一半是
   `assessKernelAgainst`（P2-B），**第三种处置已落地（2026-09-10，见 §6.3 与下文验收块）**——
   矩阵给出名字子集，app 层按名字挂起与归还。
   （P5 第二段起矩阵真的在 `stage` 路径上跑，读的是**已加载** app 的声明而非磁盘上可发现的 app；
   今天只有制品化的 app 有声明，所以名单短——**没人做过的声明不算声明**，也正是这些 app 免于被误伤。）
7. **per-app active/previous 指针**：回滚粒度细到单个 app（§6.4-3）。
   *内存版已落地*（`AppSlot.previous()` + `rollback()`）；**跨重启持久化未做**（见第 3 项）。
8. **MCP `notifications/tools/list_changed`**：app（或内核）换版本后，通知已连接的 agent 工具面变了。
   *已落地*（`effect-mcp` 的 `ToolSurface.refresh()`），并顺带把节点服务器的工具表从"构建时快照"改成**动态对账**。

### 6.6 已有的可复用件（拼装，不必从零造）

- `host.register/unregister(id, expectedPlugin)`：`expectedPlugin` 做**身份校验**，天然防止"删错代际"
  （`effect-host/src/lifecycle.ts:11-17`）——双缓冲切换正好需要它。
- 生命周期队列串行化每次变更（`queue.ts`），变更竞态已被处理。
- 注册即可回滚：`registerEffectApp` 失败 → `rollback(error, dispose)` 反序清理
  （`registration/register.ts:34-36`、`disposal.ts`）。
- bundle 加载 = `import(entry)` + `register(api)` + **幂等 disposer**（`effect-bundle/src/load.ts` 的
  `loadEffectBundle`）。
- boot 失败反序 dispose 已加载项（`load-manifest.ts:19-25`）——回滚顺序已是对的。
- `EffectBundleApi`（`load.ts`）是 **host↔app 的接缝**：host 把它交给 bundle，app 用它注册自己。
  **修正（2026-09-10，P5 第二段）**：它**不是** host↔内核的接缝——内核拿的不是这个。
  内核的接缝是 `apps/effect-server/src/kernel/types.ts` 的 `KernelContext`（host 给内核的**服务与句柄**）
  与 `KernelInstance`（内核还回来的**装载面**）：`loadKernel()` 用 `import()` 装制品，
  要求它导出 `createKernel(context)`。两条接缝分开，正是 §6.1 那条修正的落点。

## 7. 运行时可移植性：OS / 浏览器 / JS 沙箱

**要求（用户 2026-09-10）**：app 是分布式的，所以**同一个 app 制品要能跑在 OS 进程、浏览器、
或 JS 沙箱里**；沙箱更轻量。

### 7.1 三个运行时目标

| 目标 | 宿主 | 能提供 | 不能提供 |
|---|---|---|---|
| **os** | effect-server 进程（Bun/Node） | fs、SQLite、socket/listener、子进程、crypto | — |
| **browser** | 页面 / Worker | fetch、IndexedDB/localStorage、WebCrypto、MessageChannel、DOM | fs、子进程、监听端口 |
| **sandbox** | 受限 JS 运行时 | **只有注入的能力对象** | 一切 ambient（含网络与存储） |

### 7.2 唯一规则：能力注入，不 ambient

app 只能通过**注入的能力**访问世界。**这条规则仓库已经在强制执行**：`scripts/check-boundary.ts:213`
把 `Bun.serve/spawn/file`、裸 `fetch`、`WebSocket`、`process.*` 判为 **error**，且当前
`bun run check:boundary` = 0 error —— 也就是说**未被豁免的 app 天然可移植**。

**欠债（已实测，见 §7.6）**：`effect.boundary.json` 的 `ioExemptApps` 豁免了 6 个（board、mantis、
deckconsole、ui-host、ai-gateway-app、playground）。它们直接 `Bun.serve` / 读文件，**天生跑不了 browser/sandbox**。
这是"可移植"要求下的既有欠债清单。注意豁免名单与实测**并不完全重合**：`playground` 被豁免但实测未触及
系统 API，而 `effect-server` 有 ambient 依赖却不在豁免名单里（它是宿主，走 `allowSystemIoFrom`）。
即——**豁免名单是政策，不是能力证据**。

### 7.3 已有的四块底子

1. **ABI 外置**：`compileEffectBundle` 用 `--external @effect-agent/* --external zod`
   （`effect-bundle/src/compile.ts`），其意就是"bundle 能跑在任何提供这些的宿主里"——
   **这正是内核可热换而 app 不必重编的机制基础**，也是"同一个 app 换运行时"的前提。
   当时 target 写死 `--target bun`，**P3 已按 `runtimes` 出多份**（见 §7.5-2）。
2. **存储已在协议后面**：`store://ns/appId/<key>` + `NodeStore`（`effect-planes-permissions.md` §3）
   把"存储"变成**可代理的能力**——OS 上落 SQLite，浏览器落 IndexedDB，
   **沙箱里没有本地存储就代理回 home**。因此 §6.3 的"内存态必须可重建"要升级为
   **"跨运行时也成立"**。
3. **沙箱已经存在**：`packages/script` 有真实沙箱执行模型
   （`ScriptRuntime.runtime: "quickjs" | "graaljs" | "node-vm" | "isolated-vm"`，见 `script-sandbox.md` §2），
   `packages/ui-sandbox` 把它包成**权限门控**的 `UISandbox`
   （`execute:script` / `read:data` / `render` / `emit:event`，`ui-sandbox/src/index.ts:9`）。
   今天它承载的是**脚本工具**，不是整个 app —— 要扩成"app 也能跑在沙箱里"。
4. **浏览器宿主已有先例**：console 的客户端 bundle（`apps/effect-server/public/effect-ui-client.js`）
   本就在浏览器里跑；`effect-bundle-mesh.md` §5 的 P3-lite 已做过"浏览器宿主里 board bundle 回注册
   + mesh 到 `ops::board`"。

### 7.4 与 K2 的交叉

- 内核制品也要按运行时出多份；**切换时目标运行时必须一致**（不能把浏览器的内核装进 OS host）。
- 推送升级（§8）多一个匹配维度：`abi` × `runtime` × 版本区间。目标宿主的 runtime 不在 app 声明的
  集合里就**拒推**（不匹配明确失败）。
- 注意 `IsolatedVmRuntime` 是原生模块、**bun 加载不了**（`script-sandbox.md` §2 明写，自动退化
  `NodeVmRuntime`）——"沙箱"这一档的**实际隔离强度取决于宿主**，必须在 manifest 里如实声明，
  不能宣称一个统一的沙箱等级。

### 7.5 缺口

1. ~~manifest 加 `runtimes: ["os"|"browser"|"sandbox"]`（与 §5 的 `abi` 并列的**第二维兼容**）~~ ✅
   已落地（`packages/effect-bundle/src/compat.ts`；缺省 `["os"]`，加载前 gate）。
2. ~~`compileEffectBundle` 支持多 target 产物~~ ✅ **已落地（2026-09-10，P3）**：
   `compile.ts` 的 `targets` / `BUILD_TARGET` / `entryFor(runtime)` 按 manifest 声明的 `runtimes`
   各出一份 `entry.<runtime>.js`，写进制品 manifest 的 `entries`；`entry` 保留为主产物
   （`os` 优先），**旧制品（无 `entries`）照原样加载**。
   **对原方案的一处偏离**：原写"bun / browser / neutral"三档，实际只有两档
   ——`sandbox` 与 `browser` 共用 `--target browser`。理由是沙箱与浏览器的差别**不在产出的字节里**
   （都在"没有 node 内建"这一侧），而在**宿主注入什么**；为它单开一个只是换个标签的编译档是装饰。
3. ~~运行时适配层~~ ✅ **已落地（2026-09-10，P3）**。能力词表与判定在
   `packages/effect-bundle/src/capabilities.ts`（`CAPABILITY_NAMES` = clock / storage / crypto / network、
   `capabilitiesOf`、`describeCapabilities`、`requireCapability`、`capabilityGaps`），
   **构造器**在同包的 `packages/effect-bundle/src/runtime.ts`：
   `ambientCapabilities(runtime, overrides)`（os | browser：真时钟 + WebCrypto，存储缺省进程内存）
   与 `sandboxCapabilities(injected)`（**什么都不 ambient**——没被注入的时钟就是没有，哪怕进程里有）。
   两个构造器而非三个：os 与浏览器差在"能提供什么"，不差在 seam 怎么搭。
   **分开的理由是依赖方向**：loader（`effect-bundle`）必须在 import 之前就做拒绝，
   所以词表与判定归 `capabilities.ts`，构造器归 `runtime.ts`；loader 不 import 构造器，
   于是"判定早于加载"是文件边界保证的，不需要靠包边界去撑。
4. **沙箱承载完整 app**：**一半已落地（2026-09-10，P3）**。宿主那半有了——
   `loadEffectBundle` 接受 `runtime: "sandbox"` + `capabilities`，制品能在沙箱宿主里加载、执行、返回 disposer；
   `requires` 声明与 `capabilityGaps` 的拒绝 gate 就落在 `load.ts`
   （与 §5 的 abi/runtime gate **同一处**，`assertCapabilityCompat` 紧挨 `assertBundleCompat`）。
   **还缺**：真正的隔离执行——今天 entry 仍在宿主进程里跑，"沙箱"是**能力上的**而非**隔离上的**。
   要成真得把 `packages/script`（quickjs / graaljs / node-vm）接成宿主，
   且按 §7.4 如实声明隔离强度。
5. 浏览器侧存储后端（IndexedDB）与"存储代理回 home"的落点。
6. **浏览器侧至今没有真实页面宿主**：`ambientCapabilities("browser", …)` 提供一个浏览器**能力集**，
   但没有任何东西把 entry 真的放进页里跑过。P3 的验收里"os 与浏览器行为一致"因此是
   **在同一个进程里换能力集**跑出来的——能力 seam 是真的，页面不是。
   这也决定了 §7.5-5 的落点：IndexedDB 后端要先有个页面可以放。

### 7.6 P1 盘点结论（实测，2026-09-10）

自动化部分由 `bun run inventory` 生成到 **`docs/app-portability-inventory.md`**（可复核、可重跑），
`bun run check:inventory` 作为 gate。实测结论：

| 事实 | 数字 |
|---|---|
| app 总数 | 10 |
| 有 ambient 依赖（今天只能跑 `os`） | 6 — ai-gateway、board、deckconsole、effect-server、mantis、ui-host |
| 代码上未触及系统 API | 4 — agentd、mcp-gateway-app、mcp-registry-app、playground |
| 声明了 `runtimes` 的制品 | 1 — board = `["os"]` |

**"未触及系统 API" ≠ "能跑在 browser / sandbox"**：只能说明它自己没直接碰，依赖的包可能碰了，
或用了只在 OS 成立的语义。P3 之后这条判据**有了一个跑得动的样本**：`fixtures/app-portable`
在 os / browser / sandbox 三档下都真的加载并执行过（§7.5、§10 P3）。
但它是**专为可移植性写的 fixture**，不是上面这 10 个 app 中的任何一个——
**盘点结果本身没有被这句话推翻**：那 6 个 app 的 ambient 依赖还在。

人工复核的**不可重建态**（§6.3-② 的前提；脚本查不出，只能人读）：

| app | 事实 | 对内核热换的含义 |
|---|---|---|
| board | **唯一以 bundle 形态加载的 app**（`src/effect-bundle-entry.ts` → `registerEffectApp`）；`storage/database.ts:9` 打开 SQLite | 状态已落库、内存态可重建。真风险是**句柄**：档① 原地换内核时，新内核若重新打开同一 SQLite 文件就成了双写者——要么复用旧句柄，要么等 drain 完再移交 |
| mantis | 平台上注册的只是**声明式门面**（`src/effect-app.ts:11` —— 只有 config + UI）。钉钉 worker / webui 面板是**独立进程**（pm2 托管），它们的 `setInterval`（`hosts/webui/panel/store/panel.ts:16-31`）与模块级 `let host`（`hosts/dingtalk/main.ts:22`）**不参与内核切换** | 内核热换对 mantis 门面的代价是零；但那两个进程也**不在治理范围内**——要收进来得等 §8 的容器节点 |
| agentd | `src/effect-plugin.ts:7,19` 模块级 `let runtimeControl` + `??=` 记忆化单例 | **进程级活句柄**：档① 原地换内核时它仍指向旧内核对象——正是 §6.3「app 抓住了内核具体对象」的实例 |
| deckconsole / ui-host / ai-gateway | 各开 SQLite（`ui-host/src/activity.ts:17`、`deckconsole/src/domain/launchers.ts:15`）或直接 `Bun.serve`；**都没有 `effect.bundle.json`** | 今天**不在 bundle 生命周期内**，§6 的切换机制够不着它们——P2/P3 要把它们收进制品形态，否则"推送升级"只覆盖 board 一个 |
| effect-server | 宿主本身（走 `allowSystemIoFrom`） | 归 §6.1 host 不变式，不是被热换的对象 |

**这条复核给出的结论比预期具体**：真正阻塞档① 的不是"状态在内存里"——状态基本都已落 SQLite / `store://`；
而是**三样进程级活句柄**：SQLite 文件句柄、原生定时器、模块级 `let` 指向的内核对象。
它们恰好是 §6.3 档① 前置条件的三种失败形态，也直接支撑 §11-Q18（内核运行态如何交接）。
第二个结论是覆盖面：**今天 bundle 机制只覆盖 10 个 app 里的 1 个**，"推送升级"要成平台能力，先得把
其余 app 收进制品形态（§10 的 P2/P3）。

## 8. 容器节点：一个节点承接多个 app

**要求（用户 2026-09-10）**：支持**容器节点** —— 一个节点（机器 / 容器 / 宿主）可以**承接多个 app 的部署**。

### 8.1 节点构成

```text
容器节点（machine / container / browser host / sandbox host）
├── bootstrap        host 不变式：进程 · listener · 制品仓 · supervisor · 引导 ABI   ← §6.1
├── 内核制品          按目标运行时出多份；可热换                                    ← §6.2 K2
└── N 个 app 实例
     ├── app@v1   ns=ops/board
     ├── app@v2   ns=workspace-b/board     ← 同 app 多实例（不同 ns）
     └── other-app
```

节点内每个 app 实例独立 `stage / activate / rollback`（§6.4），互不影响；
节点整体**只有不兼容内核热换时才全量重建**（§6.3-②）——兼容内核原地换（§6.3-①），节点内 app 不受影响。

### 8.2 已有的对应物（不要重复造）

| 已有 | 复用为 |
|---|---|
| agentd **Machine**（机器身份、在线状态、允许下发的配置范围） | 容器节点的身份与在线状态 |
| board-v2 的 **probe**（目标机驻场程序、拉取式命令通道、NAT 友好） | 节点上的宿主程序 —— **已落地**：`packages/agentd-probe` + `bun run node:probe`，只有出站，见 §8.5-1 |
| mesh 的 node = `(namespace, bundleId, endpoint)` | 节点内 app 实例的寻址 |
| effect-bundle 的 **namespace 覆盖**（"一个 bundle 可被多次加载，每次落不同 ns → 同 app 多实例共存"，`effect-bundle-mesh.md` §3） | 同 app 多实例部署 |
| mcp-registry 的 announce / heartbeat / withdraw 租约 | 节点注册与保活的可复用形态（**复用形态，但不复用它的 `static` 租约**：注册进配置不等于活着 — 见 §8.5-1） |
| K2 host 不变式 + 内核热换（§6.1/§6.2） | 节点底座的升级 |
| app 热换（§6.4） | 节点内单个 app 的升级与回滚 |

### 8.3 节点要声明什么

- `runtimes`（os / browser / sandbox）——决定这个节点**能装哪些 app**（§7.4 的第二维兼容）。
- `namespaces`——允许承载的隔离域。
- 承接上限与资源（CPU/内存/磁盘、app 数上限、配额）——**app 数上限已决**；CPU/内存配额与
  "要不要**调度**"仍未决（§11-Q17）。

**已落地（2026-09-10，§8.3 / §11-Q17）**——声明不再只是记录，而是**准入**：

- 形状：`Machine` / `DeclaredMachine` 加 `namespaces: readonly string[]` 与可选 `maxApps?: number`
  （`packages/agentd/src/types.ts`）。两档严格度沿用 §8.5-1 已有的分法：配置文件里可省
  （省 = 什么都不承载），announce 形状里 `namespaces` 必填。
- **规则只有一条，且放在节点计划里**：`packages/agentd/src/capacity.ts` 的 `admitApps(node, apps)`
  由 `makeNodeArtifactAdapter().plan()` 在兼容性裁决**之前**调用。白名单默认**拒绝**：
  没声明 `namespaces` 的节点什么都不承载；拒绝消息指名是哪个域、以及节点**确实**声明了什么
  （`node node-1 does not carry namespace "workspace-b" for board; it carries ops`）——
  "invalid placement" 对运维不是可行动的消息。
- **为什么不在 `bindNode`**（这是对本文原计划的一处偏离，理由是实测的）：`announceNode` 会**覆盖**
  机器记录，所以节点能在绑定写入**之后**收回自己的声明。写在绑定处的规则会继续下发一份节点已经否认的部署；
  写在计划处，读到的才是**当前**声明。`apps/agentd/test/node-admission.test.ts` 就是这条的证明——
  绑定一个字没动，一次 announce 让同一个计划从 200 变 400。
- **`maxApps` 缺席 ≠ 0**：没声明上限的节点读作"声明了没有上限"，如实报告；平台不替它编一个数字。
  `0` 是另一种声明——正在排空的节点不收 app。schema 因此**不给 `maxApps` 默认值**（§11-Q17 的答复）。
- 计数在域检查**之后**：运维看到的是这个部署第一件真正错的事，而不是第二件。
- `runtimes` 这一维不动：仍由 SDK 自己的兼容闸（`assessBundleForMachine`）裁决。`capacity.ts`
  只补上限那两件**与兼容性无关、只与节点自己的声明有关**的事——正因为如此，它能在一个制品还不存在时
  就拒绝一次放置。
- probe 侧：`bun run node:probe` 新增 `--namespaces a,b`（**必填**，缺了拒绝启动）与 `--max-apps n`（可选）。
  必填的理由与 `--capabilities` 同构但更尖锐：空 ns 集合是一个**合法**声明（"什么都不承载"），
  所以打错的 flag 在计划期与一次刻意的排空长得一模一样。
- 测试 18 条：`packages/agentd/test/capacity.test.ts`（规则 7）、
  `apps/agentd/test/node-admission.test.ts`（服务面 4）、`apps/agentd/test/machine-schema.test.ts`
  （两档严格度 4）、`apps/agentd/test/probe-cli.test.ts`（CLI 启动门槛 3）。
  反事实：注释掉 `plan()` 里那一行 `admitApps`，**恰好**八条断言"被拒"的测试变红（`capacity` 5、`node-admission` 3），
  三条断言"放行"的保持绿——规则确实是新的，且没有一条老测试依赖它。
- **验收（真实控制面 + 真实驻场程序）**：`bun run app:host agentd --app-routes --config @seed.json`
  起真控制面（节点 `m1` 声明 `namespaces: ["ops"]`，绑定 `ops::board@1.0.0`），
  `bun run node:probe --namespaces ops` → `applied revision 3: place ops::board@1.0.0`；
  同一绑定、只把 CLI 的 `--namespaces` 换成 `workspace-b` → 每一拍都是
  `fault plan: … node m1 does not carry namespace "ops" for board; it carries workspace-b`。
  **绑定一个字都没改**，变的只是节点自己的声明——这就是"闸门放在计划处"的现场证据。

### 8.4 部署单位：从 app 变成"节点 × app 集合"

§9 的推送从"推一个 app"升级为"推一个**节点的期望 app 集合**"：

```ts
// 落地形状（packages/agentd/src/types.ts）
NodeAppPlacement { bundleId, version, ns, enabled? }   // 写下来的：*在哪*，不是*是什么*
ResolvedNodeApp  = BundleRef + { ns, enabled? }        // 解析后的：制品自身的事实 + 地址
DesiredNode { node: Machine, revision, kernel?: BundleRef, apps: ResolvedNodeApp[] }
```

**放置不重述 `abi` / `runtimes`**（这是实现期修正的一处设计）：放置只写"哪个制品的哪个版本落在哪个 ns"，
`abi` / `runtimes` / `kind` 一律来自注册表。若放置能自己重复这些行，它就能与它所放置的制品**相矛盾**，
而制品自己的声明也就无从强制了。`bindNode` 因此是"解析"而不是"记录"：
放置里的 `bundleId@version` 先在 registry 里查到，再拼成 `ResolvedNodeApp`。
诚实的一处代价：配置面（`effect-config.ts` 的 `nodeApp`）因此**看不见 `kind`**，
"往 app 槽里放内核"这类范畴错误只能在控制面被拒（那里才看得到 `kind`）。

回执仍复用 agentd 的 `revision` + `reportApplied` 409 stale 机制（`agentd/src/control.ts:24`）——
今天的 `DesiredAgentConfig{agentId, revision, sets, servers}` 正是这个形状的前身。
拉取式通道（probe）天然解决"节点离线再上线"：**desired 集合本身就是恢复来源**。
（"这个节点现在在不在"这一维与驻场程序都已落地，见 §8.5-1。）

**已落地（2026-09-10，§8.4）**——部署单位真的从"一个 app"变成了"节点 × app 集合"：
- `packages/agentd/src/nodes.ts` —— `makeNodeArtifactAdapter()`（`kind: "effect-node"`），
  `NodeDeployment { nodeId, kernel?, apps: NodeAppArtifact[], metadata: { nodeId, revision } }`，
  plan / apply / validate 与 `bundles.ts` 的适配器同形；`metadata` 字段名与别的 agentd 计划一致，
  所以**一条回执规则覆盖全部**，节点级没有第二套并发规则。
- **裁决仍是那一份**：`assessBundleForMachine` 原样调用，本文件只加"逐项迭代 + 给失败贴地址"
  （`cannot place workspace-b::board@1.0.0 on node-1: …`）——集合有十二项时，"计划失败"不是可行动的消息。
- **身份是放置而非制品**：`nodeAppId = ns::bundleId@version`。同一制品落在两个 ns 是两个放置（§8.1），
  同一地址出现两次才是矛盾（`bindNode` 与 `validateNodeDeployment` 各拦一道）。
- **内核槽与 app 槽不互换**：内核槽里放 app、app 槽里放内核，两边都在 bind 期与适配器 `validate` 期被拒。
- **确定性 diff**：新增 `packages/agentd/src/stable.ts`（递归按键排序的 `stableString` / `same`）。
  起因是一个**真 bug**：`JSON.stringify` 对键序敏感，而 `artifactOf` 与 `validateBundleArtifact`
  构造同一对象的键序不同，于是每次 plan 都吐出一条幻影 `update`。修在共享位置，`bundles.ts`（P6）
  一起受益——不是只在新代码里绕开。
- 服务面：`GET /agentd/node?node=`、`GET /agentd/node/plan?node=`、`POST /agentd/node/report`；
  MCP 工具 `agentd_bind_node` / `agentd_desired_node` / `agentd_plan_node` / `agentd_report_node_applied`；
  配置面 `nodeBindings` 种子字段（排在 `bundles` 之后，好让放置能指名上面刚发布的制品）。
- **仍未做**：CPU/内存配额与调度（§8.3 的 `namespaces` 与 app 数上限已落地）；跨进程送字节**已落地**（§8.2 末）；
  §8.5-5 的"离线恢复取回退还是前滚"已定（前滚，见 §8.5-1 的驻场程序一节）；
  驻场程序本身也已落地。（§6.3-② 的全量重建档已落地，见下文。）

### 8.5 缺口

1. ~~节点注册 / 心跳 / 租约（agentd Machine 有雏形，mcp-registry 有可复用形态）~~ ✅ **已落地**
   （2026-09-10，见下）——机制、控制面、传输面、**驻场程序**都有了。见下面的「驻场程序（probe）已落地」。
2. ~~节点级 desired app 集合 + 回执~~ ✅ **已落地**（2026-09-10，见 §8.4）：`DesiredNode` +
   `makeNodeArtifactAdapter()`，一份计划覆盖内核 + N 个 app，回执走同一条 409 规则。
3. ~~节点内多 app 的隔离（ns 已有）与**配额**~~ —— ns 已是放置的地址（§8.4 用了），
   `namespaces` 白名单与 app 数上限**已落地**（2026-09-10，见 §8.3）；CPU/内存配额与调度仍未决
   （§11-Q17）。
4. **不兼容内核切换 = 全节点 app 一起重建**（§6.3-②），所以**节点越大、该档的窗口越长**——
   这给 §11-Q2「内核制品粒度」加了权重：整块内核换一次动全部 app，拆细能缩小重建面。
   兼容内核走 §6.3-① 原地换，代价与节点规模无关。节点级计划让这件事**可见**了
   （一次 plan 列出要换的整个集合），但重建窗口本身没有被缩小。
   **② 档本身已落地（2026-09-10）**：重建会发生、会成功、失败会回滚，但窗口长度仍随节点规模增长——
   §11-Q2 与「只挂起不兼容 app」（§6.5-6 第三种处置）是缩小它的两条路——**后者已落地（2026-09-10）**：
   重建面现在只等于**声明过且跟不上新线**的那几个 app，没做声明的 app 不再陪跑；但声明齐全的节点上
   这一档仍可能等于全节点，所以 §11-Q2 还没做完。
5. 节点离线/崩溃后的期望态恢复（拉取式 + desired 集合即来源，但要定"版本回退还是前滚"）——
   **已定：前滚**（2026-09-10，见下面「驻场程序」一节的答复）。前提也都在了：§8.5-1 之后"离线"是一个
   **可读、可测**的状态，不再是靠 `Machine.status` 猜；驻场程序回来时拉的是**当前** revision。
   回退作为**运维动作**存在（改绑定），被表达成一次向前的期望态变更，节点侧不需要第二套机制。

**§8.5-1 已落地（2026-09-10）——节点在线是观察出来的，不是声明出来的**：
- `packages/agentd/src/presence.ts` —— `makeNodePresence({ leaseTtlMs, clock })` 提供
  `announce` / `heartbeat` / `withdraw` / `presence` / `list`。租约**读时求值**：没有定时器、没有 sweep，
  也就没有"清理任务没跑所以死节点还活着"这一档。
- **在线与身份分开两张表**：`machines` 是节点**是什么**（身份、能力——运行与否都成立），
  `presence` 是它**此刻在不在**。`GET /agentd` 把 `machines[].status`（节点自己说的）与
  `nodeLiveness`（服务端看到的）**并排**给出，读者能分清哪个是哪个——这也是 HTTP 测试断言的一对。
- **与 mcp-registry 的有意分歧**：不复用它的 `static` 租约（代码注册即视为活着）。
  节点这边**没有** static 一档，因为"它写在配置文件里"正是这一条要终止的冒充。
  测试就是"配置里声明的机器在 announce 之前是离线的"。
- **时钟取两个的较大值**：`age = max(0, 墙钟差, 单调钟差)`。NTP 往回跳会让墙钟年龄变小，
  一个已经死掉的节点能靠别人校时续命；取最大值使租约**不可能被回拨延长**
  （往前跳则提前过期——fail-closed）。默认单调源 `performance.now()` 的生命周期恰好等于这张内存表。
  测试："墙钟回拨救不活一个已死的租约"。
- **过期 ≠ 删除**：租约到期只把节点变离线，机器记录、绑定、期望集合逐字节不变
  （`same(whileUp, desiredNode(...))` 为真），且离线节点的 `desired` 照常可读、可回执。
  因为 desired 集合本身就是恢复来源（§8.4）——让心跳失效去摧毁它要恢复的东西，是自相矛盾的。
  `withdraw` 同样只结束"在不在"，不结束"这个节点"：干净关机不是退役。
- **续约不动 revision，改声明才动**：回执是关于"该跑什么"的，心跳若 bump，会让每个**没有绑定**的
  agent 的在途回执全部 409（无绑定时 `desired()` 用的是全局 revision）。但 announce 里
  `capabilities` 变了**是**期望态变化——它改变的是"这里能推什么"。两条都测了。
- **时间由服务端定**：`DeclaredMachine = Omit<Machine, "reportedAt">`，探测体里**没有**这个字段；
  多带一个 `at` 是 400 而不是被忽略——忽略会让调用方以为自己说了算。`reportedAt` 由服务端盖章。
- **声明的形状分两档，差别不是修辞**：配置面 `capabilities` 缺省即 `[]`（运维省略意为"没有"），
  探测面**必填**——缺省成 `[]` 是一次**静默清空**，之后每次 plan 都会拒绝却不说为什么。
  故探测体是"要么说清自己，要么被拒"，畸形体返回 **400 并指名缺哪个字段**（不是 500 替调用方背锅）。
  `namespaces`（§8.3）沿用同一条：配置面默认空，announce 侧必填。
- **凭据**：`nodeToken` 可选，走 `authorization: Bearer`（与 mcp-registry 的 announce/heartbeat 同一约定），
  不进请求体——秘密不进 body，也就不进 body 日志。比较用 `timingSafeEqual`。
  没配就是开放的，且 `nodeLiveness().tokenRequired` **把这件事说出来**：没上膛的枪不该看起来像上了膛。
- 服务面：`POST /agentd/node/{announce,heartbeat,withdraw}`、`GET /agentd/node/presence[?node=]`
  （不带 `node` 给整张表），MCP 工具 `agentd_announce_node` / `agentd_heartbeat_node` /
  `agentd_withdraw_node` / `agentd_node_presence`；`GET /agentd` 增加 `nodeLiveness`。
- 测试 24 条：`packages/agentd/test/presence.test.ts`（机制 9）、
  `apps/agentd/test/node-liveness.test.ts`（传输面 6）、`packages/agentd/test/node-presence.test.ts`（控制面 9）。
  四条反事实各自**只**杀掉一条测试：单调钟 → "回拨救不活"；`rejectClientTime` → "节点不能自己说何时被看见"；
  `parseBody` 的 400 映射 → "畸形体是 400 且指名字段"；从 header 取 token → "有 token 时拒绝且不改动状态"。
- **一处诚实的代价**：这张表**不落盘**，控制面重启后所有节点先显示离线，直到下一次 announce/heartbeat。
  这是有意的——从磁盘恢复的租约表是一堆**没人做过的声明**；TTL 30s，代价窗口约一个心跳。
- **仍未做**：CPU/内存配额与调度（§11-Q17）；`namespaces` 白名单与 app 数上限**已落地**，见 §8.3。

**驻场程序（probe）已落地（2026-09-10）——目标机上真的有一个东西在调这套控制面**：
- `packages/agentd-probe/` —— `startProbe({ url, machine, token?, intervalMs?, apply?, fetch?, schedule?, onEvent? })`
  返回 `{ nodeId, status(), stop() }`。一拍是：`announce`（已持租约则 `heartbeat`）→ 拉
  `GET /agentd/node/plan` → apply → `POST /agentd/node/report`。
- **只有出站**：不发监听、不开端口，所以 NAT 后的机器不需要任何入站路径（与"app 不自己开端口"同一条）。
  用原生 `fetch` 而不是 app 的 egress router——router 答的是"一个 **app** 能去哪"，而 probe 不是
  本机上的 app，它是这台机器自己的声音。
- **"拉 desired"就是拉 plan**：`plan` 的返回里已经含**完全解析**的 `desired: NodeDeployment` 与裁决结果，
  再读一次 `/agentd/node` 是两次可能打架的读。§8.4 的"一份计划覆盖内核 + N 个 app"正为此。
- **不做的事在 `apply` 的默认值里说清楚**：默认 `apply` 即 `makeNodeArtifactAdapter().apply`——校验并返回
  该部署，不凭空发明；它**不**把制品字节搬到机器上。真机传自己的 `apply`，回执里带的就是它返回的东西：
  "应用了什么"是机器的回答，不是 probe 的假设。要真的收字节就传 `stage`（§8.2 末），probe 把它接成
  `stagingApply`：取回、校验、落盘，回执里带每个制品落在了哪里。
- **同一 revision 不重复 apply、不重复回执**：`reported` 记住上次回执的 revision，相同即 `in-sync`。
  否则每 1.5 秒来一张回执，回执就不再是回执，而是一个恰好带着部署的心跳。
- **故障分类 = 七种回答，各有各的处置**（`packages/agentd-probe/src/errors.ts`）：

  | 种类 | 是什么 | 循环怎么办 |
  |---|---|---|
  | `unreachable` | 压根没有 HTTP 响应 | 继续打；节点会在控制面自然过期——这是实话 |
  | `refused` | 401 / 400 —— 控制面拒绝的是**我们** | **停**；同一次调用会被同样拒绝到永远，再打是空转 |
  | `unavailable` | 5xx —— 到了，但坏了 | 继续打 |
  | `lapsed` | 404 "node is not present" —— 租约过期了 | 同一个节拍内**重新 announce** |
  | `stale` | 409 —— 我们 apply 时期望态动了 | 下一拍重拉；这是进展，不是失败 |
  | `plan` | 计划器拒绝了**这个部署**（400） | 报出来；不 apply、不声称成功、也不发回执 |
  | `apply` | 本机侧抛了（含无法归因的错误） | 报出来、回**失败回执**、继续重试 |

  七条共有一点：**没有一条是成功**。这一层存在的意义就是"够不着控制面"不能读成"部署已应用"。
  回执形状仍是平台那一条 `{ nodeId, revision, state }`，`state` 是 probe 自己的负载
  （`{ok:true, deployment}` / `{ok:false, error}`），不是第二套回执规则。
- **`stop()` 的告别必须送达才算干净**：够不着时 `stop()` **抛**，而不是悄悄返回——吞掉失败的 `stop`
  会为"仍被列在线上直到租约过期"的节点报告一次干净退出，而退出与记录不一致正是 withdraw 要防的那件事。
  记忆化到 promise：SIGINT 与 SIGTERM 同时来也只有**一次** withdraw。
- **`leaseTtlMs` 进了配置面**（`apps/agentd/src/effect-config.ts`）：租约 TTL 是运维策略不是常量，
  而且**不可设的 TTL 就是没人能看着它过期的租约**——验收测试靠它把 TTL 压到 300ms 看它真的过期。
- CLI：`bun run node:probe --url <base> --id <m> [--name] --capabilities a,b --namespaces a,b
  [--max-apps n] [--token] [--stage <dir>] [--interval]`，
  人类可读输出全走 stderr（stdout 留给协议）；SIGINT/SIGTERM 走 withdraw，干净退出 0，告别失败退出 1。
  `--namespaces` 与 `--capabilities` 都是启动门槛：**缺了就拒绝启动**，而不是让节点带着空声明上线，
  再用一连串拒绝去解释（§8.3）。
- 测试 22 条：`packages/agentd-probe/test/`（传输 5、单拍 7、循环策略 4、退出 2）+
  `apps/agentd/test/probe-acceptance.test.ts`（真 socket，2）+ `probe-refusal.test.ts`（反向，2）。
  九条反事实各自**只**杀掉自己的测试：`unreachable`→`refused`、`refused` 停摆、`lapsed` 重公告、
  `in-sync` 跳过、失败回执、plan 的 400 分类、`stale` 分类、`stop` 记忆化、`leaseTtlMs` 透传。
- **验收（真实控制面，不是模拟）**：`bun run app:host agentd --app-routes` 起真实控制面，
  `bun run node:probe` 起真实驻场程序——announce 后 `nodeLiveness` 在线 → 心跳续约（100ms 节拍 / 1200ms 租约，
  过了一整个租约仍在线，`lastSeen` 前进）→ 收到 `{ok:true, deployment}` 回执（放置为 `ops::board@1.0.0`）
  且 `at` 不再变 → 节拍拉到 60s（**真停摆**，不是测试钩子）后 300ms 租约过期：`online:false` 而
  `withdrawn:false`，机器记录、desired 集合、回执**逐字节不变** → `stop()` 后 `withdrawn:true`，
  机器记录与部署仍在（干净关机不是退役）。反向两条：真正没人监听的端口 → 一直打、`beats:0`、
  `stop()` 抛；错 token → 401，**只**试一次就停，且控制面侧该节点始终 `online:false`。
- **§8.5-5 的答复（回退还是前滚）：前滚。** 节点不在线期间期望态只会前进（它就存在控制面里，
  离线节点的 `desired` 照常可读、可回执），节点回来时拉到的是**当前** revision；`reported` 只用于
  "同一 revision 不重复做"，所以不存在"回来把旧版本又装回去"的路径。回退并没有消失——它是**运维动作**：
  把绑定改回 `bundleId@version` 旧版本，期望态前进一步，节点拉到新 revision 照常 apply。
  两者因此不冲突：**回退被表达成一次向前的期望态变更**，节点侧不需要第二套机制，
  也不会凭"上次装的是哪个版本"自行决定装什么。
- **仍未做**：CPU/内存配额与调度（§11-Q17；`namespaces` 与 app 数上限已落地）；跨进程送字节**已落地**（§8.2 末）；
  probe 只报"应用了哪个 revision"，不报"本机崩溃过、已回退到 previous"（P5 有信号
  `kernelBoot().fellBack` / `condemned`，还没进回执形状）；probe 进程自身由谁守护、拉起、重启
  （今天它是一个进程，机器侧的进程管理不在这里）。

## 9. 推送与回执（复用 agentd）

`agentd` 已经有"下发 + 回执"的骨架，正好是 bundle 推送要的形状：

| 现有 | 复用为 |
|---|---|
| Machine / Agent 注册 | 目标机器与 agent 实例 |
| `AgentBinding.revision` + `reportApplied` 的 **409 stale** | 升级回执的乐观并发（`agentd/src/control.ts:24`） |
| `AdapterPlan{agentId, revision, desired, changes}` | 升级计划的 diff 展示（`agentd/src/types.ts:8`） |
| `GatewayConfigAdapter` 生成 `{ mcpServers: { effectGateway: { url, headers: { "x-agent-id" } } }, metadata: { agentId, revision, sets } }` | 同形扩成制品面：**已落地**（P6）为 `BundleAgentConfig`（`agentd/src/bundles.ts`） |

**边界**（不要混）：
- board 只管任务；**工具调用**归 mcp-gateway（见 `docs/mcp-gateway-surface.md`）；
- **代码制品分发**归 agentd。三者不互相越界。

**节点级扩展**：§8.4 的 `DesiredNode` 是同一机制的上一层封装——推送单位从"一个 app"变成
"节点 × 期望 app 集合"，回执与 stale 判定不变。

**已落地（2026-09-10，P6）**——三条边界里 agentd 那一条真的通了：
- `packages/agentd/src/bundles.ts` —— `BundleRef`（`{ bundleId, version, abi, runtimes?, kind?, bootstrapAbi? }`）与
  `makeBundleArtifactAdapter()`（`kind: "effect-bundle"`），plan/apply/validate 与网关适配器同形。
- **裁决不是第二套规则**：`assessBundleForMachine` 把 app 路由到 `assessBundleCompat`、
  把内核路由到 `assessKernelCompat`（都是 `effect-bundle` 的实现），自己只做这一个分流。
  测试直接断言"推送端的判定 == 装载端的判定"。
- **机器能力**写在 `Machine.capabilities` 里（`abi:effect-1` / `bootstrap:bootstrap-1` / `runtime:os`）；
  缺省即回落到 SDK 自己的默认值，但**拼错的 `runtime:` 报错而不回落**——回落会让 OS 制品被推到浏览器机器上。
- **制品落到内核仓**：`kernelRevisionOf(bundle, revision, dir)` 让被推送的制品**直接**成为
  `KernelRevision`，也就是 `supervisor.stage()` / `EffectServer.stageKernel()` 的入参。中间没有转译层，
  所以推送端与装载端不可能各说各话。`revision` 由接收方给（收据的号 ≠ 仓的号，两台机器两个仓）。
- **版本共存即回滚**：绑定以 `bundleId@version` 命名，回退就是绑回旧版本——不需要第二套回滚机制。
- 服务面：`GET /agentd/plan?agent=<id>` 出计划，拒绝时用适配器自己抛的 400 与消息；
  MCP 工具 `agentd_publish_bundle` / `agentd_bind_bundles` / `agentd_plan_bundles`。
- 配置面：`bundles` + `bundleBindings` 两个种子字段，parse 期就拦住"把两条 ABI 线混在一起"的写法
  （内核缺 `bootstrapAbi`、app 带 `bootstrapAbi`）。
- **仍未做**：回执今天只报"应用了哪个 revision"，不报"这个内核在本机崩溃过、已回退到 previous"——后者 P5 已有信号
  （`kernelBoot().fellBack` / `condemned`），但还没进收据形状。

**已落地（2026-09-10，§8.2 / P6 字节传输）**——推送链最后一段空白补上了：节点能真的**拿到**制品。

- **字节从哪来**：`publishBundle(bundle, source?)` 多了第二个参数——一个**目录**，也就是
  `compileEffectBundle` 写出的那个（`<outDir>/<bundleId>.effect-bundle/`）。配置面在 bundle 上写 `source`
  即可（`seed.ts` 会把它从 `BundleRef` 里剥掉再发布：它是"发布这个动作的输入"，不是制品的一个字段）。
- **制品仓存的是引用，不是副本**（`packages/agentd/src/artifacts.ts`）。复制会凭空发明一套制品生命周期——
  第二处放同样字节的地方，以及一个没人问过的回收问题——去防一个**如实报告就够**的情况：源没了。
  引用过期是一个事实，悄悄变空的制品是谎话。符号链接**拒绝**而非跟随：节点拿的是这些字节，
  跟随一条链会把"发布这个目录"变成"发布这个路径能摸到的一切"。
- **摘要定义一次，两端共用**（`artifact-listing.ts` 的 `listingDigest`）。摘要是一份**契约**：
  两端算法不同，就会把机群上每一个制品都报成损坏，而那个 bug 看起来是机群级故障而不是编码器不一致。
  列表按路径排序后求摘要，所以答案与 `readdir` 顺序无关。
- **线上格式是 JSON + base64**（`artifact-wire.ts`）。Bun 1.3.4 运行时**没有** `Bun.Archive`
  （`bun-types` 里有，运行时是 `undefined`），所以 tar 意味着这个仓库自己实现一个 tar；一个编译过的制品是 KB 量级，
  诚实的交换是无聊的格式。`fromWire` 先逐文件校验 sha256、再校验整份列表的摘要，
  最后才返回字节——**半写好的制品比缺失的制品更糟**（装载端会去 import 它）。
- **它证明的是完整性，不是真实性**：字节就是列表描述的那些字节。"这份列表该不该信"是 `nodeToken` 的问题
  （§8.5-1），这里不重新回答。摘要在发布时记下、字节在读取时现读，所以**源在发布之后被改过**，
  会作为"加不起来的列表"出行，并被 `fromWire` 指名拒绝——这正是想要的失败。
- **一次版本一次内容由仓主裁决**（`bundle-registry.ts`）：重复发布 `bundleId@version` 一律 409
  （`bundle already published`），**不比较字节**——版本身份归仓所有，同一 id 的第二次发布就是同一个版本的第二个写者，
  而已经取过第一个的节点手里握着的是另一份。字节在注册表**接受之后**才记录，所以一次被拒的发布不会留下
  一个 agent 绑不上的目录。`ArtifactStore.publish` 因此**没有**重复分支：走不到的路不留代码。
- **凭证在校验面，不在路由面**：`artifact(bundleId, token?)` 与其它节点动词共用**同一个**
  `authorized(token)` 比较（`control.ts`），于是 `nodeLiveness()` 报告的是一道闸而不是两道可能各说各话的闸。
  读制品**不动 revision**：一次 fetch 改变的不是"该跑什么"，会动就会作废所有在途回执。
- **机器侧安装**（`packages/agentd-probe/src/stage.ts`）：`stagingApply({ root, control })`——先把整份部署
  全部取回并校验，**再**写任何一个目录。一份应用了一半的部署跑的是两个 build 的混合体，正是这条链路存在的理由；
  而"一个都没应用"留着上一版完好无损，外加一张指名原因的回执。每个制品写成 `<root>/<id>.effect-bundle/`。
- **写入是"先建旁边、再改名"**（`stage-write.ts`）：`<dir>.staging/` 建好再 rename 盖过去，读者看到的要么是旧制品、
  要么是新制品，不会是两者的并集。改名前的删除不是原子的，这是**较小的恶**——那个窗口留下的是"缺"（干净的"没装"），
  而合并出来的目录是一个没人构建过的 build。线上的路径是**远程输入**，落盘前逐段拒绝 `..`/绝对路径/空段：
  否则一条精心构造的列表项就能让控制面挑机器上哪个文件被覆盖。
- **`fromWire` 之后还校验"答的是不是我问的"**：响应自带的 id 与请求的 id 不一致即拒——
  否则字节会被归档到一个从未校验过摘要的 id 下。
- **probe 接上了**：`ProbeOptions.stage` = 安装根目录。缺省仍是 `declarativeApply`（只被告知该跑什么、不取字节）。
  由 probe 自己接线而不是让调用方传 `apply`：取字节要用的凭证和别的节点动词是同一个，而 probe 之外的调用方
  没有渠道把它交出去。真机 CLI：`bun run node:probe --stage <dir>`。
- 服务面：`GET /agentd/artifact?id=<bundleId@version>`，应答 `{ ok, artifact: { id, digest, files[] } }`；
  `status()` 增 `artifactIds`（有字节的版本——与"已发布"不是一回事）。
- 测试 28 条：`packages/agentd/test/artifacts.test.ts`（引用式制品仓 6）、`artifact-wire.test.ts`（逐字节往返与拒绝 6）、
  `artifact-control.test.ts`（发布/读回/凭证/不动 revision 5）、`packages/agentd-probe/test/stage.test.ts`（落盘 2）
  与 `stage-refusal.test.ts`（先校验后写入、路径越界、id 不符 3，夹具在 `artifact-fixture.ts`）、
  `apps/agentd/test/artifact-route.test.ts`（服务面 4）、
  `apps/agentd/test/probe-staging.test.ts`（真实控制面 + 真实 probe 2）。
  反事实：同时关掉三处闸门（`fromWire` 的两次摘要校验、`localOf` 的越界检查、`artifact()` 的凭证检查），
  **恰好**七条断言"被拒"的测试变红（wire 2、stage 2、probe-staging 1、artifact-route 1、artifact-control 1），
  其余 1064 条保持绿——三条闸门各自是新的，且没有一条老测试依赖它们。
- **验收**：`apps/agentd/test/probe-staging.test.ts` 起真控制面（bundle 带 `source` 目录）+ 真 probe（`stage` 指向空目录），
  probe 取回并落盘 `board@1.0.0.effect-bundle/entry.os.js`，回执带 `staged: [{ id, dir, digest, files }]`；
  同一个用例在控制面起来之后**原地改掉源文件**，回执变成
  `ok:false, error: artifact board@1.0.0 file entry.os.js does not match its digest (…)`，而根目录下**一个字节都没写**。
- **验收（真实控制面 + 真实 probe，两个进程）**：`bun run app:host agentd --port 8137 --app-routes --config @seed.json`
  起真控制面（bundle `board@1.0.0` 带 `source`，节点 `m1` 声明 `namespaces: ["ops"]`，绑定 `ops::board@1.0.0`），
  `bun run node:probe --url http://127.0.0.1:8137 --id m1 --namespaces ops --token … --stage <空目录>`
  → `applied revision 3: place ops::board@1.0.0`，`<空目录>/board@1.0.0.effect-bundle/`
  下真的出现 `entry.os.js` 与 `nested/extra.js`（字节与源目录逐字节一致）。
  再把**源目录原地改掉**（控制面启动时已读过列表）后重跑，每一拍都是
  `could not apply revision 3: artifact board@1.0.0 file entry.os.js does not match its digest (820a96… → ad3af2…)`，
  控制面上的回执是 `{ ok: false, error: … }`，而 `<空目录>` 里**一个文件都没有**——
  连先到且校验通过的内核那个目录也没有，因为整份部署是一次判定。
- **仍未做**：源目录的守卫（谁能写、什么时候能写）不在这一层——它是发布方的卫生问题，不是传输层的问题；
  回执不带"这个内核在本机崩溃过、已回退到 previous"（同上）；probe 进程自身由谁守护、拉起、重启。

## 10. 落地顺序

| 阶段 | 内容 | 验收 |
|---|---|---|
| ~~**P0**~~ ✅ | `abi` + `runtimes` 声明与 gate（两条 ABI 线 + runtime 维度） | 装声明不兼容 abi/runtime 的 bundle → 明确报错；现有 board bundle 行为不变 |
| ~~**P1**~~ ✅ | **盘点**（§6.3 / §7.2 的前提）：逐个 app 的 ambient 依赖（R5 已能查出）+ 内核切换后不可重建的态 + 需要的 runtime | 有清单；不可重建项要么迁进 store，要么明确标为已知限制 |
| ~~**P2**~~ ✅ | 操作集合统一枚举（含 host 特权面）+ **host/kernel 拆分**：把 `bootRuntime` 拆成 bootstrap（不变式）与内核制品 | 操作集合那一半**已达成**（`/-/operations` 列出 host + 全部 app，含 schema）；拆分的另一半在 P5 第二段补齐——`boot/runtime.ts` 现在只留不变式，内核成为 `src/kernel/` 的制品契约，`loadKernel()` 可从制品目录 `import()` 出**另一个**内核（P2-B 当时把"制品形态"押后，正是缺 supervisor 与请求保护，见 §6.1） |
| ~~**P3**~~ ✅ | **多 target 编译** + 运行时适配层（能力注入） | **已落地**：同一个 app 制品按声明的 `runtimes` 各出一份 entry，OS 宿主与浏览器宿主给同一组注入能力时**行为逐字节一致**；沙箱宿主报告的能力集**等于实际注入的那组**（空沙箱报空，不报"进程有所以它有"）；宿主给不齐 `requires` 声明的能力 → 在 import 之前拒绝并指名缺哪个。**未做**：真正的隔离沙箱（今天 entry 仍在宿主进程里跑）、真实浏览器页面宿主 |
| ~~**P4**~~ ✅ | **app 热换**：健康检查 + 单点切换（本地）+ per-app previous 指针 + `tools/list_changed` 通知（暂存槽按 §6.4 的偏离说明未采用） | 单个 app 换版本成功、其余 app 不中断；schema 破坏被裁决拦下或告警；已连接 agent 收到工具面变更通知；失败时旧版照常服务 |
| ~~**P5**~~ ✅ | **内核级双缓冲**切换 + active/previous 指针 + boot 崩溃回滚。先做 §6.3-① **兼容原地热换**，再做 ② 全量重建档 | ① **已落地并接进真实进程**：内核从制品目录 `import()` 装入、经 §5 两线裁决与槽位覆盖探针后翻转，旧内核 drain 完才停；app 零重建（测试断言 `load()` 全程只调用一次）。② **已落地**（2026-09-10，见下）：不兼容内核改为**重建 app 后装上**——`rebuild` 能力注入式，
  未注入则与从前逐字一致（拒换）。内核制品的**编译器**也已落地（2026-09-10，见下）：内核不再是"手写目录"，`bun run kernel:build` 就能打出装载器认的制品 |
| ~~**P6**~~ ✅ | agentd 推送内核与 app 制品 + 回执（远程，按机器，含 runtime 匹配） | **已落地**：推送走 `makeBundleArtifactAdapter`，机器能力从 `Machine.capabilities` 读，不匹配在 **plan 期**就被拒（复用 `effect-bundle` 的裁决，非第二套规则）；被推送的制品经 `kernelRevisionOf` 直接成为可 stage 的 `KernelRevision`；回执 revision 一致、stale 409。跨进程传输层**已落地**（§8.2 末：制品仓 + `GET /agentd/artifact` + probe 暂存） |

**P0 / P1 已落地（2026-09-10）**：
- `packages/effect-bundle/src/compat.ts` —— `EffectRuntimeKind`、`KERNEL_ABI`、`assessBundleCompat` /
  `assertBundleCompat` / `describeCompat`、`BundleIncompatibleError`。纯函数，可在 load **之前**算（§6.2 的 stage 要用）。
- `loadEffectBundle` 在 `import(entry)` **之前** gate：不兼容制品一行都不执行（测试证明 registry 保持空）。
- `manifest.runtimes` 缺省即 `["os"]` —— 保守默认，故现有 board bundle 行为不变；board 已显式声明 `["os"]`。
- `bun run inventory` 生成 `docs/app-portability-inventory.md`；`bun run check:inventory` 是 gate。
- 顺带把 `scripts/check-boundary.ts` 的扫描原语抽到 `scripts/lib/source-scan.ts`，两个脚本共用一套
  （抽取后边界检查输出不变：48 包 · 0 error · 0 warning），并修掉一个潜在漏网——`.test.tsx` 之前没被排除。
  （P4 新增 `packages/effect-compat` 后为 49 包 · 0 error · 0 warning。）

**P4 已落地（2026-09-10）**：
- `packages/effect-apps/src/registration/generations.ts` —— `makeAppSlot` / `readAppSurface` /
  `assessSurfaceChange`。流程 `install → 读回工具面 → 裁决 → 探针 → commit（退休旧世代）`，
  任一步失败 `restore` 回上一世代；`rollback()` 就是 `install()` 反过来（§5）。
- `packages/effect-mcp/src/node-server/tools.ts` —— `ToolSurface.refresh()` 对账 MCP 工具表并
  `sendToolListChanged()`；顺手修掉一个真实缺口：`registerTools` 原本在构建时快照 `registry.tools()`，
  热换后已连接的 agent 拿着过期清单。
- `packages/effect-compat` —— 把 §5 的裁决模型从 `packages/script` 抽成**零依赖**包
  （`assessChange` / `assessUpgrade` / `assessRollback`），`script` 改为转出，避免 app 层为了裁决
  去依赖 `isolated-vm` 原生模块。
- 偏离：app 级未做"暂存槽"，理由与代价（存在切换窗口）见 §6.4。

**P2 部分落地（2026-09-10）——只落了"操作集合"，内核制品押后**：
- `packages/effect-host/src/operations.ts` + `packages/effect-apps/src/operations.ts`：
  `/-/planes` 的四个操作从正则变成声明（`HOST_OPERATIONS`，带 input/output schema），
  再与每个 app 的 interface 工具合成一张 `NodeOperation` 表（`makeNodeOperationTable`）。
- `GET /-/operations` 把它服务出来（JSON-safe 投影，不含 `invoke`）。
- `packages/effect-bundle/src/kernel.ts`：`BOOTSTRAP_ABI`、`KernelDeclaration`、`assessKernelCompat`、
  `assessKernelAgainst`（换内核前先查全部已加载 app 的矩阵）。`bootRuntime` 在建状态前先 gate。
- **没做**：内核以**制品形态**加载、bootstrap 里不含内核逻辑。理由：没有 supervisor 就没有安全的翻转点，
  单独做只会造出 §6.3-① 禁止的窗口。整块交给 P5。

**P5 第一段已落地（2026-09-10）**：
- `packages/effect-bundle/src/repo.ts` —— `kernel-state.json`（active / previous / condemned），原子写。
- `packages/effect-bundle/src/supervisor.ts` —— `makeKernelSupervisor`：`stage` 走
  `§5 矩阵 → load → probe → 翻转 → persist → 停旧`，翻转失败翻回；`boot(shipped?)` 回退到 previous 并告警。
- 验收靠 12 条测试，断言的是不变量（旧内核在 commit 前绝不停止；被拒候选一行都不执行），
  不是"happy path 能跑"。
- **未做**：接进 `bootRuntime`（要 facade + 请求保护）、内核编译成制品。这就是 P5 的第二段。

**P5 第二段已落地（2026-09-10）——内核制品化 + 稳定 facade + 请求保护**：
- `packages/effect-host/src/dispatch-point.ts` —— §6.5-5 的请求保护：`activate` 是一次指针赋值，
  `run` 在**进入时**抓住当前目标并计数，`retire` 等它归零**并且拒绝退休当前在服务的目标**
  （"先翻转再停"从注释变成了会抛错的约束）。
- `apps/effect-server/src/kernel/` —— 内核成为可构造、可整体停止的单元：
  `types.ts` 声明 `KERNEL_PLANES`（槽位 id + priority 属于 **host 的数据**）、
  `index.ts` 是**制品契约**（`createKernel(context)`）、`planes.ts` 是随本仓库发布的实现、
  `load.ts` 负责"从 `revision.dir` `import()` 一个制品"与"每个槽位一个稳定 stand-in"。
- 接线（`boot/runtime.ts`）：`load(revision)` → 制品或本仓库内核；`activate` → `point.activate`；
  `probe` → **host 侧检查候选是否填满所有槽位** + 内核自查 `health()`；`dispose` → `retire` 完再 `dispose`。
  `supervisor.boot()` 在**所有 app 注册完之后**才跑（内核的 plane 是对着已知 app 装载的）。
- 崩溃回滚成了产品行为：`main.ts` 传 `kernelStateFile: .effect-bundles/kernel-state.json`；
  测试与嵌入式宿主不传，得到内存索引（没有哪次启动该依赖可写的 cwd）。
- 外面能推内核了：`EffectServer.stageKernel(revision)` 是 P6 的入口，`kernelBoot()` 报告回退结果。
- 验收（`apps/effect-server/test/kernel-swap.test.ts`，真起服务、真写制品目录、真 `import()`）：
  内核从临时目录装入并接管；**换内核时 app 的 `load()` 全程只被调用一次**（零重建）；
  翻转已提交、新请求已由新内核应答时，旧内核仍在回答它手上那条在途请求，之后才 `dispose`
  （测试断言 `dispose:hold` 出现在放行之后）；留给槽位的制品被拒且旧内核不动；坏 revision 记 `condemned`
  并在下次启动回退。
- ~~**仍未做**：内核制品仍得**手写目录**——P3 落地的是 **app** 的多 target 编译（`compileEffectBundle`），
  **内核制品编译器不在其中**；推送侧是 P6。~~ → **已补上（2026-09-10）**，见下面「内核制品编译器」一段。
- **② 档已补齐（2026-09-10，后续一次）**：不兼容内核不再只是拒换，改为「重建 app 后装上」。
  见 §6.3 的「档② 已落地」——supervisor 加了注入式 `rebuild` 能力，产品侧 `replay` 就是再跑一次 `bootManifests`。

**P5 第二段顺带修正了 §6.1 的一条**：见 §6.1 末尾的"实现逼出来的一次修正"。

**§6.3-② 已落地（2026-09-10）——K2 决策里最后没做的那一半**：
- `packages/effect-bundle/src/supervisor.ts`：新增注入能力 `AppRebuild { teardown, replay }` 与
  `stage()` 的 ② 分支。**注入了就重建，没注入就与从前逐字一致**（拒换）——能力而非默认。
- **只有 effect 线拒绝走重建**：bootstrap 线不符仍一律拒，因为重建 app 救不了一个本机跑不了的内核。
  测试专门锁这一条（注入 `rebuild` 后仍然拒，且 `teardown` 一次都没被调用）。
- **失败路径是承重的**：`adopt` / `activate` / `replay` 各自失败都回到 A 并重放 app；
  重放也失败则**明说节点需要重启**（`rebuild-failed` 事件带 `restored: boolean`），
  不报告一次看起来成功的回滚。§6.2 的不变式在 ② 里仍成立（A 在 commit 前绝不 dispose）。
- 产品侧（`apps/effect-server/src/boot/runtime.ts`）：`replay` 就是再跑一次 `bootManifests`，
  与 boot 共用同一条注册路径。
- 验收：`packages/effect-bundle/test/supervisor.test.ts` 新增 7 条（① 不受影响、② 的完整次序、
  bootstrap 线仍拒、三条失败路径、teardown 失败即归还）；
  `apps/effect-server/test/kernel-swap.test.ts` 新增 2 条产品级测试（真起服务、真 import 制品、真发请求），
  断言 app 层在翻转**之前**下线、并在成功后回到服务。
- **承重性验过**：把 `stage()` 里的 ② 分支改回拒换 → 5 条新单测立刻红；
  把产品侧的 `rebuild` 注入去掉 → 2 条产品测试立刻红。
- **未做**：窗口本身没有被缩短（§11-Q2）——§6.5-6 的第三种处置已在下一段落地，重建面缩小了，窗口长度没变。

**§6.5-6 第三种处置已落地（2026-09-10）——只挂起不兼容 app，能活的不陪跑**：
- `packages/effect-bundle/src/supervisor.ts`：`AppRebuild` 改成**子集寻址**且参数必需——
  `teardown(apps)` / `replay(apps)` 拿到的是矩阵点名的名字；`SupervisorOptions.apps()` 报**已加载**的声明。
  `KernelAppIncompatibility.app` 从 `BundleDeclaration.bundleId`（带版本，如
  `io.effect-agent.board@1.0.0`）改成 **app 层的名字**（`effect.bundle.json` 的 `appId`，即
  `effect.yaml` 的 `id`）——挂起是按 app 层的名字做的，两个名字混用就会挂错 app。
- `apps/effect-server/src/boot/app-layer.ts`（新）：挂起**保留槽位、只交出 disposer**，
  于是归还回到原位、`stop()` 仍按反序**装载**次序拆（不是上一次重建的追加次序）；
  归还走的是与 boot **同一条** `bootManifests`（按 `only` 收窄），不另开一条更薄的注册路径；
  归还没有把某个 app 放回去就抛错，不让一次重建报告一个不成立的"成功"。
- `apps/effect-server/src/load-manifest.ts`：`declarationOf(dir, appId)`，制品 `appId` 与 manifest `id`
  不一致即拒（`ships a bundle calling itself X, but its manifest calls it Y`）。
- **今天真正被救下的是"没做声明"的 app**：矩阵只点名带 `effect.bundle.json` 的 app，其余在 ② 里
  本来会被一起拆掉——这正是本单元消掉的误伤。精确匹配 ABI + "有已加载的坏 app 就拒 boot"意味着
  "声明了但跟不上"的子集今天不可达，所以端到端就用这条真实的轴来证。
- 验收：`apps/effect-server/test/kernel-suspend.test.ts`（真起服务、真换内核：换线成功与失败两条路径下，
  声明过的 app 是 `load→stop→load`，没声明的 app 只有一次 `load`，全程在服务）；
  `apps/effect-server/test/app-layer.test.ts` 5 条（挂起保位、未知名字忽略、归还原位、
  归还丢 app 会说话、归还到从未有过的槽位也会说话）；
  `packages/effect-bundle/test/supervisor.test.ts` 与 `kernel.test.ts` 改名为子集断言。
- **承重性验过**（每轮都恰好只红它自己那几条）：A 挂起忽略子集 + 归还全量 → 4 红；
  B 归还改成追加而非入位 → 1 红；C 去掉"归还丢 app"的判定 → 2 红；
  D 去掉 `declarationOf` 的 `appId` 判定 → 恰好 1 红（那条名字不一致的测试）。

**内核制品编译器已落地（2026-09-10）——补上 P3 → P5 → P6 链条里唯一缺的一环**：
- 这条链此前每一环都在：P3 能把 **app** 编成制品（`compileEffectBundle`）、P5-2 能从 `revision.dir`
  `import()` 内核制品（`kernel/load.ts`）、P6 能把字节推到节点。**唯独没有东西能"造出"一个内核制品**——
  stage 一个内核得手写一个导出 `createKernel` 的 `kernel.js`，所以"推内核"在生产上不可执行。
- `packages/effect-bundle/src/kernel-manifest.ts`：`KERNEL_ENTRY`（`kernel.js`）、`KERNEL_MANIFEST`
  （`kernel.bundle.json`）、`KernelBundleManifest`、`readKernelManifest`。内核**不**带 `effect.bundle.json`
  ——那个形状说的是 `appId` / `namespace` / `transport`，内核一个都没有；内核有的是两条 ABI 线。
  两条线缺一条就不是"有默认值的内核"，而是**没人能裁决的制品**，所以在**读 manifest 时**就拒，
  而不是等到目标机上换到一半才发现。
- `packages/effect-bundle/src/compile-kernel.ts`：`compileKernelRevision({ kernelDir, outDir })` ——
  一次 `bun build`（`--target bun`），产物 `<bundleId>.effect-bundle/kernel.js` + 一份写回
  **编译后** entry 的 `kernel.bundle.json`。形状与 app 编译器同形，没有第二套制品格式。
- `packages/effect-bundle/src/externals.ts`：两种制品共用同一组 external（`@effect-agent/*` / `zod` /
  `react` / `react-dom`）。**这不是为了整齐，是必须**：把 ABI 打进去，内核就会在自己那份
  `@effect-agent/effect-host` 副本上注册 plane，而那份副本不是宿主的分发点——内核会"跑起来"却不真的接在宿主上。
  代价如实记下：制品只能在宿主能解析这些包的地方装载，也就是**装进宿主的模块图里**，不能扔到任意目录。
- 本仓库的内核现在真的能被打出来：`apps/effect-server/src/kernel/kernel.bundle.json` 是它的声明，
  `bun run kernel:build [outDir]`（`scripts/build-kernel.ts`）产出 `.effect-bundles/` 下的制品目录——
  与运行时的 `kernel-state.json` 同一个根，`KernelRevision.dir` 指向的就是它。
- 验收：`packages/effect-bundle/test/compile-kernel.test.ts` 3 条（产物就是装载器 import 的那个目录、
  缺 `bootstrapAbi` 在**编译期**拒且一个字节都不写、坏入口报 `kernel build failed`）；
  `apps/effect-server/test/kernel-artifact.test.ts` 3 条（本仓库内核的 manifest 与 `KERNEL` 是**同一个内核**的
  两种说法、本仓库内核真的能被编译成装载器认的目录、**编译出来的制品真的充当一次内核 revision**
  ——真起服务、真翻转、`/-/config` 被编译出的字节应答）。
- **承重性验过**（每轮只红它自己那几条）：A 产物 manifest 写回源 entry 而非 `KERNEL_ENTRY` → 2 红；
  B 吞掉 `bun build` 的失败 → 1 红；C 给缺失的 `bootstrapAbi` 补一个默认值 → 1 红。
- **不在范围**：§11-Q2 的制品粒度（整块 vs 可拆）；内核多 target（内核只声明 `os`）；运行态交接（§11-Q18）。

**P6 已落地（2026-09-10）——制品分发接上装载端**：
- `packages/agentd/src/bundles.ts` —— `BundleRef` / `MachineCapability` / `assessBundleForMachine` /
  `kernelRevisionOf` / `makeBundleArtifactAdapter`。`publishBundle` + `bindBundles` 进控制面，
  绑定以 `bundleId@version` 命名，于是**回滚就是绑回旧版本**（仓里本来就并存 `board@0.13.0` 与 `board@1.0.0`）。
- 拒绝发生在**计划期**：适配器 `plan()` 对照 `Machine.capabilities` 裁决每个制品，不合格直接 400，
  一个字节都不下发。判据来自 `effect-bundle` 的 `assessBundleCompat` / `assessKernelCompat`，
  测试断言推送端与装载端的判定**逐字段相等**。
- 两条 ABI 线不混：`publishBundle`、适配器 validate、`effect-config` 的 superRefine 三处都拦
  "内核缺 `bootstrapAbi`"与"app 带 `bootstrapAbi`"。
- 落地路径：`kernelRevisionOf(pushed, revision, dir)` → `KernelRevision` → `stageKernel()`。
  测试用真 supervisor 证明推送来的制品能被接受、翻转、并把前一个记成 `previous`。
- 服务面：`GET /agentd/plan?agent=<id>`；MCP 工具 `agentd_publish_bundle` / `agentd_bind_bundles` /
  `agentd_plan_bundles`；配置种子 `bundles` + `bundleBindings`。
- 验收（`packages/agentd/test/bundles.test.ts` 14 条 + `apps/agentd/test/agentd-app.test.ts` 3 条）：
  推送内核 + app → 回执 revision 一致；runtime 不匹配、effect 线不匹配、bootstrap 线不匹配各自被拒且
  指名道姓；stale 回执 409；绑定旧版本回退无新机制；机器不声明能力时用 SDK 缺省；`runtime:` 拼错报错；
  推送端的判定 == 装载端的判定。
- **仍未做**：收据不带"本机崩溃回退过"的信号；
  这三点里"节点级封装"已由下面的 §8.4 补上，"不兼容内核 → 全节点重建"已由 §6.3-② 补上。

**§8.4 已落地（2026-09-10）——部署单位从"一个 app"变成"节点 × app 集合"**：
- `packages/agentd/src/nodes.ts` —— `makeNodeArtifactAdapter()`（`kind: "effect-node"`）+
  `DesiredNode` / `NodeAppPlacement` / `ResolvedNodeApp`（`types.ts`）。plan / apply / validate 与
  `bundles.ts` 的适配器同形，`metadata: { nodeId, revision }` 沿用同一字段名，于是**回执仍只有一条 409 规则**。
- **裁决没被复制**：`assessBundleForMachine` 原样调用，本文件只加"逐项迭代 + 给失败贴地址"。
- **放置是解析出来的，不是记下来的**：`bindNode` 拿 `bundleId@version` 去 registry 查，拼出 `ResolvedNodeApp`。
  这是实现期的一处修正——放置若重述 `abi`/`runtimes`，它就能与所放置的制品相矛盾，制品自己的声明也就不再可强制。
- **顺手修了一个真 bug**：`JSON.stringify` 键序敏感，`artifactOf` 与 `validateBundleArtifact` 构造同对象的键序不同，
  于是每次 plan 都吐一条幻影 `update`。抽出 `packages/agentd/src/stable.ts` 递归排序后比较，P6 的 `bundles.ts` 一并受益。
- 服务面：`GET /agentd/node`、`GET /agentd/node/plan`、`POST /agentd/node/report`；MCP 工具
  `agentd_bind_node` / `agentd_desired_node` / `agentd_plan_node` / `agentd_report_node_applied`；配置种子 `nodeBindings`。
- 验收（`packages/agentd/test/nodes.test.ts` 7 条 + `apps/agentd/test/node-bindings.test.ts` 4 条）：
  一份计划覆盖内核 + N 个 app、一份回执；同一制品两个 ns 是两个放置、同一地址两次被拒；
  拒绝消息**指名是哪个放置落在哪台机器**；内核槽与 app 槽互不通用；stale 回执 409；回滚 = 改绑定。

**P3 已落地（2026-09-10）——能力注入成了可执行的东西，不只是条文**：
- `packages/effect-bundle/src/capabilities.ts` —— 词表与判定（`CAPABILITY_NAMES` /
  `capabilitiesOf` / `describeCapabilities` / `requireCapability` / `capabilityGaps`）。
- `packages/effect-bundle/src/runtime.ts` —— 构造器：`ambientCapabilities(runtime, overrides)` 与
  `sandboxCapabilities(injected)`。**两个而非三个**：os 与浏览器差在"能提供什么"，不差在 seam 怎么搭。
- `load.ts` 的 `assertCapabilityCompat` 紧挨 `assertBundleCompat` —— 拒绝 gate **只有一处**，
  与 §5 的 abi/runtime 同址；`requires` 是 app 自己的声明，宿主猜出来的需求不算需求。
- `compile.ts` 按 manifest 的 `runtimes` 各出一份 `entry.<runtime>.js` 并与 `entry` 一起写进制品；
  **旧制品没有 `entries` 也照旧加载**（回落 `entry`），所以这不是一次破坏性变更。
- 依赖方向被刻意摆正：判定归 `capabilities.ts`（它必须在 import 前就拒绝），构造器归 `runtime.ts`，
  loader 只 import 前者——否则 loader 就得依赖运行时实现才能做门禁。
- 验收（`packages/effect-bundle/test/runtime-portability.test.ts`，fixture `fixtures/app-portable`）：
  同一制品在 os 宿主与 browser 宿主下 `stamp()` 结果**逐字段相等**（注入确定性时钟/密码学，
  所以"行为一致"不是"都跑起来了"）；空沙箱 `capabilitiesOf` 为 `[]` 而非"进程有什么就有什么"；
  宿主给不齐 `requires` → 报 `requires [clock, crypto] but this host is sandbox: [storage]`，
  **且报的是 gate 的错、不是 entry 自己那句"no clock was injected"**
  （把 gate 注掉重跑，测试确实红——这条断言验过是承重的，不是装饰）；browser/sandbox 产物里
  `node:` 无残留。
- **未做，且要说清楚**：entry 今天仍在**宿主进程里**跑——"沙箱"是**能力上的**，不是**隔离上的**；
  浏览器档也只是"一个带浏览器能力集的宿主"，**没有真实页面**跑过（§7.5-5/6）。

**配置存储的拒绝要可执行（2026-09-10）——`bun run up` 真的被一条陈旧记录挡住了**：
- 现象：`.effect-agent/config-v2.sqlite` 里 mantis 那行还是重构前的形状（`webPort/host/configFile/approvals`），
  `validateStored` 依约拒绝（**存量就是权威，不规范化、不重写**），于是启动整体失败。这本身是对的，
  错的是**拒绝之后没有出路**：消息只说"operator must rebuild the config store"，既不说**哪个文件**，
  也不说**怎么做**，而且当时 `ConfigStore`/`ConfigRegistry` 根本没有"丢记录"这个操作——
  运维唯一能想到的做法是删库，而库里还有另外 7 个 app 的记录（board 是 `override`、ui-host 是 `yaml`，
  删掉就是**真丢数据**）。
- `ConfigStore.remove(appId)`（`sqlite.ts` 落到 `DELETE FROM app_config WHERE appId = ?`）——
  **只针对被点名的 app**。不做 `ConfigRegistry.rebuild(appId, layers)`：丢记录**不等于**重建，
  重建要靠**当前 schema + 调用方给的层**重新播种，而 yaml 层（effect.yaml 的 `config:`）**不在库里**，
  在这里播种只会得到一个"验证通过但不是运维那份"的配置。所以命令**只丢不播**，播种留给下一次 `initialize`。
- 拒绝要能被分辨：`ConfigFailureReason = "rebuild-required"` 进 `ConfigOutcome.reason`，
  经 registry 的错误边界原样穿过（`storageFailure`）。**不能靠字符串匹配猜**——
  哪些失败该附操作指引、哪些不该，是类型说的，不是文案说的。
- `apps/effect-server/src/config-runtime/runtime.ts` 组合出的消息含 app / 文件 / **确切命令**：
  `Invalid config for mantis: … — store: .effect-agent/config-v2.sqlite; rebuild it with: bun run config:rebuild mantis`。
  存储文件名只在 `config-runtime/config-file.ts` 里写一次（启动与命令必须指同一个文件）。
- `scripts/rebuild-config.ts`（`bun run config:rebuild <appId...>`）：只丢被点名的记录，
  逐条报告"record dropped / no record"，**不自动播种**，也不是启动路径的一部分——
  重建永远是运维的显式动作。
- 验收：`packages/effect-config/test/rebuild.test.ts` 5 条（拒绝被标成可重建**且记录原封不动**、
  非重建失败**不带**这个标记、丢一个不动别人、下次 `initialize` 按当前 schema+yaml 层重播种到 revision 1、
  丢不存在的记录是空操作）＋ `record-rejection.test.ts` 补上"reason 穿过错误边界"（3 条路径 × 7 种坏行）
  ＋ `apps/effect-server/test/config-rebuild.test.ts` 2 条（消息含文件与命令；**真跑一次 CLI**，
  断言 board 那行逐字段不变、之后启动成功且 yaml 层回到 `sources`）。
- **四条反证**（各自只杀自己那条）：① 去掉 `storageFailure` 的 reason → 7 条红；② 去掉 `validateStored`
  的 reason → 恰好 2 条红；③ `deleteRecord` 改成删整张表 → 4 条红（含产品侧 CLI 那条）；
  ④ 让 CLI 顺手播一次 schema 默认值 → CLI 那条红（yaml 层真的被吃掉）。
- 真机验证：对仓库里那份真实 store 跑 `bun run up` → 得到带文件与命令的拒绝 → 照做 → **启动成功**
  （mantis 与 agentd 重播种到 revision 1，board 仍 rev 2 原样）。
- **如实记账的代价**：启动是**遇到第一个陈旧记录就失败**，所以多个 app 一起陈旧时要一条一条来
  （这次是 2 条）——"一次列出所有需要重建的 app"是没做的那一步。

**应用独立性（2026-09-10）——不依赖其他 app 的 app 能单独 host，默认只开 MCP 面**：

- 改动前的事实：`requires` 声明在**两处**（descriptor 与 effect.yaml manifest）却**没有一行代码读它**；
  唯一真实的依赖边（gateway → mcp-registry）是 `boot/runtime.ts` 一行硬编码满足的。于是
  "这个 app 不依赖其他 app"是一句没人验证的话，而"单独 host 一个 app"根本没有入口——
  只有 bespoke 的 stdio `main.ts` 与测试代码。
- 新包 `packages/effect-standalone`：
  - `registerStandaloneApp(app, { config })` = `makePluginHost()`（**不**传 `control: true`）
    + `makeEffectRegistry()` + 内存 config store + `registerEffectApp`。kernel / listeners /
    config-runtime / console / `/-/planes` **都是组成根独有的**，这里没有——是"构造上不存在"，
    不是"忘了挂"。共享 MCP Registry **无条件注入**（与组成根一致）：它是**宿主上下文对象，不是 app**。
  - `dependencyGaps(app, [app.id])`（`src/dependencies.ts`）= 声明与"这个宿主真的 host 了什么"的差集；
    非空 → **在开端口之前**抛 `dependencyError`，消息指名缺谁。与 effect-bundle 的 `capabilityGaps`
    （clock/storage/crypto/network）同一个形状，只是轴不同：app↔app vs 运行时能力。
  - `startStandaloneApp`（streamable HTTP）与 `startStandaloneStdio`（stdio，不开端口）。
    **默认面是可枚举的**：`surface` 是返回值的一部分并被测试断言。app 声明的 `routes`/`path`
    仍注册在 plugin host 上，但不经过这个面就不达——"只开 MCP"是**这个 face 的性质**，
    `appRoutes: true` 才把 app 自己的面加进来；控制面始终不开。
- 声明只留一处：`requires` 从 `EffectManifest` 与 8 个 app 的 effect.yaml 里**删掉**，
  写进 `apps/mcp-gateway-app/src/effect-app.ts` 的 descriptor。descriptor 是 loader 真正读的
  authoring 契约；那处没人读的声明正是这次要消灭的"纯写入型元数据"。组成根那行硬编码**保留**（已加注），
  因为把它数据化要在 enable 之前 import 所有 descriptor，会改 boot 的形状——如实记为未做。
- 入口：`bun run app:host <appId> [--port n] [--app-routes] [--stdio] [--config <json|@file>]`
  （`scripts/host-app.ts`；清单读取在 `scripts/lib/app-manifest.ts`，`import.meta.dir` 改了层级）。
  app 由 `apps/<id>/effect.yaml` 的 **`id`** 指定（目录名 ≠ id：`mcp-gateway-app` → `mcp-gateway`），
  config 层取该文件的 `config:`；人类可读输出全走 stderr（`--stdio` 时 stdout 是协议）。
  **`--config` 不发明第二套层语义**：它就是 effect-config 自己的 `override` 层
  （`default < yaml < override`），**逐键合并在 yaml 之上、不替换它**；不传就是今天的行为，逐字节一致。
  它存在的理由是：单独 host 的用途就是"把某个 app 跑起来看看"，而 board 的 yaml 指的正是**真实**的
  `.effect-agent/board.sqlite`（2026-09-10 踩到过一次，写进去两条垃圾任务）。启动时把每个 config 键来自
  哪一层打到 stderr（`dataFile from yaml` / `dataFile from override`）——**只报层、不打印值**，因为 config
  里可能有凭据；`@file` 相对**当前工作目录**解析，读不到就拒绝启动。
  **边界 R4/R5 的正面交代**：新入口是 `scripts/`（不在扫描范围）与 `packages/effect-standalone`
  （R4/R5 只对 `pkg.kind === "app"` 生效），**没有往 `ioExemptApps` 加任何名字**；
  端口按仓库约定由**宿主**开、app 不开端口，生命周期对称注销。
- 验收（真跑，真 socket）：
  - `apps/board/test/standalone-host.test.ts`：board 真起来 → **真 MCP 客户端**
    （SDK 的 `Client` + `StreamableHTTPClientTransport`）连真端口 → listTools 含 board_state →
    board_create 落进该 store（`counts.todo === 1`）→ 同一端口上 `/board` 与 `/-/planes` 都是 404；
    `stop()` 之后**同端口能重新 bind**（端口真的被释放）；另有一条 override 用例：
    `config` 指向 manifest 的文件、`override` 把它挪到别处 → app 打开的是**挪到的那个**，
    manifest 指的那个**始终不存在**。
  - `apps/mcp-gateway-app/test/standalone-refusal.test.ts`：仓库里唯一真实的依赖边——
    gateway 单独启动**失败**，消息里同时有 `mcp-gateway` 与 `mcp-registry`。
  - `packages/effect-standalone/test/`：面清单、`appRoutes` 打开 app 面但仍不开控制面、
    拒绝**先于开端口**（fake listener 断言 bind 次数为 0）、stdio 面（真 MCP 客户端走 in-memory transport）、
    共享 registry 被注入（fixture 的 plugin 读 `context.mcpRegistry` 并把它报回来）；
    `override.test.ts`：override 逐键压过 yaml 且 `sources` 记为 `override`、空 override 不抹掉下层、
    没有层时值来自 schema 且 `sources` 记为 `default`。
  - `apps/board/test/host-cli.test.ts`：真进程跑 `bun scripts/host-app.ts board`（scratch cwd，真 SIGINT，
    因为 manifest 里的数据文件是**相对路径**，cwd 才决定哪个文件才是"真的"）——带 `--config` 时
    manifest 指的 `.effect-agent/board.sqlite` **没有被创建**、override 指的文件被创建、stderr 报
    `from override`；不带时反过来（`from yaml` + manifest 文件被创建），两端互为反事实。
    另两条：`@absent.yaml` 与 `--config '[1,2]'` 都在**托管之前**退出 1（后者用的是 config registry
    自己的"layers must be objects"，不是 host 另立的规则）。
  - 组成根零回归：用**真实 root effect.yaml** 在临时端口 + 临时 config store 起 composition root →
    `/-/status` 200、`/-/operations` 200、`/board/` 200、控制面 404，启用集含 gateway 时
    registry 闭包仍然成立（插件没抛"requires the shared MCP registry"）。
- **五条反证**（各自只杀自己那条）：① 注掉依赖 gate → 恰好两条拒绝用例红；② face 无视 `appRoutes`
  全放行 → 默认面那条红；③ 非 MCP 路径永远 404 → `appRoutes` 那条红；④ 不注入共享 registry →
  注入那条红；⑤ 去掉 `stop()` 自建的 `closed` 标志 → **全绿**，证明那层守卫是多余的
  （`asyncDisposer` 已记忆化、sqlite store 二次 `close()` 直接返回）——于是**删掉它**，
  而不是留着当装饰。
- **如实记账的代价 / 未做**：① 这里**不开 egress router**，所以声明了 `egress` 且真的发请求的 app
  单独 host 时 `context.fetch` 会拒绝（board 不发请求，所以它单独跑没问题）；
  ② 没有 config 面，所以"单独 host 一个 app 并改它的配置"今天做不到，config 层只能来自
  effect.yaml 或调用方（`--config` 走的是 config registry 的 **override** 层，不是 config 面）；
  ③ 组成根的依赖闭包仍是硬编码那一行；④ 跨进程分发制品、§8.3 的 CPU/内存配额与调度
  仍不在本次范围（§8.3 的 `namespaces` 与 app 数上限已落地）；驻场 probe 已落地，见 §8.5-1。

P0 是纯增量。**P4（app 热换）与 P5（内核热换）是两个独立目标**，但共用同一套原语——
先做 P4，顺便把 P5 需要的料备齐；P5 之前不引入内核热换。
P3 与 P4/P5 互不依赖（一个是可移植性，一个是切换机制），但都建立在 P1 的盘点结论上。

## 11. 待定（需要拍板）

1. ~~内核热更新粒度~~ → **已定 K2**（§6）。
2. **内核制品的粒度**：整块内核一个 bundle，还是可拆多块（路由 / config / UI / MCP 面各自可换）？
   拆得越细切换窗口越小，但兼容矩阵与一致性越难维护。
3. **切换窗口的请求语义**：排队（超时多久）还是落回 A（可能读到半新半旧）？
4. **bootstrap 的边界**：§6.1 那四项够不够——"路由**表内容**"算内核、"分发**点**"算 host，
   这条线要不要再往下压（listener 是否也归内核）？
5. **abi 不匹配策略**：拒绝加载，还是隔离运行 + 告警？（"拒换内核"与"只挂起不兼容 app"是两种粒度）
   —— 第二种粒度**已实现（2026-09-10，§6.5-6 第三种处置）**；"加载时就隔离运行"仍未决，今天的失配
   只在切换时处置，不在装载时。
6. **兼容判定**：只看 abi major，还是同时校验 kernel semver range？
7. **回滚点保留**：只留 1 个 previous，还是 N 个（磁盘 vs 可回滚性）？
8. **host 特权面模型化**：host 节点要不要也写 descriptor（现在是散落的 `/-/planes/*` control 路由）？
   *半答（P2-A）*：已经不是散落的了——`HOST_OPERATIONS` 把四条声明成数据并进了节点操作表。
   还没定的是**要不要再往前一步**：给它一个和 app 同形的 descriptor（带 lifecycle 特权面），
   让 host 也走 `registerEffectApp` 那条路，而不是一张只有四条的表。
9. **namespace 与版本**：同名 app 多版本共存时，ns 是否要带版本（影响 §4 寻址）。
10. **沙箱档的定位**：app 跑在沙箱里是"完整 app 的等价物"还是"能力降级的 app"（哪些操作必须缺席）？
11. **浏览器档的双向通道**：host→app push 在浏览器里走什么（`effect-bundle-mesh.md` §5 留的 WS 常驻）？
12. **存储后端优先级**：先做 IndexedDB，还是先做"沙箱/浏览器存储代理回 home"？
13. **runtime 不匹配的粒度**：拒装整个 app，还是只禁用其在该运行时不可用的那部分操作？
14. **app 热换的触发者**：只由 host 推送（§8）驱动，还是 app 作者也能自行触发（本地开发热重载）？
15. **两版本共存窗口的长度**：drain 有没有上限（超时后强制切断旧版本？），以及窗口内的请求是否允许跨版本。
16. **"兼容内核"由谁判定**：只看 `abi`，还是还要看**内核自有运行态的结构版本**（manifest 里得加一个内核态 schema 版本）？
17. **节点资源**：节点是否声明配额（app 数上限、CPU/内存），以及要不要**调度**（决定某个 app 放哪个节点）？
    —— **已答一半（2026-09-10）**：加的是 **app 数上限**（`Machine.maxApps`，可选；
    缺席读作"声明了没有上限"而不是 0，平台不替节点编数字），并在节点计划处作为准入执行（见 §8.3）。
    **CPU/内存配额没有加**：它们需要节点上报可用量、需要一个计量口径，而今天两边都不存在，
    加一个没人填的数字字段只会让"声明"变成装饰。**调度同样没加**：放置今天由 `nodeBindings` 写死，
    是运维的选择；等真的出现"多节点、同一 app 该落哪台"的问题时再引入，而不是先立一个调度器去找它的用途。
18. **内核运行态怎么交接**（§6.3-①）：plugin registry / route table / config runtime 的内存态是
    序列化交给新内核，还是新内核从 store 自行重建？ 

## 12. 与既有文档的关系

```text
本文（主线）：声明层 → 内核 → 操作集合 → 运行时可移植性 → 生命周期(升级/回滚)
   ├─ layers.md                     包分层（L0-L5，代数层）
   ├─ effect-unified-on-mcp.md      app=MCP server、四 plane 的 MCP 投影
   ├─ effect-planes-permissions.md  plane 寻址 + 权限（§4 的词表、§7 的存储代理）
   ├─ effect-bundle-mesh.md         制品形态、回注册、mesh、浏览器宿主先例（§6/§7 的制品基础）
   ├─ script-sandbox.md             沙箱执行 + 内容寻址版本 + 分级兼容裁决 + 回滚（§5/§7 的现成先例）
   ├─ platform-network.md           端口/路由/出口 + agentd/mcpset（§8 的分发基础）
   └─ mcp-gateway-surface.md        工具面统一入口（agent 侧只有一个 /mcp-gateway）
```
