import type { EffectPlugin, LoadedPlane } from "@effect-agent/effect-host"
import {
  makeAgentdControl, makeFactsRegistry, makeLaunchQueue, makeTunnel, type TunnelSend,
} from "@effect-agent/agentd"
import { effectConfig } from "./effect-config.ts"
import { makeAgentdHandler } from "./handle.ts"
import { makeAgentdTools } from "./ops/index.ts"
import type { AppliedReport, NodeAppliedReport } from "./ops/surfaces.ts"
import { seed } from "./seed.ts"
import { makeStatus } from "./status.ts"
import type { McpSetSlot } from "@effect-agent/mcp-gateway"

export interface AgentdPluginOptions {
  readonly send?: TunnelSend
  readonly sets?: McpSetSlot
}

export const createAgentdPlugin = (getConfig: () => unknown = () => ({}), options: AgentdPluginOptions = {}): EffectPlugin => ({
  id: "agentd",
  load: async (): Promise<LoadedPlane> => {
    const parsed = effectConfig.schema.parse(getConfig())
    const control = makeAgentdControl({
      ...(parsed.nodeToken === undefined ? {} : { nodeToken: parsed.nodeToken }),
      ...(parsed.leaseTtlMs === undefined ? {} : { leaseTtlMs: parsed.leaseTtlMs }),
      ...(parsed.gateway === undefined ? {} : { gatewayUrl: parsed.gateway }),
    })
    const applied = new Map<string, AppliedReport>(), nodeApplied = new Map<string, NodeAppliedReport>()
    const launches = makeLaunchQueue()
    const facts = makeFactsRegistry()
    const tunnel = makeTunnel({
      upstreams: parsed.tunnel,
      ...(options.send === undefined ? {} : { send: options.send }),
    })
    seed(control, parsed)
    options.sets?.provide("agentd", { facts: () => control.mcpsets() })
    const surfaces = { control, applied, nodeApplied, launches, tunnel, facts, status: makeStatus(control, applied, nodeApplied) }
    return {
      tools: makeAgentdTools(surfaces),
      handle: makeAgentdHandler(surfaces),
    }
  },
})
