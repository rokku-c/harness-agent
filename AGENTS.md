# AGENTS.md — 项目开发规范

本仓库是 `effect-agent`：一个建立在 **Effect (v3)** 上的统一 Agent 编程模型。
所有代码必须符合 effect-ts 的惯用法。本文档是硬性规范，不是建议。

## 核心原则

### 1. 副作用必须用 Effect 表达

- 任何产生副作用的操作（IO、网络、进程、文件、时间）必须返回 `Effect`，
  禁止直接写裸 `async` 函数 + `await` 作为实现主体。
- 外部库的 Promise 回调用 `Effect.tryPromise` 包裹（细粒度），错误转成明确的 `Data.TaggedError`。

```ts
// ✅ 正确：副作用包成 Effect，错误用 TaggedError
const readFile = Effect.tryPromise({
  try: () => fs.readFile(path, "utf8"),
  catch: (cause) => new ConnectionError({ uri, cause })
})

// ❌ 错误：裸 async 函数直接做 IO
const readFile = async (path: string) => fs.readFile(path, "utf8")
```

### 2. SDK 回调边界是唯一允许的 async 逃生舱

- Anthropic / OpenAI / Vercel SDK 要求回调函数是 `async`（例如工具执行的 `execute`）。
  这是**必要的边界**：在回调内部，可以用 `Runtime.runPromise(runtime)(effect)` 把
  Effect 跑成 Promise 交给 SDK。
- 但边界必须**最小化**：回调里只做「把 effect 交给 SDK」这一件事，回调内部不得写
  复杂的命令式循环 / 业务逻辑。
- `Runtime.runPromise` 只允许出现在 SDK 回调边界，禁止在纯 Effect 代码里用它。

```ts
// ✅ 正确：SDK 回调边界，最小化
definition: sdkTool(name, desc, shape, async (input) => {
  const output = await Runtime.runPromise(runtime)(op.execute(input))
  return { content: [{ type: "text", text: JSON.stringify(output) }] }
})

// ❌ 错误：整个工具循环用 async + for 写，还依赖 runPromise
const callModel = async (messages) => { /* 大段 async 逻辑 */ }
```

### 3. 迭代用 effect-ts 的方式，不用命令式 for/while

- 循环/迭代优先用 **递归 Effect**（尾递归 `go()`）、`Effect.iterate`、`Effect.loop`、
  `Stream`，或 `Effect.gen` + `Ref` 表达状态。
- 禁止用 `let` + `for` + 可变数组在 Effect 主体里累积状态（除非是极简单的局部）。

```ts
// ✅ 正确：递归 Effect + Ref 累积
const go = (): Effect.Effect<A, E> =>
  step.pipe(Effect.flatMap((event) =>
    event._tag === "Detail"
      ? Ref.update(ref, (xs) => [...xs, event.detail]).pipe(Effect.flatMap(go))
      : ref.get.pipe(Effect.map((details) => ({ output: event.value, details })))
  ))
```

### 4. 依赖注入用 Context.Tag + Layer

- 外部依赖（Container、Connection、Provider、配置）通过 `Context.Tag` + `Layer` 注入，
  禁止在业务代码里直接 new / 全局单例。
- Tag 提供 `static layer(...)` 或 `static empty` 便于组合。

```ts
export class Containers extends EffectContext.Tag("Context/Containers")<Containers, ContainersService>() {
  static layer(containers: ReadonlyArray<Container>): Layer.Layer<Containers> {
    return Layer.effect(this, Effect.succeed(makeContainers(containers)))
  }
}
```

### 5. 错误用 Data.TaggedError，不用 throw / any

- 领域错误定义成 `Data.TaggedError`，通过 Effect 的失败通道传播，禁止 `throw`。
- `Effect.tryPromise` / `Effect.try` 的 `catch` 返回明确的 TaggedError，不吞错误。

### 6. 类型窄化优先，减少 `as any`

- 优先用类型守卫、`Schema.decodeUnknown`、`Either`、联合类型收窄来处理官方 SDK 的
  严格类型，而不是 `as any` 逃逸。
- `as any` 只允许在 SDK 联合类型确实无法窄化时，且必须加注释说明原因。

### 7. 数据模型用 Schema，不用手写校验

- 结构化数据（Context entry、tool input/output、结构化输出）用 `Schema` 定义，
  `schemaJson` 生成 JSON Schema，`decode`/`decodeJson` 校验。

## 文件职责

- `src/core.ts` — 领域模型 + 核心抽象（Context / Container / Connection / Session / Driver）
- `src/agent.ts` — Agent 构建与组合
- `src/hooks.ts` — 生命周期 hook
- `src/providers/` — provider 驱动
  - `index.ts` — Providers Tag + driver 路由
  - `native.ts` — 官方 SDK 驱动（@anthropic-ai/sdk / openai）
  - `vercel.ts` — @ai-sdk/* 兼容驱动
- `src/composed/` — ComposedAgent 适配器（Claude Code / Codex / Pi）
- `src/ssh.ts` — SSH 连接
