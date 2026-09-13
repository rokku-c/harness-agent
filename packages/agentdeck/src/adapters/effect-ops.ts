/**
 * agentdeck/adapters/effect-ops - the in-proc effect runtime where a WRITE op is
 * gated by the shared ConsentLedger, so ask-2 decisions steer real execution.
 *
 * The gate itself is `effect-ops-gate.ts`; this file is the session lifecycle —
 * open a box, run one turn through the EffectAgent driver, and read the gate's
 * verdict back off the dead turn.
 */
import { Effect } from "effect"
import { AgentContext, Until, type Access } from "@effect-agent/core"
import { EffectAgent, type Model } from "@effect-agent/builtin"
import type { AgentKind } from "../kinds.ts"
import type { ConsentLedger } from "../consent-types.ts"
import type { OpenSessionRequest, SendOutcome, SessionGateway, SessionStatus } from "../flow.ts"
import type { UnifiedAgentConfig } from "../config-types.ts"
import { AWAIT, DENIED, writeOp } from "./effect-ops-gate.ts"

export interface EffectOpsGatewayOptions {
  /** model for the in-proc driver (scripted Model in tests) */
  readonly model: (config: UnifiedAgentConfig) => Model
  /** shared ledger: every write raises an ask here; resolves steer execution */
  readonly ledger: ConsentLedger
}

interface OpsBox {
  readonly sessionId: string
  readonly config: UnifiedAgentConfig
  status: SessionStatus["status"]
  detail?: string
  lastActivityAt?: number
}

export const makeEffectOpsGateway = (options: EffectOpsGatewayOptions): SessionGateway => {
  const boxes = new Map<string, OpsBox>()
  let seq = 0

  return {
    kind: "effect-ops",
    open: async (request: OpenSessionRequest) => {
      const sessionId = request.sessionId ?? "effect-ops-" + (++seq).toString(36)
      boxes.set(sessionId, { sessionId, config: request.config, status: "idle", lastActivityAt: Date.now() })
      return { sessionId, kind: "effect-ops", status: "idle", lastActivityAt: Date.now() }
    },
    close: async (sessionId: string) => { boxes.delete(sessionId) },
    send: async (sessionId: string, text: string): Promise<SendOutcome> => {
      const box = boxes.get(sessionId)
      if (box === undefined) return { ok: false, detail: "unknown session " + sessionId }
      if (box.status === "running") return { ok: false, detail: "session busy: a turn is already running" }
      box.status = "running"
      box.lastActivityAt = Date.now()
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
        const reply = String((raw as unknown as { text?: unknown })?.text ?? raw)
        box.status = "idle"
        box.detail = undefined
        box.lastActivityAt = Date.now()
        return { ok: true, text: reply }
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : String(error)
        box.status = "failed"
        box.detail = message
        box.lastActivityAt = Date.now()
        if (message.startsWith(AWAIT)) return { ok: false, detail: "awaiting operator approval", awaiting: [message.slice(AWAIT.length)] }
        if (message.startsWith(DENIED)) return { ok: false, detail: "write denied by operator" }
        return { ok: false, detail: message }
      }
    },
    status: async (sessionId: string): Promise<SessionStatus> => {
      const box = boxes.get(sessionId)
      if (box === undefined) throw new Error("unknown session " + sessionId)
      return { sessionId, kind: "effect-ops" as AgentKind, status: box.status, lastActivityAt: box.lastActivityAt, detail: box.detail }
    },
    sessions: () =>
      [...boxes.entries()].map(([sessionId, box]) => ({ sessionId, kind: "effect-ops" as AgentKind, status: box.status, lastActivityAt: box.lastActivityAt, detail: box.detail }))
  }
}
