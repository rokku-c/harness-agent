/**
 * agentd's whole surface, in one list.
 *
 * Every operation is served twice — as an MCP tool and, where a machine needs
 * it, as an HTTP route — from this one declaration. The answers carry an
 * explicit `ok` because a machine reads this as a protocol rather than as a
 * tool result: it either returns or throws.
 */
import { toEffectTools, type EffectTool, type Operation } from "@effect-agent/effect-interface"
import { agentOperations } from "./agent-ops.ts"
import { factsOperations } from "./facts-ops.ts"
import { installOperations } from "./install-op.ts"
import { launchOperations } from "./launch-ops.ts"
import { nodeOperations } from "./node-ops.ts"
import { registryOperations } from "./registry-ops.ts"
import type { AgentdSurfaces } from "./surfaces.ts"

export const agentdOperations = (surfaces: AgentdSurfaces): readonly Operation[] => [
  ...agentOperations(surfaces),
  ...registryOperations(surfaces),
  ...nodeOperations(surfaces),
  ...launchOperations(surfaces),
  ...factsOperations(surfaces),
  ...installOperations(surfaces),
]

/** The same operations as tools: what an agent reaches over MCP. */
export const makeAgentdTools = (surfaces: AgentdSurfaces): readonly EffectTool[] =>
  toEffectTools(agentdOperations(surfaces))

export type { AgentdSurfaces, AppliedReport, NodeAppliedReport } from "./surfaces.ts"
