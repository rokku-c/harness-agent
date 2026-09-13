/**
 * Reaching an agent that is already open: reading it, answering it, and waiting
 * on it.
 *
 * These are the three things an operator does to an agent they did not start
 * from here. Reading is a read; the other two are writes, because a keystroke
 * and an approval answer change what the agent will do next. `send_keys` is the
 * escape hatch — Herdr normally recognizes an approval UI itself, and this is
 * for the one it did not.
 */
import { operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import { holdDeadlineMs } from "../herdr-hold-deadline.ts"
import { agentStatus, readSource, target, withinMs } from "./agent-fields.ts"
import type { HerdrRead, HerdrSurfaces } from "./surfaces.ts"
import { typed } from "./surfaces.ts"

export const agentControlOperations = ({ client }: HerdrSurfaces): readonly Operation[] => [
  operation({
    name: "herdr_agent_output",
    description: "Read what an agent has printed — the screen as it stands, or the scrollback behind it",
    access: "read",
    // a query arrives as text, so the count of lines has to be read as one
    input: z.object({ target, source: readSource.default("recent"), lines: z.coerce.number().int().positive().max(2000).optional() }).strict(),
    http: { method: "GET", path: "/herdr/agents/:target/output" },
    handler: async (input) => {
      const answer = typed<{ read: HerdrRead }>(await client.call("agent.read", {
        target: input.target, source: input.source,
        ...(input.lines === undefined ? {} : { lines: input.lines }),
      }))
      return { ok: true, read: answer.read }
    },
  }),
  operation({
    name: "herdr_agent_keys",
    description: "Send raw keys to an agent that is waiting on a prompt Herdr could not classify — the escape hatch when an approval UI is not being recognized",
    input: z.object({ target, keys: z.array(z.string().min(1)).min(1) }).strict(),
    http: { method: "POST", path: "/herdr/agents/:target/keys" },
    handler: async (input) => ({ ok: true, sent: await client.call("agent.send_keys", { target: input.target, keys: input.keys }) }),
  }),
  operation({
    name: "herdr_agent_focus",
    description: "Bring the agent's tab to the front of the Herdr UI, which is also what marks its finished work as seen",
    input: z.object({ target }).strict(),
    http: { method: "POST", path: "/herdr/agents/:target/focus" },
    handler: async (input) => ({ ok: true, focused: await client.call("agent.focus", { target: input.target }) }),
  }),
  operation({
    name: "herdr_agent_wait",
    description: "Hold until an agent reaches one of the states you name, then report the state it settled into, or time out. Without a state there is nothing to wait for and Herdr answers at once with the agent as it stands",
    input: z.object({ target, until: z.array(agentStatus).min(1).optional(), timeoutMs: withinMs.optional() }).strict(),
    http: { method: "POST", path: "/herdr/agents/:target/wait" },
    handler: async (input) => ({
      ok: true,
      waited: await client.call("agent.wait", {
        target: input.target,
        ...(input.until === undefined ? {} : { until: input.until }),
        ...(input.timeoutMs === undefined ? {} : { timeout_ms: input.timeoutMs }),
      }, holdDeadlineMs(input.timeoutMs)),
    }),
  }),
]
