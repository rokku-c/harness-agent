import type { GatewayAgentConfig, LaunchIntent } from "@effect-agent/agentd"
import type { NodeControl } from "./transport.ts"

export interface TurnOrder {
  readonly agentId: string
  readonly kind: string
  readonly workdir: string
  readonly prompt: string
  readonly gateway: GatewayAgentConfig
}

export interface CommandOrder {
  readonly workdir: string
  readonly command: string
  readonly args?: readonly string[]
}

export type LaunchOrder = TurnOrder | CommandOrder

export interface LaunchResult {
  readonly ok: boolean
  readonly output: string
  readonly detail?: string
  readonly durationMs: number
}

export interface LaunchRunner {
  readonly run: (order: LaunchOrder) => Promise<LaunchResult>
}

export const orderOf = async (
  intent: LaunchIntent, control: Pick<NodeControl, "gatewayConfig">,
): Promise<LaunchOrder> => {
  if (!("agentId" in intent)) {
    return { workdir: intent.workdir, command: intent.command, ...(intent.args === undefined ? {} : { args: intent.args }) }
  }
  const plan = await control.gatewayConfig(intent.agentId)
  return { agentId: intent.agentId, kind: intent.kind, workdir: intent.workdir, prompt: intent.prompt, gateway: plan.desired }
}
