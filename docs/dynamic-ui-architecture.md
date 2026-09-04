# 动态画布与组件系统方案

## 结论

目标是“声明定义搭积木、运行时由 Agent 编排、渲染器可替换”。画布也是组件，
因此可以嵌套、互相引用并点击下钻。定义、数据、行为和视觉实现必须分离。

FastMCP 不进核心：仓库已有 TypeScript MCP SDK 与 `ui-agent`，足够暴露工具；
FastMCP 仅在未来需要 Python 生态时作为独立 bridge。Gradio 不进产品运行时，
只适合 Python 模型 Demo/验证。

## 分层与 package

### 主运行时（现有 effect-agent 链）

|层|package|职责|性质|
|---|---|---|---|
|L0|`core`|Agent/Until/Op/Binding/Driver 协议|核心、稳定|
|L1|`model` `channel` `tools`|模型、消息通道、工具/MCP 契约|核心接口；实现可换|
|L2|`state` `memory`|Store、EventLog、Checkpoint、长期记忆|核心接口；持久化内置|
|L3|`builtin`|默认 Agent loop、ClaudeCode、providers|内置默认实现|
|L4|`gate` `schedule` `script`|审批、调度、沙箱脚本|可选内置能力|
|L5|`assembly`、`apps/*`|组合根、产品 Host|应用层|

依赖只向上，`assembly` 是唯一组合根；同层通过 Tag/接口协作。

### 动态 UI 链（与主链平行）

1. `ui-protocol`：DSL、节点、事件、权限、错误；零业务依赖。
2. `ui-definition`：Component/Canvas 定义、props schema、slots、版本和 catalog。
3. `ui-runtime`：树/图实例、命令事务、绑定解析、历史、导航栈。
4. `ui-renderer`：RendererRegistry 与递归渲染 Host；默认 web-html。
5. `ui-extension`、`ui-sandbox`、`ui-agent`：动态注册、脚本隔离、Agent/MCP 适配。

当前仓库已有这 7 个 UI package，应保持边界，不把 UI 细节塞进 `core`。

## 核心数据模型

```ts
type ComponentDef = { type: string; kind: 'base'|'composite'|'canvas';
  props: Schema; slots?: Record<string, NodeSpec>; renderers?: string[] }
type NodeSpec = { id: string; type: string; props?: unknown;
  bindings?: Record<string, Expr>; events?: Record<string, Action[]> }
type CanvasDef = ComponentDef & { kind: 'canvas'; children: NodeSpec[] }
```

Registry 只保存声明和 renderer 引用，不保存 React/Vue 实例。组合组件通过
`NodeSpec` 引用基础或组合类型；CanvasRef 指向任意 CanvasDef。定义(schema)与
实现(renderer)分离，扩展必须带版本、权限和能力声明。

## 数据绑定与下钻

- `DataStore` 保存远程源、缓存和本地状态；每个 Canvas 创建带父链的 `Scope`。
- 绑定只允许安全路径/表达式：`$scope.user.id`、`$data.sales.items`、`$event.row`；
  禁止 `eval`。读写动作经过 schema 校验和 Gate。
- 点击 CanvasRef 产生 `navigate(canvasId, params)`，把参数写入子 Scope，
  `currentCanvasStack` 支持返回、刷新恢复和深链；子画布默认隔离，按声明读取 `$parent`。

## 渲染与动态能力

Renderer 接口接收已解析 Node + Scope，返回挂载句柄和事件出口。可注册
`web-html`、React/Vue、React Flow/Konva、tldraw、Three/WebGL 等实现；切换
renderer 只替换句柄，数据和节点 ID 不变。ThemeRegistry 提供全局→画布→节点
覆盖的 design tokens（CSS variables），换肤无需改 DSL。

复杂或高风险逻辑使用 `DynamicScriptHost`：脚本运行在 Worker/iframe/QuickJS
沙箱，通过 capability 注入数据和动作，只能更新声明状态，不能直接操作宿主 DOM。

## Agent API 与落地顺序

Agent 只调用命令：`registry.list/register`、`canvas.create/insert/link`、
`node.patch/remove`、`binding.set`、`set-data`、`navigate`、`theme.set`。命令可审计、可回放，
并由 `ui-agent` 映射为 MCP；节点事件可用 `set_data` action 更新 DataStore，
同样会转成 `set-data` 命令。主题 registry 将 token 注入 renderer context；未来
FastMCP bridge 也只做协议转换。

实施顺序：先冻结 protocol/definition schema → 补 runtime 事务与持久化 → 默认
web renderer/CanvasRef 下钻 → theme 与 renderer 热插拔 → sandbox → 协作/远程插件。
每阶段保持现有测试与每文件 100 行 lint 约束。
