import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

const home = process.env.HOME_URL ?? "http://127.0.0.1:8080/effect-apps"
const title = process.env.CODEX_TASK_TITLE ?? "Codex system dogfood"
const body = process.env.CODEX_TASK_BODY ?? "Validate the platform through its own MCP surface."
const client = new Client({ name: "codex-worker", version: "0.0.1" })
await client.connect(new StreamableHTTPClientTransport(new URL(home)))
const text = (value: unknown): string => Array.isArray(value) ? value.map((item) => {
  const part = item as { type?: string; text?: string }; return part.type === "text" ? part.text ?? "" : ""
}).join("\n") : ""
const call = async (name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const result = await client.callTool({ name, arguments: args }), raw = text(result.content)
  try { return JSON.parse(raw || "{}") as Record<string, unknown> } catch { throw new Error(`${name} failed: ${raw}`) }
}
const created = await call("app_call", { ns: "ops", appId: "board", tool: "board_create", arguments: { title, body, state: "todo", dependsOn: [] } })
const task = (created.task ?? created) as { id?: string }
if (!task.id) throw new Error(`board_create returned no task id: ${JSON.stringify(created)}`)
await call("app_call", { ns: "ops", appId: "board", tool: "board_update", arguments: { id: task.id, patch: { state: "doing" } } })
const state = await call("app_call", { ns: "ops", appId: "board", tool: "board_state", arguments: {} })
const agentd = await call("app_call", { ns: "ops", appId: "agentd", tool: "agentd_status", arguments: {} })
const gateway = await call("app_call", { ns: "ops", appId: "mcp-gateway", tool: "mcp_gateway_topology", arguments: {} })
await call("app_call", { ns: "ops", appId: "board", tool: "board_update", arguments: { id: task.id, patch: { state: "done", body: JSON.stringify({ worker: "codex", state }) } } })
console.log(JSON.stringify({ ok: true, taskId: task.id, state, agentd, gateway }))
await client.close()
