# json-render 采用与迁移决策

## 决策

采用 `vercel-labs/json-render` 作为生成式 UI 底座，不再自行扩展通用 Spec、
StateStore、catalog、binding、action、stream patch 与框架 renderer。

当前实验证据：

- `@json-render/core@0.20.0` 的 StateStore 已替换 `UIDataStore` 内核，旧测试无改动通过。
- Canvas 可转换成官方 `Spec`，保留节点、slots、path binding、action 与 CanvasRef。
- `@json-render/react@0.20.0` 已在真实 `ui-host` 注册，可通过 `set-renderer`
  切换并完成 HTTP 渲染验收。
- 全仓回归 348 pass、3 skip、0 fail。

## 保留的产品层

这些不是 json-render 的职责，继续由本仓库维护：

- 多 Canvas 图、CanvasRef 目标与下钻/返回导航栈。
- Agent 修改 UI 的命令事务、乐观版本、审计 journal 与恢复。
- Gate/权限、extension manifest、动态脚本 capability sandbox。
- effect-agent Op 与产品 MCP 工具；FastMCP 不进入核心。

## package 处理

| package | 处理 |
|---|---|
| `ui-protocol` | 收缩为 Canvas、命令、权限等产品协议；通用节点/action 类型改用 core |
| `ui-definition` | 变为 json-render Catalog + 多 Canvas 定义仓库 |
| `ui-runtime` | 保留导航/事务/journal；状态、Spec、patch 委托 core |
| `ui-renderer` | 变为官方 renderer 的选择与主题适配；完成对等后删除自研 HTML 递归器 |
| `ui-agent` | 保留 Op/MCP 到产品命令的适配，不复制 catalog schema |
| `ui-extension` | 保留插件生命周期，组件注册落到 Catalog |
| `ui-sandbox` | 保留为可选的不可信代码执行边界 |

不新增第八个长期 package；迁移适配器放在所属层，迁移完成后删除。

## 迁移门槛

1. 用官方 Catalog 校验替换手写组件约束，并验证基础/组合组件。
2. 用官方 action/state binding 替换 `ActionRef` 与自研 path/template 解析。
3. 用 RFC 6902 patch/SpecStream 替换节点级手写 patch 逻辑，外层仍记 UICommand。
4. 官方 renderer 覆盖 CanvasRef、主题、宿主事件后删除 `webRenderer`。
5. 每步保持 Canvas 下钻、journal 恢复、MCP 与全仓测试通过。

Gradio 仍不需要：它是 Python Demo UI，不是本产品的动态画布运行时。
