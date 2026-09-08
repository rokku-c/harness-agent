import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { McpPluginEntry } from "../registrar.ts"

/** Own connection cleanup if a transport fails before registration completes. */
export const connectPlugin = async (entry: McpPluginEntry): Promise<Client> => {
  const client = new Client({ name: "effect-server", version: "0.1.0" })
  try {
    if (entry.transport === "stdio") {
      const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js")
      await client.connect(new StdioClientTransport({ command: entry.command ?? "bun", args: [...entry.args ?? []] }))
    } else {
      if (!entry.url) throw new Error("http plugin needs a url")
      const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js")
      await client.connect(new StreamableHTTPClientTransport(new URL(entry.url), { requestInit: { headers: entry.headers } }))
    }
    return client
  } catch (error) { await client.close(); throw error }
}
