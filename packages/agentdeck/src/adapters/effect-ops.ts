/**
 * agentdeck/adapters/effect-ops - the in-proc effect runtime where a WRITE op
 * is gated by the shared ConsentLedger: the first send raises a consent ask
 * and aborts with awaiting[]; once the operator (or an auto policy) resolves
 * it, re-sending the same turn actually EXECUTES the op. Denial aborts with a
 * readable cause. This proves ask 2 decisions steer real execution.
 */
import { Effect, Schema } from "effect"
import { AgentContext, Op, Until, notationText, type Access } from "@effect-agent/core"
import { EffectAgent, type Model } from "@effect-agent/builtin"
import type { AgentKind, ConsentLedger, OpenSessionRequest, SendOutcome, SessionGateway, SessionStatus, UnifiedAgentConfig } from "../types.ts"

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

  /** find the newest ledger entry for a session+tool, if any */
  const entryFor = (sessionId: string, tool: string) =>
    options.ledger.entries(sessionId).find((e) => e.tool === tool)

  const writeOp = (sessionId: string) =>
    Op.write({
      name: "write_file",
      description: notationText("Write a file at the given path."),
      input: Schema.Struct({ path: Schema.String }),
      output: Schema.Struct({ path: Schema.String, ok: Schema.Boolean }),
      execute: (input: { path: string }) =>
        Effect.gen(function* () {
          const entry = entryFor(sessionId, "write_file")
          const callId = entry?.callId ?? options.ledger.ask(sessionId, "write_file", input)
          const current = entryFor(sessionId, "write_file")
          if (current === undefined || current.decision === "pending")
            return yield* Effect.die(new Error("DECK_AWAIT:" + callId))
          if (current.decision === "deny") return yield* Effect.die(new Error("DECK_DENIED:" + current.callId))
          // operator approved: the write really happens
          return yield* Effect.succeed({ path: input.path, ok: true })
        })
    })

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
        { binding: { uri: "ea://deck/effect-ops/" + sessionId, ops: [writeOp(sessionId)] }, write: true }
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
        if (message.startsWith("DECK_AWAIT:")) return { ok: false, detail: "awaiting operator approval", awaiting: [message.slice("DECK_AWAIT:".length)] }
        if (message.startsWith("DECK_DENIED:")) return { ok: false, detail: "write denied by operator" }
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
