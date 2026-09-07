# AI Gateway 架构

AI Gateway 位于 Agent/Model 与模型提供商之间，代理请求并提供统一观测、记录和行为控制。
它不进入 Agent loop，不依赖 UI，也不替代 provider SDK。

## 分层与 package

1. `@effect-agent/ai-gateway`：可嵌入的控制管线。
   - `contract`：请求上下文、审计事件、上游和记录端口。
   - `rules`：按 agent/session/model/path 匹配的声明式控制规则。
   - `injection`：协议适配后的 system prompt 注入；每次修改均可审计。
   - `redaction`：记录前脱敏，绝不持久化 Authorization。
   - `gateway`：固定执行顺序，不包含产品规则。
2. `apps/ai-gateway`：部署外壳。
   - OpenAI/Anthropic HTTP 路由、身份提取、配置加载、健康检查。
   - 组装规则、上游、记录器；默认通过 TypeORM 写入 SQLite。
3. `@effect-agent/storage-typeorm`：通用动态存储适配层。
   - 实现现有 `StoreService`，默认使用 TypeORM `sqljs` SQLite 驱动。
   - 支持运行时追加 `EntitySchema`，也可传入其他 TypeORM `DataSourceOptions`。
   - checkpoint、memory、UI 和 Gateway 均可复用，不进入领域核心。
4. 现有 `@effect-agent/model`：保持模型客户端职责，只需把 `baseURL` 指向 Gateway。

## 请求链

`身份提取 → 协议解析 → 规则判定 → 可审计注入 → 上游代理 → 响应观测 → 脱敏记录`

默认允许透传；拒绝、改路由、限额等控制由显式规则提供。注入规则必须有稳定 `ruleId`，
并记录命中者、插入位置和内容摘要。原始凭据永不进入事件；是否记录请求/响应正文由部署配置决定。

## 不放入核心

- FastMCP、Gradio：与模型 HTTP 代理无关。
- 产品专用 prompt、租户名单、计费套餐：属于 app 配置。
- Agent 工具执行审批：仍由 `@effect-agent/gate` 负责；Gateway 只控制模型调用边界。
- UI 画布权限：仍属于 UI host/agent adapter。

## 演进顺序

1. OpenAI-compatible 非流式代理、规则注入、JSONL 审计。
2. SSE 流式透传、usage/延迟/错误指标、请求关联 ID。
3. Anthropic adapter、路由/降级/重试、token 与成本预算。
4. 动态规则控制面；规则版本化并支持灰度和回滚。
