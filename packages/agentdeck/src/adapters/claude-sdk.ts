/**
 * agentdeck/adapters/claude-sdk - the claude-code agent driven IN-PROCESS by
 * this framework's own ClaudeCode driver (which wraps the anthropic
 * claude-agent-sdk). One unified config maps onto driver options; a session
 * send is one driver.run(until text). Flow control and transcripts are
 * identical to the other gateways, so products swap CLI/SDK freely.
 */
import { Effect } from "effect"
import { AgentContext, Until } from "@effect-agent/core"
import { ClaudeCode, type ClaudeCodeOptions } from "@effect-agent/builtin"
import type { SendOutcome, SessionGateway, SessionTurn } from "../flow.ts"
import type { UnifiedAgentConfig } from "../config-types.ts"
import { makeSessionTable, type SessionBox } from "./session-table.ts"

export interface ClaudeSdkGatewayOptions {
  /** SDK query fn (production: the real claude-agent-sdk query; tests inject a stub) */
  readonly query: NonNullable<ClaudeCodeOptions["query"]>
  /** extra SDK option knobs merged under config.extra */
  readonly baseOptions?: ClaudeCodeOptions
}

interface SdkBox extends SessionBox {
  readonly config: UnifiedAgentConfig
  readonly turns: Array<SessionTurn>
}

export const makeClaudeSdkGateway = (options: ClaudeSdkGatewayOptions): SessionGateway => {
  const table = makeSessionTable<SdkBox>({
    kind: "claude-cc",
    prefix: "claude-cc",
    create: (sessionId, request) => ({
      sessionId, config: request.config, status: "idle", lastActivityAt: Date.now(), turns: []
    })
  })

  const driverOptions = (config: UnifiedAgentConfig): ClaudeCodeOptions => ({
    ...(options.baseOptions ?? {}),
    ...(config.extra as Record<string, unknown> | undefined),
    model: config.model ?? "claude-sonnet-4-5",
    query: options.query
  })

  const send = (sessionId: string, text: string): Promise<SendOutcome> =>
    table.run(sessionId, async (box) => {
      const driver = ClaudeCode.make(driverOptions(box.config))
      const turn = Effect.runPromise(
        (driver as unknown as { run: (r: unknown) => Effect.Effect<unknown> }).run({
          context: AgentContext.text(text),
          until: Until.text,
          access: []
        }) as Effect.Effect<unknown>
      )
      const deadline = box.config.turnTimeoutMs === undefined
        ? undefined
        : new Promise<never>((_, reject) => setTimeout(() => reject(new Error("turn timed out")), box.config.turnTimeoutMs))
      const raw = await Promise.race([turn, deadline].filter(Boolean) as Array<Promise<unknown>>)
      const reply = String((raw as unknown as { text?: unknown })?.text ?? raw)
      box.turns.push({ role: "user", content: text, at: Date.now() }, { role: "agent", content: reply, at: Date.now() })
      return { ok: true, text: reply }
    })

  return {
    kind: "claude-cc",
    open: table.open,
    close: table.close,
    send,
    status: table.status,
    sessions: table.sessions,
    history: (sessionId: string) => table.get(sessionId)?.turns ?? []
  }
}
