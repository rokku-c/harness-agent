import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { Effect } from "effect"
import type { JsonValue } from "@effect-agent/core"
import { mcpSdkAdapter } from "./mcp-sdk.js"

const configRecord = (config: JsonValue | undefined): Readonly<Record<string, JsonValue>> =>
  config && typeof config === "object" && !Array.isArray(config)
    ? config as Readonly<Record<string, JsonValue>>
    : {}

/** Browser-safe official MCP Streamable HTTP transport adapter. */
export const mcpStreamableHttpAdapter = (options: {
  readonly kind?: string
  readonly clientInfo?: { readonly name: string; readonly version: string }
} = {}) => mcpSdkAdapter({
  kind: options.kind ?? "builtin.mcp.streamable-http",
  ...(options.clientInfo ? { clientInfo: options.clientInfo } : {}),
  createTransport: (config) => Effect.try({
    try: () => {
      const value = configRecord(config)
      if (typeof value.url !== "string") throw new Error("MCP Streamable HTTP adapter requires config.url")
      const headers = value.headers && typeof value.headers === "object" && !Array.isArray(value.headers)
        ? Object.fromEntries(Object.entries(value.headers).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
        : undefined
      return new StreamableHTTPClientTransport(new URL(value.url), {
        requestInit: headers ? { headers } : undefined
      })
    },
    catch: (cause) => cause instanceof Error ? cause : new Error(String(cause))
  })
})
