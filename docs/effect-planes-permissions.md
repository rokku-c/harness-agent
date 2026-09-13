# effect-agent — 统一 Planes(接口 / UI / 存储)与权限

> **状态（2026-09-13）**:§1 的资源模型与寻址语法已落地在 `packages/effect-authz`
> （`resource.ts` / `match.ts` / `decide.ts`），生效的 plane 控制面是
> `packages/effect-host/src/{control,operations}.ts` 的 `/-/planes/*`。
> 本文 §5/§6 里那个 `packages/effect-planes` **没有保留下来**：它的 `makePlanes` 是同一套
> plane 模型的第二份实现（已被 effect-host 取代），已删除；其中唯一在用的 `NodeStore`
> 并入了 `packages/effect-bundle/src/store.ts`。下文按设计原样保留，读的时候按此对照。

目标:所有 app(node)的**接口、UI、存储**都用一套统一、namespace 化、可寻址的资源模型
表达;**权限**是这套模型的显式一层——某个节点只要有权限,就能**读取/调用其它节点**的
接口、UI 或存储(跨节点只读是默认禁止,授权后才放行)。

## 1) 资源模型:node 的四个 plane

每个 node = `(namespace, appId)`。它对外暴露的资源统一按 plane 寻址:

```
interface : ns::appId.tool                      # 调用已有(mesh)
ui        : ui://ns/appId/<view>                # 读取/加载声明式 UI(UiDocument)
storage   : store://ns/appId/<key...>           # 读写该 node 的数据(JSON 文档)
config    : config://ns/appId                    # 该 node 的配置(schema 驱动)
```

- **统一**:UI 是语言无关的 UiDocument;存储是统一的文档式 KV(JSON,前缀寻址);
  接口是 schema 化 tool。三层都“能导出 schema/描述”。
- **默认隔离**:跨 namespace 一律拒绝;同 node 自身可读写;同 ns 内默认可见(可收紧)。
- 每个 node 的 UI 和存储都**可被授权方读取**,但读写都走同一权限检查点。

## 2) 权限模型(Authorization)

- **主体(principal)**:调用者 = `(namespace, bundleId)` 或 `(agent/session 身份)`,
  从统一头 `x-namespace / x-bundle-id / x-agent-id / x-session-id` 解析(已存在)。
- **资源(scope)** = `(plane, ns::appId, [item])`。
- **动作**:`read`(读 UI/存储/描述)、`call`(调接口)、`write`(写存储/config)。
- **规则** 两种来源,统一进一张授权表:
  1. 静态声明:manifest `requires/grant`(如 `grant: [{ toNs, planes:[ui,store] }]`);
  2. 运行时:consent(复用 consent store)。
  规则默认 `deny`;仅显式允许的 (principal, plane, target) 放行。
- **强制点**:home 的协议边界。
  - 接口调用:在 mesh.call 的隔离检查后、audit 钩子旁,把 `can(callerNs, "interface", target)` 并入;
  - UI/存储/配置读取:home 暴露的统一端点(如 `/-/planes/read`)先鉴权再返回;
  - audit:每条放行/拒绝都进 audit 事件(mcp-gateway 风格)。

## 3) 存储抽象

- `NodeStore`:统一文档 KV —— `get(key)/set(key,value)/list(prefix)`(JSON)。
- 每个 node 把它的 store **注册**进统一 planes(它可把读写代理到协议:远端 node 的
  store 操作经 `mesh/store-get|set` dispatch 到达真实存储)。
- 读取别的 node 的存储 = 通过授权表 + 解析到那个 node 的 store(本地对象或协议调用);
  home 不隐式持有任何 node 的实现对象 —— 仍是“只走 protocol”。

## 4) UI 读取

- 每个 node 注册其 `UiDocument`(effect-ui view / json-render / html)。
- “读取别的 node 的 UI” = 经授权后取到其 UiDocument(声明层),由统一客户端渲染;
  live 界面仍由该 node 提供(同源 iframe / 远程 endpoint),但**目录与描述读取**同样走授权。

## 5) 复用与落点

- 复用:effect-mesh 的 ns/grant、effect-interface(工具 schema)、effect-ui(UiDocument)、
  effect-config(schema)、consent/audit、effect-bundle(manifest grants 声明)。
- 新增:**packages/effect-planes** —— 统一授权表(can/grant/revoke,plane 维度)+
  node 的 store/ui 描述注册 + 统一的跨 node 读取入口;以及一个最小 `NodeStore`。

## 6) 落地顺序

- **A — Planes 模型 + 授权**:`packages/effect-planes`:规则表(plane 粒度)、
  NodeStore、registerNode(store+ui+interface 描述)、readStore/readUi/readInterfaceSchema
  统一入口、跨 ns 默认拒 + grant(plane)。测试覆盖 授权/拒绝。
- **B — 接 mesh**:把 `interface` 判定并入 mesh.call(统一强制点);
  store/ui 的远端读写经 dispatch(`store/get|set`、`ui/get`)。
- **C — HTTP/UI 端点**:home 暴露 `/-/planes/*`(读 store/ui/config),统一鉴权;
  console/config 走它。
- **D — 迁移**:board/ui-host/deck/各 bundle 声明 store+ui+grants,注册进 planes。
