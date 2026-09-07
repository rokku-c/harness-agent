import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { makeDefinitionStore, registerBuiltins } from "@effect-agent/ui-definition"
import { makeUIRuntime } from "@effect-agent/ui-runtime"
import { makeUIMcp } from "@effect-agent/ui-agent"
import { jsonReactRenderer, makeRendererRegistry, webRenderer } from "@effect-agent/ui-renderer"
import { makeExtensionRegistry } from "@effect-agent/ui-extension"
import { makeActivityStore } from "./activity.ts"

const definitions = registerBuiltins(makeDefinitionStore())
const runtime = makeUIRuntime(definitions, "root")
const renderers = makeRendererRegistry([webRenderer, jsonReactRenderer])
const extensions = makeExtensionRegistry(definitions)
const activity = makeActivityStore()
runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root Canvas" })
const server = makeUIMcp(runtime, definitions, renderers, extensions, activity)
await server.connect(new StdioServerTransport())
