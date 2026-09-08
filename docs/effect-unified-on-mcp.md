# 统一到 MCP(2026-07-28 新版)的设计映射

目标:除了**权限**(作为 MCP 之上的 facade 层),所有跨 app 的注册与通信都只走
**Model Context Protocol** 最新版(2026-07-28 时代,modern era)——
不再维护自研的 announce/call/…;effect-mesh 的“自研 JSON-RPC”退位为 MCP 的封装。

## 映射表(planes → MCP)

| effect 层 | MCP(2026-07-28) |
|---|---|
| app 注册/回连 | 每个 app = 一个 **MCP server**;主节点 = MCP **client**,连接后跑
  `server/discover`(modern 探活+能力+extensions+versions)→ 注册 |
| 接口 plane | **tools**(`tools/list` 返回带 inputSchema 的工具;`tools/call` 执行) |
| UI plane | **resources**:`ui://…` 资源由 `resources/list`/`resources/read` 提供;
  会话内渲染走 MCP Apps(`_meta.ui.resourceUri`,host 拉取 → 沙箱 iframe → `ui/*`) |
| 存储 plane | **resources** 读写(`resources/read`;写通过暴露的写 tool 或
  resources/templates + modern subscriptions/listen 推送变更) |
| config plane | 一个只读 resource(`config://ns/app`) + 一个写 tool(`config_set`) |
| namespace | 落在 **server/工具命名**与连接隔离:`ns__app__tool`(对齐 dsh
  `mcp__<server>__<tool>`);每个 ns 一个独立 server/client 对,天然隔离 |
| 双向(home→app UI push) | modern **subscriptions/listen** + notifications/subscriptions/acknowledged;
  或 MCP Apps 的 host→app push(2026-07-28 语义) |
| 远程/嵌入 | streamable-http(modern、sessionless)或 stdio;同进程用
  **InMemoryTransport**(同一协议、零网络) |
| 权限 | MCP 之上的一层 facade:home 在转发 `tools/call` / `resources/read` 前先查
  effect-planes 授权表(plane 粒度),拒绝就不发 MCP 请求 → 审计记录 |

## 关键点

- **In-memory 也是真 MCP**:进程内 app 用 `InMemoryTransport` 一对,home client 与
  app server 之间就是标准 MCP initialize/discover/tools。这样“进程内 vs 远程”零差异。
- **不再有自研 wire**:effect-mesh 的 `dispatchMeshJson` 等只作为“把 MCP 结果映回
  effect-interface”的胶水;新增能力一律走 MCP 方法。
- **SDK 版本**:仓库当前 `@modelcontextprotocol/sdk ^1.30`;2026-07-28 的 modern
  方法(server/discover、subscriptions/listen、Mcp-* headers 等)需把 SDK 升到支持
  “modern era”的版本,升级前先用其兼容子集(initialize/tools/list/call/resources/read)。
- 命名隔离:工具名带 `ns__app` 前缀;跨 ns 权限由 facade 决定,名字唯一性由 ns 保证。

## Phase 落地

- **B-MCP【已完成】**:进程内 app=**MCP server**(packages/effect-mcp buildNodeMcpServer),
  home=**MCP client** InMemory 注册/转发(`connectNodeToHome`),命名 `ns::appId`。
- **C【已完成】**:ui/store 作为 **MCP resources** 暴露(`ui://`、`store://{key}` template),
  home `resources/list|read` 读取(connectNodeToHome.resources/readResource)。
- **D【已完成,SDK 1.30 web-standard】**:packages/effect-mcp-http `serveMcpHttp` 用
  `WebStandardStreamableHTTPServerTransport` 把 node 的 MCP server 暴露成 Bun HTTP
  (per-request fresh transport 规避 GHSA-345p-7cg4-v4c7;GET→405 回退 POST JSON);
  远端 MCP client 直连成功。2026-07-28 modern 的 server/discover 等需后续升 SDK。
- 新增 console app:apps/mcp-registry-app、apps/mcp-gateway-app(统一 configSchema + UI)。

- **数据渲染/agent 读取【已完成】**:effect-ui 声明节点支持 `bind`(JSON pointer)→ 投影成
  json-render `{$bindState:…}`(text/button/formField);数据由 render 时注入(state)。
  `packages/effect-apps` 提供 MCP 入口:`apps_list / app_read(ui|state|config|store) /
  app_call`,per-op 授权后浏览+操作任意 namespace 的 app —— agent 读的是数据平面
  (spec+state+config+store),不是渲染后的 DOM。
