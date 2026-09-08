/**
 * buildNodeMcpServer — turn an app's effect-interface registry into a real
 * MCP server. Tools are registered 1:1; each handler validates via invoke and
 * answers with a JSON text blob. Connectable by ANY MCP client.
 *
 * Optionally the app's UI and storage planes are exposed as MCP resources:
 *  - ui://<viewId>      — static resource per ui entry (its document, JSON text)
 *  - store://<key>      — resource template over the store's get(key); keys that
 *                         the store can list are advertised as concrete URIs.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { invoke, type EffectRegistry } from "@effect-agent/effect-interface"

const sanitize = (name: string): string => name.replace(/[^A-Za-z0-9_-]+/g, "_")

interface JsonField {
  readonly type?: string
  readonly enum?: readonly unknown[]
}
interface JsonSchema {
  readonly type?: string
  readonly properties?: Readonly<Record<string, JsonField>>
  readonly required?: readonly string[]
}

/** Minimal JSON Schema (object) -> zod raw shape for the MCP SDK. */
const zodField = (s: JsonField): z.ZodType => {
  switch (s.type) {
    case "string":
      return s.enum !== undefined && s.enum.length > 0 ? z.enum(s.enum as [string, ...string[]]) : z.string()
    case "number":
      return z.number()
    case "integer":
      return z.number().int()
    case "boolean":
      return z.boolean()
    default:
      return z.unknown()
  }
}

const zodShape = (schema: JsonSchema | undefined): Record<string, z.ZodType> => {
  if (schema?.properties === undefined) return {}
  const required = new Set(schema.required ?? [])
  const shape: Record<string, z.ZodType> = {}
  for (const [key, field] of Object.entries(schema.properties)) {
    const base = zodField(field)
    shape[key] = required.has(key) ? base : base.optional()
  }
  return shape
}

/** A node's storage plane: read one key, optionally enumerate keys. */
export interface NodeStorePlane {
  readonly get: (key: string) => unknown | undefined
  /** Optional key enumerator (e.g. a real store's list). When present, concrete store://<key> resources are advertised. */
  readonly list?: (prefix?: string) => readonly string[]
}

/** Optional UI + storage planes exposed as MCP resources on top of the tools. */
export interface NodeResourcePlanes {
  /** viewId -> live document, exposed as ui://<viewId>. */
  readonly ui?: Readonly<Record<string, unknown>>
  /** keyed JSON store, exposed as store://<key>. */
  readonly store?: NodeStorePlane
}

/** One JSON-text resource read result (TextResourceContents[]). */
interface ResourceReadResult {
  readonly contents: Array<{ uri: string; text: string; mimeType?: string }>
}

const jsonResult = (uri: string, doc: unknown): ResourceReadResult => ({
  contents: [{ uri, text: JSON.stringify(doc) ?? "null", mimeType: "application/json" }],
})

export const buildNodeMcpServer = (registry: EffectRegistry, planes?: NodeResourcePlanes): McpServer => {
  const server = new McpServer({ name: "effect-node", version: "0.1.0" })
  const register = server.registerTool.bind(server) as (
    name: string,
    config: { title?: string; description?: string; inputSchema?: unknown },
    handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>,
  ) => void

  for (const entry of registry.tools()) {
    const tool = entry.tool
    register(
      sanitize(tool.name),
      {
        title: tool.title ?? tool.name,
        description: tool.description ?? tool.name,
        inputSchema: zodShape(tool.inputSchema as JsonSchema | undefined),
      },
      async (args) => {
        try {
          const out = await invoke(tool, args ?? {})
          return { content: [{ type: "text", text: JSON.stringify(out) }] }
        } catch (error) {
          return {
            content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
            isError: true,
          }
        }
      },
    )
  }

  if (planes === undefined) return server

  const registerResource = server.registerResource.bind(server) as unknown as (
    name: string,
    uriOrTemplate: string | ResourceTemplate,
    config: { description?: string },
    read: (uri: URL, variables?: Record<string, string>) => Promise<ResourceReadResult>,
  ) => void

  for (const [viewId, doc] of Object.entries(planes.ui ?? {})) {
    const id = sanitize(viewId) || "view"
    const uri = `ui://${id}`
    registerResource(`ui:${id}`, uri, { description: `ui plane view ${viewId}` }, () => Promise.resolve(jsonResult(uri, doc)))
  }

  const store = planes.store
  if (store !== undefined) {
    const storeRecord = store as unknown as Record<string, unknown>
    const storeKeys = (): readonly string[] => {
      if (typeof store.list === "function") return store.list() ?? []
      // Record-style fallback: enumerable own data properties (skips get/list fns).
      return Object.keys(store).filter((key) => typeof storeRecord[key] !== "function")
    }
    const template = new ResourceTemplate("store://{key}", {
      list: async () => ({
        resources: storeKeys().map((key) => ({ uri: `store://${key}`, name: key })),
      }),
    })
    registerResource(
      "store",
      template,
      { description: "storage plane: store://<key>" },
      async (_uri, variables) => {
        const key = variables?.key ?? ""
        const value = typeof store.get === "function" ? store.get(key) : storeRecord[key]
        if (value === undefined) throw new Error(`store key not found: ${key}`)
        return jsonResult(`store://${key}`, value)
      },
    )
  }

  return server
}
