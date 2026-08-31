/**
 * Session wiring: pure composition over the session protocol. A child's
 * event bus can be forwarded into a parent's signal box, watch rules can
 * fork responders at declared moments, and an agent can report progress
 * into its own session. Nothing here knows about fibers - the kernel is
 * injected as a plain spawn function.
 */
import { Effect, Option, PubSub, Queue, Schema, type Scope } from "effect"
import { AgentSession, notationText, Op, type AgentError, type AgentEvent, type Spawned, type Watch } from "@effect-agent/core"

/** Forward a child's progress/completion into the parent's signal box. */
export const forwardChildEvents = (child: { readonly agent: string; readonly bus: PubSub.PubSub<AgentEvent> }): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* () {
    const parent = yield* Effect.serviceOption(AgentSession)
    if (Option.isNone(parent)) return
    const signals = parent.value.signals
    const sub = yield* PubSub.subscribe(child.bus)
    yield* Effect.forkScoped(Effect.gen(function* () {
      while (true) {
        const event = yield* Effect.catchAllCause(Queue.take(sub), () => Effect.fail("closed" as const))
        if (event._tag === "Progress")
          yield* Queue.offer(signals, { _tag: "Inject", content: [{ _tag: "Text", text: "[" + child.agent + "] progress: " + event.text }] })
        if (event._tag === "ChildCompleted")
          yield* Queue.offer(signals, { _tag: "Inject", content: [{ _tag: "Text", text: "[" + child.agent + "] completed" }] })
      }
    }).pipe(Effect.ignore))
  }).pipe(Effect.asVoid)

/** Fork the responder fibers declared by watch rules. */
export const startWatchers = (
  spawn: (agent: string, task: string) => Effect.Effect<Spawned, AgentError, Scope.Scope>,
  childBus: PubSub.PubSub<AgentEvent>,
  childId: string,
  agent: string,
  watch: ReadonlyArray<Watch>
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* () {
    for (const rule of watch) {
      const sub = yield* PubSub.subscribe(childBus)
      yield* Effect.forkScoped(Effect.gen(function* () {
        while (true) {
          const event = yield* Effect.catchAllCause(Queue.take(sub), () => Effect.fail("closed" as const))
          const kind = event._tag === "Progress" ? "progress" : event._tag === "ChildCompleted" ? "completed" : undefined
          if (kind === undefined || rule.when.kind !== kind) continue
          const task = rule.spawn.task
            .replaceAll("{child}", childId)
            .replaceAll("{agent}", agent)
            .replaceAll("{text}", event._tag === "Progress" ? event.text : "completed")
          yield* spawn(rule.spawn.agent, task)
        }
      }).pipe(Effect.ignore))
    }
  }).pipe(Effect.asVoid)

/** Report progress into your own session; your supervisor hears it between its steps. */
export const progressOp = () =>
  Op.write({
    name: "report_progress",
    description: notationText("Report your own progress to your supervisor; it arrives between their steps."),
    input: Schema.Struct({ text: Schema.String }),
    output: Schema.Struct({ reported: Schema.Boolean }),
    execute: (input: unknown) =>
      Effect.gen(function* () {
        const session = yield* Effect.serviceOption(AgentSession)
        if (Option.isSome(session)) yield* PubSub.publish(session.value.events, { _tag: "Progress", agent: session.value.agent, text: (input as { text: string }).text })
        return { reported: true }
      })
  })

