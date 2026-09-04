import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { makeDefinitionStore, registerBuiltins } from "@effect-agent/ui-definition"
import { makeUIRuntime } from "@effect-agent/ui-runtime"
import { makeUIMcp } from "@effect-agent/ui-agent"
import { makeRendererRegistry, webRenderer } from "@effect-agent/ui-renderer"

const definitions = registerBuiltins(makeDefinitionStore())
const runtime = makeUIRuntime(definitions, "root")
const renderers = makeRendererRegistry([webRenderer])
runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root Canvas" })
const server = makeUIMcp(runtime, definitions, renderers)
await server.connect(new StdioServerTransport())
