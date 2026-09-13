/**
 * The session lifecycle every gateway shares: the box table, the generated id,
 * the busy guard, the status transitions and the read-back.
 *
 * Five gateways had grown their own copy — same messages, same states — and only
 * two things were ever theirs: how a turn runs, and the id prefix. Everything
 * else is one answer for every agent kind, which is the point of a middle
 * abstraction: `run` owns the states a turn leaves behind, so a gateway's turn
 * only reports an outcome and cannot forget to clear a stale `detail`.
 */
import type { AgentKind } from "../kinds.ts"
import type { OpenSessionRequest, SendOutcome, SessionStatus } from "../flow.ts"

export const BUSY = "session busy: a turn is already running"

/** A failed turn's message. Wider than `instanceof Error`: an Effect that dies
 * rejects with whatever it died with, and gateways read protocol markers here. */
export const detailOf = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error)

export interface SessionBox {
  readonly sessionId: string
  status: SessionStatus["status"]
  detail?: string
  lastActivityAt?: number
}

export interface SessionTable<B extends SessionBox> {
  get(sessionId: string): B | undefined
  open(request: OpenSessionRequest): Promise<SessionStatus>
  close(sessionId: string): Promise<void>
  status(sessionId: string): Promise<SessionStatus>
  sessions(): ReadonlyArray<SessionStatus>
  /** one turn, under the guard: unknown id, busy, running -> idle or failed. */
  run(sessionId: string, turn: (box: B) => Promise<SendOutcome>): Promise<SendOutcome>
}

export const makeSessionTable = <B extends SessionBox>(options: {
  /** the kind a status carries when the box does not say */
  readonly kind: AgentKind
  /** generated ids read `<prefix><seq>` */
  readonly prefix: string
  readonly create: (sessionId: string, request: OpenSessionRequest) => B
  /** the kind this box's status carries — CLI dialects label by their config */
  readonly kindOf?: (box: B) => AgentKind
  /** teardown that has to run while the box is still reachable */
  readonly onClose?: (box: B) => void
}): SessionTable<B> => {
  const boxes = new Map<string, B>()
  const kindOf = options.kindOf ?? (() => options.kind)
  let seq = 0

  const statusOf = (box: B): SessionStatus =>
    ({ sessionId: box.sessionId, kind: kindOf(box), status: box.status, lastActivityAt: box.lastActivityAt, detail: box.detail })

  return {
    get: (sessionId) => boxes.get(sessionId),
    open: async (request) => {
      const sessionId = request.sessionId ?? options.prefix + "-" + (++seq).toString(36)
      const box = options.create(sessionId, request)
      boxes.set(sessionId, box)
      return statusOf(box)
    },
    close: async (sessionId) => {
      const box = boxes.get(sessionId)
      if (box === undefined) return
      options.onClose?.(box)
      boxes.delete(sessionId)
    },
    status: async (sessionId) => {
      const box = boxes.get(sessionId)
      if (box === undefined) throw new Error("unknown session " + sessionId)
      return statusOf(box)
    },
    sessions: () => [...boxes.values()].map(statusOf),
    run: async (sessionId, turn) => {
      const box = boxes.get(sessionId)
      if (box === undefined) return { ok: false, detail: "unknown session " + sessionId }
      if (box.status === "running") return { ok: false, detail: BUSY }
      box.status = "running"
      box.lastActivityAt = Date.now()
      const settle = (outcome: SendOutcome): SendOutcome => {
        box.status = outcome.ok ? "idle" : "failed"
        box.detail = outcome.ok ? undefined : outcome.detail
        box.lastActivityAt = Date.now()
        return outcome
      }
      try {
        return settle(await turn(box))
      } catch (error) {
        return settle({ ok: false, detail: detailOf(error) })
      }
    }
  }
}
