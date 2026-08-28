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

/**
 * Sequential composition of two agent programs: the first program's output is
 * the second's input (a.out = b.in, pinned by the type parameters - no any
 * bridge, no array signature). The result is a typed function, NOT an
 * AgentProgram: a composite has no single offer surface, so it exposes
 * (input: A) => Effect<C, E1 | E2, R1 | R2>.
 *
 * Step-level errors are a typed E union by construction: the chain's E1 | E2
 * attributes a failure to its step - a caller matching the E1 or E2 branch
 * locates the failing program. E-union attribution only holds for DISTINCT
 * tag typed steps: implementedBy pins E = AgentError, so an agent->agent
 * chain collapses to AgentError | AgentError and attribution goes through
 * the existing AgentFailure.agent field instead. Short-circuit: when a
 * fails, b never runs (flatMap skips the second step).
 */
export type Then = <A, B, C, E1, E2, R1, R2>(
  a: AgentProgram<A, B, E1, R1>,
  b: AgentProgram<B, C, E2, R2>
) => (input: A) => Effect.Effect<C, E1 | E2, R1 | R2>

/**
 * A chained program: callable with the chain's input, and `.then` accumulates
 * further steps into the E/R unions (a.then(b).then(c) works). Still NOT an
 * AgentProgram - a composite has no single offer surface (no id/capabilities);
 * events and runIds are emitted by the constituent agents themselves (runId
 * ownership lands in B1-B). Same E-union boundary as Then: attribution needs
 * distinct tag typed steps; agent->agent chains collapse to AgentError and
 * attribute via AgentFailure.agent.
 */
export interface Chained<I, O, E, R> {
  (input: I): Effect.Effect<O, E, R>
  then<O2, E2, R2>(next: AgentProgram<O, O2, E2, R2>): Chained<I, O2, E | E2, R | R2>
}

const chainOf = <I, O, E, R>(run: (input: I) => Effect.Effect<O, E, R>): Chained<I, O, E, R> => {
  const chained = ((input: I) => run(input)) as Chained<I, O, E, R>
  chained.then = <O2, E2, R2>(next: AgentProgram<O, O2, E2, R2>): Chained<I, O2, E | E2, R | R2> =>
    chainOf((input) => run(input).pipe(Effect.flatMap((value) => next.run(value))))
  return chained
}

export const Agent = {
  define: <I>(id: string, input: (input: I) => AgentContext) => ({
    returns: <O>(until: Until<O>) => new AgentBuilder<I, O, never>({ id, input, until, access: [] })
  }),
  run: <I, O, E, R>(agent: AgentProgram<I, O, E, R>, input: I) => agent.run(input),
  /** Chained entry point: an AgentProgram becomes a callable chain. */
  chain: <I, O, E, R>(agent: AgentProgram<I, O, E, R>): Chained<I, O, E, R> => chainOf(agent.run),
  /** Pairwise form kept for two-step chains; equivalent to chain(a).then(b). */
  then: <A, B, C, E1, E2, R1, R2>(
    a: AgentProgram<A, B, E1, R1>,
    b: AgentProgram<B, C, E2, R2>
  ): ((input: A) => Effect.Effect<C, E1 | E2, R1 | R2>) =>
    (input) => a.run(input).pipe(Effect.flatMap((value) => b.run(value))),
  map: <I, O, E, R>(agents: ReadonlyArray<AgentProgram<I, O, E, R>>, input: I) =>
    Effect.forEach(agents, (agent) => agent.run(input), { concurrency: "unbounded" }),
  reduce: <I, O, E, R, E2, R2>(agents: ReadonlyArray<AgentProgram<I, O, E, R>>, input: I, select: (values: ReadonlyArray<O>) => Effect.Effect<O, E2, R2>) =>
    Effect.forEach(agents, (agent) => agent.run(input), { concurrency: "unbounded" }).pipe(Effect.flatMap(select))
}
