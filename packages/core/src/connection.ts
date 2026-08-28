import { Context, Data, Deferred, Effect, Exit, Layer, PubSub, Ref, Stream } from "effect"
import type { JsonSchema, JsonValue } from "./schema.js"

export interface CapabilitySpec {
  readonly name: string
  readonly input: JsonSchema
  readonly output: JsonSchema
  readonly mode?: "read" | "write" | "control"
  readonly description?: string
}

export interface ConnectionContract {
  readonly protocol?: string
  readonly capabilities: ReadonlyArray<CapabilitySpec>
}

export interface AdapterRef {
  readonly kind: string
  readonly config?: JsonValue
  readonly priority?: number
}

export type AdapterSelection =
  | { readonly strategy: "priority" }
  | { readonly strategy: "failover" }
  | { readonly strategy: "capability"; readonly requires: ReadonlyArray<string> }

/** Serializable logical connection. It contains no executable behavior. */
export interface ConnectionSpec {
  readonly id: string
  readonly contract: ConnectionContract
  readonly adapters: ReadonlyArray<AdapterRef>
  readonly selection?: AdapterSelection
  readonly metadata?: Readonly<Record<string, JsonValue>>
}

export interface ConnectionEvent {
  readonly connectionId: string
  readonly adapter: string
  readonly kind: string
  readonly payload?: unknown
}

/** A live physical interpretation of a logical ConnectionSpec. */
export interface ConnectionSession {
  readonly connectionId: string
  readonly adapter: string
  readonly capabilities: ReadonlySet<string>
  readonly invoke: (capability: string, input: unknown) => Effect.Effect<unknown, Error>
  readonly events?: Stream.Stream<ConnectionEvent, Error>
  readonly close: Effect.Effect<void, Error>
}

/** Platform extension point. The core never imports a transport or vendor SDK. */
export interface ConnectionAdapter {
  readonly kind: string
  readonly capabilities: ReadonlySet<string>
  readonly connect: (spec: ConnectionSpec, ref: AdapterRef) => Effect.Effect<ConnectionSession, Error>
}

export const connectionAdapter = (adapter: ConnectionAdapter): ConnectionAdapter => adapter

export class ConnectionNotFound extends Data.TaggedError("ConnectionNotFound")<{ readonly id: string }> {}
export class AdapterNotFound extends Data.TaggedError("AdapterNotFound")<{ readonly kind: string }> {}
export class ConnectionCapabilityNotDeclared extends Data.TaggedError("ConnectionCapabilityNotDeclared")<{
  readonly id: string
  readonly capability: string
}> {}
export class ConnectionCapabilityUnavailable extends Data.TaggedError("ConnectionCapabilityUnavailable")<{
  readonly id: string
  readonly capability: string
  readonly adapter: string
}> {}
export class ConnectionOpenError extends Data.TaggedError("ConnectionOpenError")<{
  readonly id: string
  readonly attempts: ReadonlyArray<{ readonly adapter: string; readonly cause: unknown }>
}> {}

type OpenOutcome =
  | { readonly _tag: "done"; readonly session: ConnectionSession }
  | { readonly _tag: "waiting"; readonly deferred: Deferred.Deferred<ConnectionSession, Error> }
  | { readonly _tag: "owner"; readonly deferred: Deferred.Deferred<ConnectionSession, Error> }

interface RuntimeState {
  readonly specs: ReadonlyMap<string, ConnectionSpec>
  readonly adapters: ReadonlyMap<string, ConnectionAdapter>
  readonly sessions: ReadonlyMap<string, ConnectionSession>
  /** In-flight single-flight opens: the owner completes this for every waiter. */
  readonly pending: ReadonlyMap<string, Deferred.Deferred<ConnectionSession, Error>>
}

const requiredCapabilities = (spec: ConnectionSpec) => new Set([
  ...spec.contract.capabilities.map((capability) => capability.name),
  ...(spec.selection?.strategy === "capability" ? spec.selection.requires : [])
])

const candidates = (spec: ConnectionSpec, adapters: ReadonlyMap<string, ConnectionAdapter>) => {
  const required = requiredCapabilities(spec)
  const refs: Array<AdapterRef> = []
  const skipped: Array<{ readonly adapter: string; readonly capability: string }> = []
  for (const ref of [...spec.adapters].sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0))) {
    const adapter = adapters.get(ref.kind)
    if (!adapter) { refs.push(ref); continue }
    const missing = [...required].filter((capability) => !adapter.capabilities.has(capability))
    if (missing.length > 0) {
      // Capability-missing adapters are recorded (not silently dropped) so an
      // empty attempt list is never zero-information.
      for (const capability of missing) skipped.push({ adapter: ref.kind, capability })
      continue
    }
    refs.push(ref)
  }
  return { refs, skipped }
}

/** Browser-safe runtime: Effect Ref + pure declarations, with no platform imports. */
export class ConnectionRuntime {
  private constructor(
    private readonly state: Ref.Ref<RuntimeState>,
    private readonly eventBus: PubSub.PubSub<ConnectionEvent>
  ) {}

  static make(options: {
    readonly specs?: ReadonlyArray<ConnectionSpec>
    readonly adapters?: ReadonlyArray<ConnectionAdapter>
  } = {}) {
    return Effect.gen(function* () {
      const state = yield* Ref.make<RuntimeState>({
        specs: new Map((options.specs ?? []).map((spec) => [spec.id, spec])),
        adapters: new Map((options.adapters ?? []).map((adapter) => [adapter.kind, adapter])),
        sessions: new Map(),
        pending: new Map()
      })
      const eventBus = yield* PubSub.unbounded<ConnectionEvent>()
      return new ConnectionRuntime(state, eventBus)
    })
  }

  private emit(event: ConnectionEvent) { return PubSub.publish(this.eventBus, event).pipe(Effect.asVoid) }

  // Boundary (recorded, not fixed): registerAdapter / spec replacement racing
  // an in-flight open can let connect() complete afterwards and register a
  // "resurrected" session - this predates single-flight and is unchanged. The
  // pending cleanup in close() closes the hang, not that race.
  private closeSessions(predicate: (session: ConnectionSession) => boolean) {
    const self = this
    return Effect.gen(function* () {
      const state = yield* Ref.get(self.state)
      const selected = [...state.sessions.values()].filter(predicate)
      // A per-session close failure must neither abort the sweep nor go silent:
      // catch it, surface connection.failed with the cause, and keep closing the
      // rest. Successful closes still emit connection.closed.
      yield* Effect.forEach(selected, (session) =>
        session.close.pipe(
          Effect.tap(() => self.emit({
            connectionId: session.connectionId,
            adapter: session.adapter,
            kind: "connection.closed"
          })),
          Effect.catchAll((cause) => self.emit({
            connectionId: session.connectionId,
            adapter: session.adapter,
            kind: "connection.failed",
            payload: { operation: "close", cause }
          }))
        ), { concurrency: "unbounded", discard: true })
      yield* Ref.update(self.state, (current) => ({
        ...current,
        sessions: new Map([...current.sessions].filter(([, session]) => !predicate(session)))
      }))
    })
  }

  registerSpec(spec: ConnectionSpec) {
    const self = this
    return self.close(spec.id).pipe(Effect.zipRight(
      Ref.update(self.state, (state) => ({ ...state, specs: new Map(state.specs).set(spec.id, spec) }))
    ))
  }

  unregisterSpec(id: string) {
    const self = this
    return self.close(id).pipe(Effect.zipRight(Ref.update(self.state, (state) => {
      const specs = new Map(state.specs)
      specs.delete(id)
      return { ...state, specs }
    })))
  }

  registerAdapter(adapter: ConnectionAdapter) {
    const self = this
    return self.closeSessions((session) => session.adapter === adapter.kind).pipe(Effect.zipRight(
      Ref.update(self.state, (state) => ({ ...state, adapters: new Map(state.adapters).set(adapter.kind, adapter) }))
    ))
  }

  unregisterAdapter(kind: string) {
    const self = this
    return self.closeSessions((session) => session.adapter === kind).pipe(Effect.zipRight(
      Ref.update(self.state, (state) => {
        const adapters = new Map(state.adapters)
        adapters.delete(kind)
        return { ...state, adapters }
      })
    ))
  }

  spec(id: string) {
    return Ref.get(this.state).pipe(Effect.flatMap((state) => {
      const spec = state.specs.get(id)
      return spec ? Effect.succeed(spec) : Effect.fail(new ConnectionNotFound({ id }))
    }))
  }

  open(id: string): Effect.Effect<ConnectionSession, Error> {
    const self = this
    return Effect.gen(function* () {
      // Spec check first: missing spec fails fast with ConnectionNotFound.
      const state = yield* Ref.get(self.state)
      const spec = state.specs.get(id)
      if (!spec) return yield* Effect.fail(new ConnectionNotFound({ id }))
      // Single-flight CAS: one Ref.modify decides owner vs waiter vs cached.
      // Never a Ref.get + update two-step for the sessions/pending decision.
      const deferred = yield* Deferred.make<ConnectionSession, Error>()
      const outcome = yield* Ref.modify(
        self.state,
        (current): readonly [OpenOutcome, RuntimeState] => {
          const existing = current.sessions.get(id)
          if (existing) return [{ _tag: "done", session: existing }, current]
          const waiting = current.pending.get(id)
          if (waiting) return [{ _tag: "waiting", deferred: waiting }, current]
          return [{ _tag: "owner", deferred }, {
            ...current,
            pending: new Map(current.pending).set(id, deferred)
          }]
        }
      )
      if (outcome._tag === "done") return outcome.session
      if (outcome._tag === "waiting") return yield* Deferred.await(outcome.deferred)

      // Owner: run the existing failover chain; waiters share this Deferred, and
      // the attempts array is captured in this closure so every waiter receives
      // the same ConnectionOpenError. connection.opened is emitted once, by the
      // owner only.
      const attempts: Array<{ adapter: string; cause: unknown }> = []
      const { refs, skipped } = candidates(spec, state.adapters)
      for (const skip of skipped)
        attempts.push({ adapter: skip.adapter, cause: new ConnectionCapabilityUnavailable({ id, capability: skip.capability, adapter: skip.adapter }) })

      const attempt = (index: number): Effect.Effect<ConnectionSession, Error> => {
        const ref = refs[index]
        if (!ref) return Effect.fail(new ConnectionOpenError({ id, attempts }))
        const adapter = state.adapters.get(ref.kind)
        if (!adapter) {
          attempts.push({ adapter: ref.kind, cause: new AdapterNotFound({ kind: ref.kind }) })
          return attempt(index + 1)
        }
        return adapter.connect(spec, ref).pipe(Effect.catchAll((cause) => {
          attempts.push({ adapter: ref.kind, cause })
          return attempt(index + 1)
        }))
      }

      return yield* attempt(0).pipe(
        Effect.either,
        Effect.flatMap((either) => Ref.update(self.state, (current) => {
          // One update registers the session and drops the pending marker;
          // waiters are released through the Deferred, not the state map.
          const pending = new Map(current.pending)
          pending.delete(id)
          if (either._tag === "Right")
            return { ...current, pending, sessions: new Map(current.sessions).set(id, either.right) }
          return { ...current, pending }
        }).pipe(Effect.as(either))),
        Effect.flatMap((either) => {
          if (either._tag === "Right") {
            return self.emit({ connectionId: id, adapter: either.right.adapter, kind: "connection.opened" })
              .pipe(Effect.zipRight(Deferred.succeed(deferred, either.right)), Effect.as(either.right))
          }
          return Deferred.fail(deferred, either.left).pipe(Effect.zipRight(Effect.fail(either.left)))
        }),
        Effect.onExit((exit) => Effect.gen(function* () {
          // Idempotent cleanup on any exit (success, failure, or interrupt):
          // drop the pending marker and complete the Deferred if it is still
          // open. Success/failure paths already completed it (a second complete
          // is a safe no-op); an interrupt would otherwise leave waiters
          // hanging on an owner that will never connect.
          yield* Ref.update(self.state, (current) => {
            const pending = new Map(current.pending)
            pending.delete(id)
            return { ...current, pending }
          })
          if (Exit.isFailure(exit)) yield* Deferred.failCause(deferred, exit.cause)
        }))
      )
    })
  }

  invoke(id: string, capability: string, input: unknown) {
    const self = this
    return self.spec(id).pipe(
      Effect.flatMap((spec) => spec.contract.capabilities.some((item) => item.name === capability)
        ? Effect.void
        : Effect.fail(new ConnectionCapabilityNotDeclared({ id, capability }))),
      Effect.zipRight(this.open(id)),
      Effect.flatMap((session) => session.capabilities.has(capability)
        ? self.emit({ connectionId: id, adapter: session.adapter, kind: "connection.invoking", payload: { capability } }).pipe(
            Effect.zipRight(session.invoke(capability, input)),
            Effect.tap((output) => self.emit({ connectionId: id, adapter: session.adapter, kind: "connection.invoked", payload: { capability, output } })),
            Effect.tapError((error) => self.emit({ connectionId: id, adapter: session.adapter, kind: "connection.failed", payload: { capability, error } }))
          )
        : Effect.fail(new ConnectionCapabilityUnavailable({ id, capability, adapter: session.adapter })))
    )
  }

  close(id: string) {
    const self = this
    return Effect.gen(function* () {
      yield* self.closeSessions((session) => session.connectionId === id)
      // Also cancel an in-flight open: drop the pending marker and fail its
      // waiters, so a closed connection cannot resurrect afterwards.
      const waiting = yield* Ref.modify(self.state, (current) => {
        const pending = new Map(current.pending)
        const deferred = pending.get(id) ?? null
        if (deferred) pending.delete(id)
        return [deferred, { ...current, pending }]
      })
      if (waiting) yield* Deferred.fail(waiting, new ConnectionNotFound({ id }))
    })
  }

  snapshot() { return Ref.get(this.state) }
  specs() { return Ref.get(this.state).pipe(Effect.map((state) => [...state.specs.values()])) }
  events() { return Stream.fromPubSub(this.eventBus) }
}

export class Connections extends Context.Tag("effect-agent/core/Connections")<Connections, ConnectionRuntime>() {
  static layer(options: {
    readonly specs?: ReadonlyArray<ConnectionSpec>
    readonly adapters?: ReadonlyArray<ConnectionAdapter>
  } = {}) {
    return Layer.effect(this, ConnectionRuntime.make(options))
  }
}
