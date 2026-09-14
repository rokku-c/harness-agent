import type { Operation } from "@effect-agent/effect-interface"
import { agentControlOperations } from "./agent-control-ops.ts"
import { agentOperations } from "./agent-ops.ts"
import { agentStartOperations } from "./agent-start-ops.ts"
import { workspaceOperations } from "./workspace-ops.ts"
import type { HerdrSurfaces } from "./surfaces.ts"

export const herdrOperations = (surfaces: HerdrSurfaces): readonly Operation[] => [
  ...workspaceOperations(surfaces),
  ...agentOperations(surfaces),
  ...agentStartOperations(surfaces),
  ...agentControlOperations(surfaces),
]

export type { HerdrAgent, HerdrAgentTail, HerdrPane, HerdrRead, HerdrSurfaces, HerdrWorkspace } from "./surfaces.ts"
