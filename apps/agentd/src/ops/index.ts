import { toEffectTools, type EffectTool, type Operation } from "@effect-agent/effect-interface"
import { agentOperations } from "./agent-ops.ts"
import { factsOperations } from "./facts-ops.ts"
import { gatewayOperations } from "./gateway-op.ts"
import { installOperations } from "./install-op.ts"
import { launchOperations } from "./launch-ops.ts"
import { nodeOperations } from "./node-ops.ts"
import { registryOperations } from "./registry-ops.ts"
import type { AgentdSurfaces } from "./surfaces.ts"

export const agentdOperations = (surfaces: AgentdSurfaces): readonly Operation[] => [
  ...agentOperations(surfaces),
  ...registryOperations(surfaces),
  ...nodeOperations(surfaces),
  ...gatewayOperations(surfaces),
  ...launchOperations(surfaces),
  ...factsOperations(surfaces),
  ...installOperations(surfaces),
]

export const makeAgentdTools = (surfaces: AgentdSurfaces): readonly EffectTool[] =>
  toEffectTools(agentdOperations(surfaces))

export type { AgentdSurfaces, AppliedReport, NodeAppliedReport } from "./surfaces.ts"
