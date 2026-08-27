import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { Effect } from "effect"
import type { JsonValue } from "@effect-agent/core"
import { mcpSdkAdapter } from "./adapters/mcp-sdk.js"

const configRecord = (config: JsonValue | undefined): Readonly<Record<string, JsonValue>> =>
  config && typeof config === "object" && !Array.isArray(config)
    ? config as Readonly<Record<string, JsonValue>>
    : {}

/** Node-only official MCP stdio transport adapter. */
export const mcpStdioAdapter = (options: {
  readonly kind?: string
  readonly clientInfo?: { readonly name: string; readonly version: string }
} = {}) => mcpSdkAdapter({
  kind: options.kind ?? "builtin.mcp.stdio",
  ...(options.clientInfo ? { clientInfo: options.clientInfo } : {}),
  createTransport: (config) => Effect.try({
    try: () => {
      const value = configRecord(config)
      if (typeof value.command !== "string") throw new Error("MCP stdio adapter requires config.command")
      const args = Array.isArray(value.args) && value.args.every((item) => typeof item === "string")
        ? value.args
        : undefined
      const env = value.env && typeof value.env === "object" && !Array.isArray(value.env)
        ? Object.fromEntries(Object.entries(value.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
        : undefined
      return new StdioClientTransport({
        command: value.command,
        ...(args ? { args } : {}),
        ...(env ? { env } : {}),
        ...(typeof value.cwd === "string" ? { cwd: value.cwd } : {})
      })
    },
    catch: (cause) => cause instanceof Error ? cause : new Error(String(cause))
  })
})
