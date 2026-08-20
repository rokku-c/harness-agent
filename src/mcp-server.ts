import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { defaultToSchema, EffectAgent } from "@effect-agent/core"
import { ClaudeCode, EffectAgentMcp } from "@effect-agent/builtin"

/**
 * effect-agent MCP 服务器（stdio）—— GOAL「被其他 agent 消费，mcp/api 是必须的」。
 *
 * 把 agent 暴露为 MCP 工具：Claude Code 或任意 MCP 客户端可连接并调用这些 agent。
 *
 * 启动：
 *   bun run src/mcp-server.ts
 *
 * Claude Code 里配置：
 *   claude mcp add effect-agent -- bun run /path/to/src/mcp-server.ts
 *
 * 然后 Claude Code 里就能直接调用暴露的 agent 工具。
 */

// 演示：暴露两个 agent（一个审查者，一个规划者）。
// 真实用法：从 config.toml 读 provider，或从 IR 仓库载入描述。
const reviewerIR = EffectAgent.gen(function*() {
  yield EffectAgent.define("reviewer")
  yield EffectAgent.role("审查项目代码，产出结构化发现")
  yield EffectAgent.produces({ kind: "stop" })
  yield EffectAgent.driver("composed", "claude-code")
})

const plannerIR = EffectAgent.gen(function*() {
  yield EffectAgent.define("planner")
  yield EffectAgent.role("把需求拆成可执行计划")
  yield EffectAgent.produces({ kind: "stop" })
  yield EffectAgent.driver("composed", "claude-code")
})

// 编译环境：driver 解析到真实 Claude Code / Provider。
const env = {
  resolveDriver: () => ClaudeCode.make(),
  toSchema: defaultToSchema,
}

const server = EffectAgentMcp.make({
  serverName: "effect-agent",
  serverVersion: "0.0.0",
  agents: [
    { name: "reviewer", ir: reviewerIR, env },
    { name: "planner", ir: plannerIR, env },
  ],
})

const transport = new StdioServerTransport()
await server.connect(transport)
console.error("[effect-agent] MCP server connected via stdio")
