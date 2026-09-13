# App 可移植性盘点

> **本文件由 `bun scripts/inventory-apps.ts` 生成，请勿手改。**
> 依据：`docs/architecture-rework.md` §7（运行时可移植性）与 §10 的 P1。
>
> 本盘点**刻意忽略** `effect.boundary.json` 的豁免名单：豁免是「允许这么写」的授权，
> 不是「能离开 OS 宿主」的证据。边界检查管的是政策，这里报告的是事实。

## 总览

共 11 个 app：**6 个**有 ambient 依赖（今天只能跑 os），**5 个**代码上未触及系统 API。

| app | 包名 | runtime 下限 | abi | ambient IO | node/bun 内建 |
|---|---|---|---|---|---|
| `agentd` | `@effect-agent/agentd-app` | 未声明 · 待实测 | —（无制品） | — | — |
| `ai-gateway` | `@effect-agent/ai-gateway-app` | `os`（有 ambient 依赖） | —（无制品） | 2 | — |
| `board` | `app-board` | declared: `os` | `effect-1` | 2 | 8 |
| `deckconsole` | `deckconsole` | `os`（有 ambient 依赖） | —（无制品） | 3 | 3 |
| `effect-server` | `@effect-agent/effect-server` | `os`（有 ambient 依赖） | —（无制品） | 8 | 12 |
| `herdr-app` | `@effect-agent/herdr-app` | 未声明 · 待实测 | —（无制品） | — | — |
| `mantis` | `app-mantis` | `os`（有 ambient 依赖） | —（无制品） | 10 | 15 |
| `mcp-gateway-app` | `@effect-agent/mcp-gateway-app` | 未声明 · 待实测 | —（无制品） | — | — |
| `mcp-registry-app` | `@effect-agent/mcp-registry-app` | 未声明 · 待实测 | —（无制品） | — | — |
| `playground` | `app-playground` | 未声明 · 待实测 | —（无制品） | — | — |
| `ui-host` | `app-ui-host` | `os`（有 ambient 依赖） | —（无制品） | 3 | 6 |

## 明细

### apps/ai-gateway — `@effect-agent/ai-gateway-app`

| 文件 | 事实 |
|---|---|
| `apps/ai-gateway/src/main.ts` | ambient：process/env — `process.env` |
| `apps/ai-gateway/src/standalone.ts` | ambient：Bun.serve/spawn/file — `Bun.serve(` |

### apps/board — `app-board`

| 文件 | 事实 |
|---|---|
| `apps/board/src/hosts/mcp/main.ts` | ambient：process/env — `process.env` |
| `apps/board/src/hosts/web/main.ts` | ambient：Bun.serve/spawn/file — `Bun.serve(` |
| `apps/board/src/docs/store.ts` | 内建：`bun:sqlite` |
| `apps/board/src/hosts/web/assets.ts` | 内建：`node:fs` |
| `apps/board/src/runs/store.ts` | 内建：`bun:sqlite` |
| `apps/board/src/storage/clean.ts` | 内建：`node:fs` |
| `apps/board/src/storage/database.ts` | 内建：`bun:sqlite` |
| `apps/board/src/storage/database.ts` | 内建：`node:fs` |
| `apps/board/src/storage/database.ts` | 内建：`node:path` |
| `apps/board/src/storage/store.ts` | 内建：`bun:sqlite` |

### apps/deckconsole — `deckconsole`

| 文件 | 事实 |
|---|---|
| `apps/deckconsole/src/http/assets.ts` | ambient：Bun.serve/spawn/file — `Bun.file(` |
| `apps/deckconsole/src/main.ts` | ambient：process/env — `process.env` |
| `apps/deckconsole/src/standalone.ts` | ambient：Bun.serve/spawn/file — `Bun.serve(` |
| `apps/deckconsole/src/domain/launchers.ts` | 内建：`bun:sqlite` |
| `apps/deckconsole/src/domain/launchers.ts` | 内建：`node:fs` |
| `apps/deckconsole/src/domain/launchers.ts` | 内建：`node:path` |

### apps/effect-server — `@effect-agent/effect-server`

| 文件 | 事实 |
|---|---|
| `apps/effect-server/src/boot/runtime.ts` | ambient：process/env — `process.env` |
| `apps/effect-server/src/client/console-activity.ts` | ambient：network fetch — `fetch(` |
| `apps/effect-server/src/client/console-boot.ts` | ambient：network fetch — `fetch(` |
| `apps/effect-server/src/client/console-views.tsx` | ambient：network fetch — `fetch(` |
| `apps/effect-server/src/client/inspector-call.ts` | ambient：network fetch — `fetch(` |
| `apps/effect-server/src/config-runtime/config-file.ts` | ambient：process/env — `process.env` |
| `apps/effect-server/src/main.ts` | ambient：process/env — `process.env` |
| `apps/effect-server/src/up.ts` | ambient：process/env — `process.env` |
| `apps/effect-server/src/console-plugin.ts` | 内建：`node:fs` |
| `apps/effect-server/src/kernel/load.ts` | 内建：`node:path` |
| `apps/effect-server/src/kernel/load.ts` | 内建：`node:url` |
| `apps/effect-server/src/load-manifest.ts` | 内建：`node:fs` |
| `apps/effect-server/src/load-manifest.ts` | 内建：`node:path` |
| `apps/effect-server/src/main.ts` | 内建：`node:fs` |
| `apps/effect-server/src/main.ts` | 内建：`node:path` |
| `apps/effect-server/src/manifest-loader/inproc.ts` | 内建：`node:path` |
| `apps/effect-server/src/up.ts` | 内建：`node:fs` |
| `apps/effect-server/src/up.ts` | 内建：`node:path` |
| `apps/effect-server/src/yaml-manifest.ts` | 内建：`node:fs` |
| `apps/effect-server/src/yaml-manifest.ts` | 内建：`node:path` |

### apps/mantis — `app-mantis`

| 文件 | 事实 |
|---|---|
| `apps/mantis/src/config/discovery.ts` | ambient：process/env — `process.env` |
| `apps/mantis/src/config/map.ts` | ambient：process/env — `process.env` |
| `apps/mantis/src/env.ts` | ambient：process/env — `process.env` |
| `apps/mantis/src/hosts/dingtalk/card/deliver.ts` | ambient：network fetch — `fetch(` |
| `apps/mantis/src/hosts/dingtalk/channels/dws/runner.ts` | ambient：Bun.serve/spawn/file — `Bun.spawnSync(` |
| `apps/mantis/src/hosts/dingtalk/channels/openapi.ts` | ambient：network fetch — `fetch(` |
| `apps/mantis/src/hosts/dingtalk/channels/robot/sdk.ts` | ambient：socket/connect — `connect(` |
| `apps/mantis/src/hosts/dingtalk/channels/robot/send.ts` | ambient：network fetch — `fetch(` |
| `apps/mantis/src/hosts/webui/panel/api.ts` | ambient：network fetch — `fetch(` |
| `apps/mantis/src/hosts/webui/server/serve.ts` | ambient：Bun.serve/spawn/file — `Bun.serve(` |
| `apps/mantis/src/config/discovery.ts` | 内建：`node:fs` |
| `apps/mantis/src/config/discovery.ts` | 内建：`node:path` |
| `apps/mantis/src/effect-plugin.ts` | 内建：`node:url` |
| `apps/mantis/src/hosts/dingtalk/conversation/store.ts` | 内建：`bun:sqlite` |
| `apps/mantis/src/hosts/dingtalk/conversation/store.ts` | 内建：`node:fs` |
| `apps/mantis/src/hosts/dingtalk/conversation/store.ts` | 内建：`node:path` |
| `apps/mantis/src/hosts/dingtalk/main.ts` | 内建：`node:path` |
| `apps/mantis/src/hosts/mcp/main.ts` | 内建：`node:path` |
| `apps/mantis/src/hosts/webui/console/turn-runner.ts` | 内建：`node:async_hooks` |
| `apps/mantis/src/hosts/webui/main.ts` | 内建：`node:path` |
| `apps/mantis/src/hosts/webui/server/helpers.ts` | 内建：`node:fs` |
| `apps/mantis/src/hosts/webui/server/helpers.ts` | 内建：`node:path` |
| `apps/mantis/src/tools/store.ts` | 内建：`bun:sqlite` |
| `apps/mantis/src/tools/store.ts` | 内建：`node:fs` |
| `apps/mantis/src/tools/store.ts` | 内建：`node:path` |

### apps/ui-host — `app-ui-host`

| 文件 | 事实 |
|---|---|
| `apps/ui-host/src/main.ts` | ambient：process/env — `process.env` |
| `apps/ui-host/src/standalone.ts` | ambient：Bun.serve/spawn/file — `Bun.serve(` |
| `apps/ui-host/src/web.ts` | ambient：Bun.serve/spawn/file — `Bun.file(` |
| `apps/ui-host/src/activity.ts` | 内建：`bun:sqlite` |
| `apps/ui-host/src/activity.ts` | 内建：`node:fs` |
| `apps/ui-host/src/activity.ts` | 内建：`node:path` |
| `apps/ui-host/src/canvas-store.ts` | 内建：`bun:sqlite` |
| `apps/ui-host/src/canvas-store.ts` | 内建：`node:fs` |
| `apps/ui-host/src/canvas-store.ts` | 内建：`node:path` |

## 怎么读这张表

- **有 ambient 依赖** → 该 app 今天与 `os` 绑定（§7.2 的欠债清单）。要让它可移植，
  先把 fs / 网络 / 进程收敛到注入的能力对象，再由三档运行时各自实现（§7.5-3）。
- **未声明 · 待实测** → 代码上没碰系统 API，但**这不足以证明**能跑在 browser/sandbox：
  依赖的包可能自己碰了，或用了只在 OS 存在的语义。要真跑过一次才算数（P3 的验收）。
- **abi 列** → 有 `effect.bundle.json` 的才有；`runtimes` 缺省即 `["os"]`（保守默认）。
- 内核切换后不可重建的内存态需人工复核对，不在本表内——见 `docs/architecture-rework.md` §6.3。

