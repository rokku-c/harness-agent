import { Data, Effect, Schema } from "effect"

export interface McpTool {
  readonly name: string
  readonly description?: string
  readonly inputSchema?: Record<string, unknown>
}

/** Protocol-level compatibility shape. Official SDK clients are implemented as adapters. */
export interface McpConnection {
  readonly id: string
  readonly listTools: () => Effect.Effect<ReadonlyArray<McpTool>, Error>
  readonly callTool: (name: string, args: unknown) => Effect.Effect<unknown, Error>
  readonly close?: () => Effect.Effect<void, Error>
}

type RequestResult = Effect.Effect<any, Error> | Promise<any>
const asEffect = (value: RequestResult): Effect.Effect<any, Error> =>
  value instanceof Promise
    ? Effect.tryPromise({ try: () => value, catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)) })
    : value

export class McpConnectionNotFound extends Data.TaggedError("McpConnectionNotFound")<{ readonly id: string }> {}

/** Legacy MCP-only registry. New code should use ConnectionRuntime + an MCP adapter. */
export class ConnectionRegistry {
  constructor(readonly connections: ReadonlyMap<string, McpConnection>) {}
  static empty = new ConnectionRegistry(new Map())
  register(connection: McpConnection) {
    const next = new Map(this.connections)
    next.set(connection.id, connection)
    return new ConnectionRegistry(next)
  }
  unregister(id: string) {
    const connection = this.connections.get(id)
    const next = new Map(this.connections)
    next.delete(id)
    return { registry: new ConnectionRegistry(next), closed: connection?.close?.() ?? Effect.void }
  }
  resolve(id: string) {
    const connection = this.connections.get(id)
    return connection ? Effect.succeed(connection) : Effect.fail(new McpConnectionNotFound({ id }))
  }
  list() { return [...this.connections.values()] }
  listTools(id: string) {
    const self = this
    return Effect.gen(function* () {
      const connection = yield* self.resolve(id)
      return yield* connection.listTools()
    })
  }
  callTool(id: string, name: string, args: unknown) {
    const self = this
    return Effect.gen(function* () {
      const connection = yield* self.resolve(id)
      return yield* connection.callTool(name, args)
    })
  }
}

/** Adapt a standards-shaped MCP JSON-RPC request function to the legacy shape. */
export const mcpConnection = (spec: {
  readonly id: string
  readonly request: (method: string, params?: unknown) => RequestResult
}): McpConnection => ({
  id: spec.id,
  listTools: () => asEffect(spec.request("tools/list")).pipe(
    Effect.map((result) => (result?.tools ?? []) as ReadonlyArray<McpTool>)
  ),
  callTool: (name, args) => asEffect(spec.request("tools/call", { name, arguments: args })).pipe(
    Effect.map((result) => result?.content ?? result)
  )
})

export const McpToolSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  inputSchema: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
})
