/**
 * What this machine was told to run, and what it needs to start it.
 *
 * A launch is one of two things here as well as on the wire: an agent's turn,
 * which starts armed with the config fetched for the identity the intent names,
 * or a command, which is what it is. The distinction is carried in the type
 * because only one of the two has a door to be brought to.
 *
 * `runLaunches` declares what it needs from whatever runs agents structurally on
 * purpose: choosing a CLI dialect is the machine host's business, and a package
 * whose job is to be the machine's voice to the control plane should not also
 * carry an opinion about how `claude` spells its flags. `agentdeck`'s `Launcher`
 * fits this without a cast; so does a script.
 */
import type { GatewayAgentConfig, LaunchIntent } from "@effect-agent/agentd"
import type { NodeControl } from "./transport.ts"

/** An agent's turn: the identity, the dialect to spawn, and the door it is armed for. */
export interface TurnOrder {
  readonly agentId: string
  readonly kind: string
  readonly workdir: string
  readonly prompt: string
  /**
   * The config this turn must start with (§F10) — the whole plan, not an
   * extracted header: what a dialect does with it is the dialect's business, and
   * one that cannot carry it at all must say so rather than start anyway.
   */
  readonly gateway: GatewayAgentConfig
}

/** Work that is not an agent turn. It runs as itself, and has no identity to be armed with. */
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

/**
 * One intent, as the machine must carry it out. For a turn that means fetching
 * the config *first*: the fetch is what decides whether this can start at all, so
 * it happens before anything is spawned and before the center is told the work is
 * running. The address fetched from is the intent's own identity and never
 * anything a caller supplied — a caller supplies no identity here, only the
 * center's resolution of one.
 */
export const orderOf = async (
  intent: LaunchIntent, control: Pick<NodeControl, "gatewayConfig">,
): Promise<LaunchOrder> => {
  // the presence of an identity is the difference between the two shapes, and it
  // is what the queue's own union already turns on
  if (!("agentId" in intent)) {
    return { workdir: intent.workdir, command: intent.command, ...(intent.args === undefined ? {} : { args: intent.args }) }
  }
  const plan = await control.gatewayConfig(intent.agentId)
  return { agentId: intent.agentId, kind: intent.kind, workdir: intent.workdir, prompt: intent.prompt, gateway: plan.desired }
}
