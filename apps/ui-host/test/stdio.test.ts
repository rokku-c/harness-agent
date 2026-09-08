import { expect, test } from "bun:test"
import { spawn } from "node:child_process"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const rpc = (child: ReturnType<typeof spawn>) => {
  let buffer = ""
  const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>()
  child.stdout!.on("data", (raw: Buffer) => {
    buffer += raw.toString()
    for (const line of buffer.split("\n").slice(0, -1)) {
      try {
        const message = JSON.parse(line)
        const request = pending.get(message.id)
        if (request) { clearTimeout(request.timer); pending.delete(message.id); request.resolve(message.result) }
      } catch { /* wait for next frame */ }
    }
    buffer = buffer.split("\n").at(-1) ?? ""
  })
  return (method: string, params: unknown, id: number): Promise<any> => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("rpc timeout")) }, 10000)
    pending.set(id, { resolve, reject, timer })
    child.stdin!.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n")
  })
}

test("ui host advertises the external MCP surface", async () => {
  const child = spawn("bun", ["run", "apps/ui-host/src/main.ts"], { cwd: root, env: { ...process.env, UI_DATABASE: ":memory:" }, stdio: ["pipe", "pipe", "pipe"] })
  const call = rpc(child)
  try {
    const init = await call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } }, 1)
    expect(init.serverInfo.name).toBe("ui-runtime")
    child.stdin!.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n")
    const listed = await call("tools/list", {}, 2)
    expect(listed.tools.map((tool: { name: string }) => tool.name)).toContain("ui_list_components")
    expect(listed.tools.map((tool: { name: string }) => tool.name)).toContain("ui_remove_node")
    expect(listed.tools.map((tool: { name: string }) => tool.name)).toContain("ui_link_canvas")
    expect(listed.tools.map((tool: { name: string }) => tool.name)).toContain("ui_register_component")
    expect(listed.tools.map((tool: { name: string }) => tool.name)).toContain("ui_list_canvases")
    expect(listed.tools.map((tool: { name: string }) => tool.name)).toContain("ui_set_status")
    const created = await call("tools/call", { name: "ui_create_canvas", arguments: { canvasId: "demo", title: "Demo" } }, 3)
    expect(JSON.stringify(created)).toContain("demo")
    await call("tools/call", { name: "ui_register_component", arguments: { type: "RemoteCard", version: "1", category: "extension" } }, 6)
    const catalog = await call("tools/call", { name: "ui_list_components", arguments: {} }, 7)
    expect(JSON.stringify(catalog)).toContain("RemoteCard")
    await call("tools/call", { name: "ui_create_canvas", arguments: { canvasId: "details", title: "Details" } }, 8)
    const linked = await call("tools/call", { name: "ui_link_canvas", arguments: { canvasId: "demo", nodeId: "details-link", targetCanvasId: "details" } }, 9)
    expect(JSON.stringify(linked)).toContain("details")
    await call("tools/call", { name: "ui_insert_node", arguments: { canvasId: "demo", nodeId: "title", type: "Text", value: "Hello" } }, 4)
    const read = await call("tools/call", { name: "ui_get_canvas", arguments: { canvasId: "demo" } }, 5)
    expect(JSON.stringify(read)).toContain("Demo")
    expect(JSON.stringify(read)).toContain("Hello")
    await call("tools/call", { name: "ui_set_status", arguments: { agent: "Codex", status: "Building UI" } }, 10)
    const activity = await call("tools/call", { name: "ui_list_activity", arguments: {} }, 11)
    expect(JSON.stringify(activity)).toContain("Building UI")
  } finally { child.kill() }
})
