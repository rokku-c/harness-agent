# effect-agent — Bundle + Register-back + Mesh 架构

> 已定决策(2026-09-08):① bundle 产物 = **目录型**(dist/<bundleId>.effect-bundle/);
> ② namespace 默认**隔离 + 显式授权**(跨 ns 需 requires/consent)。P0(编译+就地回注册)已实现于 packages/effect-bundle。


目标(对照 deepseek-harness 的 bundle,dsh: profile 列 bundle;bundle 的 package.json
声明 `dsh: { bundle: { patch } }`;loader 自动 import 其 `./typert` 注册能力):

> 一个 effect-agent 的“插件/app”(接口+config+UI)可以被**编译成一个自包含 bundle**;
> 这个 bundle 能**在任意宿主/运行时里被加载**,加载后**回注册**到注册中心;
> 注册出的节点之间能 **mesh**(互相发现、互相调用),并有 **namespace** 隔离/叠加实例;
> 这一切必须支持**远程**(bundle 跑在别处),因此需要一条**远程协议**。

本设计复用已就绪的抽象,不另起炉灶:
`packages/effect-host`(EffectPlugin 注册/热插拔)、`packages/effect-interface`
(zod schema 接口注册)、`packages/effect-config`、`packages/effect-ui`+`UiDocument`
(声明式 UI,语言无关)、`packages/mcp-registry`(server 目录/心跳)、
`apps/effect-server`(组合根+发现+`registrar` inproc/stdio/http、console)。

---

## 1) Bundle 制品(build)

一个 bundle = 一个(或多个)**app/plugin 的可分发单元**,产物:

```
dist/<bundleId>.effect-bundle/
  effect.bundle.json        # 清单(自描述)
  entry.js                  # 编译后的 loader: 调用注册 API
  ui/…                      # 可选的 UiDocument / json-render / html 资产
```

`effect.bundle.json`(自描述、schema 可导出):

```yaml
bundleId: io.effect-agent.board@0.13.0
appId: board
abi: effect-1            # 与宿主 runtime 的 ABI 版本
namespace: ops            # 默认 namespace(加载时可覆盖)
transport: mesh          # inproc | stdio | http | mesh(远程双向)
requires: []             # 声明依赖的其它 bundle/接口 id(只按 id,不按实现)
provides:
  interfaces: [ { name, description, inputSchema, outputSchema } ]  # 从 zod 导出
  configSchema: { … }     # 从 configSchema 导出
  ui: [ { lang: effect-ui|json-render|html, document: … } ]
entry: entry.js
```

编译就是把 app 现有的 `effect.yaml` + `src/effect-plugin.ts`/`effect-config.ts`/
`effect-ui.ts(+html)` 用 bun build 打成上面的自描述产物;清单的 schema 部分全部来自
现有 zod/effect-interface 导出,保证“能导出 schema”。

## 2) 任意处加载 + 回注册(register back)

统一入口:`loadEffectBundle(bundle, options)`:

```ts
options: {
  // 就地加载
  host?, registry?, configs?, uiViews?,             // 本进程内的注册目标
  // 远程回注册
  remote?: { url, token, namespace },
}
```

- **就地(inproc)**:调 `host.register(plugin)` + `registry/configs/ui…` 注册其
  能力,返回 disposer(与现在 effect.yaml 加载路径一致,只是来源是编译好的 bundle)。
- **远程/嵌入(任意运行时,含浏览器)**:bundle 的 `entry.js` 运行在该处,通过**远程
  协议**向“home”(注册中心,如 effect-server)发起 `registry/announce`,携带清单 +
  namespace;home 校验(可要求 consent)→ 登记成**远端节点**,之后对它的调用都走
  远程协议(而非本进程函数)。

“回注册”要点:注册主体是**bundle 自己**,不是宿主去拉;host 只提供 ABI 与地址。

## 3) Mesh + Namespace

- 注册中心里每个可寻址单元叫 **node**:`(namespace, bundleId, endpoint)`。
  一个 bundle 可被多次加载,每次落不同 namespace → 同 app 多实例共存。
- **namespace** 是一等公民:所有键都带 ns
  `ns::appId::tool` / `ns::appId::config` / `ui://ns/appId/…`;
  bundle 声明默认 ns,加载方可覆盖(如 workspace-b)。ns 同时承担 scoping 与授权墙
  (跨 ns 访问需显式声明/consent)。
- **mesh** = 节点间互相发现与调用:
  - 每个节点把自己 `provides`(接口 schema + UI + config)announce 给注册中心;
  - 中心做 `discover(capability, ns?)` 返回可达节点;
  - 调用方按需路由到目标 ns/节点(健康/心跳复用 mcp-registry 的 TTL)。
  - 例:远程 bundle(浏览器里跑的 board UI, ns=workspace-b)注册回 home 后,
    mesh 到 `ops::board` 的接口拿实时数据,同时 home 也能 `ui/push` 给远端 UI。

## 4) 远程协议(effect remote)

一条**对称的 JSON-RPC 2.0** 协议,复用并扩展现有 MCP 风格:
方法 = `registry/announce|discover`, `invoke`, `config/get|set`,
`ui/push`, `events/sub`。请求头带身份:`x-namespace, x-bundle-id,
x-agent-id/x-session-id/x-request-id`(复用现状)。

Transport 插件化、与协议正交(同 MCP/registrar 哲学):
- `memory`(同进程)、`stdio`(子进程)、`streamable-http`(远程单向,已存在)
- `ws`(新增:**长连接双向**,支持 host→app 的 `ui/push`/事件通知、mesh 常驻)

注册即“往协议里 announce”:

```jsonrpc
{ "id":1, "method":"registry/announce",
  "params": { "namespace":"workspace-b", "bundle": "<manifest>",
              "endpoint": { "transport":"ws", "url":"…" } } }
```

Consent/审计/脱敏:announce 与跨 ns invoke 可复用现有 consent store 与
mcp-gateway 的规则/审计/redaction;鉴权按 (bundle,token,ns)。

## 5) 落地步骤(建议顺序)

- **P0 — Bundle 制品 + 就地回注册**:`packages/effect-bundle`(compile + load;
  用 board 先做第一个 bundle)。单测:compile→load→register→disposer。【已完成 2/2】
- **P1 — Namespace + Mesh**:`packages/effect-mesh`——ns 隔离默认 + 显式 grant,
  announce/discover/call over memory + JSON-RPC http 协议骨架。【已完成 4/4,后**已删除**:
  自研 wire 由 MCP 取代,见 `effect-unified-on-mcp.md`;本文件保留为当时的计划记录】
- **P1 — Namespace + Mesh(本地协议)**:给 registry/UI/config 键加 ns;mesh 层
  announce/discover/invoke over memory(先用 in-memory transport 打通)。
- **P2 — 远程协议**:stdin/stdio 与 streamable-http 走通(现成 registrar 底座),
  加 `registry/announce` 与双向调用;consent/审计接入。【已完成 6/6:announce+代理调用回环】
- **P3 — WS 长连接 + UI push**:让远端 bundle 的 UI 也能收 home 推送;浏览器宿主里
  board bundle 回注册 + mesh 到 `ops::board`。【P3-lite 已完成:HTTP 事件端点 mesh/push 接收 host→远端 UI 推送;WS 常驻留待做】
- **P4 — 用 board 验证**:把 board 编译成 bundle,分别以 inproc 与远程方式加载,
  端点互相 mesh。【已完成:board 编成 `io.effect-agent.board@0.13.0` bundle,在进程内
  回注册 host(enable)+config+ui,disposer 全清】

## 6) 开放决策(需要你拍板)

- 单文件(wasm-ish)还是目录型 bundle(P0 先目录型,成本低)?
- ns 语法与可见性:跨 ns 是否默认不可见、只靠显式 `requires: ns::app`?
- 远程鉴权:per-(bundle,ns) token 是否够,还是要 OAuth?
- 遥测/审计:mesh 调用是否全走 mcp-gateway 审计(默认 yes)。
