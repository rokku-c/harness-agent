import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { HttpSend } from "@effect-agent/effect-network"
import type { McpServerRecord } from "@effect-agent/mcp-registry"

export type PreviewKind = "html" | "image" | "text"
export interface ResourcePreview {
  readonly uri: string
  readonly mimeType?: string
  readonly kind: PreviewKind
  readonly body: string
}

const kindOf = (mimeType: string | undefined): PreviewKind =>
  mimeType?.toLowerCase().includes("html") ? "html" : mimeType?.toLowerCase().startsWith("image/") ? "image" : "text"

const bodyOf = (content: { readonly text?: string; readonly blob?: string }): string =>
  content.text ?? content.blob ?? ""

export const readResourcePreview = async (
  server: McpServerRecord,
  uri: string,
  send: HttpSend,
): Promise<ResourcePreview> => {
  if (server.status === "offline") throw new Error(`registry: server ${server.serverId} is offline`)
  if (!server.apps?.includes(uri)) throw new Error(`registry: ${uri} is not declared by ${server.serverId}`)
  if (!uri.startsWith("ui://")) throw new Error("registry: only ui:// resources can be previewed")
  if (server.transport.kind !== "streamable-http" || !server.transport.endpoint) {
    throw new Error(`registry: server ${server.serverId} has no streamable HTTP endpoint`)
  }

  const client = new Client({ name: "effect-agent-registry-preview", version: "1.0.0" })
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(server.transport.endpoint), { fetch: send }))
    const result = await client.readResource({ uri })
    const content = result.contents[0]
    if (content === undefined) throw new Error(`registry: ${uri} returned no content`)
    const mimeType = content.mimeType
    return { uri, ...(mimeType === undefined ? {} : { mimeType }), kind: kindOf(mimeType), body: bodyOf(content) }
  } finally {
    await client.close().catch(() => undefined)
  }
}
