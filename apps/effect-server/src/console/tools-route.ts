/**
 * The surface an app gets when it registers tools and draws nothing.
 *
 * Some apps are MCP only: they publish tools over the registry and never declare
 * a view. Without a surface the console can only say "no declarative
 * description" — and that is exactly the app an operator most needs to poke at
 * while wiring it up. So an interface that has tools and no view opens the tool
 * inspector instead: pick a tool, read its schema, fill the form, call it, see
 * what came back. It is the debugging surface MCP Inspector made familiar,
 * built here on the registry we already serve agents from, so what the
 * inspector shows cannot drift from what an agent gets.
 */

import { invoke, type EffectRegistry } from "@effect-agent/effect-interface"

/** One tool as the inspector needs it: what to call, and the form to build. */
export interface InspectorTool {
  readonly name: string
  readonly title?: string
  readonly description?: string
  readonly inputSchema: unknown
}

export const inspectorTools = (registry: EffectRegistry, id: string): readonly InspectorTool[] => {
  const iface = registry.find(id)
  if (iface === undefined) return []
  return iface.tools.map((tool) => ({
    name: tool.name,
    ...(tool.title === undefined ? {} : { title: tool.title }),
    ...(tool.description === undefined ? {} : { description: tool.description }),
    // the same projection the MCP door serves, so a form here and a call there
    // are validated against one schema
    inputSchema: registry.schemaFor(`${id}.${tool.name}`)?.parameters ?? { type: "object" },
  }))
}

/** Arguments are the request body; an empty body is an empty argument set. */
const argsOf = async (request: Request): Promise<unknown> => {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

/**
 * Calling is a POST: a tool may write, and no link or prefetch should reach one.
 * A refusal is a tool result, not a transport failure — the inspector renders it
 * beside the form — so it answers 200 with `ok: false` rather than an error code.
 */
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
