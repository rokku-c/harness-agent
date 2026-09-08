# 应用、入口、路由、出口（2026-09-08 当前设计）

## 边界

- 内置 App = 纯 handler + schema + 接口声明，不应为嵌入运行创建临时端口。
- SDK 注册/加载 App 时注册路由及实例工具；停用/卸载时撤销。
- 平台监听器引用同一个服务路由表。默认任何已注册端口都能访问同样的服务。
- 端口可显式配置 apps 白名单；不配置表示共享全部服务。未声明隔离不产生隔离。
- 自管独立进程/端口不由平台承担生命周期、流量或一致性保证。

```text
端口 A ─┐
端口 B ─┼─ listener manager ─ shared route table ─ app handler
端口 C ─┘                          │
                             SDK context.fetch
                                  │
                          application egress policy
                            ┌─────┴─────┐
                           本机        主节点
                            └─────┬─────┘
                               外部目标
```

## 上游不等于出口

AI Gateway providers 每项是 `{id,apiType,baseURL,apiKey?,enabled?}`。
同一个 apiType 可以有任意多个上游；只要求 id 唯一。
未指定时在同协议已启用项中轮询；`x-upstream-id` 显式选定某一项，协议不匹配即失败。
`apiType`决定path和鉴权协议，不代表某个厂商，也不决定从哪台机器发出请求。
不自动重放失败的模型请求，不透传选择上游的内部请求头。

## 四种出口策略

| App声明 | 选择 |
|---|---|
| main-first（默认） | 优先主节点，主节点未配置/不可选时选本机 |
| local-first | 优先本机，本机禁用时选主节点 |
| local-only | 只能本机，无本机出口就失败 |
| main-only | 只能主节点，peer未配置主节点就失败 |

“优先”是**发送前选择可用出口**，不是请求失败后换出口重试。
主节点自身的 main 就是本机出口。无法联网、超时、响应错误均返回调用方，不隐式重放。

## 网络配置

网络配置同样通过 SQLite 和 Config App 管理，appId=`platform-network`。
首次初始化可从根 effect.yaml 的 network 导入：

```yaml
network:
  role: main
  listeners:
    - {id: local, hostname: 127.0.0.1, port: 8080}
    - {id: alternate, hostname: 127.0.0.1, port: 8081}
```

peer可配置 `main:{url,token}`。主节点必须显式配置 `relayToken` 才接受认证中继。
默认主节点不是公网代理；没有token、未知app、禁止主节点出口的app都不能中继。
relay endpoint=`/-/network/egress`，传输时隔离节点凭据和目标凭据，流响应原样返回。
当前实现是HTTP中继，不声称已经实现节点自动发现、端到端VPN、身份颁发或Tailscale功能。

## agentd / mcpset 当前最小实现与下一阶段

本轮已加入最小可运行的 `@effect-agent/agentd`、`agentd` 平台 App 和 `mcp-gateway` 的 mcpset registry。

当前已支持：机器/Agent注册、MCP server引用、mcpset、Agent绑定、revision回执、allow/deny工具过滤。
尚未完成：真实远程MCP transport、announce/heartbeat HTTP协议、Agent配置适配器写入Claude/Codex文件。

Board只管理任务与看板数据，接入治理搬到独立能力：

```text
机器 agentd → 配置适配中心 → 生成某种Agent的MCP配置
                                  │
                            MCP Gateway
                         ┌────────┴────────┐
                      mcpset A          mcpset B
                    server1/server2    server2/server3
```

- Machine：机器身份、在线状态、允许下发的配置范围。
- Adapter：Claude/Codex等当前配置格式的生成和应用，避免各app改全局文件。
- McpSet：稳定setId、成员server引用、工具过滤/策略，允许多个set同时存在。
- Binding：machine/agent实例 → 允许使用的set集合；配置只指向MCP Gateway入口。
- 配置下发是显式、可验证操作；机器身份和审批不依赖Board任务或提示词。
- 当前Gateway已在内存pipeline中按binding→mcpset→server/tool policy解析；下一步接入真实MCP transport。
- 后续MCP Gateway按set独立发现与调用，鉴权在gateway边界，不能只靠URL中的setId。

不为旧配置/旧schema保留别名、兼容层或自动迁移。旧库不自动删除；不符当前结构时明确报错。

## 本阶段已落地（2026-09-08）

- `@effect-agent/agentd`：Machine/Agent 注册、MCP Server 引用、McpSet、Agent binding、revision/applied 回执。
- `agentd` App：无端口控制面，注册工具由宿主统一提供。
- `@effect-agent/mcp-registry`：带 token 的 announce/heartbeat/withdraw；token 不进入 server record。
- `@effect-agent/agentd` GatewayConfigAdapter：只生成指向 Gateway 的 Agent 配置，不暴露真实 MCP server endpoint，不写用户文件。
- `@effect-agent/mcp-gateway`：McpSet 绑定策略和 streamable-http upstream adapter 已接入；HTTP upstream 使用宿主注入的 EgressRouter fetch。
- `POST /mcp-gateway/call`：从 `x-agent-id/x-session-id/x-request-id` 获取身份，调用体只携带 setId/serverId/tool/args。

仍未落地：真实 registry HTTP announce/heartbeat 路由、stdio upstream、Agent 配置文件适配器的实际 apply、节点级身份认证和目标地址策略。

## Registry runtime lease（2026-09-08）

Registry现在提供纯 handler 控制面：

- `POST /-/registry/announce` + `Authorization: Bearer ...`
- `POST /-/registry/heartbeat`
- `DELETE /-/registry/:serverId`
- `GET /-/registry/servers`

凭据只用于控制面认证，不进入 server record/list。HTTP handler 本身不监听端口，
由平台宿主决定挂载入口。Gateway upstream 已支持懒连接 streamable-http MCP，
但 Registry transport resolver 与 stdio transport 仍留待下一阶段；当前静态配置仍可直接提供 endpoint。

## 当前 Registry-backed resolver

Gateway 已提供 `makeRegistryTransportResolver` 与 `makeRegistryHttpUpstream`：
每次调用按 serverId 重新读取 Registry，offline/withdraw 后下一次调用立即不可用；
endpoint 变化会销毁旧 MCP Client 并懒重建。Gateway 不缓存 Registry 的健康状态。

`mcp-registry` App 现在是无端口运行时插件，提供 `/mcp-registry` 查询和 `/-/registry/*`
租约控制路由。端口仍由平台 listener manager 管理。
