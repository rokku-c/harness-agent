import { Data, Effect } from "effect"
import type { ConnectionRuntime } from "./connection.js"
import type { JsonSchema, JsonValue } from "./schema.js"

export interface ConnectionUse {
  readonly ref: string
  readonly requires: ReadonlyArray<string>
  readonly visibility?: "none" | "events" | "summary" | "full"
  readonly control?: "none" | "invoke" | "intervene" | "admin"
}

export interface InvocationIR {
  readonly connection: string
  readonly capability: string
}

/** An Agent is a serializable connection graph. */
export interface AgentIR {
  readonly id?: string
  readonly version?: string
  readonly input: JsonSchema
  readonly output: JsonSchema
  readonly connections: ReadonlyArray<ConnectionUse>
  readonly entry: InvocationIR
  readonly metadata?: Readonly<Record<string, JsonValue>>
}

export class InvalidAgentIR extends Data.TaggedError("InvalidAgentIR")<{
  readonly message: string
  readonly id?: string
}> {}

export interface GraphProgram {
  readonly ir: AgentIR
  readonly run: (input: unknown) => Effect.Effect<unknown, Error>
}

/** Validate connection contracts and compile the graph to one runtime invocation. */
export const compile = (ir: AgentIR, runtime: ConnectionRuntime): Effect.Effect<GraphProgram, Error> =>
  Effect.gen(function* () {
    const uses = new Map(ir.connections.map((connection) => [connection.ref, connection]))
    const entryUse = uses.get(ir.entry.connection)
    if (!entryUse) return yield* Effect.fail(new InvalidAgentIR({ message: `Entry connection is not declared: ${ir.entry.connection}`, id: ir.id }))
    if (!entryUse.requires.includes(ir.entry.capability))
      return yield* Effect.fail(new InvalidAgentIR({ message: `Entry capability is not required: ${ir.entry.capability}`, id: ir.id }))

    for (const use of ir.connections) {
      const spec = yield* runtime.spec(use.ref)
      const available = new Set(spec.contract.capabilities.map((capability) => capability.name))
      const missing = use.requires.filter((capability) => !available.has(capability))
      if (missing.length > 0)
        return yield* Effect.fail(new InvalidAgentIR({ message: `Connection ${use.ref} is missing: ${missing.join(", ")}`, id: ir.id }))
    }

    return {
      ir,
      run: (input) => runtime.invoke(ir.entry.connection, ir.entry.capability, { input, agent: ir })
    }
  })
