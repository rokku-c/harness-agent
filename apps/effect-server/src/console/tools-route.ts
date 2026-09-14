/**
 * Operations, and calling them: the server half of the Tools place.
 *
 * Operations used to have no address of their own — the inspector was what an app
 * *got* when it registered MCP and drew nothing, so an app that also had a view
 * could not reach its own operations at all (`flows.md` §1.6, verified in
 * source). Tools is a place now, and the whole catalogue arrives in one read so
 * that `#tools` can list apps the reader has not reached yet, `#tools/<app>` can
 * scope to one of them, and an app with both a view and operations is inspectable
 * like any other.
 *
 * It is the same registry MCP serves agents from, projected the same way, so what
 * an operator sees here cannot drift from what an agent gets.
 */

import { invoke, type EffectRegistry } from "@effect-agent/effect-interface"

/** One tool as the inspector needs it: what to call, and the form to build. */
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
      // the same projection the MCP door serves, so a form here and a call there
      // are validated against one schema
      inputSchema: registry.schemaFor(key)?.parameters ?? { type: "object" },
    }))

/** Every interface that registered an operation, under the title it carries, with its operations. */
export const toolsRoute = (registry: EffectRegistry): Response =>
  Response.json({
    apps: [...new Set(registry.tools().map((entry) => entry.interfaceId))].map((id) => ({
      id,
      title: registry.find(id)?.title ?? id,
      tools: inspectorTools(registry, id),
    })),
  })

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
