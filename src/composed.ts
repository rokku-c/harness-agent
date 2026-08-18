import type { AgentError, AgentProgram, Capabilities, Result } from "./core.js"

/** A completed Harness Agent that can be reused as one composed program. */
export interface ComposedAgent<I, O, E = AgentError, R = never> extends AgentProgram<I, O, E, R> {
  readonly _tag: "ComposedAgent"
}

export const ComposedAgent = {
  make: <I, O, E = AgentError, R = never>(agent: AgentProgram<I, O, E, R>): ComposedAgent<I, O, E, R> => ({
    ...agent,
    _tag: "ComposedAgent"
  }),

  capabilities: <I, O, E, R>(agent: ComposedAgent<I, O, E, R>): Capabilities => agent.capabilities,

  run: <I, O, E, R>(agent: ComposedAgent<I, O, E, R>, input: I) => agent.run(input)
}

export type AnyComposedAgent = ComposedAgent<unknown, unknown, AgentError, never>
