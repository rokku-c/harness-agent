# deckconsole · agentdeck 控制室（产品层第 1 版）

在 packages/agentdeck 组件上封装的小产品：HTTP 控制室（JSON API + 单个暗色管理页），
把三个统一面直接暴露给人用：

- 会话/流程：POST /api/session（开启，任意 kind + 原始配置自动归一）、
  POST /api/session/:id/send、POST /api/session/:id/close
- session→同意：GET /api/deck 返回 pending 与每 session 的映射统计；
  POST /api/consent/:callId { allow } 审批
- 配置→统一：GET /api/config/preview?kind=&raw=（原始 JSON → 归一结果，页面可交互预览）
- 页面 GET / （会话表、一键触发审批、同意/拒绝、配置归一预览）

启动：bun apps/deckconsole/src/main.ts（DECK_PORT 默认 4851）。
内置 demo agent（无模型/无二进制）可完整演示 open→send→ask→approve；
其余 kind 走 CLI gateway（claude-code/codex/gemini/pi/custom），effect 需在
startDeckServer({ effectModel }) 注入模型提供者。

验证：apps/deckconsole/test/deckconsole.test.ts（3 条 e2e，真起 HTTP 服务）。


## API 速查（JSON）

| 方法 路径 | 作用 |
|---|---|
| GET / | 管理页 |
| GET /api/deck | kinds/launchers/sessions/pending/mapping 统计/samples |
| POST /api/session | 开启会话 {kind, sessionId?, config(原始配置→自动归一), prompt?} |
| POST /api/session/:id/send | 跑一轮 {text}（demo 支持 ask:tool JSON 标记触发审批） |
| POST /api/session/:id/close | 关闭会话 |
| GET /api/session/:id/history | transcript + 该会话同意日志 |
| POST /api/sessions/close-all | 关停全部会话并清理策略 |
| GET /api/consent | 全量同意台账 |
| POST /api/consent/bulk | 批量处理待批 {allow} |
| POST /api/consent/:callId | 审批 {allow} |
| GET /api/config/preview?kind=&raw= | 配置归一预览 + CLI 调用计划 |
| GET /api/config/samples | 每 kind 原始配置样例 |
| GET/POST /api/launchers · DELETE /api/launchers/:label?kind= | 启动组 CRUD（DECK_FILE 持久化） |

环境：DECK_PORT、DECK_AGENTS(JSON launchers)、DECK_FILE(启动组状态文件)。

## 安全边界
- 默认仅绑定 127.0.0.1（本机）。startDeckServer({ host }) 或 DECK_HOST 可改绑；
  控制台无鉴权且可启动任意命令，跨机使用请置于可信内网或自行加鉴权层。


## 验收（3 分钟）
无 key：bun apps/deckconsole/scripts/acceptance.ts   （11 项核心流，exit 0 = 绿）
真机：  REAL=1 bun apps/deckconsole/scripts/acceptance.ts （+ claude-code 真实应答段，13 项）
页面：  DECK_PORT=4851 bun apps/deckconsole/src/main.ts → http://127.0.0.1:4851
引导：  docs/tour.md（分步预期状态 + 截图索引）
