import { makeGatewayConfigAdapter } from "./adapter.ts"
import { desired } from "./control-projections.ts"
import type { ControlState } from "./control-state.ts"
import type { AgentdControl } from "./contract.ts"
import { AgentdError } from "./errors.ts"

export const configOps = (control: ControlState, gatewayUrl?: string): Pick<AgentdControl, "gatewayConfig"> => ({
  gatewayConfig(agentId, token, reported) {
    if (!control.guard.authorized(token)) throw new AgentdError(401, "unauthorized gateway config fetch")
    if (gatewayUrl === undefined) throw new AgentdError(409, "no MCP Gateway address is declared; this center cannot tell an agent where the door is")
    const config = desired(control, agentId)
    return makeGatewayConfigAdapter(gatewayUrl).plan(config.agent, config, reported)
  },
})
