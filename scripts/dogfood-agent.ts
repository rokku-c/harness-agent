/**
 * Dogfood — I (the agent) connect to the running home over MCP and operate.
 *
 * Connects to http://<home>/effect-apps (stateless streamable HTTP), lists
 * the platform's own tools, then reads the apps: catalog, board ui + config.
 * Run while `bun run up` is live, with HOME_URL set (default :8266).
 * This is the platform's own dogfood client: it exercises discovery, UI,
 * config, state and tool invocation through the public MCP surface.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

const HOME = process.env.HOME_URL ?? "http://127.0.0.1:8266/effect-apps"

const text = (content: unknown): string =>
  Array.isArray(content)
    ? content
        .filter((c): c is { type: string; text?: string } => typeof c === "object" && c !== null && (c as { type?: string }).type === "text")
        .map((c) => c.text ?? "")
        .join("\n")
    : ""

const client = new Client({ name: "dogfood-agent", version: "0.0.1" })
await client.connect(new StreamableHTTPClientTransport(new URL(HOME)))

const tools = await client.listTools()
console.log("[agent] connected · platform tools: " + tools.tools.map((t) => t.name).join(", "))

const call = async (name: string, args: Record<string, unknown>) => {
  const r = await client.callTool({ name, arguments: args })
  return text(r.content)
}

console.log("\n[agent] apps_list →")
console.log(text((await client.callTool({ name: "apps_list", arguments: {} })).content))

console.log("\n[agent] app_call board_state →")
console.log((await call("app_call", { ns: "ops", appId: "board", tool: "board_state", arguments: {} })).slice(0, 240))

console.log("\n[agent] app_call board_tree →")
console.log((await call("app_call", { ns: "ops", appId: "board", tool: "board_tree", arguments: {} })).slice(0, 200))

await client.close()
console.log("\n[agent] done")
