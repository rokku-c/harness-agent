/**
 * Board event stream: every domain change is emitted with a wall-clock ts.
 * History is kept in a small ring so late joiners (SSE, MCP polling) can
 * replay from a timestamp without per-client cursor state.
 */
import { Effect, Ref } from "effect"

export type BoardEventType =
  | "item.created" | "item.state" | "resource.created"
  | "resource.acquired" | "resource.released"
  | "executor.registered" | "coordinator.started" | "coordinator.finished"
  | "consent.asked" | "consent.resolved"

export interface BoardEvent {
  readonly type: BoardEventType
  readonly itemId?: string
  readonly resourceId?: string
  readonly executorId?: string
  readonly message: string
  readonly ts: number
}

interface Store {
  readonly ring: Ref.Ref<ReadonlyArray<BoardEvent>>
  readonly listeners: Ref.Ref<ReadonlyArray<(event: BoardEvent) => void>>
}

const MAX_HISTORY = 500

export class EventBus {
  private constructor(readonly state: Store) {}

  static of = (state: Store): EventBus => new EventBus(state)

  static make = (): Effect.Effect<EventBus> =>
    Effect.gen(function* () {
      const ring = yield* Ref.make<ReadonlyArray<BoardEvent>>([])
      const listeners = yield* Ref.make<ReadonlyArray<(event: BoardEvent) => void>>([])
      return EventBus.of({ ring, listeners })
    })

  push(event: Omit<BoardEvent, "ts">): Effect.Effect<void> {
    const state = this.state
    return Effect.gen(function* () {
      const dated: BoardEvent = { ...event, ts: Date.now() }
      yield* Ref.update(state.ring, (ring) => {
        const next = [...ring, dated]
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
      })
      const current = yield* Ref.get(state.listeners)
      for (const listener of current) listener(dated)
    })
  }

  /** events strictly after a timestamp (stateless polling cursor) */
  after(ts: number): Effect.Effect<ReadonlyArray<BoardEvent>> {
    const ring = this.state.ring
    return Ref.get(ring).pipe(Effect.map((r) => r.filter((e) => e.ts > ts)))
  }

  history(): Effect.Effect<ReadonlyArray<BoardEvent>> {
    return Ref.get(this.state.ring)
  }

  subscribe(listener: (event: BoardEvent) => void): Effect.Effect<() => void> {
    const listeners = this.state.listeners
    return Effect.gen(function* () {
      yield* Ref.update(listeners, (all) => [...all, listener])
      return () => {
        void Effect.runSync(Ref.update(listeners, (all) => all.filter((x) => x !== listener)))
      }
    })
  }
}

/** construct a fresh bus */
export const makeEventBus = EventBus.make
