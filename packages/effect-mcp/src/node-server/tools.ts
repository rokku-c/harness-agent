import { invoke, type EffectRegistry, type EffectTool } from "@effect-agent/effect-interface"
import { zodShape, type JsonSchema } from "./schema.js"

/**
 * The name a caller sees: the tool's own name, reduced to what MCP allows.
 *
 * `sanitize` is not injective — `Formal/ToolKey.lean`
 * (`two_names_can_serve_as_one_name`) exhibits two tools with one served name —
 * so a surface that let the later registration win would drop a tool it still
 * advertises. `registerTools` refuses instead.
 */
const sanitize = (name: string): string => name.replace(/[^A-Za-z0-9_-]+/g, "_")

const call = (tool: EffectTool) => async (args: Record<string, unknown>): Promise<unknown> => {
  try {
    return { content: [{ type: "text", text: JSON.stringify(await invoke(tool, args ?? {})) }] }
  } catch (error) {
    return {
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      isError: true,
    }
  }
}

/**
 * Serve a registry's tools on a node server, once, from the registry as it is.
 *
 * A server serves the surface it was built with; a caller that needs a
 * different one builds another server. That is how every production face works
 * — `effect-standalone`'s HTTP host and `apps/effect-server` both build a server
 * per request from the live catalog — so an app hot-swap is a new server rather
 * than a reconcile pass over this one, and there is no stale list to announce.
 *
 * Throws (naming both tools) rather than silently overwriting when two tools
 * would share one served name.
 */
export const registerTools = (server: any, registry: EffectRegistry): void => {
  const register = server.registerTool.bind(server) as any
  const served = new Map<string, string>()

  for (const { key, tool } of registry.tools()) {
    const name = sanitize(tool.name)
    const taken = served.get(name)
    if (taken !== undefined) {
      throw new Error(`tools "${taken}" and "${key}" both serve as "${name}"; rename one of them`)
    }
    served.set(name, key)
    register(
      name,
      {
        title: tool.title ?? tool.name,
        description: tool.description ?? tool.name,
        inputSchema: zodShape(tool.inputSchema as JsonSchema | undefined),
      },
      call(tool),
    )
  }
}
