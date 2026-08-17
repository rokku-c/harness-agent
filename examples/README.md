# Examples

所有示例默认读取仓库根目录的 `config.toml` 和 `.env`，应从仓库根目录运行。

```sh
bun run example
bun run example text
bun run example object
bun run example tool
bun run example multi-agent
bun run example composed-agents
bun run example claude-code-object
bun run example review-project
```

不带名称时列出所有示例。Runner 会自动发现 `examples/` 中符合 `数字-名称.ts` 的文件，新增示例不需要修改 `package.json`。

- `01-text.ts`：默认 provider 的普通文本任务。
- `02-object.ts`：使用 Effect Schema 要求模型输出经过验证的对象。
- `03-tool.ts`：把 Effect Op 自动暴露成 LLM tool。
- `04-multi-agent.ts`：为 TOML 中的每个 provider 建立一个 Agent，并发探索同一问题。
- `05-composed-agents.ts`：用同一个业务定义 harness Claude Code、Codex 和 Pi，并比较 adapter 能力；不会发起 API 调用。
- `06-claude-code-object.ts`：通过 Claude Agent SDK 启动完整 Claude Code Agent，并使用 Effect Schema 获取结构化对象。
- `07-review-project.ts`：让 Claude Code 审查当前项目；禁用全部内置工具，仅注入项目审查 Skill 和受限的只读文件工具，并返回结构化 Review。

`review-project` 的详细 HarnessHook 日志写入 stderr，最终 JSON 写入 stdout，因此可以分别保存：

```sh
bun run example review-project > review.json 2> review.log
```

日志包含 prompt、每次工具输入、工具输出预览、耗时、结构化输出、失败原因和总运行时间。读取的大文件内容会截断，避免日志无限增长；不会输出 provider API key。

## Claude Code object 示例

`claude-code-object` 不使用 `config.toml` 的 `anthropic.messages` provider，因为 Claude Code 是独立的 ComposedAgent。配置放在独立区域：

```toml
[composedAgents.claudeCode]
provider = "claude" # 继承 providers.claude 的 model/apiKey/baseURL
cwd = "."
# claudeHome = "/path/to/isolated/claude-home"
# 可选；省略时使用 Claude Code 的默认模型
# model = "claude-sonnet-4-6"
apiKey = "${ANTHROPIC_API_KEY}"
# baseURL = "${ANTHROPIC_BASE_URL}"
maxTurns = 3
permissionMode = "plan"
tools = []
skillPaths = ["./skills/reviewer"]
skills = ["reviewer"]
settingSources = []
persistSession = false
```

认证值仍可放在 `.env`：

```dotenv
ANTHROPIC_API_KEY=sk-ant-...
```

然后运行：

```sh
bun run example claude-code-object
```

示例使用 `permissionMode = "plan"` 和 `tools = []`，只要求结构化规划结果，不向 Claude Code 提供内置工具。`allowedTools = []` 只表示“不自动批准任何工具”，并不负责隐藏工具。

`claudeHome` 省略时，Adapter 会为每次运行创建随机临时 `CLAUDE_CONFIG_DIR`，并在成功、失败或中断后回收。`skillPaths` 中的 Skill 会复制到该隔离目录。通过 `Agent.uses/writes` 授权的 Binding Ops 会注册为进程内 SDK MCP tools；它们不属于 Claude 内置工具，因此仍可在 `tools = []` 时使用。

这些命令会真实调用模型 API，可能产生费用。`example:multi` 会调用 `config.toml` 中的所有 provider。
