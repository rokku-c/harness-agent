# PR Review 示例架构

本文展示如何用当前抽象定义 PR Review，不引入专用 Agent 类型。

## 环境

```text
PullRequest Binding
├── read：标题、描述、diff、状态
└── ops
    ├── listFiles
    ├── readFile
    └── publishReview（write）

Workspace Binding
├── read：仓库摘要
└── ops
    ├── search
    ├── readFile
    └── runChecks
```

本地仓库和 SSH 仓库可以提供同一 Workspace 能力。Agent 是否知道真实位置由 Binding 的资源策略决定。

## 输出

```ts
const Review = Schema.Struct({
  verdict: Schema.Literal("approve", "request-changes"),
  summary: Schema.String,
  findings: Schema.Array(Schema.Struct({
    file: Schema.String,
    line: Schema.optional(Schema.Number),
    severity: Schema.Literal("low", "medium", "high"),
    explanation: Schema.String
  }))
})
```

## 单 Agent

```ts
const ReviewPullRequest = Agent
  .define<PullRequestRef>((ref) => AgentContext.current(ref))
  .returns(Until.schema(Review))
  .uses(PullRequest)
  .uses(Workspace)
  .implementedBy(driver)

const result = yield* ReviewPullRequest.run(ref)
```

Agent 只获得只读能力。发布 Review 是确定性宿主操作：

```ts
const result = yield* ReviewPullRequest.run(ref)
yield* PullRequest.publishReview(result.output)
```

需要 Agent 自主发布时，显式改为 `.writes(PullRequest)`。

## 多 Agent

并行专项审查使用相同 Agent 定义和不同环境能力，不增加“Reviewer”类型：

```ts
const reviews = yield* Effect.forEach(
  [security, correctness, maintainability],
  (agent) => agent.run(ref),
  { concurrency: 3 }
)

const final = yield* consolidate.run(reviews.map((item) => item.output))
```

共享黑板通过 Layer 注入：

```ts
const program = Effect.all(reviewers.map((agent) => agent.run(ref))).pipe(
  Effect.provide(Blackboard.layer())
)
```

## 长期监听

未来由 AgentKeeper 把一次性 Review Agent 托管成长期运行实例：

```text
PullRequestEvent Queue
        ↓
AgentKeeper<ReviewPullRequest>
        ↓
Stream<Review>
```

消息、Webhook 和跨进程队列属于 Keeper 的输入 Adapter，不改变 Review Agent 本身。

## 安全边界

- 文件路径范围由 Workspace Binding 强制；
- `.uses` 不暴露 write Op；
- 所有 Op 输入输出经过 Schema；
- Provider、GitHub/GitLab 客户端和凭证通过 Layer 注入；
- 发布动作与模型决策可以分离；
- Driver 不支持所需能力时在运行前失败。

