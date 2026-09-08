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
  return JSON.parse(raw || "{}") as Record<string, unknown>
}
const created = await call("app_call", { ns: "ops", appId: "board", tool: "board_create", arguments: { title, body } })
const task = (created.task ?? created) as { id?: string }
if (!task.id) throw new Error(`board_create returned no task id: ${JSON.stringify(created)}`)
await call("app_call", { ns: "ops", appId: "board", tool: "board_update", arguments: { id: task.id, patch: { state: "doing" } } })
const state = await call("app_call", { ns: "ops", appId: "board", tool: "board_state", arguments: {} })
await call("app_call", { ns: "ops", appId: "board", tool: "board_update", arguments: { id: task.id, patch: { state: "done", body: JSON.stringify({ worker: "codex", state }) } } })
console.log(JSON.stringify({ ok: true, taskId: task.id, state }))
await client.close()
