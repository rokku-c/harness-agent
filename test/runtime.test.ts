import { describe, expect, test } from "bun:test"
import { Deferred, Effect, Layer, Schema } from "effect"
import {
  Agent, AgentContext, AgentRuntime, Boards, Groups, Op, notationText,
  Until, type Binding, type RunRequest
} from "@effect-agent/core"
import { EffectAgent, FiberAgentRuntime, batchOps, childBinding, groupOps, progressOp, type Model, type WireMessage } from "@effect-agent/builtin"

const noopBinding = (): Binding => ({
  uri: "ea://svc/noop/main",
  ops: [Op.read({
    name: "noop",
    description: notationText("Does nothing."),
    input: Schema.Struct({}),
    output: Schema.Struct({ ok: Schema.Boolean }),
    execute: () => Effect.succeed({ ok: true })
  })]
})

const progressBinding = (): Binding => ({
  uri: "ea://svc/progress/main",
  ops: [progressOp()]
})

/** A model whose first call blocks on a gate, then replays a script. */
const gatedModel = (script: Array<{ text: string; toolCalls?: Array<{ id: string; name: string; input: unknown }> }>) => {
  const gate = Effect.runSync(Deferred.make<void>())
  const seen: Array<ReadonlyArray<WireMessage>> = []
  let released = false
  const model: Model & { release: Effect.Effect<void>; seen: Array<ReadonlyArray<WireMessage>> } = {
    seen,
    release: Effect.gen(function* () {
      released = true
      yield* Deferred.succeed(gate, undefined)
    }),
    generate: (_s: string, messages: ReadonlyArray<WireMessage>) =>
      Effect.gen(function* () {
        if (!released) yield* Deferred.await(gate)
        seen.push(messages)
        const next = script.shift()
        return next ? { text: next.text, toolCalls: next.toolCalls ?? [] } : { text: "done", toolCalls: [] }
      })
  }
  return model
}

const scriptedAgent = (name: string, output: string) =>
  Agent.define(name, (task: string) => AgentContext.text(task))
    .returns(Until.text)
    .implementedBy({
      id: name,
      capabilities: {
        provider: { _tag: "Configurable" }, granularity: "run", thinking: false, cancel: true,
        pause: true, resume: false, fork: "none", tools: "native", toolCalls: "intercept",
        structuredOutput: "text", sandbox: "none"
      },
      run: <A, R>(_request: RunRequest<A, R>) => Effect.succeed(output as A) as any
    })

const provide = (agents: Record<string, unknown>) =>
  Layer.mergeAll(
    FiberAgentRuntime.layer(agents as never),
    FiberAgentRuntime.registry(agents as never)
  )

describe("FiberAgentRuntime: supervision as fibers", () => {
  test("spawn + wait(all): children complete and report output", async () => {
    const agents = {
      worker: scriptedAgent("worker", "w1"),
      other: scriptedAgent("other", "o1")
    }
    const results = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* AgentRuntime
        yield* rt.spawn("worker", "t1")
        yield* rt.spawn("other", "t2")
        return yield* rt.wait("all")
      }).pipe(Effect.scoped, Effect.provide(provide(agents)))
    )
    expect(results).toHaveLength(2)
    expect(results[0]?.status).toBe("completed")
    expect(results[0]?.output).toBe("w1")
    expect(results[1]?.output).toBe("o1")
  })

  test("injected signal lands in the child's context at its next step", async () => {
    const model = gatedModel([
      { text: "", toolCalls: [{ id: "t1", name: "noop", input: {} }] },
      { text: "final", toolCalls: [] }
    ])
    const agents = {
      worker: Agent.define("worker", (task: string) => AgentContext.text(task))
        .returns(Until.text)
        .uses(noopBinding())
        .implementedBy(EffectAgent.make({ model }))
    }
    const results = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* AgentRuntime
        const spawned = yield* rt.spawn("worker", "start")
        yield* rt.send(spawned.childId, { _tag: "Inject", content: [{ _tag: "Text", text: "injected!" }] })
        yield* model.release
        return yield* rt.wait("all")
      }).pipe(Effect.scoped, Effect.provide(provide(agents)))
    )
    expect(results[0]?.status).toBe("completed")
    const last = model.seen[model.seen.length - 1] ?? []
    expect(last.some((m) => m.role === "user" && m.content.includes("injected!"))).toBe(true)
    expect(results[0]?.output).toBe("final")
  })

  test("cooperative interrupt: the signal ends the run between steps", async () => {
    const model = gatedModel([
      { text: "", toolCalls: [{ id: "t1", name: "noop", input: {} }] },
      { text: "unreachable", toolCalls: [] }
    ])
    const agents = {
      worker: Agent.define("worker", (task: string) => AgentContext.text(task))
        .returns(Until.text)
        .uses(noopBinding())
        .implementedBy(EffectAgent.make({ model }))
    }
    const results = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* AgentRuntime
        const spawned = yield* rt.spawn("worker", "start")
        yield* rt.send(spawned.childId, { _tag: "Interrupt" })
        yield* model.release
        return yield* rt.wait("all")
      }).pipe(Effect.scoped, Effect.provide(provide(agents)))
    )
    expect(results[0]?.status).toBe("interrupted")
  })

  test("hard interrupt kills the fiber immediately", async () => {
    const model: Model = { generate: () => Effect.never }
    const agents = {
      worker: Agent.define("worker", (task: string) => AgentContext.text(task))
        .returns(Until.text)
        .implementedBy(EffectAgent.make({ model }))
    }
    const results = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* AgentRuntime
        const spawned = yield* rt.spawn("worker", "start")
        yield* Effect.sleep(20)
        yield* rt.interrupt(spawned.childId, true)
        return yield* rt.wait("all")
      }).pipe(Effect.scoped, Effect.provide(provide(agents)))
    )
    expect(results[0]?.status).toBe("interrupted")
  })

  test("children share a board through the runtime ops", async () => {
    let calls = 0
    const workerModel = (): Model => ({
      generate: (_s: string, _m: ReadonlyArray<WireMessage>) => {
        calls++
        return calls % 2 === 1
          ? Effect.succeed({ text: "", toolCalls: [{ id: "t" + calls, name: "post_board", input: { board: "ea://board/findings", text: "finding " + calls } }] })
          : Effect.succeed({ text: "done", toolCalls: [] })
      }
    })
    const agents = {
      worker: Agent.define("worker", (task: string) => AgentContext.text(task))
        .returns(Until.text)
        .writes(childBinding)
        .implementedBy(EffectAgent.make({ model: workerModel() }))
    }
    const results = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* AgentRuntime
        const boards = yield* Boards
        yield* boards.create("findings")
        yield* rt.spawn("worker", "a")
        yield* rt.spawn("worker", "b")
        yield* rt.wait("all")
        return yield* boards.read("ea://board/findings")
      }).pipe(Effect.scoped, Effect.provide(provide(agents)))
    )
    expect(results.length).toBeGreaterThanOrEqual(2)
    expect(results.every((entry) => entry.text.startsWith("finding"))).toBe(true)
  })

  test("group posts push into members' signal boxes and keep a log", async () => {
    const model = gatedModel([
      { text: "", toolCalls: [{ id: "t1", name: "noop", input: {} }] },
      { text: "saw the group post", toolCalls: [] }
    ])
    const agents = {
      worker: Agent.define("worker", (task: string) => AgentContext.text(task))
        .returns(Until.text)
        .uses(noopBinding())
        .implementedBy(EffectAgent.make({ model }))
    }
    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* AgentRuntime
        const groups = yield* Groups
        const spawned = yield* rt.spawn("worker", "start")
        yield* groups.create("room", [spawned.childId])
        // delivery is composed in the op: post + push into members' signal boxes
        const postOp = groupOps().find((op) => op.name === "post_group")!
        yield* (postOp.execute as (input: unknown) => Effect.Effect<unknown, unknown>)({ group: "ea://group/room", text: "please expedite" })
        yield* model.release
        const log = yield* groups.read("ea://group/room")
        return { results: yield* rt.wait("all"), log }
      }).pipe(Effect.scoped, Effect.provide(provide(agents)))
    )
    expect(outcome.log).toHaveLength(1)
    expect(outcome.results[0]?.output).toBe("saw the group post")
    const last = model.seen[model.seen.length - 1] ?? []
    expect(last.some((m) => m.role === "user" && m.content.includes("please expedite"))).toBe(true)
  })

  test("map_children: bounded parallel map over a task list", async () => {
    const agents = {
      worker: scriptedAgent("worker", "w1"),
      idle: scriptedAgent("idle", "i1")
    }
    const results = await Effect.runPromise(
      Effect.gen(function* () {
        const mapOp = batchOps().find((op) => op.name === "map_children")!
        const executed = yield* (mapOp.execute as (input: unknown) => Effect.Effect<unknown, unknown>)({
          agent: "worker",
          tasks: ["t1", "t2", "t3", "t4"],
          concurrency: 2
        })
        const all = yield* (batchOps().find((op) => op.name === "children_where")!
          .execute as (input: unknown) => Effect.Effect<unknown, unknown>)({})
        return { results: executed, all }
      }).pipe(Effect.scoped, Effect.provide(provide(agents)))
    )
    const mapped = results.results as Array<{ status: string; output: string }>
    expect(mapped).toHaveLength(4)
    expect(mapped.every((r) => r.status === "completed" && r.output === "w1")).toBe(true)
    const all = results.all as Array<{ agent: string; status: string }>
    expect(all.filter((c) => c.agent === "worker")).toHaveLength(4)
    expect(all.filter((c) => c.agent === "idle")).toHaveLength(0)
  })

  test("children_where filters by agent and status", async () => {
    const agents = {
      worker: scriptedAgent("worker", "w"),
      idle: scriptedAgent("idle", "i")
    }
    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* AgentRuntime
        yield* rt.spawn("worker", "t1")
        yield* rt.spawn("idle", "t2")
        const whereOp = batchOps().find((op) => op.name === "children_where")!
        const run = yield* (whereOp.execute as (input: unknown) => Effect.Effect<unknown, unknown>)({ agent: "worker", status: "running" })
        const failed = yield* (whereOp.execute as (input: unknown) => Effect.Effect<unknown, unknown>)({ status: "failed" })
        return { run, failed }
      }).pipe(Effect.scoped, Effect.provide(provide(agents)))
    )
    expect((outcome.run as Array<{ agent: string }>)).toHaveLength(1)
    expect((outcome.run as Array<{ agent: string }>)[0]?.agent).toBe("worker")
    expect(outcome.failed).toHaveLength(0)
  })

  test("watch rules fork responders at declared moments", async () => {
    const agents = {
      notable: Agent.define("notable", (task: string) => AgentContext.text(task))
        .returns(Until.text)
        .writes(progressBinding())
        .implementedBy(EffectAgent.make({
          model: {
            generate: (() => {
              let calls = 0
              return (_s: string, _m: ReadonlyArray<WireMessage>) => {
                calls++
                return calls === 1
                  ? Effect.succeed({ text: "", toolCalls: [{ id: "p1", name: "report_progress", input: { text: "halfway" } }] })
                  : Effect.succeed({ text: "done", toolCalls: [] })
              }
            })()
          }
        })),
      responder: scriptedAgent("responder", "responded")
    }
    const results = await Effect.runPromise(
      Effect.gen(function* () {
        const rt = yield* AgentRuntime
        yield* rt.spawn("notable", "task", [{ when: { kind: "progress" }, spawn: { agent: "responder", task: "react to halfway" } }])
        yield* Effect.sleep(80)
        return yield* rt.wait("all")
      }).pipe(Effect.scoped, Effect.provide(provide(agents)))
    )
    expect(results).toHaveLength(2)
    const responder = results.find((r) => r.agent === "responder")
    expect(responder?.status).toBe("completed")
    expect(responder?.output).toBe("responded")
  })
})


