/**
 * agentdeck/adapters/effect - the "self" agent (this framework's own
 * EffectAgent runtime) as a SessionGateway. Flow control maps 1:1 onto
 * driver.run(until text); config maps onto the driver options + model.
 */
import { Effect } from "effect"
import { AgentContext, Until } from "@effect-agent/core"
import { EffectAgent, type Model } from "@effect-agent/builtin"
import type { AgentKind, OpenSessionRequest, SendOutcome, SessionGateway, SessionStatus, UnifiedAgentConfig } from "../types.ts"

export interface EffectGatewayOptions {
  /** model for the in-proc driver; REQUIRED for real use, injectable for tests */
  readonly model?: (config: UnifiedAgentConfig) => Model
  readonly maxTurns?: number
}

interface SessionBox {
  readonly config: UnifiedAgentConfig
  readonly seed?: string
  readonly history: Array<string>
  status: SessionStatus["status"]
  detail?: string
  lastActivityAt?: number
}

export const effectGateway = (options: EffectGatewayOptions = {}): SessionGateway => {
  const sessions = new Map<string, SessionBox>()
  let seq = 0

  const driverFor = (config: UnifiedAgentConfig) => {
    const provider = options.model
    if (provider === undefined) throw new Error("effect gateway needs a model provider (inject options.model)")
    const model = provider(config)
    return EffectAgent.make({ model, maxSteps: options.maxTurns ?? 8 })
  }

  const getBox = (sessionId: string): SessionBox => {
    const box = sessions.get(sessionId)
    if (box === undefined) throw new Error("unknown session " + sessionId)
    return box
  }

  return {
    kind: "effect",
    open: async (request: OpenSessionRequest) => {
      const sessionId = request.sessionId ?? "effect-" + (++seq).toString(36)
      const box: SessionBox = { config: request.config, seed: request.prompt, history: [], status: "idle", lastActivityAt: Date.now() }
      sessions.set(sessionId, box)
      return { sessionId, kind: "effect", status: "idle", lastActivityAt: box.lastActivityAt }
    },
    close: async (sessionId: string) => { sessions.delete(sessionId) },
    send: async (sessionId: string, text: string): Promise<SendOutcome> => {
      const box = getBox(sessionId)
      if (box.status === "running") return { ok: false, detail: "session busy: a turn is already running" }
      box.status = "running"
      box.lastActivityAt = Date.now()
      try {
        const driver = driverFor(box.config)
        const prior = box.history.length > 0 ? "Prior turns:\n" + box.history.map((h, i) => (i + 1) + ". " + h).join("\n") + "\n\n" : ""
        const task = (box.seed !== undefined ? box.seed + "\n" : "") + prior + text
        const output = await Effect.runPromise(
          driver.run({ context: AgentContext.text(task), until: Until.text, access: [] })
        )
        const reply = String((output as unknown as { text?: unknown })?.text ?? output)
        box.history.push(text, reply)
        box.status = "idle"
        box.lastActivityAt = Date.now()
        return { ok: true, text: reply }
      } catch (error) {
        box.status = "failed"
        box.detail = error instanceof Error ? error.message : String(error)
        return { ok: false, detail: box.detail }
      }
    },
    history: async (sessionId: string) => {
      const box = getBox(sessionId)
      const turns: Array<{ role: "user" | "agent"; content: string; at: number }> = []
      box.history.forEach((entry, i) => turns.push({ role: i % 2 === 0 ? "user" : "agent", content: entry, at: box.lastActivityAt ?? Date.now() }))
      return turns
    },
    status: async (sessionId: string): Promise<SessionStatus> => {
      const box = getBox(sessionId)
      return { sessionId, kind: "effect", status: box.status, lastActivityAt: box.lastActivityAt, detail: box.detail }
    },
    sessions: () => [...sessions.entries()].map(([sessionId, box]) => ({ sessionId, kind: "effect" as AgentKind, status: box.status, lastActivityAt: box.lastActivityAt, detail: box.detail }))
  }
}
