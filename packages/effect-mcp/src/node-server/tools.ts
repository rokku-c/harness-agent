import { invoke, type EffectRegistry, type EffectTool } from "@effect-agent/effect-interface"
import { zodShape, type JsonSchema } from "./schema.js"
import { makeServedNames } from "./served-name.js"

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

export const registerTools = (server: any, registry: EffectRegistry): void => {
  const register = server.registerTool.bind(server) as any
  const served = makeServedNames("tools")

  for (const { key, tool } of registry.tools()) {
    register(
      served(key, tool.name),
      {
        title: tool.title ?? tool.name,
        description: tool.description ?? tool.name,
        inputSchema: zodShape(tool.inputSchema as JsonSchema | undefined),
      },
      call(tool),
    )
  }
}
