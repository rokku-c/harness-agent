/**
 * EventLog: the append-only fact source (E9). Session facts are logged
 * before they are shown to the model - "model-visible ⟺ logged" (DSH
 * invariant). Derived state is a projection over the log, never the other
 * way around. Any replayable log implementation can be swapped in.
 */
import { Context, Effect, Layer, Ref } from "effect"
import type { HarnessEvent } from "@effect-agent/core"

export interface SessionEvent {
  readonly seq: number
  readonly ts: number
  readonly session: string
  readonly type: string
  readonly data: unknown
}

export interface EventLogService {
  /** Append a fact; returns its sequence number. */
  readonly append: (session: string, type: string, data: unknown) => Effect.Effect<number>
  readonly stream: (session: string, afterSeq?: number) => Effect.Effect<ReadonlyArray<SessionEvent>>
  readonly all: () => Effect.Effect<ReadonlyArray<SessionEvent>>
}

export class EventLog extends Context.Tag("effect-agent/EventLog")<EventLog, EventLogService>() {}

export const MemoryEventLog = Effect.gen(function* () {
  const log = yield* Ref.make<ReadonlyArray<SessionEvent>>([])
  const service: EventLogService = {
    append: (session, type, data) =>
      Ref.modify(log, (events) => {
        const next = [...events, { seq: events.length + 1, ts: Date.now(), session, type, data }]
        return [next.length, next]
      }),
    stream: (session, afterSeq = 0) =>
      Effect.map(Ref.get(log), (events) => events.filter((event) => event.session === session && event.seq > afterSeq)),
    all: () => Ref.get(log)
  }
  return service
})

export const MemoryEventLogLayer: Layer.Layer<EventLog> = Layer.effect(EventLog, MemoryEventLog)

/**
 * Bridge: a core HarnessHook that mirrors loop events into the EventLog.
 * This is the Observability seam - the same loop, now auditable end to end.
 */
export const eventLogHook = (session: string) => {
  const toEvent = (event: HarnessEvent): { readonly type: string; readonly data: unknown } => {
    switch (event._tag) {
      case "RunStarted":
        return { type: "run.started", data: { agent: event.agent } }
      case "ToolStarted":
        return { type: "tool.started", data: { callId: event.callId, tool: event.tool, input: event.input } }
      case "ToolCompleted":
        return { type: "tool.completed", data: { callId: event.callId, tool: event.tool, output: event.output } }
      case "Output":
        return { type: "run.output", data: { output: event.output } }
      case "RunCompleted":
        return { type: "run.completed", data: { agent: event.agent } }
      case "RunFailed":
        return { type: "run.failed", data: { error: event.error } }
      default:
        return { type: "driver." + event._tag.toLowerCase(), data: event }
    }
  }
  return {
    name: "eventlog",
    handle: (event: HarnessEvent) =>
      Effect.flatMap(EventLog, (log) => {
        const mapped = toEvent(event)
        return log.append(session, mapped.type, mapped.data).pipe(Effect.asVoid)
      })
  }
}
