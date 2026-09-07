# Doop 借鉴清单

参考仓库：`/Users/user/repos/doop`（main，2026-09-07）。Doop 是多人设计画布，
核心对象是 Canvas → Frame，Frame 保存 HTML，在 sandbox iframe 中增量 morph；Agent
通过 MCP 创建和流式编辑 Frame。

## 值得直接借鉴

1. **操作指南作为 MCP 合同的一部分**：Doop 的 `get_guide` 让 Agent 先了解工作流、
   尺寸、风格和协作规则。我们的 `ui-agent` 应提供一次性 protocol/interaction guide，
   但规则必须来自 capability/catalog，不能靠隐藏 prompt。
2. **增量生成**：`append_frame_html(start/done)` 让观察者实时看到进度。对应本项目应
   使用 json-render 的 RFC 6902 `SpecStream`，外层每个 patch 仍写入 UI journal。
3. **Agent 在场与任务状态**：`set_status`、heartbeat、任务队列和 activity feed 让人知道
   谁在做什么。应作为 host/product 层能力，不进入 `ui-protocol` 的通用节点 schema。
4. **重启恢复语义**：Doop 启动时把中断中的任务标记为可重试失败，避免永久卡在 working。
   我们的 journal/runtime 应对未完成的 SpecStream 记录同样提供 interrupted 状态。
5. **服务端权威访问控制**：MCP 每个 canvas/frame 操作都先做 owner/member access check，
   Agent 身份继承授权用户；不能仅依赖前端隐藏按钮。
6. **设计记忆与人工确认**：Doop 的 guideline、reference、decision、proposal 分层，
   规则由人接受后才成为持久指南。这比把所有历史对话自动塞进 prompt 更适合产品化。
7. **安全渲染边界**：Doop 将不可信 HTML 放进 sandbox iframe，并对脚本/HTML 做清理。
   我们坚持 json-render 的声明式 catalog；只有未来允许自定义 HTML 时才启用独立 sandbox。

## 不直接照搬

- Doop 的 HTML Frame 不是我们的 canonical model；它无法提供 catalog 级 props 校验和
  跨 React/Vue/Svelte renderer。继续以 json-render Spec 为 UI 底座。
- Doop 的多人 presence、评论、memory 属于产品协作层，不应塞进 `@json-render/core`。
- Doop 的 MCP 工具是产品动作；本项目仍通过 Effect Op + Gate + UICommand 统一审计。

## 当前实施顺序

1. 增加 `SpecStream` → UICommand/journal 的增量 patch adapter。
2. 给 ui-host 增加 Agent status/activity 的最小产品接口。
3. 将 canvas 访问控制接到 MCP 与 HTTP command 入口。
4. 再做 guidelines/reference/decision 的可选 memory package。

FastMCP、Gradio 仍不需要：Doop 的价值在协议和产品运行语义，不在 Python UI 框架。
