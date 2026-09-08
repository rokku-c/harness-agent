/**
 * Minimal MCP JSON-RPC over HTTP (stateless, JSON responses) for the
 * registered effect-interface registry — lets the stdio/http registrar and
 * other MCP clients reach the same surface remotely. Implements the methods a
 * client needs: initialize, ping, tools/list, tools/call.
 */

import type { EffectRegistry } from "@effect-agent/effect-interface"
import { invoke } from "@effect-agent/effect-interface"

const textOf = (out: unknown): string => JSON.stringify(out)

const toolList = (registry: EffectRegistry): Array<Record<string, unknown>> =>
  registry.tools().map((entry) => ({
    name: entry.key,
    description: entry.tool.description ?? entry.tool.name,
    inputSchema:
      entry.tool.inputSchema ?? { type: "object", properties: {}, additionalProperties: true },
  }))

const respond = (id: unknown, result: unknown): Response =>
  Response.json({ jsonrpc: "2.0", id, result })

const respondError = (id: unknown, code: number, message: string): Response =>
  Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 200 })

/** handle one JSON-RPC request (any method in params.method path style). */
export const handleMcpRequest =
  (registry: EffectRegistry) =>
  async (request: Request): Promise<Response> => {
    if (request.method === "GET") {
      return new Response("effect-agent mcp json-rpc", { headers: { "content-type": "text/plain" } })
    }
    let body: { id?: unknown; method?: string; params?: Record<string, unknown> }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return Response.json({ jsonrpc: "2.0", error: { code: -32700, message: "parse error" } })
    }
    const { id, method, params } = body
    if (method === "initialize") {
      const protocolVersion = (params?.protocolVersion as string) ?? "2025-06-18"
      return respond(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "effect-agent", version: "0.1.0" },
      })
    }
    if (method === "ping") return respond(id, {})
    if (method === "tools/list") return respond(id, { tools: toolList(registry) })
    if (method === "resources/list") {
      const resources = registry.apps().map((a) => ({
        uri: a.app.resourceUri ?? `ui://${a.interfaceId}/${a.app.id}`,
        name: a.app.title ?? a.app.id,
        description: a.app.description,
      }))
      return respond(id, { resources })
    }
    if (method === "tools/call") {
      const name = String(params?.name ?? "")
      const args = (params?.arguments ?? {}) as Record<string, unknown>
      const entry = registry.tools().find((t) => t.key === name)
      if (entry === undefined) return respondError(id, -32602, "unknown tool: " + name)
      try {
        const out = await invoke(entry.tool, args)
        return respond(id, { content: [{ type: "text", text: textOf(out) }] })
      } catch (error) {
        return respond(id, {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        })
      }
    }
    return respondError(id, -32601, "method not found: " + (method ?? ""))
  }
