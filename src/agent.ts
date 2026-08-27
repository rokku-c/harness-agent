import { Effect } from "effect"
import type { Access, AgentProgram, AgentContext, AgentError, Binding, Driver, Until, WritableBinding } from "./core.js"

export interface Definition<I, O, R> {
  readonly id: string
  readonly input: (input: I) => AgentContext
  readonly until: Until<O>
  readonly access: ReadonlyArray<Access<R>>
}

export class AgentBuilder<I, O, R = never> {
  constructor(readonly definition: Definition<I, O, R>) {}

  uses<R2>(binding: Binding<any, any, R2>): AgentBuilder<I, O, R | R2> {
    const access = [...this.definition.access, { binding, write: false }] as ReadonlyArray<Access<R | R2>>
    return new AgentBuilder<I, O, R | R2>({ ...this.definition, access })
  }

  // Only a WritableBinding can be declared as a write target: passing a plain
  // Binding fails at compile time (docs/writable.md D2).
  writes<R2>(binding: WritableBinding<any, any, R2>): AgentBuilder<I, O, R | R2> {
    const access = [...this.definition.access, { binding, write: true }] as ReadonlyArray<Access<R | R2>>
    return new AgentBuilder<I, O, R | R2>({ ...this.definition, access })
  }

  implementedBy<RD>(driver: Driver<RD>): AgentProgram<I, O, AgentError, R | RD> {
    const definition = this.definition
    return {
      id: definition.id,
      capabilities: driver.capabilities,
      run: (input) => driver.run({
        context: definition.input(input),
        until: definition.until,
        access: definition.access
      })
    }
  }
}

export const Agent = {
  define: <I>(id: string, input: (input: I) => AgentContext) => ({
    returns: <O>(until: Until<O>) => new AgentBuilder<I, O, never>({ id, input, until, access: [] })
  }),
  run: <I, O, E, R>(agent: AgentProgram<I, O, E, R>, input: I) => agent.run(input),
  map: <I, O, E, R>(agents: ReadonlyArray<AgentProgram<I, O, E, R>>, input: I) =>
    Effect.forEach(agents, (agent) => agent.run(input), { concurrency: "unbounded" }),
  reduce: <I, O, E, R, E2, R2>(agents: ReadonlyArray<AgentProgram<I, O, E, R>>, input: I, select: (values: ReadonlyArray<O>) => Effect.Effect<O, E2, R2>) =>
    Effect.forEach(agents, (agent) => agent.run(input), { concurrency: "unbounded" }).pipe(Effect.flatMap(select))
}
