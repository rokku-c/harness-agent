import { Effect, Schema as EffectSchema } from "effect"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { AgentIR } from "@effect-agent/core"
import { AgentIRSchema, EffectAgent } from "@effect-agent/core"
import type { CompileEnv } from "@effect-agent/core"
import type { AgentProgram } from "@effect-agent/core"

/**
 * EffectAgentMcp —— 把 agent 暴露为 MCP 工具（GOAL「被其他 agent 消费，mcp/api 是必须的」）。
 *
 * 每个注册的 agent 变成一个 MCP tool：别的 agent（Claude Code / MCP 客户端）可调用它。
 * 这就是 GOAL 的「可描述 + 可被 agent 消费」—— 另一个 agent 通过 MCP 调用本系统的 agent。
 *
 *   const mcp = EffectAgentMcp.make({
 *     agents: [
 *       { name: "reviewer", ir, env },
 *       { name: "planner", ir2, env2 },
 *     ],
 *   })
 *   // 用 stdio transport 启动（Claude Code / MCP 客户端可直接连）
 */

export interface McpAgent {
  readonly name: string
  readonly ir: AgentIR
  readonly env: CompileEnv
}

export interface EffectAgentMcpOptions {
  readonly agents: ReadonlyArray<McpAgent>
  readonly serverName?: string
  readonly serverVersion?: string
}

/** 把 agent 暴露为 MCP tool：name + 入参 + 执行（编译并运行）。 */
const registerAgent = (server: McpServer, agent: McpAgent) => {
  server.tool(
    agent.name,
    `effect-agent 暴露的 agent「${agent.ir.id}」。${agent.ir.role ?? ""} 调用它执行该 agent。`,
    { task: z.string() },
    async (input) => {
      const program: AgentProgram<unknown, unknown> = EffectAgent.compile(agent.ir, agent.env)
      const result = await Effect.runPromise(program.run(input.task))
      return { content: [{ type: "text" as const, text: JSON.stringify(result.output) }] }
    }
  )
}

export const EffectAgentMcp = {
  make: (options: EffectAgentMcpOptions): McpServer => {
    const server = new McpServer({
      name: options.serverName ?? "effect-agent",
      version: options.serverVersion ?? "0.0.0",
    })
    for (const agent of options.agents) registerAgent(server, agent)
    return server
  },

  /** 从 IR 编译成可运行程序（供 MCP 之外的 API 复用）。 */
  compile: (ir: AgentIR, env: CompileEnv): AgentProgram<unknown, unknown> =>
    EffectAgent.compile(ir, env),

  /** 校验一份 IR（描述语言 Schema）。 */
  validate: (value: unknown) => EffectSchema.decodeUnknown(AgentIRSchema)(value),
}
