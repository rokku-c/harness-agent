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

export interface AgentdPluginOptions {
  /**
   * The platform's egress-bound send. It is the only way out of this app, so a
   * tunnel without it refuses rather than reaching the network ungoverned.
   */
  readonly send?: TunnelSend
}

export const createAgentdPlugin = (getConfig: () => unknown = () => ({}), options: AgentdPluginOptions = {}): EffectPlugin => ({
  id: "agentd",
  load: async (): Promise<LoadedPlane> => {
    const parsed = effectConfig.schema.parse(getConfig())
    // Node token and lease TTL (§8.5-1), when configured; absent is legal and reported.
    const control = makeAgentdControl({
      ...(parsed.nodeToken === undefined ? {} : { nodeToken: parsed.nodeToken }),
      ...(parsed.leaseTtlMs === undefined ? {} : { leaseTtlMs: parsed.leaseTtlMs }),
    })
    const applied = new Map<string, AppliedReport>(), nodeApplied = new Map<string, NodeAppliedReport>()
    const launches = makeLaunchQueue()
    const facts = makeFactsRegistry()
    // the tunnel belongs to the center too: which upstream an agent reaches is
    // this machine's configuration, and how it leaves is the platform's egress
    const tunnel = makeTunnel({
      upstreams: parsed.tunnel,
      ...(options.send === undefined ? {} : { send: options.send }),
    })
    seed(control, parsed)
    // one surface object, so the tools and the routes are the same operations
    const surfaces = { control, applied, nodeApplied, launches, tunnel, facts, status: makeStatus(control, applied, nodeApplied) }
    return {
      tools: makeAgentdTools(surfaces),
      handle: makeAgentdHandler(surfaces),
    }
  },
})
