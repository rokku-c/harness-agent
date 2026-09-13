import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { makeDefinitionStore, registerBuiltins } from "@effect-agent/ui-definition"
import { makeUIRuntime } from "@effect-agent/ui-runtime"
import { jsonReactRenderer, makeRendererRegistry, webRenderer } from "@effect-agent/ui-renderer"
import { makeExtensionRegistry } from "@effect-agent/ui-extension"
import { makeActivityStore } from "./activity.ts"
import { makeUiMcpServer } from "./mcp-server.ts"

const definitions = registerBuiltins(makeDefinitionStore())
const runtime = makeUIRuntime(definitions, "root")
const renderers = makeRendererRegistry([webRenderer, jsonReactRenderer])
const extensions = makeExtensionRegistry(definitions)
const activity = makeActivityStore(process.env.UI_DATABASE)
runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root Canvas" })
const server = makeUiMcpServer({ runtime, definitions, renderers, extensions, activity })
await server.connect(new StdioServerTransport())

server.server.onclose = () => activity.close()
process.once("exit", () => activity.close())
