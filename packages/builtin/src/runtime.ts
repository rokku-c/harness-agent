/**
 * FiberAgentRuntime: the supervision surface, implemented with Effect fibers.
 * Spawn forks the child agent with its own session (signal box + event bus);
 * progress and completion flow back into the parent's signal box between its
 * steps. Watch rules are declared timing: when a child reports at a declared
 * moment, the runtime forks a responder. Boards and groups are shared
 * bindings - coordination structures are data, not a harness layer.
 */
import { Cause, Context, Effect, Exit, Fiber, Layer, Option, PubSub, Queue, Ref, Schema } from "effect"
import {
  AgentFailure, AgentRegistry, AgentRuntime, AgentSession,
  boardPost, boardRead, groupPost, groupRead, makeBoard, makeGroup,
  Op, notationText,
  type AgentEvent, type AgentProgram, type Binding, type BoardEntry, type ChildResult,
  type GroupEntry, type Signal, type Watch, type AgentRuntimeService
} from "@effect-agent/core"

interface ChildState {
  readonly childId: string
  readonly agent: string
  readonly fiber: Fiber.RuntimeFiber<unknown, unknown>
  readonly signals: Queue.Queue<Signal>
  readonly bus: PubSub.PubSub<AgentEvent>
}

interface BoardState {
  readonly uri: string
  readonly entries: Ref.Ref<ReadonlyArray<BoardEntry>>
}

interface GroupState {
  readonly uri: string
  readonly log: Ref.Ref<ReadonlyArray<GroupEntry>>
  readonly members: Ref.Ref<ReadonlyArray<string>>
}

/** The runtime's ops surface: an agent includes it via .uses() / .writes(). */
export const runtimeBinding: Binding<any, any, AgentRuntime | AgentRegistry> = {
  uri: "ea://runtime/agents",
  // the roster, materialized into the supervisor's context at run start, so
  // the model spawns names that actually exist
  read: Effect.map(AgentRegistry, (registry) => ({
    _tag: "Text" as const,
    text: "Registered agents you may spawn: " + (registry.names().join(", ") || "(none)")
  })),
  ops: [
    Op.write({
      name: "spawn_agent",
      description: notationText("Spawn a named subagent with a task. Use watch rules to fork responders when the child reports at a declared moment."),
      input: Schema.Struct({
        agent: Schema.String,
        task: Schema.String,
        wait: Schema.optional(Schema.Boolean),
        watch: Schema.optional(Schema.Array(Schema.Struct({
          when: Schema.Struct({ kind: Schema.Literal("progress", "completed") }),
          spawn: Schema.Struct({ agent: Schema.String, task: Schema.String })
        })))
      }),
      output: Schema.Unknown,
      execute: (input: unknown) =>
        Effect.gen(function* () {
          const runtime = yield* AgentRuntime
          const spec = input as {
            agent: string; task: string; wait?: boolean
            watch?: ReadonlyArray<{ when: { kind: "progress" | "completed" }; spawn: { agent: string; task: string } }>
          }
          const watch: ReadonlyArray<Watch> = (spec.watch ?? []).map((rule) => ({
            when: { kind: rule.when.kind },
            spawn: rule.spawn
          }))
          const spawned = yield* runtime.spawn(spec.agent, spec.task, watch)
          if (spec.wait) {
            const result = yield* runtime.join(spawned.childId)
            return result
          }
          return spawned
        })
    }),
    Op.write({
      name: "send_child",
      description: notationText("Inject a message into a running child's context; it takes effect at the child's next step."),
      input: Schema.Struct({ child: Schema.String, text: Schema.String }),
      output: Schema.Struct({ sent: Schema.Boolean }),
      execute: (input: unknown) =>
        Effect.gen(function* () {
          const runtime = yield* AgentRuntime
          const { child, text } = input as { child: string; text: string }
          yield* runtime.send(child, { _tag: "Inject", content: [{ _tag: "Text", text }] })
          return { sent: true }
        })
    }),
    Op.write({
      name: "interrupt_child",
      description: notationText("Stop a running child. Cooperative mode lets it finish its current step; hard mode kills the fiber."),
      input: Schema.Struct({ child: Schema.String, hard: Schema.optional(Schema.Boolean) }),
      output: Schema.Struct({ interrupted: Schema.Boolean }),
      execute: (input: unknown) =>
        Effect.gen(function* () {
          const runtime = yield* AgentRuntime
          const { child, hard } = input as { child: string; hard?: boolean }
          yield* runtime.interrupt(child, hard ?? false)
          return { interrupted: true }
        })
    }),
    Op.read({
      name: "wait_children",
      description: notationText("Wait for spawned children. mode=all joins every child; mode=first returns when the first completes."),
      input: Schema.Struct({ mode: Schema.optional(Schema.Literal("all", "first")) }),
      output: Schema.Unknown,
      execute: (input: unknown) =>
        Effect.gen(function* () {
          const runtime = yield* AgentRuntime
          const { mode } = (input ?? {}) as { mode?: "all" | "first" }
          return yield* runtime.wait(mode ?? "all")
        })
    }),
    Op.write({
      name: "report_progress",
      description: notationText("Report your own progress to your supervisor; it arrives between their steps."),
      input: Schema.Struct({ text: Schema.String }),
      output: Schema.Struct({ reported: Schema.Boolean }),
      execute: (input: unknown) =>
        Effect.gen(function* () {
          const runtime = yield* AgentRuntime
          const session = yield* Effect.serviceOption(AgentSession)
          const agent = Option.isSome(session) ? session.value.agent : "agent"
          const { text } = input as { text: string }
          yield* runtime.emitProgress(agent, text)
          return { reported: true }
        })
    }),
    Op.write({
      name: "create_board",
      description: notationText("Create a shared whiteboard; the returned uri grants read/write access to any child you spawn."),
      input: Schema.Struct({ name: Schema.String }),
      output: Schema.Struct({ uri: Schema.String }),
      execute: (input: unknown) =>
        Effect.gen(function* () {
          const runtime = yield* AgentRuntime
          const { name } = input as { name: string }
          const uri = yield* runtime.createBoard(name)
          return { uri }
        })
    }),
    Op.write({
      name: "post_board",
      description: notationText("Append a finding to a shared whiteboard."),
      input: Schema.Struct({ board: Schema.String, text: Schema.String }),
      output: Schema.Struct({ posted: Schema.Boolean }),
      execute: (input: unknown) =>
        Effect.gen(function* () {
          const runtime = yield* AgentRuntime
          const session = yield* Effect.serviceOption(AgentSession)
          const { board, text } = input as { board: string; text: string }
          yield* runtime.postBoard(board, Option.isSome(session) ? session.value.agent : "agent", text)
          return { posted: true }
        })
    }),
    Op.read({
      name: "read_board",
      description: notationText("Read every entry on a shared whiteboard."),
      input: Schema.Struct({ board: Schema.String }),
      output: Schema.Unknown,
      execute: (input: unknown) =>
        Effect.gen(function* () {
          const runtime = yield* AgentRuntime
          const { board } = input as { board: string }
          return yield* runtime.readBoard(board)
        })
    }),
    Op.write({
      name: "create_group",
      description: notationText("Create a discussion group over child ids; posts reach members between their steps."),
      input: Schema.Struct({ name: Schema.String, children: Schema.Array(Schema.String) }),
      output: Schema.Struct({ uri: Schema.String }),
      execute: (input: unknown) =>
        Effect.gen(function* () {
          const runtime = yield* AgentRuntime
          const { name, children } = input as { name: string; children: ReadonlyArray<string> }
          const uri = yield* runtime.createGroup(name, children)
          return { uri }
        })
    }),
    Op.write({
      name: "post_group",
      description: notationText("Post to a group discussion; members see it between their steps."),
      input: Schema.Struct({ group: Schema.String, text: Schema.String }),
      output: Schema.Struct({ posted: Schema.Boolean }),
      execute: (input: unknown) =>
        Effect.gen(function* () {
          const runtime = yield* AgentRuntime
          const session = yield* Effect.serviceOption(AgentSession)
          const { group, text } = input as { group: string; text: string }
          yield* runtime.postGroup(group, Option.isSome(session) ? session.value.agent : "agent", text)
          return { posted: true }
        })
    }),
    Op.read({
      name: "read_group",
      description: notationText("Read the group's discussion log."),
      input: Schema.Struct({ group: Schema.String, limit: Schema.optional(Schema.Number) }),
      output: Schema.Unknown,
      execute: (input: unknown) =>
        Effect.gen(function* () {
          const runtime = yield* AgentRuntime
          const { group, limit } = input as { group: string; limit?: number }
          return yield* runtime.readGroup(group, limit)
        })
    })
  ]
}

export const FiberAgentRuntime = {
  /** Layer the runtime over an agent registry. */
  layer: (agents: Readonly<Record<string, AgentProgram<any, any, any, AgentRuntime | AgentRegistry>>>) =>
    Effect.gen(function* () {
      const registry: { get: (name: string) => Option.Option<AgentProgram<any, any, any, AgentRuntime | AgentRegistry>>; names: () => ReadonlyArray<string> } = {
        get: (name) => Option.fromNullable(agents[name]),
        names: () => Object.keys(agents)
      }
      const children = yield* Ref.make<ReadonlyMap<string, ChildState>>(new Map())
      const boards = yield* Ref.make<ReadonlyMap<string, BoardState>>(new Map())
      const groups = yield* Ref.make<ReadonlyMap<string, GroupState>>(new Map())

      const childSummary = (state: ChildState): Effect.Effect<{ childId: string; agent: string; status: "running" | "completed" | "failed" | "interrupted" }> =>
        Effect.gen(function* () {
          const polled = yield* Fiber.poll(state.fiber)
          if (Option.isNone(polled)) return { childId: state.childId, agent: state.agent, status: "running" as const }
          const exit = polled.value
          if (Exit.isSuccess(exit)) return { childId: state.childId, agent: state.agent, status: "completed" as const }
          const cause = exit.cause
          if (cause._tag === "Fail" && (cause.error as { _tag?: string })._tag === "AgentFailure" &&
            String((cause.error as { cause?: unknown }).cause ?? "").includes("interrupted"))
            return { childId: state.childId, agent: state.agent, status: "interrupted" as const }
          return { childId: state.childId, agent: state.agent, status: "failed" as const }
        })

      const exitToResult = (state: ChildState) => (exit: Exit.Exit<unknown, unknown>): ChildResult => {
        if (Exit.isSuccess(exit)) return { childId: state.childId, agent: state.agent, status: "completed", output: exit.value }
        const cause = exit.cause
        if (Cause.isInterruptedOnly(cause)) return { childId: state.childId, agent: state.agent, status: "interrupted" }
        if (cause._tag === "Fail" && (cause.error as { _tag?: string })._tag === "AgentFailure" &&
          String((cause.error as { cause?: unknown }).cause ?? "").includes("interrupted"))
          return { childId: state.childId, agent: state.agent, status: "interrupted" }
        return { childId: state.childId, agent: state.agent, status: "failed", error: String(cause) }
      }

      /** Fork the responder fibers declared by watch rules. */
      const startWatchers = (self: AgentRuntimeService, childBus: PubSub.PubSub<AgentEvent>, childId: string, agent: string, watch: ReadonlyArray<Watch>) =>
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
                yield* self.spawn(rule.spawn.agent, task)
              }
            }).pipe(Effect.ignore))
          }
        })

      /** Forward a child's progress/completion into the parent's signal box. */
      const startForwarder = (childBus: PubSub.PubSub<AgentEvent>, childId: string, agent: string) =>
        Effect.gen(function* () {
          const parentSession = yield* Effect.serviceOption(AgentSession)
          if (Option.isNone(parentSession)) return
          const signals = parentSession.value.signals
          const sub = yield* PubSub.subscribe(childBus)
          yield* Effect.forkScoped(Effect.gen(function* () {
            while (true) {
              const event = yield* Effect.catchAllCause(Queue.take(sub), () => Effect.fail("closed" as const))
              if (event._tag === "Progress")
                yield* Queue.offer(signals, { _tag: "Inject", content: [{ _tag: "Text", text: "[" + agent + "] progress: " + event.text }] })
              if (event._tag === "ChildCompleted")
                yield* Queue.offer(signals, { _tag: "Inject", content: [{ _tag: "Text", text: "[" + agent + "] completed" }] })
            }
          }).pipe(Effect.ignore))
          void childId
        })

      // boards and groups answer both their full uri and their bare name
      const boardUri = (uriOrName: string) => (uriOrName.startsWith("ea://") ? uriOrName : "ea://board/" + uriOrName)
      const groupUri = (uriOrName: string) => (uriOrName.startsWith("ea://") ? uriOrName : "ea://group/" + uriOrName)

      const service: Context.Tag.Service<AgentRuntime> = {
        spawn: (agent, task, watch = []) =>
          Effect.gen(function* () {
            const program = registry.get(agent)
            if (Option.isNone(program))
              return yield* new AgentFailure({
                agent: "runtime",
                cause: "unknown agent: " + agent + " (registered: " + Object.keys(agents).join(", ") + ")"
              })
            const signals = yield* Queue.unbounded<Signal>()
            const bus = yield* PubSub.unbounded<AgentEvent>()
            const childId = crypto.randomUUID()
            const childEffect = program.value.run(task).pipe(
              Effect.provideService(AgentSession, { agent, signals, events: bus }),
              Effect.provideService(AgentRuntime, service),
              Effect.provideService(AgentRegistry, registry),
              Effect.onExit((exit) =>
                Exit.isSuccess(exit)
                  ? PubSub.publish(bus, { _tag: "ChildCompleted", childId, agent, output: exit.value })
                  : PubSub.publish(bus, { _tag: "ChildFailed", childId, agent, error: String(exit.cause) })
              ),
              Effect.ensuring(Effect.zipRight(PubSub.shutdown(bus), Queue.shutdown(signals)))
            )
            const fiber = yield* Effect.forkScoped(childEffect)
            yield* Ref.update(children, (map) => new Map(map).set(childId, { childId, agent, fiber, signals, bus }))
            yield* startForwarder(bus, childId, agent)
            yield* startWatchers(service, bus, childId, agent, watch)
            return { childId, agent }
          }),
        join: (childId) =>
          Effect.gen(function* () {
            const map = yield* Ref.get(children)
            const state = map.get(childId)
            if (state === undefined)
              return yield* new AgentFailure({ agent: "runtime", cause: "unknown child: " + childId })
            const exit = yield* Fiber.await(state.fiber)
            return exitToResult(state)(exit)
          }),
        send: (childId, signal) =>
          Effect.gen(function* () {
            const map = yield* Ref.get(children)
            const state = map.get(childId)
            if (state === undefined)
              return yield* new AgentFailure({ agent: "runtime", cause: "unknown child: " + childId })
            yield* Queue.offer(state.signals, signal)
          }),
        interrupt: (childId, hard = false) =>
          Effect.gen(function* () {
            const map = yield* Ref.get(children)
            const state = map.get(childId)
            if (state === undefined)
              return yield* new AgentFailure({ agent: "runtime", cause: "unknown child: " + childId })
            if (hard) yield* Fiber.interrupt(state.fiber)
            else yield* Queue.offer(state.signals, { _tag: "Interrupt" })
          }),
        wait: (mode) =>
          Effect.gen(function* () {
            const map = yield* Ref.get(children)
            const states = [...map.values()]
            if (states.length === 0) return []
            if (mode === "first") {
              const raced = yield* Effect.raceAll(states.map((state) =>
                Effect.map(Fiber.await(state.fiber), (exit) => ({ state, exit }))
              ))
              return [exitToResult(raced.state)(raced.exit)]
            }
            const results: ChildResult[] = []
            for (const state of states) {
              const exit = yield* Fiber.await(state.fiber)
              results.push(exitToResult(state)(exit))
            }
            return results
          }),
        children: Effect.gen(function* () {
          const map = yield* Ref.get(children)
          const summaries: Array<{ childId: string; agent: string; status: "running" | "completed" | "failed" | "interrupted" }> = []
          for (const state of map.values()) summaries.push(yield* childSummary(state))
          return summaries
        }),
        emitProgress: (agent, text) =>
          Effect.gen(function* () {
            const session = yield* Effect.serviceOption(AgentSession)
            if (Option.isSome(session)) yield* PubSub.publish(session.value.events, { _tag: "Progress", agent, text })
          }),
        createBoard: (name) =>
          Effect.gen(function* () {
            const board: BoardState = { uri: "ea://board/" + name, entries: yield* Ref.make<ReadonlyArray<BoardEntry>>([]) }
            yield* Ref.update(boards, (map) => new Map(map).set(board.uri, board))
            return board.uri
          }),
        postBoard: (uri, author, text) =>
          Effect.gen(function* () {
            const map = yield* Ref.get(boards)
            const board = map.get(boardUri(uri))
            if (board === undefined)
              return yield* new AgentFailure({ agent: "runtime", cause: "unknown board: " + uri + " (known: " + [...map.keys()].join(", ") + ")" })
            yield* boardPost(board, author, text)
          }),
        readBoard: (uri) =>
          Effect.gen(function* () {
            const map = yield* Ref.get(boards)
            const board = map.get(boardUri(uri))
            if (board === undefined)
              return yield* new AgentFailure({ agent: "runtime", cause: "unknown board: " + uri + " (known: " + [...map.keys()].join(", ") + ")" })
            return yield* boardRead(board)
          }),
        createGroup: (name, members) =>
          Effect.gen(function* () {
            const group: GroupState = {
              uri: "ea://group/" + name,
              log: yield* Ref.make<ReadonlyArray<GroupEntry>>([]),
              members: yield* Ref.make(members)
            }
            yield* Ref.update(groups, (map) => new Map(map).set(group.uri, group))
            return group.uri
          }),
        postGroup: (uri, author, text) =>
          Effect.gen(function* () {
            const map = yield* Ref.get(groups)
            const group = map.get(groupUri(uri))
            if (group === undefined)
              return yield* new AgentFailure({ agent: "runtime", cause: "unknown group: " + uri + " (known: " + [...map.keys()].join(", ") + ")" })
            yield* groupPost(group, author, text)
            // posts push into every member's signal box - they see it at their
            // next step boundary
            const childMap = yield* Ref.get(children)
            const members = yield* Ref.get(group.members)
            for (const member of members) {
              const child = childMap.get(member)
              if (child !== undefined)
                yield* Queue.offer(child.signals, { _tag: "Inject", content: [{ _tag: "Text", text: "[group " + uri + "] " + author + ": " + text }] })
            }
          }),
        readGroup: (uri, limit) =>
          Effect.gen(function* () {
            const map = yield* Ref.get(groups)
            const group = map.get(groupUri(uri))
            if (group === undefined)
              return yield* new AgentFailure({ agent: "runtime", cause: "unknown group: " + uri + " (known: " + [...map.keys()].join(", ") + ")" })
            return yield* groupRead(group, limit)
          })
      }
      return service
    }).pipe((effect) => Layer.effect(AgentRuntime, effect)),
  /** The registry layer for named agents. */
  registry: (agents: Readonly<Record<string, AgentProgram<any, any, any, AgentRuntime | AgentRegistry>>>) =>
    Layer.succeed(AgentRegistry, {
      get: (name) => Option.fromNullable(agents[name]),
      names: () => Object.keys(agents)
    })
}









