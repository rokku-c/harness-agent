# effect-agent 产品路线图

## 定位
面向 Effect 生态的 TypeScript 开发者，用一套统一、类型安全的 Agent 编程模型，让业务代码以纯 Effect 依赖的方式编排「从单次模型调用到 Claude Code / Codex / OpenCode / Pi 等外部 Agent」的一切智能体；在 Agent 运行时碎片化、各家 SDK 各自为政的此刻，成为 Effect 生态事实标准的 Agent 抽象层。

## 目标用户
- Effect 生态的 TS 后端 / 平台开发者：在业务应用中嵌入 Agent 能力（PR 审查、代码生成、数据洞察、自动修复等）
- 需要把 Claude Code / Codex / OpenCode / Pi 等外部 Agent 接入 CI/CD 与 DevOps 流水线的工程团队
- 构建内部 Agent 编排平台、需要统一多家供应商与运行时差异的平台团队
- 想在 Effect 之上开发 Agent 工具库与 Binding 的第三方作者（生态共建者）

## 价值主张
- 一种 Agent，全部运行时：单次模型调用与完整外部 Agent 统一为 Input → Effect<Output, Error, Requirements>，业务代码一次编写、按需替换底层
- 业务逻辑优先：Provider、API Key、进程、Tool 协议与 Layer 装配只出现在实现边界，换供应商不动业务代码
- Effect 原生：类型化错误、依赖注入（Tag/Layer）、取消与生命周期开箱即用，Agent 与业务系统共享同一套纪律
- 权限即代码、能力不伪造：未授权写操作不注入上下文；适配器如实声明 Capabilities 并显式降级——安全与诚实内建于类型层
- Schema 可选、渐进增强：从 read 到 typed / ops / write 按需取用，简单场景不付复杂成本

## 护城河
生态位标准：抢占 Effect 生态内「Agent 抽象层」的独特位置，随 Effect 生态成长而复利；适配器网络效应：每接入一个外部 Agent 与每个 Binding，抽象对业务的价值非线性增长；锁定方向的逆转：业务代码面向标准而非特定厂商，形成「对标准的锁定」以削弱单一厂商锁定；可沉淀的领域资产：Capabilities 规范、Binding 库、权限策略、适配器矩阵与示例库随时间积累，构成难以复制的内容与工程资产。

## 分阶段路线图（3 阶段）
### P1 Phase 1 · 核心模型定型（Foundation）
- goal: 把 Agent / ComposedAgent / Context / Binding / Until 的最小语义定稿，交付可运行、可上手的 0.x 骨架，跑通「业务逻辑优先」的完整体验闭环。
- milestones:
  - 定稿 Agent<Input, Output, Error, Requirements> 核心类型与 ComposedAgent 边界
  - 交付内置 Agent 实现（至少 1 个主流 Provider）及 Binding / Op / 权限强制的闭环
  - 发布首个端到端 example：业务代码只依赖 Tag，不感知底层 Provider
  - 将 DRAFT 0.6 演进为 1.0 API 草案并公开稳定性承诺
- OKRs:
  - 核心 API 进入 1.0 稳定期（breaking change 收敛并有迁移指南）
  - 内置 Provider 适配 ≥2 家主流供应商
  - 首个 ComposedAgent 真实适配器（Claude Code SDK）可运行
  - ≥5 个可运行 example / 教程覆盖 Agent 与 ComposedAgent 两条路径

### P2 Phase 2 · 外部 Agent 生态（ComposedAgent 网络）
- goal: 把 ComposedAgent 从概念变成可用适配器矩阵，用真实世界验证「不伪造能力」与「权限不是 Prompt」两条原则。
- milestones:
  - Capabilities 矩阵规范与显式降级策略落地（Tool 注入 / Thinking / 结构化输出 / 取消 / 恢复）
  - 适配 Claude Code / Codex / OpenCode / Pi 中至少 2-3 个真实 SDK
  - Connection 模型（远程 Agent runtime）原型验证
  - 权限策略（Permission Policy）与 Context Events 审计日志落地
- OKRs:
  - 认证适配器 ≥3 个且全部通过 Capabilities 合规测试
  - 未授权写操作注入数为 0（自动化测试覆盖）
  - ≥1 个外部团队在生产环境用 effect-agent 编排 Agent
  - 发布「从 Provider 到外部 Agent 可统一编排」的里程碑版本

### P3 Phase 3 · 生态与标准复利（Ecosystem）
- goal: 成为 Effect 生态的事实 Agent 标准，沉淀可复用的 Binding 生态与治理机制，把单点工具变成平台。
- milestones:
  - 发布 GitHub / PR / 文件系统等常用 Binding 库，形成生态样板
  - 与 Effect Schema / Platform 深度集成，typed 场景开箱即用
  - 观测性（OpenTelemetry）、审计与权限策略引擎等企业级能力
  - 社区治理：RFC 流程、适配器认证标准与贡献者激励
- OKRs:
  - Binding 社区贡献 ≥10 个且进入 effect-agent 仓库标准目录
  - 认证适配器覆盖主流外部 Agent ≥5 个
  - 周下载量与生产部署组织数进入持续增长通道（社区遥测验证）
  - 进入 Effect 生态官方文档 / 会议 / 示例的推荐位置

## 成功指标
- 北极星指标：每周生产环境 Agent 运行数（一次 Agent 从启动到 Until 完成的会话）
- 领先指标：认证适配器数量、新 Binding 数量、文档→试用转化率、API 稳定性（兼容性承诺下的 breaking change 次数）
- 滞后指标：npm 周下载量、生产部署组织数、被其他 Effect 库依赖与集成的数量、社区贡献者数

## 产品风险
- 市场与竞争：Agent 编排赛道已有 Vercel AI SDK、LangChain、Mastra 等强敌，且外部 Agent SDK 高速迭代，抽象层存在被绕过或迅速过时的风险
- 采用门槛：Effect 本身是小众生态，叠加 Effect + Schema + Agent 模型的学习成本，团队可能倾向直接用厂商 SDK 而非再包一层
- 依赖漂移：底层外部 Agent SDK（如 Claude Code SDK）不稳定或能力缺失，「不伪造能力」原则会如实暴露能力缺口，影响体验上限
- 抽象正确性：外部 Agent 是黑盒且非确定性，统一抽象可能过度承诺（如取消、恢复在外部 Agent 上无法真正实现），损害信用
- 安全：通过 Binding / Content 注入的 Prompt Injection 风险，权限策略需极其谨慎设计，一旦失守将直接打击「权限即代码」的核心卖点

## 下一步产品行动
- 用 1 个真实外部 Agent（首选 Claude Code SDK）实现最小 ComposedAgent 适配器并公开其 Capabilities 清单，验证「不伪造能力」与「权限不是 Prompt」在真实环境下成立——这是整个模型的信用基石
- 将核心 API 定稿为可发布的 0.x，并交付一个端到端示例（一个普通 Agent + 一个 ComposedAgent 并存），跑通「业务逻辑优先」的完整体验闭环，为 Phase 2 的适配器生态提供样板
