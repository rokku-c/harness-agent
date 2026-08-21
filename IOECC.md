# 声明式 Agent 操作系统底座：IOECC 形式化架构白皮书

**版本**：4.0（最终模型）
**状态**：架构愿景 —— 核心模型已收敛，代码落地于 `packages/ioecc`
**核心范式**：基于代数效应 (Algebraic Effects) 与 Effect TS 的纯声明式 Agent 架构

---

## 摘要

主流 LLM Agent 框架停留在命令式编程延长线上：隐式副作用、硬编码条件分支、脆弱状态管理，导致难以测试、缺乏可观测性、无法模块化组合。

本白皮书提出 **IOECC 模型** —— 基于 Effect TS 代数结构的极简声明式 Agent 架构。最终模型收敛为一套极度简单的形状：

- Agent 是**纯描述（被动黑盒）**：只声明五个维度的形状（I / O / E / C / C），**不执行**。
- **EffectExecutor / ControlExecutor / ObservabilityWorld / ConnectionImpl 路由等独立执行器不再是核心概念**；执行只分两步：**声明（gen）+ 驱动（driver 声明的 control）**。
- **Driver 就等于 Agent（五维度）**：没有任何强制方法（无 `run`/`SetProvider`/`observe`）。具体 driver 是 Agent 实例，可以附加自己的方法（如 `run`），那是它自己的，不是核心强制。driver 可以是 **n 个**（`drivers` 数组）。
- **Control 是类**：constructor（构造）+ `run(I, O, E, Cn, Ct, d)`（用具体 driver 的能力写逻辑，`yield* d.xxx()`）。
- 虚拟拓扑（Messenger / Group / Org）、触发器**不是核心概念**：由 Connection（世界）这一普通概念长出来。
- 分形组合是**免费**的：任何 Agent 都可以当另一个 agent 的 driver，递归而无需包装。

在承认 TypeScript 物理极限的前提下，本白皮书区分「类型/运行时物理保证」与「架构纪律约定」，给出模型在工程落地层面的最优解。

---

## 1. 引言：当前 Agent 开发的结构性困境

四个结构性缺陷：

1. **隐式副作用的黑盒化**：Agent 直接调用外部 API 或修改全局状态，行为不可预测，难以确定性测试。
2. **控制流与业务逻辑深度耦合**：重试、超时、并发、Fork/Join 等元控制逻辑污染核心业务代码。
3. **可观测性缺失与割裂**：LLM 思考 (Thinking) 与工具调用 (ToolCall) 只能靠非结构化日志旁路捕获，无法作为一等公民参与路由与监督。
4. **组合性断裂**：单体与组合 Agent 接口/语义不一致，无法实现「组合产物仍可作基础组件」的分形复用。

IOECC 用「五个正交维度 + 声明/驱动两步」同时解决以上四点。

---

## 2. 核心哲学

三条不可妥协的基石：

- **陈述句范式**：Agent 的设计不是「如何一步步执行」，而是「陈述架构、陈述接入的环境、陈述交互意图、陈述对自身的控制」。代码即系统拓扑图。Agent 是**数据**，可以序列化、可被另一个 Agent 描述/生成。
- **Agent 即被动黑盒（纯描述）**：Agent 只声明五个维度的形状，**不执行**。任何（I/O/路由/驱动）与执行相关的动作都发生在「声明之外」——由外围在 gen 时把 driver 与 Connection 实现注入。核心不定义任何强制方法。
- **驱动 = 具体 driver 声明的 Control**：Agent 的运行逻辑不在 Agent 上，而在 **Control 实现**里（用具体 driver 的能力 `d.xxx()` 写）。Agent 不 import 物理实现，只经 Connection 与外部交互。

---

## 3. IOECC 模型：五个正交维度

穷尽分布式自治节点的物理与逻辑属性。每个维度都是「描述」，不执行、不携带操作契约；具体契约在 compile/驱动时提供。

### 3.1 I (Input) 与 O (Output)：数据拓扑

- **I** 是 Agent 接收的数据形状（`input: Schema.Schema<I>`）。
- **O** 是 Agent 产出给下游的数据形状（`output: Schema.Schema<O>`）。
- 两者都由 **Schema** 约束，是**运行时解码的物理保证**（见 §7.2）。

### 3.2 E (Effect)：显式交互意图

Effect 是 Agent 显式声明的「对世界的影响」：只声明**对哪个 Connection 的外部产生了可观测影响**，不携带操作契约。

```typescript
interface Effect<Connection extends string> {
  readonly _tag: string
  readonly connection: Connection   // 指向哪个 Connection（世界）
}
```

- **关键突破**：LLM 思考 (Thinking) 与工具调用 (ToolCall) 升格为 Effect，使内部过程类型安全、可路由、可被外部监督。

### 3.3 C (Connection)：世界的边界

任何外部或内部依赖（数据库、文件系统、LLM API、虚拟沙箱），在 Agent 视角一律抽象为 `Connection`（`{ name: string }`）。Agent 不 import 物理实现，只通过 Effect 声明与 Connection 交互。实现（`ConnectionImpl.handle`）在 compile/gen 时由外围注入。

**观测/额外功能是在这里落地的**：具体 driver 作为普通 Connection 提供（外部可访问）。

### 3.4 C (Control)：对自身的控制

Control 是 Agent 对**自身**的控制声明。在最终模型中，**Control 是类**：

```typescript
class Control<I, O> {
  constructor(tag: string) { this._tag = tag }   // 构造
  run(i, o, effects, connections, controls, d): Effect.Effect<O, Error> {
    // 用 driver（具体能力）写逻辑
    return Effect.fail(new Error("run not implemented"))
  }
}
```

- `constructor`：构造（命名这个控制）。
- `run(I, O, E, Cn, Ct, d)`：接收五维度 + driver，返回 `Effect`。子类可自由 override，用具体 driver 的能力 `yield* d.xxx()` 写业务逻辑。
- 静态 Trigger 与动态干预（Fork/Stop/Retry）都是 Control 的子类（见 §5）。

---

## 4. 核心抽象与类型闭合

最终模型只保留少数核心类型，全部集中在 `concept.ts` 与 `gen.ts`。

### 4.1 五维度 Agent（纯描述，不执行）

```typescript
interface Agent<I, O> {
  readonly input: Schema.Schema<I>            // I
  readonly output: Schema.Schema<O>           // O
  readonly effects: ReadonlyArray<Effect>     // E
  readonly connections: ReadonlyArray<Connection>  // C（世界）
  readonly controls: ReadonlyArray<Control>   // C（对自身控制）
  readonly drivers: ReadonlyArray<Driver>     // 声明时就绑定（n 个）
}
```

### 4.2 Driver = Agent（五维度）

```typescript
type Driver<I, O> = Agent<I, O>
```

**Driver 没有任何强制方法**（没有 `run`/`SetProvider`/`observe`）。任何 Agent 都能当 driver，递归而无需包装。具体 driver（如 claude code driver）内部可能有很多方法，但那属于它自己的五维度世界，非核心强制。驱动（执行）靠 driver 的**声明**：driver 里 `controls` 数组声明的 `Control`。

### 4.3 声明 + 驱动两步：`EffectAgent.gen`

```typescript
const program = EffectAgent.gen(spec, drivers, impls)
// spec            —— 五维度描述（AgentSpec）
// drivers         —— n 个 driver（任意 Agent）
// impls           —— Connection 实现（外围提供，处理 agent 声明的每个 Effect）
// 产出 Program：
//   program.agent        —— 可读的 Agent 描述（effects/connections/controls/drivers）
//   program.drive(i, x)  —— 驱动：执行第 i 个 control（driver 声明的）
//   program.execute(e)   —— 解释一个 Effect（按 connection 路由到 impl.handle）
//   program.decode(v)    —— 按 output Schema 解码
```

`gen` 把所有 control 汇集（agent 自己声明的 + 各 driver 声明的），`drive` 按索引执行某个 control；`execute` 按 `effect.connection` 路由到外围注入的 `ConnectionImpl.handle`。**驱动靠 driver 声明的 control，不靠 driver.run。**

`EffectAgent.make` 是同一构造的元编程形态，类型更精确。

---

## 5. 拓扑：从底部向上推导（非独立轴）

虚拟拓扑（Messenger / Group / Org）与触发器**都不是核心概念**，由 Connection（世界）这一普通概念**长出来**。多 agent 组织不引入新增核心维度。

### 5.1 世界 = Connection（把一切外部物变 Connection）

| 外部物 | IOECC 表达 |
|---|---|
| LLM 驱动 (driver) | 一个五维度 Agent 实例（可附加 `run` 等方法），其 control = 驱动能力 |
| 工具 (Tool) | 声明在 Connection 上的 `Effect`（`_tag` + `connection`）|
| 消息/广播/寻址 | Messenger Connection 上的 Effect |
| Group/Org | Connection（成员是配置）|
| 黑板/共享资源 | 有状态的共享 Connection |
| 观测/自省 | 具体 driver 作为普通 Connection 注入 |

**工具问题自动消解**：工具不是注入的对象/操作，而是「具体 driver 作为 Connection 在跑时解释的 Effect 声明」。「自己写日志」「读自己的日志」就是把自身当 Connection 注入（见 `core.test.ts` 的「观测 = 具体 driver 作为 Connection」用例）。

### 5.2 组合：Agent 即 Driver（递归免费）

任何 Agent 都可以作为另一个 agent 的 driver。组合不引入新抽象——同一个五维度形状嵌套即可。两个 Agent 经共享 Connection（如共享黑板 / 消息总线）协作：它们不直接调用彼此，各自用 `gen` 声明，同一个 `ConnectionImpl` 注入两者（见 `02-composed.ts`）。

### 5.3 分形 = 共享解释器（免费）

所有层级的 Agent 共享同一套「声明（gen）+ 驱动（control）+ Connection 路由（execute）」。子 agent 的 Effect、Connection、Control 自动汇聚到同一世界，父能看到任意深度。分形不是显式组合，是「一切皆五维度」的自然结果。

---

## 6. 关键机制

### 6.1 副作用的「薛定谔化」与白盒化

`execute(new FetchWeatherEffect(...))` 不立即发请求，只产出「意图对象」并经 `ConnectionImpl.handle` 解释。因为所有交互是显式数据流，可持久化意图序列实现精确决策回放。

### 6.2 驱动的归属：Control 在 driver 上

业务逻辑不在 Agent 五维度里，而在 **Control 实现**里，用具体 driver 的能力写。driver 声明自己的 control（能力清单），gen 把它汇入程序。**归属是「谁声明 control、谁驱动」**——驱动一个程序，就是执行某个具体 driver 声明的 control。

### 6.3 控制策略正交组合

Control 是不透明声明，具体策略（超时/重试）作为外围中间件作用在 `run` 返回的 Effect 上（`Effect.timeout` / `Effect.retry` 等）。Agent 内部对超时/重试一无所知。

---

## 7. 诚实的边界

### 7.1 框架内保证 = 架构纪律与工程约定

TypeScript 无法在编译期阻止 `Control.run` 内部直接 `import fs`。**「无隐式副作用」是架构纪律 + 代码审查 + ESLint 规则**（禁止 Agent 目录 import 物理世界模块），不是类型强制。IOECC 提供清晰机制来接管副作用，但「不使用旁门左道」依赖团队自律。

### 7.2 运行时解码保证 = 类型与物理双重强制

与副作用隔离不同，**输入/输出类型安全是物理保证**：`Agent.input` / `Agent.output` 强制 `Schema.Schema<I>` / `Schema.Schema<O>`，`program.decode` 必须 `Schema.decodeUnknown(agent.output)`。脏数据在进入前被物理拦截。这是类型系统与运行时共同锁死。

### 7.3 框架外约定

未适配接口的遗留系统/第三方黑盒 agent 只能经 Proxy/Adapter 接入，无法保证声明完备性，外部黑盒仍可能产生未声明的隐式副作用。模型不承诺对这类外部实体的绝对可观测性。

---

## 8. 结论

IOECC 不是 Agent 框架，而是**基于代数效应的通用自治节点操作系统底座**。

- 五个正交维度（I/O/E/C/C）把一切外部物描述为 Connection，把一切无行为强制、无固定方法的实体统一为纯描述 Agent。
- **Driver = Agent**：无固定方法，任意 Agent 递归可作 driver，组合免费。
- **Control 是类**：constructor 构造 + `run(I,O,E,Cn,Ct,d)` 用具体 driver 能力写逻辑。
- **声明 + 驱动两步**（`gen` → Program）：描述可序列化可观测，驱动靠 driver 声明的 control，路由靠 Connection 实现。
- **拓扑非独立轴**：Messenger / Group / Org / 触发器由 Connection 长出来，不新增核心概念。
- 统一的「一切皆描述 + Connection 路由」把黑盒 agent 转成全链路白盒可观测实体。

开发 Agent 不再是编写 `try-catch`/`if-else` 胶水代码，而是像写 IaC 一样用陈述句定义节点的 IOECC 属性。物理运转、资源管理、弹性容错与可观测性，交给 Effect TS 这个严密的数学引擎。

---

## 9. 最终模型代码形态

三个关键片段，反映 `packages/ioecc` 的最终实现。

### 9.1 Control 是类：constructor + run（用 driver 能力写逻辑）

```typescript
// packages/ioecc/src/concept.ts
class Control<I, O> {
  readonly _tag: string
  constructor(_tag: string) { this._tag = _tag }   // 构造
  run(i, o, effects, connections, controls, d): Effect.Effect<O, Error> {
    // 子类 override：用具体 driver 的能力 d.xxx() 写业务逻辑
    return Effect.fail(new Error(`Control ${this._tag} run not implemented`))
  }
}

// 用法：一个 Control 实现，d 是具体 driver，这里 cast 到有 run 的假 driver
class RunLogic<I, O> extends Control<I, O> {
  constructor() { super("RunLogic") }
  run(_i, _o, _e, _cn, _ct, d) {
    const concrete = d as unknown as { run: (i: I) => Effect.Effect<O, Error> }
    return concrete.run(_i)   // 用具体 driver 能力
  }
}
```

### 9.2 Driver = Agent（五维度）+ 声明两步：`EffectAgent.gen`

```typescript
// driver 就是 Agent：五维度 + 自己声明的 control +（可附加）具体 run 方法
const fakeDriver = {
  input: Schema.String,
  output: Schema.String,
  effects: [],
  connections: [],
  controls: [new RunLogic<string, string>()],   // driver 声明自己的控制（能力）
  drivers: [],
  // 以下是具体 driver 的实现能力（Agent 之外的具体方法，非核心强制）
  run: (input: string) => Effect.succeed(`driven:${String(input)}`),
}

// gen：五维度 + n 个 driver + Connection 实现 → 可运行 Program
const program = EffectAgent.gen({
  input: Schema.String,
  output: Schema.String,
  effects: [],
  connections: [],
  controls: [],
}, [fakeDriver])

// 驱动：执行 driver 声明的 control（index 0 = RunLogic → fakeDriver.run）
const out = await Effect.runPromise(program.drive(0, "hello"))   // → "driven:hello"
```

### 9.3 观测/额外功能 = 具体 driver 作为普通 Connection 注入

```typescript
// 观测 Connection 由外围注入（普通 Connection 实现）
const program = EffectAgent.gen({
  input: Schema.Void,
  output: Schema.Void,
  effects: [{ _tag: "ReadLogs", connection: "SelfLogs" }],
  connections: [],
  controls: [],
}, [fakeDriver], new Map([
  ["SelfLogs", { handle: () => Effect.succeed("log-line-1\nlog-line-2") }],
]))

const out = await Effect.runPromise(program.execute({ _tag: "ReadLogs", connection: "SelfLogs" }))
// → "log-line-1\nlog-line-2"：观测是普通 Connection，不是核心轴
```

---

## 附：与 effect-agent 的映射

| IOECC 概念（最终模型） | effect-agent 现有实现 |
|---|---|
| 五维度纯描述 Agent | `AgentIR` / `EffectAgent.gen`（可序列化描述，声明 + 驱动两步）|
| Driver = Agent（五维度，无强制方法） | 具体 driver（如 claude code driver）是 Agent 实例，附加自有 `run` 等方法 |
| Control 类（constructor + run(d)） | `Session` 介入通道 / 各类 Control 实现 |
| Connection（世界）+ 路由 | `Binding` / `Op.execute`（Schema 约束）|
| 观测 = 具体 driver 作为 Connection | `Detail`（Thinking/ToolCall）+ 观测 Connection |
| 拓扑由 Connection 长出来 | `Group` / `Organization`（成员为配置的 Connection）|
| 工具 | 声明在 Connection 上的 `Effect` |
| 消息互通 | 归一化 `Message`（与 Anthropic/OpenAI 同义）|
| MCP 消费 | `EffectAgentMcp`（纯 transport，外围）|

**主要收敛**：去掉旧模型的 EffectExecutor / ControlExecutor / ObservabilityWorld / ControlRunner 等独立执行器概念；执行统一为「声明（gen）+ 驱动（driver 声明的 control）+ Connection 路由（execute）」两步。Driver 不再是抽象接口而就是五维度 Agent。
