import type { AppRuntimeContext } from "@effect-agent/effect-apps"
import type { EffectPlugin, LoadedPlane } from "@effect-agent/effect-host"
import { makeMcpGateway, makeGatewayHandler, makeMcpSetRegistry, makeRegistryHttpUpstream, makeRegistrySetResolver } from "@effect-agent/mcp-gateway"
import { effectConfig } from "./effect-config.ts"

const topology = (registry: NonNullable<AppRuntimeContext["mcpRegistry"]>, config: ReturnType<typeof effectConfig.schema.parse>) => ({
  servers: registry.list(), sets: config.sets, bindings: config.bindings,
})

/** Agent-facing MCP call ingress plus a read-only topology view. */
export const createMcpGatewayPlugin = (getConfig: () => unknown, context: AppRuntimeContext): EffectPlugin => ({
  id: "mcp-gateway", routes: [{ path: "/mcp-gateway", match: "prefix" }], priority: 20,
  load: async (): Promise<LoadedPlane> => {
    const config = effectConfig.schema.parse(getConfig()), registry = context.mcpRegistry
    if (!registry) throw new Error("mcp-gateway requires the shared MCP Registry")
    const sets = makeMcpSetRegistry({ resolver: makeRegistrySetResolver(registry) })
    for (const set of config.sets) sets.registerSet(set)
    for (const binding of config.bindings) sets.bindAgent(binding)
    const upstream = makeRegistryHttpUpstream({ registry, fetch: context.fetch })
    const call = makeGatewayHandler(makeMcpGateway({ setRegistry: sets, upstream, defaultAction: config.defaultAction, captureArgs: config.captureArgs }))
    const view = () => topology(registry, config)
    return {
      tools: [{ name: "mcp_gateway_topology", input: effectConfig.schema.pick({}).strict(), handler: view }],
      handle: async (request) => new URL(request.url).pathname === "/mcp-gateway" ? Response.json({ app: "mcp-gateway", ...view() }) : call(request),
      stop: () => upstream.close(),
    }
  },
})
