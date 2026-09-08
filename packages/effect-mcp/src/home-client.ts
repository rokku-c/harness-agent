import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import { textContent, resourceText } from "./home-client/content.js"
export interface ConnectNodeOptions { readonly ns: string; readonly appId: string; readonly server: McpServer; readonly homeRegistry: EffectRegistry; readonly authorize?: (ns: string, appId: string, tool: string) => boolean }
export interface ConnectedResource { readonly uri: string; readonly name: string }
export interface ConnectedNode { readonly key: string; readonly resources: readonly ConnectedResource[]; readonly readResource: (uri: string) => Promise<unknown>; readonly dispose: () => Promise<void> }
export const connectNodeToHome = async (o: ConnectNodeOptions): Promise<ConnectedNode> => {
  const { ns, appId, server, homeRegistry } = o; const authorize = o.authorize ?? (() => true); const client = new Client({ name: "effect-home", version: "0.1.0" }); const pair = InMemoryTransport.createLinkedPair(); await server.connect(pair[0]); await client.connect(pair[1])
  const listed = await client.listTools(); const resources = client.getServerCapabilities()?.resources ? (await client.listResources()).resources.map((m) => ({ uri: m.uri, name: m.name })) : []
  const disposeIface = homeRegistry.registerInterface({ id: `${ns}::${appId}`, title: appId, tools: listed.tools.map((meta) => ({ name: meta.name, title: meta.title ?? meta.name, description: meta.description ?? meta.name, inputSchema: meta.inputSchema as unknown, handler: async (args: unknown) => { if (!authorize(ns, appId, meta.name)) throw new Error(`mcp: denied — ${ns}::${appId}.${meta.name}`); const result = await client.callTool({ name: meta.name, arguments: args as Record<string, unknown> }); const text = textContent(result.content); if (result.isError) throw new Error(text); try { return JSON.parse(text) } catch { return text } } })) })
  let closed = false; return { key: `${ns}::${appId}`, resources, readResource: async (uri) => { const result = await client.readResource({ uri }); const text = resourceText(result.contents); try { return JSON.parse(text) } catch { return text } }, dispose: async () => { if (closed) return; closed = true; disposeIface(); try { await client.close() } catch {} } }
}
