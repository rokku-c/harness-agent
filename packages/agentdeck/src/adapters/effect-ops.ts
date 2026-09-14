import { Effect } from "effect"
import { AgentContext, Until, type Access } from "@effect-agent/core"
import { EffectAgent } from "@effect-agent/builtin"
import type { Model } from "@effect-agent/model"
import type { SendOutcome, SessionGateway } from "../flow.ts"
import type { UnifiedAgentConfig } from "../config-types.ts"
import type { ConsentLedger } from "../consent-types.ts"
import { detailOf, makeSessionTable, type SessionBox } from "./session-table.ts"
import { AWAIT, DENIED, writeOp } from "./effect-ops-gate.ts"

export interface EffectOpsGatewayOptions {
  readonly model: (config: UnifiedAgentConfig) => Model
  readonly ledger: ConsentLedger
}

interface OpsBox extends SessionBox {
  readonly config: UnifiedAgentConfig
}

export const makeEffectOpsGateway = (options: EffectOpsGatewayOptions): SessionGateway => {
  const table = makeSessionTable<OpsBox>({
    kind: "effect-ops",
    prefix: "effect-ops",
    create: (sessionId, request) => ({ sessionId, config: request.config, status: "idle", lastActivityAt: Date.now() })
  })

  const send = (sessionId: string, text: string): Promise<SendOutcome> =>
    table.run(sessionId, async (box) => {
      const access: ReadonlyArray<Access> = [
        { binding: { uri: "ea://deck/effect-ops/" + sessionId, ops: [writeOp(options.ledger, sessionId)] }, write: true }
      ]
      try {
        const driver = EffectAgent.make({ model: options.model(box.config), maxSteps: 6 })
        const raw = await Effect.runPromise(
          (driver as unknown as { run: (r: unknown) => Effect.Effect<unknown> }).run({
            context: AgentContext.text(text), until: Until.text, access
          }) as Effect.Effect<unknown>
        )
        return { ok: true, text: String((raw as unknown as { text?: unknown })?.text ?? raw) }
      } catch (error) {
        const message = detailOf(error)
        if (message.startsWith(AWAIT)) return { ok: false, detail: "awaiting operator approval", awaiting: [message.slice(AWAIT.length)] }
        if (message.startsWith(DENIED)) return { ok: false, detail: "write denied by operator" }
        throw error
      }
    })

  return { kind: "effect-ops", open: table.open, close: table.close, send, status: table.status, sessions: table.sessions }
}
