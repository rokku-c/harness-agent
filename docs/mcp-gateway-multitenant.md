# MCP 接入网关多租户方案 —— 对外工具面统一收口 + user/app/system 三档身份 + 视角投影

> 状态：design v0.1（2026-09-09，经多轮对齐的决策记录，见 §2；待评审拍板后按 P0–P3 实施）。
> 前置阅读：`docs/effect-unified-on-mcp.md`（统一到 MCP 的设计映射）、`docs/effect-bundle-mesh.md`（mesh/审计开放决策）、
> `docs/effect-planes-permissions.md`（内部授权模型：principal×plane×action，默认拒）、
> `packages/mcp-gateway/*`（gateway 现状）、`apps/effect-server/src/apps-plane.ts`（/effect-apps 现状）、`apps/mcp-gateway-app/*`。
> 本文档 = 决策记录 + 目标架构 + 分阶段实施计划，是落实现的依据。

## 1. 背景与问题

对外暴露的 MCP 工具面当前分裂，且身份扁平、无可凭据体系、内外部两套授权：

1. **对外暴露面分裂**：`POST /effect-apps`（`apps/effect-server/src/apps-plane.ts`，直连聚合目录，`apps_list / app_read / app_call`）
   与 `POST /mcp-gateway`（`apps/mcp-gateway-app/src/effect-plugin.ts`）都能被外部 agent 调工具；前者**不经过 gateway**，
   gateway 的规则与审计完全看不到它。另有 `/-/(mirror|lui)/<app>/call`（`monitor-plane.ts`）直调 app 工具的旁路。
2. **身份扁平**：`packages/mcp-gateway/src/identity.ts` 只解析 `x-agent-id / x-session-id / x-request-id` 三个头，是单个字符串；
   `sets.ts` 的绑定按 `agentId` 字符串，无「调用者种类」、无「视角/投影」概念。
3. **无凭据体系**：没有 token 签发/校验表；claim 通道无信任锚点——`identity.ts` 注释也承认 header 只在受信 transport 下可信，
   当前任何自称 `x-agent-id` 的请求都能冒充任意主体。
4. **内外部两套授权**：`effect-planes`（`packages/effect-planes/src/permissions.ts`，principal × plane × action，默认拒）只在进程内强制；
   gateway 的 mcpset/rules 是另一套按 server/tool 的规则。两套并存必然漂移。

## 2. 决策记录（已对齐）

| # | 决策 | 结论 |
|---|---|---|
| D1 | 身份分档 | **user / app / system 三档**，落在 principals 表的 `kind` 列 |
| D2 | 档级语义 | **合并模型**：`kind` 只决定默认投影模板；显式 grant/consent（主体 → 资源层 → scopes）叠加或收窄；全部默认 deny；最终解析成一个 `view(principal)`。「不同用户视角不同」来自 grant 差异而非 kind 写死 |
| D3 | 凭据 | **Token 为主**（gateway 签发的不透明 bearer → 查库还原 principal，可吊销/轮换），**Claim 为辅**（内部/受信链用 `x-*` 头直解）；两通道汇到同一 `principal → view` 解析 |
| D4 | 视角范围 | **工具列表可见性**（tools/list 只投影该主体的面）+ **统一审计与观察**（每条按主体记录，进 monitor/observe） |
| D5 | 调用强制 | 视为**基线而非可选项**：与投影同一张表驱动 `tools/call` 的默认 deny——否则可见性只是装饰（伪造 tools/list 直 call 隐藏工具即穿透） |
| D6 | 数据级剪裁 | **本次不做**：行/字段级过滤（如「用户只见自己建的 task」）需给数据加 owner 归属，留作延伸 |
| D7 | 出口收敛 | **只留 gateway 一个对外口**；`/effect-apps` 不再是外部可直达面，收为内部 managed surface/上游 |
| D8 | 审计模型 | gateway 审计与 effect-planes 授权**合流**：gateway 把 view 编译成内部同一张授权表，避免双轨 |

## 3. 目标与非目标

**目标**
- 外部 MCP 工具只有一个受管出口，所有连接与调用可管理、可观察、可审计。
- 主体分 user/app/system 三档；每档有默认面，可被显式授权叠加/收窄。
- 不同主体接入后看到的工具列表不同；伪造直 call 也按同一视角默认拒绝。
- 每条连接与调用按主体落审计，供 monitor/observe 查询。

**非目标**
- 数据行/字段级剪裁（D6）。
- 自研 wire 协议：一切仍走 MCP（streamable HTTP / stdio / InMemory）。
- 进程内 home↔app 授权模型的重写：沿用 effect-planes，gateway 只负责把外部身份解成内部同一张授权表。

## 4. 概念模型

```
principal  = { kind: user|app|system, id, claims }
                 │ kind 决定默认投影模板 TEMPLATE[kind]
                 │ 显式 grant/consent（principal → 资源层 → scopes）叠加/收窄
                 ▼
view(principal) = TEMPLATE[kind] ⊕ GRANTS(p) − REVOKES(p)     // 默认 deny
                 │
   ┌──────────────┬─────────────────────┬───────────────────┐
 tools/list 投影     tools/call 同表判定      audit 全记录
 （可见性）          （强制，默认 deny）        （统一观察）
```

三档默认模板（原则性；具体工具集在实现时按 mcp-registry 实际登记固化）：
- **user**：个人拥有的资源面（个人 board/config 等以 owner/grant 关联的项）。
- **app**：接入应用声明需要的接口契约（对应 manifest `requires/grant`，见 effect-planes-permissions §2）。
- **system**：平台管理面（agentd 身份/配置、mcp-registry、gateway 拓扑、monitor/observe）。

**例子**：Alice 与 Bob 都是 `user`——Alice 基线用户面 + board 授 `owner`（叠加 board 应用面）；Bob 无 grant，于是同 kind、不同视角。
计费同步器是 `app`，只见 board 发给它的「写 done」契约。codex-sync 是 `system`，默认含 agentd/gateway/monitor 管理面。

## 5. 目标拓扑

**现状**
```
外部 agent ──▶ /effect-apps     直连目录，绕过 gateway            ✗
外部 agent ──▶ /mcp-gateway     唯一受管，但只有 mcp_gateway_call  +  扁平 agent
console    ──▶ /-/(mirror|lui)/<app>/call  直调 app 工具          ✗
```

**之后**
```
外部 agent ──▶ /mcp-gateway（唯一对外口）
                  │  authn(token/claim) → principal
                  │  view(principal) → tools/list 投影 / tools/call 强制（默认 deny）
                  │  audit 落 observe
                  ▼
            内部不再直连：effect-apps 目录收为 internal managed surface；
            board/agentd/… 仍注册进共享 mcp-registry，gateway 按 serverId 上游转发
```
- `/effect-apps` 对**外部不再可达**（保留给 in-proc/console，或彻底收编后移除）。
- `/-/(mirror|lui)/<app>/call` 限本机 console 或加同套鉴权。
- README / `scripts/codex-session.ts` 的 Codex dogfood 入口改为 `/mcp-gateway` + **system token**。

## 6. 数据模型（DB）

沿用 `.effect-agent/*.sqlite`；倾向独立 `gateway.sqlite`（P0 定，见 §11 待定）。

```
principals(kind, id, display_name, status[active|disabled], created_at)
tokens(token_hash PK, principal_key FK, issued_at, expires_at, revoked_at, last_used_at)
grants(principal_key FK, scope_key, scopes[], source[manifest|consent|operator], expires_at?)
templates(kind PK, scope_key, scopes[])        -- 默认模板，operator 可调
audit(call_id, principal_key, action[connect|list|call], server_id, tool,
      decision[allow|deny], args_redacted, ts, duration_ms)
```
- token 存 **hash** 不存明文；签发/吊销走 console/API。
- `scope_key` 对齐现有资源寻址 `{plane}:{ns}::{appId}`（effect-planes）或 `serverId`（registry）——实现时归一为一种。

## 7. 身份与凭据（D3）

1. **token 通道（对外默认）**：`Authorization: Bearer t_…` → 查 `tokens`（hash、未过期、未吊销）→ 还原 principal。支持吊销/轮换/到期。
2. **claim 通道（内部/受信链）**：仅当请求来自**已认证的信任边界内**（in-proc transport、已鉴权宿主、或带 gateway 签发短期签名的上游）才接受 `x-agent-id` 等头解 principal；否则一律要求 token。
   - `identity.ts` 现无条件信 header → 改为显式 `trusted: boolean` 判定，杜绝冒名。
3. 两通道汇到同一 `resolvePrincipal(req) → { principal, view }`。

## 8. 授权与视角投影（核心）

在 `mcp-gateway` 内新增 **view resolver**（替代现在 `sets.ts` 的 agent→binding 纯解析）：

```
resolve(principal):
  eff = {}
  TEMPLATE[kind].forEach(t => eff[t.scope] = union(eff[t.scope], t.scopes))
  GRANTS[principal].forEach(g => eff[g.scope] = union(eff[g.scope], g.scopes))
  REVOKES[principal].forEach(r => eff[r.scope] = minus(eff[r.scope], r.scopes))
  return { visibleServers, toolSet, canCall(tool) = defaultDeny(eff) }

ListTools → 只回投影内工具（可见性，D4）
CallTool  → 先 canCall 判定，deny 记审计（强制，D5）
```

- **强制点合一**：gateway 把 `view(principal)` 编译/挂载成 effect-planes 的 grants，使内部 `app_call` 与资源读取走同一张表——不维护两套（D8）。
- **审计合一**：gateway `recorder`（`contract.ts` 现有）扩展 principal 字段；事件与 monitor/observe 打通（D4）。

## 9. 落点（对现有代码的改动）

| 位置 | 改动 |
|---|---|
| `packages/mcp-gateway/src/identity.ts` | 加 `trusted` 判定、token 校验、claim 解析 → `resolvePrincipal` |
| `packages/mcp-gateway/src/contract.ts` | context/event 加 `principalKind/principalId/claims`；新增 `PrincipalRegistry` / `TokenStore` / `ViewResolver` 接口 |
| `packages/mcp-gateway/src/sets.ts` | 保留 mcpset 语义，解析入口改接 view resolver（templates + grants） |
| `packages/mcp-gateway/src/gateway.ts` | 调用前后补 principal 审计；deny 判定前统一查 view |
| `packages/mcp-gateway/src/mcp-server.ts` | `ListToolsRequestHandler` 改投影；`CallToolRequestHandler` 改 view 强制 |
| `apps/mcp-gateway-app/src/effect-plugin.ts` | 装配 principals/tokens/grants（config + sqlite）；接线 recorder |
| `apps/mcp-gateway-app/effect.yaml` | config 增 principals/tokens/grants 段与 sqlite 归属 |
| `packages/effect-planes/*` | gateway 编译 view → 挂 grants；导出统一强制点供内部复用 |
| `apps/effect-server/src/apps-plane.ts` | `/effect-apps` 收回外部可达性（仅 in-proc/console 或移除） |
| `apps/effect-server/src/monitor-plane.ts` | `/-/…/call` 加鉴权或限本机 |
| `scripts/codex-session.ts` + `README.md` | dogfood 改连 `/mcp-gateway` + system token |

## 10. 分阶段实施

- **P0 身份/凭据**：principals + tokens 表、签发/校验/吊销、claim 信任边界。测试守：伪造头被拒、过期/吊销 token 被拒、信任边界内外行为分叉。
- **P1 视角**：三档模板 + grants/revokes + view resolver 喂 ListTools/CallTool，default deny。测试守：Alice/Bob/system 三例 tools/list 差异；隐藏工具直 call 被 deny；审计行存在。
- **P2 收敛**：`/effect-apps` 外部关闭；dogfood 改 `/mcp-gateway`；`/-/…/call` 收口。测试守：外部只剩一个可达 MCP 口（路由表断言）。
- **P3 配置/UI/观察**：console 发 token、看 principals/bindings/单主体 view 预览；audit 进 observe 面板。

## 11. 待定与风险

- principal/token 放哪个 sqlite（倾向独立 `gateway.sqlite`，P0 定）。
- token 生命周期：默认时效、轮换、吊销传播。
- claim 信任边界定义：什么算「受信链」（in-proc / 已鉴权宿主 / 网关签发短签名）——决定 claim 通道能否对外安全。
- user 档「个人资源」暂无数据归属支撑：本次只做面级可见性；行级归属（owner 字段）留延伸，需先给 task/config 加 owner。
- 审计量与脱敏：沿用 `redaction.ts`（token/secret 字段脱敏）；高频只读调用是否降级采样待定。
