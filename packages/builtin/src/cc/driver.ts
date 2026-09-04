/**
 * cc/driver.ts - THE ClaudeCode DRIVER (facade, top layer).
 *
 * Concept: Claude Code is an external agent with its own loop - effect-agent
 * treats it as a black box and expresses it as just another Driver: binding
 * ops become native MCP tools (cc/mcp.ts), one SDK session is launched and
 * drained (cc/session.ts), and the until decides what comes back
 * (cc/result.ts). This file only composes those layers.
 */
import { Effect, Runtime } from "effect"
import { materialize, requireUntil, schemaJson, type Driver, type RunRequest } from "@effect-agent/core"
import type { ClaudeCodeOptions } from "./options.ts"
import { mcpTools } from "./mcp.ts"
import { runClaudeSession } from "./session.ts"
import { interpretResult } from "./result.ts"

export const ClaudeCode = {
  make: (options: ClaudeCodeOptions = {}): Driver => {
    const driver: Driver = {
      id: "claude-code",
      capabilities: {
        provider: { _tag: "Fixed", api: "anthropic.messages" },
        granularity: "run",
        thinking: true,
        cancel: true,
        pause: true,
        resume: false,
        fork: "session",
        tools: "native",
        toolCalls: "intercept",
        structuredOutput: "native",
        sandbox: "delegated"
      },
      run: <A, R>(request: RunRequest<A, R>) =>
        Effect.gen(function* () {
          const unsupported = requireUntil(driver.id, driver.capabilities, request.until)
          if (unsupported) return yield* Effect.fail(unsupported)
          const prepared = yield* materialize(request)
          const runtime = yield* Effect.runtime<any>()
          // read ops always; write ops only where write access was granted
          const ops = prepared.access.flatMap(({ binding, write }) =>
            (binding.ops ?? []).filter((op) => op.access === "read" || write)
          )
          const injected = mcpTools(ops, runtime)
          const outputFormat = request.until._tag === "Schema"
            ? { type: "json_schema" as const, schema: schemaJson(request.until.schema) as unknown as Record<string, unknown> }
            : undefined
          const messages = yield* runClaudeSession(
            { ...options } as any,
            { agentId: driver.id, prompt: prepared.context.render(), injected, outputFormat },
            options.claudeCodeHooks,
            options.claudeHome,
            options.query
          )
          return yield* interpretResult<A>(driver.id, request.until, messages)
        }).pipe(Effect.scoped) as any
    }
    return driver
  }
}
