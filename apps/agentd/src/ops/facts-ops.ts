/**
 * What the machines reported about themselves. The center stores what it was
 * told and never reaches out: a machine that cannot be called pushes its facts,
 * its sessions and its notes on its own beat.
 */
import { count, OperationFault, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { AgentdSurfaces } from "./surfaces.ts"

const machine = z.object({ machineId: z.string().min(1) }).strict()
/** Not strict: a field the center does not index is that agent's business, not a reason to lose the session. */
const session = z.object({
  kind: z.string().min(1), sessionId: z.string().min(1), updatedAt: z.number(), bytes: z.number(),
  cwd: z.string().optional(), title: z.string().optional(), source: z.string().optional(),
  /** The tail of the transcript, as the machine last reported it. */
  tail: z.string().optional(),
})

export const factsOperations = ({ facts }: AgentdSurfaces): readonly Operation[] => [
  operation({
    name: "agentd_machine_facts", description: "What the machines reported: every report, or one machine's",
    access: "read", input: z.object({ machineId: z.string().min(1).optional() }).strict(),
    http: { method: "GET", path: "/agentd/facts" },
    handler: (input) => input.machineId === undefined
      ? { ok: true, reports: facts.list() }
      : { ok: true, report: facts.get(input.machineId) ?? null },
  }),
  operation({
    name: "agentd_sessions", description: "The sessions the machines have, newest first, across machines or on one",
    access: "read", input: z.object({
      machineId: z.string().min(1).optional(), kind: z.string().min(1).optional(), limit: count.min(1).optional(),
    }).strict(),
    http: { method: "GET", path: "/agentd/sessions" },
    handler: (input) => ({ ok: true, sessions: facts.sessions(input) }),
  }),
  operation({
    name: "agentd_session_read",
    description: "Read the tail of one session — what the agent before you actually did, on any machine that reported it",
    access: "read", input: z.object({
      machineId: z.string().min(1), kind: z.string().min(1), sessionId: z.string().min(1),
    }).strict(),
    http: { method: "GET", path: "/agentd/session" },
    handler: (input) => {
      const found = facts.session(input.machineId, input.kind, input.sessionId)
      if (found === undefined) {
        throw new OperationFault(404, `machine "${input.machineId}" has no ${input.kind} session "${input.sessionId}" in its last report`)
      }
      // A machine reports the tails of its most recent sessions, so a session it
      // has but did not send is a real answer, not an empty one.
      if (found.tail === undefined) {
        throw new OperationFault(404, `${input.kind}/${input.sessionId} was listed without a transcript; the machine sends the tail of its most recent sessions`)
      }
      return { ok: true, session: found }
    },
  }),
  operation({
    name: "agentd_report_facts", description: "A machine reporting what its agents are and what they are configured to talk to",
    input: machine.extend({ facts: z.unknown() }).strict(), http: { method: "POST", path: "/agentd/facts" },
    handler: (input) => ({ ok: true, report: facts.putFacts(input.machineId, input.facts) }),
  }),
  operation({
    name: "agentd_report_sessions", description: "A machine reporting the sessions it has now: a snapshot, not a delta",
    input: machine.extend({ sessions: z.array(session) }).strict(), http: { method: "POST", path: "/agentd/sessions" },
    handler: (input) => ({ ok: true, report: facts.putSessions(input.machineId, input.sessions) }),
  }),
  operation({
    name: "agentd_report_note", description: "A machine saying why it could not be read, so a stale snapshot is not shown as a quiet one",
    input: machine.extend({ note: z.string().min(1) }).strict(), http: { method: "POST", path: "/agentd/note" },
    handler: (input) => ({ ok: true, report: facts.putNote(input.machineId, input.note) }),
  }),
]
