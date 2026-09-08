# Board

独立任务看板。平台入口 `/board/`；声明式SDK路由，不创建内置监听端口。

- 任务创建、修改、删除、状态；父子层级、依赖关系；操作事件与SQLite持久化。
- **不包含**资源governor、coordinator agent、Claude配置、机器注册、launch或consent。
- 不自动运行任务；状态是显式写入的任务数据，不是后台Agent生命周期。
- 关系引用必须存在且不可成环；删除前先解除子任务与依赖引用。
- SQLite每次读当前数据，变更与事件在同一事务提交；不是内存全量快照覆盖。
- 旧数据库不自动迁移或删除，格式不符明确失败。

SDK实例工具：board_state/get/create/update/delete/tree/events，Web与MCP共享同一个BoardApi。
机器接入未来走agentd/MCP Gateway/mcpset，不属于本应用。

独立自管模式：`bun apps/board/src/hosts/web/main.ts`（BOARD_PORT、BOARD_DATA_FILE）。
stdio MCP：`bun apps/board/src/hosts/mcp/main.ts`。
