# effect-agent implementation

当前实现坚持一个业务概念：`Agent<I, O, E, R>`。Vercel AI SDK 是普通 Agent 的执行引擎；Claude Code、Codex 和 Pi 都只是 `Driver`，业务定义不感知 SDK。

```ts
const Review = Schema.Struct({
  summary: Schema.String,
  risk: Schema.Literal("low", "medium", "high"),
  findings: Schema.Array(Schema.String)
})

const PRReview = (driver: Driver) => Agent
  .define<string>("PRReview", diff => AgentContext.text(`Review:\n${diff}`))
  .returns(Until.schema(Review))
  .implementedBy(driver)

const candidates = yield* Agent.map([
  PRReview(ClaudeCode.make()),
  PRReview(CodexAgent.make()),
  PRReview(PiAgent.make())
], diff)
```

## TOML Provider 配置

Provider 的身份精确到 API，而不是厂商。`openai.responses` 和 `openai.chat` 是两个不同能力，不能互换：

```toml
default = "reasoner"

[providers.reasoner]
api = "openai.responses"
model = "gpt-5.2"
apiKey = "${OPENAI_API_KEY}"

[providers.compatible_chat]
api = "openai.chat"
model = "deepseek-chat"
baseURL = "${OPENAI_COMPATIBLE_BASE_URL}"
apiKey = "env:OPENAI_COMPATIBLE_API_KEY"
```

默认读取当前目录的 `.env`，但不会覆盖已经存在的进程环境变量。支持两种引用形式：

```text
${ENV_KEY}
env:ENV_KEY
```

任意字符串字段都能引用环境变量，包括 `apiKey`、`baseURL` 和 headers。缺少引用时，配置加载立即以 `ProviderConfigError` 失败，不会带着空密钥运行。

Vercel `LanguageModel` 公共接口不提供模型的最大输出 token 元数据，因此调用层默认显式传入 `maxOutputTokens = 8192`。可以按 provider 覆盖：

```toml
[providers.reasoner]
api = "openai.responses"
model = "gpt-5.2"
maxOutputTokens = 16384
```

基础设施只需提供一层：

```ts
const program = Effect.gen(function*() {
  const driver = yield* Providers.agent("reasoner")
  return yield* PRReview(driver).run(diff)
}).pipe(
  Effect.provide(Providers.layer({ path: "agents.toml" }))
)
```

当前内置 API：

- `openai.responses`
- `openai.chat`
- `openai.completions`
- `anthropic.messages`

OpenAI-compatible 服务选择它实际实现的 API，并通过 `baseURL` 指向兼容端点；不能仅因为厂商宣称 OpenAI-compatible 就默认当作 Responses API。

Binding 的 `read` 自动进入 Context；允许的 `Op` 自动进入支持工具的 Driver。Op 在发起 Agent 的 Effect runtime 中执行，因此它自己的 Layer 依赖不会丢失。

## 两类 Hook

effect-agent 的 `HarnessHook` 与外部 Agent 的原生 Hook 是两个不同概念。

```ts
const observed = Harness.withHooks(claude, ConsoleHook)
```

`HarnessHook` 跨所有 Agent/ComposedAgent 工作，观察 effect-agent 管理的 `RunStarted`、`ToolStarted`、`ToolCompleted`、`ToolFailed`、`Output`、`RunFailed` 和 `RunCompleted`。工具执行失败会发 `ToolFailed`（对齐未来协议 tag `tool.failed`），`ToolStarted`/`ToolFailed`/`ToolCompleted` 保持平衡。Hook 本身是 Effect，可以依赖日志、telemetry、存储等服务；Hook 失败会以 effect-agent 的 `AgentFailure` 终止对应流程。

Claude Agent SDK 原生 Hook 通过专属名称传入：

```ts
ClaudeCode.make({
  claudeCodeHooks: {
    PreToolUse: [{ matcher: "Bash", hooks: [nativeClaudeHook] }]
  }
})
```

`claudeCodeHooks` 保留 Claude SDK 的 matcher、输入和返回协议，只能用于 Claude Code，不会被包装成可移植的 `HarnessHook`。公共配置中不再使用含义模糊的 `hooks`。

## SDK 调研结论

下表区分“SDK 能力上限”和“当前 adapter 已兑现能力”。能力协商只声明后者，防止 SDK 理论支持但 adapter 尚未接线时产生静默越权。

| 能力 | Claude Agent SDK 0.3.232 | Codex SDK 0.147.0 | Pi 0.73.1 |
|---|---|---|---|
| Provider | Claude/Anthropic 体系 | Codex/OpenAI 兼容配置 | 多 Provider、可换 Model |
| 最细事件 | partial assistant、thinking、tool、result | turn/item；没有 token text delta | token delta、thinking、tool、turn |
| 取消/介入 | AbortController、`interrupt()`、权限回调及 hooks | AbortSignal；无 pause API | `abort()`、steer、follow-up、extension hooks |
| 恢复/fork | resume、`forkSession`、`resumeSessionAt` 任意链节点 | resume thread；无任意节点 fork | session tree，runtime/RPC 可按 entry fork |
| 工具 | SDK MCP、PreToolUse/PostToolUse、`canUseTool` | MCP 可见；TS SDK 无通用原生 tool 注册或 pre-tool callback | customTools；extension 可在执行前 block/mutate |
| Object | 原生 JSON Schema，result 带 `structured_output` | 每 turn 原生 `outputSchema` | 无同级原语；适配器注入 typed output tool |
| 沙盒 | SDK sandbox/permissions，可配置不可用时失败 | read-only/workspace-write/danger-full-access + approvals | 无硬沙盒；必须交给外部 Container 隔离 |

当前 adapter 状态：

- Claude Code：stop、原生 object、隔离 Claude Home、cwd、Skill 注入和 Binding Ops → 进程内 SDK MCP 已接；默认隐藏全部内置工具。细粒度暂停尚未接，因此如实声明 `tools: mcp, pause: false`。
- Codex：文本、原生 object、resume、sandbox/approval/thread 配置已接；**thinking 未接（SDK 仅 turn 粒度，无 token/thinking 事件流）**——reasoning-summary 提取（Responses API reasoning items）列为 P1 候选；MCP 只能由调用方通过 Codex 配置提供，Binding Ops 不会伪装成已注入。
- Pi：stop、Binding custom tools、typed output tool 已接；细粒度暂停尚未接，硬沙盒仍为 `none`。
- Vercel：`generateText` tool loop、Effect Schema → JSON Schema、Binding tools、`Output.object` 已接。当前采用完整 run，所以 tool call 只可观察、不可安全暂停。

P0(b) 后协商矩阵（DRAFT §12 修正：text/thinking 为观察级语义，不再要求 pause；toolCall 在统一事件/暂停协议前保持 REJECT；与 `test/capability-matrix.test.ts` 断言一致）：

| Until | vercel | claude-code | codex | pi |
|---|---|---|---|---|
| text | OK | OK | OK | OK |
| thinking | OK | OK | REJECT | OK |
| toolCall | REJECT | REJECT | REJECT | REJECT |
| stop | OK | OK | OK | OK |
| schema | OK | OK | OK | OK |

下一层接入会集中在统一的事件/暂停协议：Vercel 改用 `streamText` + approval boundary，Claude 生成 in-process SDK MCP，Pi 用 pre-tool extension hook。完成前 `Until.toolCall` 会通过 `UnsupportedCapability` 提前失败，而不是在工具已经执行后假装暂停。

## 配置粒度

- Claude：几乎全部 `Options` 透传，包括 model、thinking/effort、maxTurns、budget、permissionMode、sandbox、hooks、plugins、skills、agents、resume/fork 和 MCP。
- Codex：`CodexOptions`、`ThreadOptions` 和 resume thread ID 分层传入，包括 model、reasoning effort、cwd、sandbox、approval、network/web search、base URL 与 CLI config。
- Pi：`CreateAgentSessionOptions` 透传，包括 model、thinkingLevel、cwd、session manager、resource loader、built-in tool allowlist 和 custom tools。

## 验证

```sh
bun install
bun run typecheck
bun test
bun run example
```
