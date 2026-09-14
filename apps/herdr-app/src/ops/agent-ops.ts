import { operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import { holdDeadlineMs } from "../herdr-hold-deadline.ts"
import { agentStatus, target, withinMs } from "./agent-fields.ts"
import { withTails } from "./agent-tails.ts"
import { typed, type HerdrAgent, type HerdrSurfaces } from "./surfaces.ts"

export const agentOperations = ({ client }: HerdrSurfaces): readonly Operation[] => [
  operation({
    name: "herdr_agents",
    description: "Every coding agent Herdr has recognized, with its lifecycle state: idle and done are ready for input, working is busy, blocked is waiting on an approval, unknown means Herdr cannot classify it. Ask for a tail and each agent also carries the last lines it printed",
    access: "read",
    input: z.object({ tail: z.coerce.number().int().positive().max(500).optional() }).strict(),
    http: { method: "GET", path: "/herdr/agents" },
    handler: async (input) => {
      const answer = typed<{ agents: readonly HerdrAgent[] }>(await client.call("agent.list"))
      if (input.tail === undefined) return { ok: true, agents: answer.agents }
      return { ok: true, agents: await withTails(client, answer.agents, input.tail) }
    },
  }),
  operation({
    name: "herdr_agent_prompt",
    description: "Send a prompt to a running agent, optionally asking Herdr to hold the call until the agent reaches one of the states you name; this is how the console talks to an agent that is already open",
    input: z.object({
      target, text: z.string(),
      wait: z.object({ timeoutMs: withinMs.optional(), until: z.array(agentStatus).min(1).optional() }).strict().optional(),
    }).strict(),
    http: { method: "POST", path: "/herdr/agents/:target/prompt" },
    handler: async (input) => ({
      ok: true,
      prompted: await client.call("agent.prompt", {
        target: input.target, text: input.text,
        ...(input.wait === undefined ? {} : { wait: {
          ...(input.wait.timeoutMs === undefined ? {} : { timeout_ms: input.wait.timeoutMs }),
          ...(input.wait.until === undefined ? {} : { until: input.wait.until }),
        } }),
        // a prompt told to wait holds Herdr for as long as the caller asked, so
        // the socket has to outlast that hold too, or Herdr's own
        // `agent_prompt_stalled` is replaced by this client's silence
      }, holdDeadlineMs(input.wait?.timeoutMs)),
    }),
  }),
]
