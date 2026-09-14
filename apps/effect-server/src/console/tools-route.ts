import { invoke, type EffectRegistry } from "@effect-agent/effect-interface"

export interface InspectorTool {
  readonly name: string
  readonly title?: string
  readonly description?: string
  readonly inputSchema: unknown
}

export const inspectorTools = (registry: EffectRegistry, id: string): readonly InspectorTool[] =>
  registry
    .tools()
    .filter((entry) => entry.interfaceId === id)
    .map(({ key, tool }) => ({
      name: tool.name,
      ...(tool.title === undefined ? {} : { title: tool.title }),
      ...(tool.description === undefined ? {} : { description: tool.description }),
      inputSchema: registry.schemaFor(key)?.parameters ?? { type: "object" },
    }))

export const toolsRoute = (registry: EffectRegistry): Response =>
  Response.json({
    apps: [...new Set(registry.tools().map((entry) => entry.interfaceId))].map((id) => ({
      id,
      title: registry.find(id)?.title ?? id,
      tools: inspectorTools(registry, id),
    })),
  })

const argsOf = async (request: Request): Promise<unknown> => {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

export const callRoute = async (
  registry: EffectRegistry,
  id: string,
  name: string,
  request: Request,
): Promise<Response> => {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "tools are called with POST" }, { status: 405 })
  }
  const tool = registry.find(id)?.tools.find((candidate) => candidate.name === name)
  if (tool === undefined) {
    return Response.json({ ok: false, error: `no such tool: ${id}.${name}` }, { status: 404 })
  }
  try {
    return Response.json({ ok: true, result: await invoke(tool, await argsOf(request)) })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
