import { expect, test } from "bun:test"
import { spawn } from "node:child_process"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const call = (child: ReturnType<typeof spawn>, method: string, params: unknown, id: number): Promise<any> => new Promise((resolve, reject) => {
  let buffer = ""
  const timer = setTimeout(() => reject(new Error("rpc timeout")), 10000)
  child.stdout!.on("data", (raw: Buffer) => {
    buffer += raw.toString()
    for (const line of buffer.split("\n").slice(0, -1)) {
      try { const message = JSON.parse(line); if (message.id === id) { clearTimeout(timer); resolve(message.result) } } catch { /* wait for next frame */ }
    }
    buffer = buffer.split("\n").at(-1) ?? ""
  })
  child.stdin!.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n")
})

test("ui host advertises the external MCP surface", async () => {
  const child = spawn("bun", ["run", "apps/ui-host/src/main.ts"], { cwd: root, stdio: ["pipe", "pipe", "pipe"] })
  try {
    const init = await call(child, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } }, 1)
    expect(init.serverInfo.name).toBe("ui-runtime")
    child.stdin!.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n")
    const listed = await call(child, "tools/list", {}, 2)
    expect(listed.tools.map((tool: { name: string }) => tool.name)).toContain("ui_list_components")
    expect(listed.tools.map((tool: { name: string }) => tool.name)).toContain("ui_remove_node")
    expect(listed.tools.map((tool: { name: string }) => tool.name)).toContain("ui_link_canvas")
    expect(listed.tools.map((tool: { name: string }) => tool.name)).toContain("ui_register_component")
    const created = await call(child, "tools/call", { name: "ui_create_canvas", arguments: { canvasId: "demo", title: "Demo" } }, 3)
    expect(JSON.stringify(created)).toContain("demo")
    await call(child, "tools/call", { name: "ui_register_component", arguments: { type: "RemoteCard", version: "1", category: "extension" } }, 6)
    const catalog = await call(child, "tools/call", { name: "ui_list_components", arguments: {} }, 7)
    expect(JSON.stringify(catalog)).toContain("RemoteCard")
    await call(child, "tools/call", { name: "ui_insert_node", arguments: { canvasId: "demo", nodeId: "title", type: "Text", value: "Hello" } }, 4)
    const read = await call(child, "tools/call", { name: "ui_get_canvas", arguments: { canvasId: "demo" } }, 5)
    expect(JSON.stringify(read)).toContain("Demo")
    expect(JSON.stringify(read)).toContain("Hello")
  } finally { child.kill() }
})
