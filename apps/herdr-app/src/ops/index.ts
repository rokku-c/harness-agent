/**
 * Herdr's whole console plane, in one list.
 *
 * Every operation is served twice — as an MCP tool and as an HTTP route — from
 * this one declaration, so an agent driving Herdr over MCP and an operator
 * reading the console over HTTP cannot be told different things about the same
 * agent. The socket is the only thing that knows Herdr; nothing here reaches
 * past it.
 */
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
