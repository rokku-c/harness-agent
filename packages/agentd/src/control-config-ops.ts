/**
 * The config one agent runs with, served to the machine that runs it (§F10).
 *
 * Kept apart from the verb groups that *write*: this one writes nothing, and what
 * it hands over is the adapter's plan, read at the guard. It is the one answer
 * with a credential in it, so it is a fetch rather than a projection on a console
 * — a page that echoed one would be the leak the console's "held / none" word
 * exists to avoid.
 *
 * The address a plan names is this center's declaration and never the request's.
 * A caller that could name the door could point an agent at another one, and then
 * the identity the center bound and the door that verifies it would be two facts
 * that happen to agree.
 */

import { makeGatewayConfigAdapter } from "./adapter.ts"
import { desired } from "./control-projections.ts"
import type { ControlState } from "./control-state.ts"
import type { AgentdControl } from "./contract.ts"
import { AgentdError } from "./errors.ts"

export const configOps = (control: ControlState, gatewayUrl?: string): Pick<AgentdControl, "gatewayConfig"> => ({
  /**
   * Reads are not revisions: what a machine fetches does not change what it should
   * run, so this does not bump. An agent holding no credential is refused by the
   * adapter — an empty header would be turned away at the door, far from whoever
   * could have issued one.
   */
  gatewayConfig(agentId, token, reported) {
    if (!control.guard.authorized(token)) throw new AgentdError(401, "unauthorized gateway config fetch")
    if (gatewayUrl === undefined) throw new AgentdError(409, "no MCP Gateway address is declared; this center cannot tell an agent where the door is")
    // One lookup: the agent the plan is about, and the state it is planned from.
    const config = desired(control, agentId)
    return makeGatewayConfigAdapter(gatewayUrl).plan(config.agent, config, reported)
  },
})
