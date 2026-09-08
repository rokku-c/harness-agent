/**
 * connectNodeToHome — home registers an in-proc app's MCP server.
 *
 * A home-side MCP client connects to the app's MCP server over an
 * InMemoryTransport pair (genuine MCP initialize/tools-list/call, zero
 * network), then registers each discovered tool into the home's
 * effect-interface registry as ns::appId.tool. Every forwarded call goes
 * through the MCP client; an optional authorize() runs before forwarding.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { EffectRegistry } from "@effect-agent/effect-interface"

export interface ConnectNodeOptions {
  readonly ns: string
  readonly appId: string
  readonly server: McpServer
  readonly homeRegistry: EffectRegistry
  /** permission gate before forwarding (e.g. planes.can(callerNs,ns,'interface')). */
  readonly authorize?: (ns: string, appId: string, tool: string) => boolean
}

export interface ConnectedResource {
  readonly uri: string
  readonly name: string
}

export interface ConnectedNode {
  readonly key: string
  /** Resources advertised by the node (ui://… and store://… planes). */
  readonly resources: readonly ConnectedResource[]
  /** Read one node resource and return its parsed JSON payload. */
  readonly readResource: (uri: string) => Promise<unknown>
  readonly dispose: () => Promise<void>
}

const textContent = (content: unknown): string => {
  if (!Array.isArray(content)) return ""
  return content
    .filter((c): c is { type: "text"; text?: string } => typeof c === "object" && c !== null && (c as { type?: string }).type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
}

/** Resource contents carry { uri, text } (no `type` field, unlike tool content). */
const resourceText = (content: unknown): string => {
  if (!Array.isArray(content)) return ""
  const hit = content.find(
    (c): c is { text: string } => typeof c === "object" && c !== null && typeof (c as { text?: unknown }).text === "string",
  )
  return hit?.text ?? ""
}

export const connectNodeToHome = async (options: ConnectNodeOptions): Promise<ConnectedNode> => {
  const { ns, appId, server, homeRegistry } = options
  const authorize = options.authorize ?? (() => true)
  const client = new Client({ name: "effect-home", version: "0.1.0" })
  const pair = InMemoryTransport.createLinkedPair()
  await server.connect(pair[0])
  await client.connect(pair[1])

  const listed = await client.listTools()
  const resources =
    client.getServerCapabilities()?.resources !== undefined
      ? (await client.listResources()).resources.map((meta) => ({ uri: meta.uri, name: meta.name }))
      : []
  const disposeIface = homeRegistry.registerInterface({
    id: `${ns}::${appId}`,
    title: appId,
    tools: listed.tools.map((meta) => ({
      name: meta.name,
      title: meta.title ?? meta.name,
      description: meta.description ?? meta.name,
      inputSchema: meta.inputSchema as unknown,
      handler: async (args: unknown) => {
        if (!authorize(ns, appId, meta.name)) {
          throw new Error(`mcp: denied — ${ns}::${appId}.${meta.name}`)
        }
        const result = await client.callTool({ name: meta.name, arguments: args as Record<string, unknown> })
        const text = textContent(result.content)
        if (result.isError === true) throw new Error(text)
        try {
          return JSON.parse(text) as unknown
        } catch {
          return text
        }
      },
    })),
  })

  let closed = false
  return {
    key: `${ns}::${appId}`,
    resources,
    readResource: async (uri: string): Promise<unknown> => {
      const result = await client.readResource({ uri })
      const text = resourceText(result.contents)
      try {
        return JSON.parse(text) as unknown
      } catch {
        return text
      }
    },
    dispose: async () => {
      if (closed) return
      closed = true
      disposeIface()
      try {
        await client.close()
      } catch {
        /* already closed */
      }
    },
  }
}
