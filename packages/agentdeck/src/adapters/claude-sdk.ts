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
import type { AgentKind, OpenSessionRequest, SendOutcome, SessionGateway, SessionStatus, SessionTurn, UnifiedAgentConfig } from "../types.ts"

export interface ClaudeSdkGatewayOptions {
  /** SDK query fn (production: the real claude-agent-sdk query; tests inject a stub) */
  readonly query: NonNullable<ClaudeCodeOptions["query"]>
  /** extra SDK option knobs merged under config.extra */
  readonly baseOptions?: ClaudeCodeOptions
}

interface SdkBox {
  readonly sessionId: string
  readonly config: UnifiedAgentConfig
  status: SessionStatus["status"]
  detail?: string
  lastActivityAt?: number
  readonly turns: Array<SessionTurn>
}

export const makeClaudeSdkGateway = (options: ClaudeSdkGatewayOptions): SessionGateway => {
  const boxes = new Map<string, SdkBox>()
  let seq = 0

  const driverOptions = (config: UnifiedAgentConfig): ClaudeCodeOptions => ({
    ...(options.baseOptions ?? {}),
    ...(config.extra as Record<string, unknown> | undefined),
    model: config.model ?? "claude-sonnet-4-5",
    query: options.query
  })

  return {
    kind: "claude-cc",
    open: async (request: OpenSessionRequest) => {
      const sessionId = request.sessionId ?? "claude-cc-" + (++seq).toString(36)
      boxes.set(sessionId, { sessionId, config: request.config, status: "idle", lastActivityAt: Date.now(), turns: [] })
      return { sessionId, kind: "claude-cc", status: "idle", lastActivityAt: Date.now() }
    },
    close: async (sessionId: string) => { boxes.delete(sessionId) },
    send: async (sessionId: string, text: string): Promise<SendOutcome> => {
      const box = boxes.get(sessionId)
      if (box === undefined) return { ok: false, detail: "unknown session " + sessionId }
      if (box.status === "running") return { ok: false, detail: "session busy: a turn is already running" }
      box.status = "running"
      box.lastActivityAt = Date.now()
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
      try {
        const raw = await Promise.race([turn, deadline].filter(Boolean) as Array<Promise<unknown>>)
        const reply = String((raw as unknown as { text?: unknown })?.text ?? raw)
        box.turns.push({ role: "user", content: text, at: Date.now() }, { role: "agent", content: reply, at: Date.now() })
        box.status = "idle"
        box.lastActivityAt = Date.now()
        return { ok: true, text: reply }
      } catch (error) {
        box.status = "failed"
        box.detail = error instanceof Error ? error.message : String(error)
        return { ok: false, detail: box.detail }
      }
    },
    status: async (sessionId: string): Promise<SessionStatus> => {
      const box = boxes.get(sessionId)
      if (box === undefined) throw new Error("unknown session " + sessionId)
      return { sessionId, kind: "claude-cc", status: box.status, lastActivityAt: box.lastActivityAt, detail: box.detail }
    },
    sessions: () =>
      [...boxes.entries()].map(([sessionId, box]) => ({ sessionId, kind: "claude-cc" as AgentKind, status: box.status, lastActivityAt: box.lastActivityAt, detail: box.detail })),
    history: (sessionId: string) => boxes.get(sessionId)?.turns ?? []
  }
}
