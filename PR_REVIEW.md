# PR Review Agent

> `effect-agent` 业务表达基准样例

## 1. 外部依赖

PullRequest 是一个外部对象。它既能向 Agent 提供原始内容，也能向确定性程序提供结构化信息。

```ts
const PullRequestInfo = Schema.Struct({
  repository: Schema.String,
  number: Schema.Number,
  title: Schema.String,
  base: Schema.String,
  head: Schema.String
})

class PullRequest extends Binding.Tag("PullRequest")<
  PullRequest,
  Binding.Readable & Binding.Typed<typeof PullRequestInfo.Type>
>() {}
```

Agent 不知道 PullRequest 来自 GitHub API、Git CLI、本地 patch 还是测试 fixture。

## 2. 输出 Schema

```ts
const Finding = Schema.Struct({
  severity: Schema.Literal("critical", "high", "medium", "low"),
  file: Schema.String,
  line: Schema.optional(Schema.Number),
  title: Schema.String,
  description: Schema.String,
  suggestion: Schema.optional(Schema.String)
})

const Findings = Schema.Array(Finding)

const Review = Schema.Struct({
  summary: Schema.String,
  verdict: Schema.Literal("approve", "comment", "request_changes"),
  findings: Findings
})
```

## 3. 专项 Reviewer

Reviewer 只读取 PullRequest，不产生外部副作用，并返回结构化 Findings。

```ts
const CorrectnessReviewer = Agent.make("CorrectnessReviewer").pipe(
  Agent.instructions("检查逻辑错误、边界条件和并发问题"),
  Agent.uses(PullRequest),
  Agent.returns(Findings)
)

const SecurityReviewer = Agent.make("SecurityReviewer").pipe(
  Agent.instructions("检查输入验证、权限、注入、敏感信息和供应链风险"),
  Agent.uses(PullRequest),
  Agent.returns(Findings)
)

const MaintainabilityReviewer = Agent.make("MaintainabilityReviewer").pipe(
  Agent.instructions("检查复杂度、重复、抽象边界和长期维护成本"),
  Agent.uses(PullRequest),
  Agent.returns(Findings)
)

const TestReviewer = Agent.make("TestReviewer").pipe(
  Agent.instructions("检查测试覆盖、失败路径、回归风险和测试可靠性"),
  Agent.uses(PullRequest),
  Agent.returns(Findings)
)

const ReviewSynthesizer = Agent.make("ReviewSynthesizer").pipe(
  Agent.instructions("根据 PR 内容和专项审查结果生成最终 Review"),
  Agent.uses(PullRequest),
  Agent.returns(Review)
)
```

由于每个 Reviewer 都声明了 `returns(Findings)`，即使完全禁止副作用，它们仍然是合法的可运行 Agent。

## 4. PR Review 业务流程

```ts
const PRReview = Effect.gen(function*() {
  const pullRequest = yield* PullRequest
  const synthesizer = yield* ReviewSynthesizer

  const content = yield* pullRequest.read

  const findings = yield* Effect.all(
    {
      correctness: CorrectnessReviewer,
      security: SecurityReviewer,
      maintainability: MaintainabilityReviewer,
      tests: TestReviewer
    },
    { concurrency: "unbounded" }
  )

  const info = yield* pullRequest.typed

  return yield* synthesizer.iterate(Until.schema(Review))(
    Context.make(
      "根据 PR 内容和专项审查结果，生成最终 Review",
      content,
      { pullRequest: info, findings }
    )
  )
})
```

它直接表达：

```text
读取 PullRequest 内容
→ 并行运行四个只读 Reviewer
→ 获取结构化 PR 信息
→ 让 ReviewSynthesizer Agent 汇总并迭代到合法 Review
```

## 5. 将流程定义为 Agent

```ts
const PRReviewAgent = Agent.make("PRReview").pipe(
  Agent.instructions("组织专项审查并输出最终 PR Review"),
  Agent.uses(PullRequest),
  Agent.returns(Review),
  Agent.program(PRReview)
)
```

PRReviewAgent：

- 只读取 PullRequest；
- 不获得任何 write op；
- 返回经过 Review Schema 验证的值；
- 所有依赖保留在 Effect 的 `R` 中。

## 6. PullRequest 的可选 Ops

如果 PullRequest Binding 还提供只读操作：

```ts
const ReadFileAtRevision = Op.read(
  "pullRequest.readFileAtRevision",
  Schema.Struct({ path: Schema.String }),
  Schema.String
)
```

那么 `Agent.uses(PullRequest)` 会自动把该 Op 注入 Agent 的底层执行器：

```text
Op Schema
→ LLM Tool Definition
→ ToolCall 参数验证
→ PullRequest 实现
→ ToolResult
→ Context
```

业务流程无需出现 `Tool.make`、Provider Tool 配置或手工 ToolCall 分发。

## 7. 发布 Review

发布目标是另一个外部依赖：

```ts
class ReviewOutput extends Binding.Tag("ReviewOutput")<
  ReviewOutput,
  Binding.Writable<typeof Review.Type>
>() {}
```

```ts
const PublishReview = Effect.gen(function*() {
  const output = yield* ReviewOutput
  const review = yield* PRReviewAgent

  yield* output.write(review)
  return review
})
```

ReviewOutput 可以由 GitHub Comment、终端、文件、数据库或测试 Collector 实现。

## 8. 实现由应用提供

```ts
const GitHubPullRequestLive = Layer.effect(
  PullRequest,
  Effect.gen(function*() {
    const github = yield* GitHub

    return Binding.typed({
      schema: PullRequestInfo,
      read: github.currentPullRequest,
      ops: [ReadFileAtRevision]
    })
  })
)
```

```ts
const program = PublishReview.pipe(
  Effect.provide(GitHubPullRequestLive),
  Effect.provide(GitHubReviewOutputLive),
  Effect.provide(OpenAIReviewAgentLive),
  Effect.provide(ContainerLive),
  Effect.provide(HarnessPolicy.Default)
)

Effect.runPromise(program)
```

测试时只替换 Layer：

```ts
PublishReview.pipe(
  Effect.provide(TestPullRequest),
  Effect.provide(TestReviewOutput),
  Effect.provide(ScriptedReviewAgent),
  Effect.provide(MemoryContainer),
  Effect.provide(HarnessPolicy.Test)
)
```

## 9. Agent.iterate 示例

```ts
const reviewer = yield* Reviewer

const nextText = yield* reviewer.iterate(Until.text)()
const nextThinking = yield* reviewer.iterate(Until.thinking)()
const nextToolCall = yield* reviewer.iterate(Until.toolCall)()
const finalText = yield* reviewer.iterate(Until.stop)()
const review = yield* reviewer.iterate(Until.schema(Review))()
```

其中：

```text
Until.text      下一段 Text
Until.thinking  下一段 Thinking
Until.toolCall  下一个 ToolCall，不执行
Until.stop      完整执行工具循环，返回最后 Text
Until.schema    迭代到合法结构化值
```

## 10. 安全不变量

PRReviewAgent 没有声明：

```ts
Agent.writes(PullRequest)
```

因此即使 PullRequest 实现包含 comment、approve、merge 等 write ops，这些操作也不会被注入 Agent。

如果以后需要自动发布审查，可以显式定义：

```ts
const AutoReviewAgent = Agent.make("AutoReview").pipe(
  Agent.uses(PullRequest),
  Agent.writes(PullRequest),
  Agent.returns(Review)
)
```

权限变化在 Agent 定义中清晰可见，而不是藏在 Prompt 或 Provider 配置里。

## 11. 使用外部完整 Agent

ReviewSynthesizer 或专项 Reviewer 可以直接换成 ComposedAgent，而不改变 PRReview 业务流程。

```ts
const ClaudeCodeReviewerLive = ComposedAgent.sdk(ReviewSynthesizer, {
  sdk: ClaudeCodeSdk,
  codec: ClaudeCodeContextCodec,
  tools: "mcp",
  capabilities: ClaudeCodeCapabilities
})
```

也可以提供其他实现：

```ts
const CodexReviewerLive = ComposedAgent.sdk(
  ReviewSynthesizer,
  CodexSdkAdapter
)

const OpenCodeReviewerLive = ComposedAgent.sdk(
  ReviewSynthesizer,
  OpenCodeSdkAdapter
)

const PiReviewerLive = ComposedAgent.sdk(
  ReviewSynthesizer,
  PiSdkAdapter
)
```

运行时只替换 Layer：

```ts
PRReview.pipe(
  Effect.provide(ClaudeCodeReviewerLive)
)
```

业务代码仍然只有：

```ts
const synthesizer = yield* ReviewSynthesizer
const review = yield* synthesizer.iterate(Until.schema(Review))(context)
```

外部 Agent 被视为黑盒。Adapter 只负责 Context 编解码、事件归一化、能力协商、取消和资源释放。

## 12. ComposedAgent 能力协商

替换 Layer 不代表所有实现具备相同的细粒度控制能力。启动前必须验证当前 PR Review 的 Requirements：

```text
ReviewSynthesizer requirements
├── 可以读取 Text
├── 可以运行到 stop
├── 可以输出 Review Schema
├── 不需要暂停在 ToolCall
└── 不允许修改 PullRequest
```

例如 Claude Code Adapter 可以声明：

```ts
capabilities: {
  providers: { _tag: "Fixed", provider: "anthropic" },
  control: {
    granularity: "run",
    pause: false,
    cancel: true,
    resume: true
  },
  tools: {
    injection: "mcp",
    visibleCalls: false,
    interceptBeforeExecution: false
  },
  structuredOutput: "text",
  sandbox: "delegated",
  externalSideEffects: true
}
```

这个实现可以用于 `Until.stop`，并可在策略允许时从最终文本解析 Review；但不能用于要求暂停在 `Until.toolCall` 的流程。

如果 PR Review 明确需要 Claude Code plan mode，必须声明扩展：

```ts
const PlannedReview = Agent.make("PlannedReview").pipe(
  Agent.implementedBy(ClaudeCode),
  Agent.usesExtension(ClaudeCode.PlanMode),
  Agent.uses(PullRequest),
  Agent.returns(Review)
)
```

不声明扩展时，`yield* ClaudeCode` 始终获得默认配置。Provider 限制、无法暂停、无法注入 Tool、无法沙盒等情况必须提前失败或由显式 FallbackPolicy 降级，不能静默处理。

## 13. Fork 与多 Agent 探索

四个 Reviewer 可以从读取完 PullRequest 的同一 Context Node 分叉：

```ts
const node = context.head

const candidates = yield* Effect.all({
  correctness: reviewer.fork(node).pipe(
    Effect.flatMap(agent => agent.iterate(Until.schema(Findings))())
  ),
  security: securityReviewer.fork(node).pipe(
    Effect.flatMap(agent => agent.iterate(Until.schema(Findings))())
  ),
  maintainability: maintainabilityReviewer.fork(node).pipe(
    Effect.flatMap(agent => agent.iterate(Until.schema(Findings))())
  ),
  tests: testReviewer.fork(node).pipe(
    Effect.flatMap(agent => agent.iterate(Until.schema(Findings))())
  )
})
```

ReviewSynthesizer 承担 reduce：

```ts
const review = yield* synthesizer.iterate(Until.schema(Review))(
  Context.make("归约专项审查结果", candidates)
)
```

每个候选保留 branch URI，最终 Review 可以引用来源节点，未选中的分支之后仍可重新访问或继续探索。

## 14. 远程 PullRequest 与 Workspace

PullRequest 或 Workspace 可以由远程 Container 提供：

```ts
const connection = yield* SshConnection.connect("ssh://review-runner")

const workspace = yield* connection.registerContainer(
  "ea://review-runner/containers/pr-1234"
)
```

Agent 运行结束后返回稳定引用：

```ts
const result = {
  review,
  workspace: workspace.ref,
  context: context.head.uri
}
```

之后可以重新解析并读取：

```ts
const workspace = yield* ResourceResolver.resolve(result.workspace)
const diff = yield* workspace.read("git/diff")
```

URI 只用于寻址；SSH 凭证、Container 权限和写操作授权仍由 Connection、Layer 与 Agent.writes 控制。
