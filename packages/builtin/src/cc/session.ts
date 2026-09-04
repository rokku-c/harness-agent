/**
 * cc/session.ts - the SDK SESSION (launch + collect).
 *
 * Concept: translate a run into one Claude Code query and stream it to
 * completion. The MCP bridge server, the allowed-tool allowlist and the
 * environment (with an isolated CLAUDE_CONFIG_DIR) are assembled HERE - the
 * driver stays a thin composer over this.
 */
import { Effect } from "effect"
import { createSdkMcpServer, query, type Options, type SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import { AgentFailure } from "@effect-agent/core"
import type { InjectedOp } from "./mcp.ts"

export interface SessionSpec {
  readonly agentId: string
  readonly prompt: string
  readonly injected: ReadonlyArray<InjectedOp>
  readonly outputFormat?: { type: "json_schema"; schema: Record<string, unknown> }
}

export const runClaudeSession = (
  sdkOptions: Options,
  spec: SessionSpec,
  hooks: Options["hooks"] | undefined,
  claudeHome: string | undefined,
  queryFn: typeof query | undefined
): Effect.Effect<ReadonlyArray<SDKMessage>, AgentFailure> => {
  const effectiveMcpServers = spec.injected.length > 0
    ? {
        ...sdkOptions.mcpServers,
        effect_agent: createSdkMcpServer({ name: "effect_agent", version: "0.0.0", tools: spec.injected.map(({ definition }) => definition) })
      }
    : sdkOptions.mcpServers
  const effectiveAllowedTools = [
    ...((sdkOptions.allowedTools ?? []) as ReadonlyArray<string>),
    ...spec.injected.map(({ allowedName }) => allowedName)
  ]
  const effectiveEnv: Record<string, string | undefined> = {
    ...process.env,
    ...(sdkOptions.env ?? {}),
    ...(claudeHome ? { CLAUDE_CONFIG_DIR: claudeHome } : {})
  }
  return Effect.tryPromise({
    try: async () => {
      const all: SDKMessage[] = []
      for await (const message of (queryFn ?? query)({
        prompt: spec.prompt,
        options: {
          ...sdkOptions,
          env: effectiveEnv,
          hooks,
          mcpServers: effectiveMcpServers,
          allowedTools: effectiveAllowedTools,
          outputFormat: spec.outputFormat
        }
      })) all.push(message)
      return all
    },
    catch: (cause) =>
      new AgentFailure({
        agent: spec.agentId,
        cause,
        message: cause instanceof Error ? cause.message : String(cause)
      })
  })
}
