# agentd

The machine agent's center. A machine runs a probe (`bun run node:probe`) that announces itself,
reports what it has, and asks for work; agentd is the side that remembers, adjudicates and queues.
It is reached at `/agentd/…` through declarative SDK routes and opens no listener of its own.

## What it owns

Machines, agents, deployments, launch intents, tunnels, and what the machines reported about
themselves. It does **not** own board or task data, and it never reaches out to a machine: a machine
pushes its facts, its sessions and its notes on its own beat, and asks for work when it wants some.
An unreachable machine is a machine that stopped pushing, which is why a report carries `note` and
why "no answer" is a different fact from "nothing to say".

## Surfaces

Every operation is declared once, in `src/ops/*.ts`, as an `operation({ name, description, access,
input, handler, http })`. The same declaration becomes an MCP tool (`toEffectTools`) and an HTTP
route (`toHttpHandler`), so the two surfaces cannot drift and a new capability is one entry rather
than a tool plus a route plus the wiring between them.

- **Machine protocol** — `agentd_announce_node`, `agentd_heartbeat_node`, `agentd_withdraw_node`,
  `agentd_node_presence`, `agentd_desired_node`, `agentd_plan_node`, `agentd_report_node_applied`,
  `agentd_artifact`, `agentd_launch_poll`, `agentd_launch_report`, `agentd_report_facts`,
  `agentd_report_sessions`, `agentd_report_note`.
- **Operator and control** — `agentd_status`, `agentd_desired`, `agentd_plan_bundles`,
  `agentd_report_applied`, `agentd_launch`, `agentd_launches`, `agentd_register_*`, `agentd_bind`,
  `agentd_bind_bundles`, `agentd_bind_node`, `agentd_publish_bundle`, `agentd_install`.
- **Reading what the machines have** — `agentd_machine_facts`, `agentd_sessions`,
  `agentd_session_read`: the last of these hands an agent the tail of a transcript another agent
  wrote, on any machine that reported it.

The machine verbs and the read surfaces carry HTTP paths, so `/agentd/node/announce`,
`/agentd/node/plan`, `/agentd/launch`, `/agentd/facts`, `/agentd/sessions`, `/agentd/session`,
`/agentd/gateway` and `/agentd/artifact` all mean what the tool of the same name means. The last two
both answer with a secret — a config's credential, an artifact's bytes — so a machine fetches them
with the node credential instead of reading them off a console. The declaring verbs —
`agentd_register_*`, `agentd_bind*`, `agentd_publish_bundle`, `agentd_install` — are MCP-only: they
are typed declarations an operator makes through a client, not traffic a machine drives. Over HTTP a
machine sends its token in `authorization: Bearer …`; a token in a body or a query string is not a
credential here and is dropped rather than honoured.

## What a launch is

Work queued for a machine is one of two things, and the difference is *who the machine is* when it
runs. A **turn** runs as an identity: `agentd_launch` names the agent and the working directory, and
the center reads the machine and the CLI dialect out of its own record of that identity — so a caller
cannot send one agent's work to a machine of its choosing, and `agentd_install` (a **command**, which
runs as itself and has no identity at all) is the shape for anything else. The machine claims work
with `agentd_launch_poll` and answers with `agentd_launch_report`; a claim is a lease and lapses back
if the machine holding it goes away.

One field of a turn is carried rather than derived: the task node the work is filed under. It is
optional, and absent means a turn asked for by hand — filed under no node — which is a different
state from one whose node is unknown. A caller that has a node (an agent picking up board work)
names it; the console's launch form does not, and the queue files the turn under exactly what was
asked and invents no task for work that named none.

A turn is armed *before* it starts: the machine fetches `GET /agentd/gateway` for the intent's own
identity, and a refusal settles that one intent `failed` with the reason instead of spawning a
process that would discover the refusal one tool call at a time. The refusal is one agent's and not
the beat's, so a fleet where one identity has no credential still runs the work it can.

## Two answer shapes

The machine protocol answers `{"ok":true, …}` and reports a failure as `{"ok":false,"error":…}` with
a status, because a deployed probe checks `ok === true` before it reads anything else; the operator
verbs answer their payload directly. Both come out of one declaration — the envelope is what the
machine's transport requires, not a second contract.

## Running it

- `bun run up` starts the effect server with agentd mounted as an app. `bun run node:probe --url
  <center> --id <node> --capabilities abi:effect-1,runtime:os --namespaces ops` runs the probe.
  `--namespaces` and `--capabilities` are required: an empty declaration is indistinguishable from a
  typo, and every placement would be refused with no hint as to why. `--token`, `--stage`, `--name`,
  `--interval`, `--facts-interval`, `--session-limit`, `--max-apps`, `--hosts` and `--no-collect` /
  `--no-launch` refine it.
- A machine's stored config is never migrated. When a build changes what it understands, the start
  refuses with the exact rebuild-required error and the operator runs `bun run config:rebuild agentd`
  (or `… board agentd` for both records at once). The home comes up either way: an app that cannot
  load is reported by name and left disabled instead of taking the server down with it.
