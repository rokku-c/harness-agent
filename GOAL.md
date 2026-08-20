# GOAL — effect-agent 目标

> 本文档记录 effect-agent 的**目标、使用场景与设计约束**，是设计决策的锚点。改动前先读这里。

## 一句话

`effect-agent` 是**构建 agent 系统的框架**（harness agent framework），不是「调 LLM 的库」。它让开发者能**表达任意 agent 架构**，并把这份表达运行在任何基座上。

## 使用场景

四类使用者，按抽象层级从低到高：

1. **开发者** —— 用代码（Effect-TS）定义 harness agent 或整套 agent 架构；
2. **agent 本身** —— 通过 MCP / API 消费这套系统（别的 agent 能调它）；
3. **高级用户** —— 通过 web 层做可观测与控制；
4. **框架能力** —— 能构造出类似 cloudflare-os、clawyp、claude code 或**任意 agent** 的东西。

## 核心目标

1. **表达任意 agent 架构** —— 不仅能描述单个 agent（节点），还能描述一堆 agent 怎么组织（协作、递归）。
2. **双基座** —— 同一份 agent/系统描述，本地 harness 能跑，Cloudflare（Durable Object / Worker）也能跑。
3. **大规模** —— 能操控很多 agent。
4. **概念统一、外部可替换、维护核心** —— 一条缝接入外部实现；核心保持最小，外部实现可替换。
5. **被其他 agent 消费** —— 通过 code / api / mcp / 描述方式都能用；描述简洁、无冗余、能表达架构。

## 两条对称属性

agent 系统既是「被描述的对象」，也是「描述/观测它的主体」。这两件事，人和 agent 都能做：

1. **可描述** —— agent 可以被 agent 或人**定义并运行**。agent 不是硬编码的类，是一份可表达的描述；一旦能描述，就能被任何能读懂描述的人/agent 定义出来并跑起来（meta-agent 定义新 agent 是其中一种）。
2. **可观测/介入** —— agent 定义好后，可以被人/agent 观测（状态/进度/结果）和介入（暂停/改方向/注入新指令/取消）。

观测/介入分两个维度，不能混为一谈：
- **主体**（谁来做）：人，或 agent。
- **通道**（怎么访问）：web、mcp/api、另一个 agent 直接访问。

因为「另一个 agent」也是主体，所以**观测/介入接口本身必须能被 agent 访问（mcp/api 是必须的），web 只是给人用的一种形态**。不能把「观测/介入」与「web + mcp/api」划等号——通道多样，主体是人/agent 两个。

两条属性串起所有目标：可描述 → 需要架构表达层；可定义并运行 → 需要双基座；可观测/介入 → 接口必须同时暴露给人（web）和 agent（mcp/api）。也解释了「能构造 claude code」——claude code 也是「能描述/观测 agent 的东西」，框架要能表达出这种元能力。

## 抽象原则

- 抽象是给「要描述 agent 架构的人」用的 → 第一原则是「人怎么描述协作」，不是「系统怎么运行」；
- 用户表达意图，宿主决定机制；
- 底层全是 LLM 请求；抽象只做一件事：把「请求之间怎么配合」从手写变成声明；
- 一切 agent 必须满足两条对称属性（可描述 + 可观测/介入），抽象要保证这两条在任何基座上成立。

## 参考（仅参考，不照搬）

```toml
[agent]
resources = [...]            # 用什么（读写什么）
driver = "anthropic/..."     # 靠谁执行（模型/外部 agent）
until = "schema"             # 什么时候停
```

- 这是「单个 agent 的形状」，是底座；
- 真正的核心是**「能表达任意 agent 架构」的那一层**（多 agent 的组织、协作、递归）。

## 当前设计状态

- ✅ `Agent`（单个请求的边界）已实现；
- ✅ 已确认：`Agent` 描述层核心（Stage/Until/Gates + Resource + Mgmt + Connection/Group/Org/Messenger）已设计，见 DESIGN.md；
- ✅ 编排组合子（Stage/Until/Gate）已实现并接入 Agent 定义流；
- 🔶 阶段推进引擎未实现（编排能表达、未真正驱动按阶段跑）；
- ✅ **不引入 `System` 层和运行视图层作为独立概念**——「系统」= 一组 Agent + Connection 的组合，「运行视图」= 每个 Agent 运行自然暴露的 Handle。它们是现有概念的自然涌现，不是独立抽象。
