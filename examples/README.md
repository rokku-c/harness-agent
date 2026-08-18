# Examples

从仓库根目录运行：

```sh
bun run example
bun run example text
bun run example object
bun run example tool
```

不带名称时列出所有示例。示例默认读取根目录的 `config.toml` 和 `.env`；调用模型的示例可能产生费用。

## 基础

| 示例 | 内容 |
|---|---|
| `01-text.ts` | 文本输入与输出 |
| `02-object.ts` | Effect Schema 结构化输出 |
| `03-tool.ts` | Binding Op 工具注入 |
| `04-multi-agent.ts` | 多 Provider 并发探索 |
| `05-composed-agents.ts` | Claude Code、Codex、Pi 能力比较 |
| `06-claude-code-object.ts` | Claude Code 结构化输出 |
| `07-review-project.ts` | Skill 与只读项目工具 |

## 组合

| 示例 | 内容 |
|---|---|
| `08-subagents.ts` | Claude Code 运行时委派 |
| `09-ssh-game.ts` | SSH 远程文件环境 |
| `10-blackboard-puzzle.ts` | 共享 Binding 黑板 |
| `11-meta-agent-live.ts` | AgentSpec 动态编译 |
| `12-meta-agent-render.ts` | AgentSpec 渲染源码 |
| `13-agent-swarm.ts` | 有界并发、失败隔离与收敛 |
| `14-project-iterate.ts` | Agent 在受限 ProjectEnvironment 中自主观察、修改和验证 |
| `15-product-plan.ts` | 产品路线图生成 |
| `16-composed-keeper.ts` | 将完成的 Agent 组合为 ComposedAgent，再由 AgentKeeper 长期托管 |
| `17-predictive-coding.ts` | 工具执行前预测、执行后校验，并把预测误差写入记忆 |

这些示例用于验证组合能力，不代表每种组合都是新的框架抽象。

## 常用命令

```sh
bun run example multi-agent
bun run example review-project
bun run example subagents
bun run example ssh-game
bun run example blackboard-puzzle
bun run example agent-swarm --task "分析任务"
bun run example project-iterate --task "检查并改进核心抽象"
bun run example product-plan
```

`review-project` 的详细日志写入 stderr，最终 JSON 写入 stdout：

```sh
bun run example review-project > review.json 2> review.log
```

## Claude Code 配置

```toml
[composedAgents.claudeCode]
provider = "claude"
cwd = "."
maxTurns = 3
permissionMode = "plan"
tools = []
settingSources = []
persistSession = false
```

省略 `claudeHome` 时，Driver 为每次运行创建并回收临时 `CLAUDE_CONFIG_DIR`。通过 `.uses/.writes` 授权的 Binding Ops 会注册为进程内 MCP tools。

## Meta-agent

示例 11 和 12 共享 `examples/lib/agent-spec.ts`：

- 模型只生成经过 Schema 校验的 AgentSpec；
- 可执行 Op 来自宿主注册表；
- Route A 在内存中编译并运行；
- Route B 生成可审查的 TypeScript。

```sh
bun run example meta-agent-live "审查 src/"
bun run example meta-agent-render "审查 src/"
```

## 写操作

`project-iterate --execute`、SSH 和生成文件示例会修改外部状态。运行前先阅读对应源码中的权限和路径范围。
