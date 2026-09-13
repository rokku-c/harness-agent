/**
 * agentdeck/adapters/effect - the "self" agent (this framework's own
 * EffectAgent runtime) as a SessionGateway. Flow control maps 1:1 onto
 * driver.run(until text); config maps onto the driver options + model.
 */
import { Effect } from "effect"
import { AgentContext, Until } from "@effect-agent/core"
import { EffectAgent, type Model } from "@effect-agent/builtin"
import type { SendOutcome, SessionGateway, SessionTurn } from "../flow.ts"
import type { UnifiedAgentConfig } from "../config-types.ts"
import { makeSessionTable, type SessionBox } from "./session-table.ts"

export interface EffectGatewayOptions {
  /** model for the in-proc driver; REQUIRED for real use, injectable for tests */
  readonly model?: (config: UnifiedAgentConfig) => Model
  readonly maxTurns?: number
}

interface EffectBox extends SessionBox {
  readonly config: UnifiedAgentConfig
  readonly seed?: string
  /** alternating user/agent text, in order */
  readonly history: Array<string>
}

export const effectGateway = (options: EffectGatewayOptions = {}): SessionGateway => {
  const table = makeSessionTable<EffectBox>({
    kind: "effect",
    prefix: "effect",
    create: (sessionId, request) => ({
      sessionId,
      config: request.config,
      seed: request.prompt,
      history: [],
      status: "idle",
      lastActivityAt: Date.now()
    })
  })

  const driverFor = (config: UnifiedAgentConfig) => {
    const provider = options.model
    if (provider === undefined) throw new Error("effect gateway needs a model provider (inject options.model)")
    return EffectAgent.make({ model: provider(config), maxSteps: options.maxTurns ?? 8 })
  }

  const send = (sessionId: string, text: string): Promise<SendOutcome> =>
    table.run(sessionId, async (box) => {
      const prior = box.history.length > 0 ? "Prior turns:\n" + box.history.map((h, i) => (i + 1) + ". " + h).join("\n") + "\n\n" : ""
      const task = (box.seed !== undefined ? box.seed + "\n" : "") + prior + text
      const output = await Effect.runPromise(
        driverFor(box.config).run({ context: AgentContext.text(task), until: Until.text, access: [] })
      )
      const reply = String((output as unknown as { text?: unknown })?.text ?? output)
      box.history.push(text, reply)
      return { ok: true, text: reply }
    })

  const boxOf = (sessionId: string): EffectBox => {
    const box = table.get(sessionId)
    if (box === undefined) throw new Error("unknown session " + sessionId)
    return box
  }

  return {
    kind: "effect",
    open: table.open,
    close: table.close,
    send,
    status: table.status,
    sessions: table.sessions,
    history: (sessionId: string) => {
      const box = boxOf(sessionId)
      const turns: Array<SessionTurn> = []
      box.history.forEach((entry, i) => turns.push({ role: i % 2 === 0 ? "user" : "agent", content: entry, at: box.lastActivityAt ?? Date.now() }))
      return turns
    }
  }
}
