import { Effect, Ref } from "effect"
import { Context } from "./core.js"
import type { Access, AgentProgram, AgentError, Binding, Detail, Driver, Result, Session, SubagentProgram, Until } from "./core.js"
import { Session as SessionImpl } from "./core.js"

export interface Definition<I, O, R> {
  readonly id: string
  readonly input: (input: I) => Context
  readonly until: Until<O>
  readonly access: ReadonlyArray<Access<R>>
  readonly subagents: ReadonlyArray<SubagentProgram>
}

/** Add a binding to access, de-duplicating by `binding.uri` (later declaration wins). */
const upsertAccess = <R, R2>(
  access: ReadonlyArray<Access<R>>,
  binding: Binding<any, any, R2>,
  write: boolean
): ReadonlyArray<Access<R | R2>> => {
  const rest = access.filter((entry) => entry.binding.uri !== binding.uri) as ReadonlyArray<Access<R | R2>>
  return [...rest, { binding, write }]
}

export class AgentBuilder<I, O, R = never> {
  constructor(readonly definition: Definition<I, O, R>) {}

  uses<R2>(binding: Binding<any, any, R2>): AgentBuilder<I, O, R | R2> {
    return new AgentBuilder<I, O, R | R2>({ ...this.definition, access: upsertAccess(this.definition.access, binding, false) })
  }

  writes<R2>(binding: Binding<any, any, R2>): AgentBuilder<I, O, R | R2> {
    return new AgentBuilder<I, O, R | R2>({ ...this.definition, access: upsertAccess(this.definition.access, binding, true) })
  }

  /** Declare runtime-derived sub-agents the running driver may spawn via a delegate tool. */
  subagents(...subagents: ReadonlyArray<SubagentProgram>): AgentBuilder<I, O, R> {
    return new AgentBuilder<I, O, R>({ ...this.definition, subagents: [...this.definition.subagents, ...subagents] })
  }

  implementedBy<RD>(driver: Driver<RD>): AgentProgram<I, O, AgentError, R | RD> {
    const definition = this.definition
    return {
      id: definition.id,
      capabilities: driver.capabilities,
      run: (input) => Effect.gen(function*() {
        const context = definition.input(input).withUntil(definition.until).withAccess(definition.access)
        const driverSession = yield* driver.start({ context })
        const detailsRef = yield* Ref.make<ReadonlyArray<Detail>>([])
        return yield* new SessionImpl(context, driverSession, detailsRef).run<O>()
      })
    }
  }
}

export const Agent = {
  define: <I>(
    idOrInput?: string | ((input: I) => Context),
    maybeInput?: (input: I) => Context
  ) => {
    const id = typeof idOrInput === "string" ? idOrInput : "agent"
    const input = typeof idOrInput === "string" ? maybeInput! : typeof idOrInput === "function" ? idOrInput : Context.input
    return {
      returns: <O>(until: Until<O>) => new AgentBuilder<I, O, never>({ id, input, until, access: [], subagents: [] })
    }
  },
  run: <I, O, E, R>(agent: AgentProgram<I, O, E, R>, input: I) => agent.run(input),
  map: <I, O, E, R>(agents: ReadonlyArray<AgentProgram<I, O, E, R>>, input: I) =>
    Effect.forEach(agents, (agent) => agent.run(input), { concurrency: "unbounded" }),
  reduce: <I, O, E, R, E2, R2>(agents: ReadonlyArray<AgentProgram<I, O, E, R>>, input: I, select: (values: ReadonlyArray<Result<O>>) => Effect.Effect<Result<O>, E2, R2>) =>
    Effect.forEach(agents, (agent) => agent.run(input), { concurrency: "unbounded" }).pipe(Effect.flatMap(select))
}
