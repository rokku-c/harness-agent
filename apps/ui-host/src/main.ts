import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { makeDefinitionStore, registerBuiltins } from "@effect-agent/ui-definition"
import { makeUIRuntime } from "@effect-agent/ui-runtime"
import { makeUIMcp } from "@effect-agent/ui-agent"

const definitions = registerBuiltins(makeDefinitionStore())
const runtime = makeUIRuntime(definitions, "root")
runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root Canvas" })
const server = makeUIMcp(runtime, definitions)
await server.connect(new StdioServerTransport())
