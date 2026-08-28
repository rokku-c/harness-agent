// A minimal MCP stdio server: initialize + tools/list + tools/call (echo).
import { createInterface } from "node:readline"

const reply = (message, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\n")

const rl = createInterface({ input: process.stdin })
rl.on("line", (line) => {
  if (line.trim().length === 0) return
  const message = JSON.parse(line)
  if (message.method === "initialize") reply(message, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "echo", version: "0.0.1" } })
  else if (message.method === "tools/list") reply(message, { tools: [{ name: "echo", description: "Echo the input text back.", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } }] })
  else if (message.method === "tools/call") reply(message, { content: [{ type: "text", text: String(message.params.arguments.text) }] })
  else if (message.id !== undefined) reply(message, {})
})
