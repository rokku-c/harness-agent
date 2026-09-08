# 平台收敛任务（2026-09-08）

| 任务 | 负责人 | 范围 | 状态 |
|---|---|---|---|
| A Board独立功能 | 主线程 + Heisenberg | 移除governor/coordinator/Claude接入/资源调度；保留任务看板 | 完成 |
| B 多上游 | Lagrange | 命名provider、同协议多实例、显式选择/轮询、可增删表单 | 完成 |
| C 不兼容 | Aquinas | 去配置自动迁移/旧schema适配与结构化文本降级 | 完成 |
| D 网络底层 | 主线程 + Lagrange | 独立listener manager、四种出口策略、认证主节点中继 | 完成 |
| E 无端口内置App | Heisenberg | UI Host/Deck纯handler、DB关闭和前缀路由 | 完成 |
| F SDK/宿主 | 主线程 | 自动路由/工具注册、平台网络配置、组合与浏览器验收 | 完成 |
| G agentd核心 | 主线程 | machine/agent/mcpset/binding/revision控制面与port-free App | 完成 |
| H Gateway mcpset | 主线程 | set registry、binding解析、allow/deny和审计拒绝 | 完成 |

## 已定设计

- 所有默认平台注册端口引用同一个host路由表；仅显式apps过滤产生不同服务视图。
- App的SDK出站接口和provider路由选择分开；默认main-first，无自动重放。
- Network配置纳入SQLite权威，appId=platform-network；启动App不等于创建listener。
- Board不再承担任何机器Agent配置；agentd/mcpset定义见platform-network.md，后续独立实现。
- 不迁移或删除用户实际数据库、不操作全局Claude配置；旧结构明确报错。

## 本轮验收

- 307项定向测试通过（112个文件），未运行全仓测试。
- 受影响范围TypeScript检查通过；263个相关TS文件的100行检查通过。
- Import boundary：0错误，12条其它依赖声明警告未扩张处理。
- 浏览器：三个相同apiType上游添加/保存/轮询/显式选择通过。
- 浏览器：Board任务创建后从第二个托管端口立即读到同一任务；页面无旧治理控件。
- 主节点中继：真实peer→main→上游链路、身份与目标凭据隔离、流响应均已验证。
- Board编译bundle：宿主提供ABI、资源路径、实例工具注册/卸载已验证。
- 所有验证使用隔离SQLite/本机模拟上游；未删除/迁移用户数据、未改全局Agent配置、未重启已有实例。

## 留给下一阶段

- agentd实际配置适配器、announce/heartbeat/withdraw HTTP协议和Agent配置下发仍待实现。
- MCP Gateway真实stdio/streamable-http upstream transport仍待接入；当前已完成内存binding/policy pipeline。
- 当前网络是显式配置的HTTP出口中继，不是节点自动发现或VPN。

## 下一阶段增量（本轮继续）

- I Registry lease：完成纯控制接口 announce/heartbeat/withdraw；下一步才暴露认证 HTTP 路由。
- J Agent config adapter：完成内存 plan/apply 结果；下一步接具体 Claude/Codex adapter，但仍只生成 Gateway 配置。
- K Gateway data plane：streamable-http MCP upstream 经 EgressRouter，统一 `/mcp-gateway/call` 已可用；stdio 与完整 registry resolver 后续接入。

本轮新增核心验证较少：agentd/mcpset/registry/upstream/宿主接线覆盖关键行为，不扩展页面测试矩阵。

## 本轮新增（2026-09-08）

- Registry lease HTTP handler：完成 announce/heartbeat/withdraw/servers 查询。
- Agentd GatewayConfigAdapter：完成只生成 Gateway 入口的纯配置 plan/apply。
- Gateway streamable-http upstream：完成 MCP Client 懒连接与 EgressRouter fetch 注入。
- 下一步：把 Gateway 的 server topology 从静态 config 切换为 Registry-backed resolver，并补 stdio transport。

## 本轮继续：Registry-backed Gateway

- mcp-registry App 从占位插件变为真实 registry runtime。
- Registry 控制面已挂载：announce / heartbeat / withdraw / servers。
- Gateway 新增 Registry transport resolver 和动态 HTTP upstream；Registry 状态变化影响下一次调用。
- 仍不支持 stdio transport；暂不做 registry 持久化和节点自动发现。

## 当前阶段验收

- Shared Registry + Gateway + live Streamable HTTP MCP Server：端到端通过。
- announce / heartbeat / withdraw 后 Gateway 下一次调用行为正确。
- endpoint 变更会重建 Gateway 的 MCP Client；不缓存旧 Registry 状态。
- 标准 MCP initialize/tools/list/tools/call 入口已接入；不再维护旧 JSON call 入口。
- 本阶段定向测试 97 通过；受影响 TypeScript、行数、边界检查通过。
