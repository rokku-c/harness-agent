import { Effect } from "effect"
import type { Access } from "./binding.ts"
import type { Capabilities } from "./capabilities.ts"
import type { AgentContext, Content } from "./content.ts"
import type { AgentError } from "./errors.ts"
import type { Until } from "./until.ts"

/** What a driver receives: the loop, fully expressed as data. */
export interface RunRequest<A, R = never> {
  readonly context: AgentContext
  readonly until: Until<A>
  readonly access: ReadonlyArray<Access<R>>
  readonly report?: (event: DriverEvent) => Effect.Effect<void, AgentError, R>
}

export type DriverEvent = {
  readonly _tag: "DriverPrepared"
  readonly agent: string
  readonly runtime: string
  readonly details: Readonly<Record<string, unknown>>
}

export const report = <A, R>(request: RunRequest<A, R>, event: DriverEvent) =>
  request.report?.(event) ?? Effect.void

/**
 * Materialize the request: pull every readable binding's content into the
 * context before the loop starts. The agent sees its bindings from step one.
 */
export const materialize = <A, R>(request: RunRequest<A, R>) =>
  Effect.gen(function* () {
    const content = yield* Effect.forEach(
      request.access,
      ({ binding }) =>
        binding.read
          ? Effect.map(binding.read, (value: Content) => [value])
          : Effect.succeed([] as ReadonlyArray<Content>),
      { concurrency: "unbounded" }
    )
    return { ...request, context: request.context.append(...content.flat()) }
  })

/**
 * The driver IS the loop engine: it receives the expressed loop and runs it.
 * The same agent definition can be implemented by any driver - a model loop,
 * Claude Code, Codex - without changing the definition.
 */
export interface Driver<RD = never> {
  readonly id: string
  readonly capabilities: Capabilities
  readonly run: <A, R>(request: RunRequest<A, R>) => Effect.Effect<A, AgentError, R | RD>
}

