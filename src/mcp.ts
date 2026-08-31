/**
 * MCP adapter (mode 1 - any): a minimal Model Context Protocol client over
 * stdio (newline-delimited JSON-RPC 2.0), zero dependencies. MCP tool
 * inputSchemas are JSON Schema - they land in the Connection unchanged, which
 * is exactly what the any-mode declaration accepts (mcp__ prefix).
 */
import { Effect } from "effect"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { connection, type Connection } from "./connection.ts"
import { memoryNotationStore, type NotationEntry } from "./notation.ts"

export interface McpOptions {
  /** The connection name (the slot key the agent declares). */
  readonly name: string
  readonly command: string
  readonly args?: ReadonlyArray<string>
  readonly env?: Record<string, string>
}

interface Pending {
  resolve: (result: unknown) => void
  reject: (cause: unknown) => void
}

const startClient = (options: McpOptions): ChildProcessWithoutNullStreams => {
  const child = spawn(options.command, [...(options.args ?? [])], {
    stdio: ["pipe", "pipe", "pipe"],
    env: options.env === undefined ? process.env : { ...process.env, ...options.env }
  })
  return child as ChildProcessWithoutNullStreams
}

const wire = (child: ChildProcessWithoutNullStreams) => {
  let buffer = ""
  let nextId = 1
  const pending = new Map<number, Pending>()
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString()
    let index: number
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line.length === 0) continue
      try {
        const message = JSON.parse(line) as { id?: number; result?: unknown; error?: unknown }
        if (message.id !== undefined && pending.has(message.id)) {
          const entry = pending.get(message.id)!
          pending.delete(message.id)
          if (message.error !== undefined) entry.reject(message.error)
          else entry.resolve(message.result)
        }
      } catch {
        // non-JSON line: ignore (servers may log to stdout)
      }
    }
  })
  const request = <T>(method: string, params: unknown): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve: resolve as (result: unknown) => void, reject })
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n")
    })
  return request
}

/**
 * Connect to an MCP server over stdio: initialize, list tools, and return a
 * Connection whose tool execute issues tools/call requests.
 */
export const mcpConnection = (options: McpOptions): Effect.Effect<Connection, unknown> =>
  Effect.async<Connection, unknown>((resume) => {
    const child = startClient(options)
    const request = wire(child)
    void (async () => {
      try {
        await request("initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "effect-agent", version: "0.1.0" }
        })
        await request("notifications/initialized", {})
        const listed = await request<{ tools?: Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }> }>("tools/list", {})
        // the server's tool descriptions are external prose - they enter the
        // system through a store like every other model-facing text
        const entries: NotationEntry[] = []
        for (const tool of listed.tools ?? []) {
          if (tool.description === undefined || tool.description.length === 0)
            throw new Error(`mcp server "${options.name}": tool "${tool.name}" carries no description - the server should provide one (model-facing prose must live in a store)`)
          entries.push({ target: `tool:${tool.name}`, instructions: [tool.description] })
        }
        const store = memoryNotationStore(entries)
        const tools = (listed.tools ?? []).map((tool) => ({
          name: tool.name,
          input: tool.inputSchema,
          output: { type: "object" } as Record<string, unknown>,
          execute: (input: unknown) =>
            Effect.tryPromise({
              try: async () => {
                const called = await request<{ content?: unknown }>("tools/call", { name: tool.name, arguments: input })
                return called.content ?? called
              },
              catch: (cause) => cause
            })
        }))
        resume(Effect.succeed(connection(options.name, tools, store)))
      } catch (cause) {
        resume(Effect.fail(cause))
      }
    })()
  })
