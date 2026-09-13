/**
 * The launch surface. A machine asks for work rather than being told to do it,
 * so polling is a POST: it hands out intents and they stop being anyone else's,
 * and a GET that quietly claimed work would be a lie about what it does.
 *
 * `agentd_launch` queues a *turn*, and a turn is named by the identity it runs
 * as. The machine it runs on and the dialect it runs under are read from that
 * identity here, at the moment of queueing, rather than accepted from the
 * caller: a request that could name its own dialect could start a CLI the center
 * never planned a config for, and the plan and the process would then agree only
 * by luck. Work that is not a turn names its own machine and its own argv, and
 * has no identity to be armed with — which is why it is a different shape and
 * not this one with a field left out.
 *
 * An identity this center cannot arm is refused where it is armed: the machine's
 * fetch (§F10) is the thing that hands over a credential, and a second rule for
 * that question here would be a copy of the adapter's, free to drift from it.
 *
 * A caller with a task node names it, and the intent is filed under it; a caller
 * without one — an operator starting a turn from the console — leaves it out and
 * the intent belongs to no node. It is the one field here the center does not
 * derive, and it is optional because it is a label and not a routing decision:
 * what the turn runs as and where it runs come from the identity either way.
 */
import { count, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { AgentdSurfaces } from "./surfaces.ts"

const states = ["queued", "claimed", "running", "done", "failed", "cancelled"] as const

export const launchOperations = ({ control, launches }: AgentdSurfaces): readonly Operation[] => [
  operation({
    name: "agentd_launch",
    description: "Run one agent's turn in one directory; the machine it runs on is read from the agent",
    input: z.object({
      agentId: z.string().min(1), workdir: z.string().min(1), prompt: z.string(),
      nodeId: z.string().min(1).optional(),
    }).strict(),
    http: { method: "POST", path: "/agentd/launch", status: 201 },
    handler: (input) => {
      const agent = control.desired(input.agentId).agent
      return { ok: true, launch: launches.enqueue({ ...input, machineId: agent.machineId, kind: agent.kind }) }
    },
  }),
  operation({
    name: "agentd_launches",
    description: "Queued and finished work, optionally for one machine or for one task node", access: "read",
    input: z.object({ machineId: z.string().min(1).optional(), nodeId: z.string().min(1).optional() }).strict(),
    http: { method: "GET", path: "/agentd/launch" },
    handler: (input) => ({ ok: true, launches: launches.list(input) }),
  }),
  operation({
    name: "agentd_launch_poll", description: "Claim work for this machine; claiming is what makes an intent its own",
    input: z.object({ machineId: z.string().min(1), limit: count.min(1).max(16).optional() }).strict(),
    http: { method: "POST", path: "/agentd/launch/poll" },
    handler: (input) => ({ ok: true, launches: launches.poll(input.machineId, input.limit) }),
  }),
  operation({
    name: "agentd_launch_report", description: "What became of an intent; only the machine holding it may say",
    input: z.object({
      intentId: z.string().min(1), machineId: z.string().min(1), state: z.enum(states), detail: z.string().optional(),
    }).strict(),
    http: { method: "POST", path: "/agentd/launch/report" },
    handler: (input) => ({ ok: true, launch: launches.report(input.intentId, input.machineId, input.state, input.detail) }),
  }),
]
