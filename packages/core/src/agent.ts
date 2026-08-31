import { Effect } from "effect"
import type { Access, Binding } from "./binding.ts"
import type { Capabilities } from "./capabilities.ts"
import type { AgentContext } from "./content.ts"
import type { Driver } from "./driver.ts"
import type { AgentError } from "./errors.ts"
import type { Until } from "./until.ts"

/**
 * The agent algebra: an agent is Input -> Effect<Output, Error, Requirements>.
 * The definition expresses WHAT it does (context mapping, until, access);
 * the driver decides HOW the loop runs. define -> returns -> uses/writes ->
 * implementedBy reads as the sentence it is.
 */
export interface Definition<I, O, R> {
  readonly id: string
  readonly input: (input: I) => AgentContext
  readonly until: Until<O>
  readonly access: ReadonlyArray<Access<R>>
}

export class AgentBuilder<I, O, R = never> {
  constructor(readonly definition: Definition<I, O, R>) {}

  uses = <R2>(binding: Binding<any, any, R2>): AgentBuilder<I, O, R | R2> =>
    new AgentBuilder<I, O, R | R2>({
      ...this.definition,
      access: [...this.definition.access, { binding, write: false } as Access<R | R2>]
    })

  writes = <R2>(binding: Binding<any, any, R2>): AgentBuilder<I, O, R | R2> =>
    new AgentBuilder<I, O, R | R2>({
      ...this.definition,
      access: [...this.definition.access, { binding, write: true } as Access<R | R2>]
    })

  implementedBy = <RD>(driver: Driver<RD>): AgentProgram<I, O, AgentError, R | RD> => ({
    id: this.definition.id,
    capabilities: driver.capabilities,
    run: (input: I) =>
      driver.run({
        context: this.definition.input(input),
        until: this.definition.until,
        access: this.definition.access
      }) as Effect.Effect<O, AgentError, R | RD>
  })
}

export interface AgentProgram<I, O, E = AgentError, R = never> {
  readonly id: string
  readonly capabilities: Capabilities
  readonly run: (input: I) => Effect.Effect<O, E, R>
}

export const Agent = {
  define: <I>(id: string, input: (input: I) => AgentContext) => ({
    returns: <O>(until: Until<O>) => new AgentBuilder<I, O, never>({ id, input, until, access: [] })
  }),
  run: <I, O, E, R>(agent: AgentProgram<I, O, E, R>, input: I) => agent.run(input),
  map: <I, O, E, R>(agents: ReadonlyArray<AgentProgram<I, O, E, R>>, input: I) =>
    Effect.forEach(agents, (agent) => agent.run(input), { concurrency: "unbounded" }),
  reduce: <I, O, E, R, E2, R2>(
    agents: ReadonlyArray<AgentProgram<I, O, E, R>>,
    input: I,
    select: (values: ReadonlyArray<O>) => Effect.Effect<O, E2, R2>
  ) =>
    Effect.forEach(agents, (agent) => agent.run(input), { concurrency: "unbounded" }).pipe(Effect.flatMap(select))
}

