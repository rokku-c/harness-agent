/**
 * Where this app's reads land, and what its screens are called.
 *
 * The two are one file because they are one decision: a path is a promise to
 * every node that reads it, and a screen id is a promise to every address that
 * names it. Spelling either at its use sites is how a rename reaches half the
 * app: a table reading `/status/agents` while the sentence above it says
 * `agents` after somebody moved one and not the other.
 *
 * The screen ids are addresses, so they are part of the console's public
 * surface: `#app/agentd/<id>` is what an operator can paste to a colleague.
 */

/** What the fleet is read from: machines, agents, the servers they reach, and liveness. */
export const STATUS_SOURCE = "status"
/** The launch queue. A launch moves it, so the press that queued one re-runs this read. */
export const LAUNCHES_SOURCE = "launches"

export const AGENTS = "/status/agents"
export const MACHINES = "/status/machines"
/** The server's observation of its nodes, derived from the machines above it. */
export const NODES = "/status/nodeLiveness/nodes"
export const SERVERS = "/status/servers"
export const SETS = "/status/sets"
export const LAUNCHES = "/launches/launches"

/**
 * A room keeps its own answers. The two rooms are different jobs about different
 * subjects, so they read into different subtrees: an agent's resolution can
 * never be drawn under a machine's header by a path that happens to match.
 */
export const AGENT_SCREEN = "agent"
export const AGENT_RESOLUTION = "/agent/resolution"
export const AGENT_PLAN = "/agent/plan"
export const AGENT_LAUNCH = "/agent/launch"

export const MACHINE_SCREEN = "machine"
export const MACHINE_BINDING = "/machine/binding"
export const MACHINE_PLAN = "/machine/plan"

export const LAUNCHES_SCREEN = "launches"
export const SERVERS_SCREEN = "servers"

/** The draft a launch is composed in. */
export const WORKDIR = "/launch/workdir"
export const PROMPT = "/launch/prompt"
