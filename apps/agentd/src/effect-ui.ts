/**
 * The agentd console: the fleet on the first screen, and the four places an
 * operator goes from it.
 *
 * The first screen is the fleet itself, because that is what an operator comes
 * back to read; the four others are jobs. Work one fleet agent (read what it
 * resolves to, plan the push, ask for a turn), work one machine (read what its
 * node is bound to, plan that push), read the queue those jobs feed, and read
 * the servers they are assembled from. Each is entered and come back from, and
 * each states the verdict of the read behind it once, above every list that read
 * feeds.
 *
 * A room is filled by its own read, named as the screen's `onEnter`, so a row's
 * Open and an address pasted into the bar are one arrival with one read behind
 * both. That read takes its id from `/_nav`, which is where the press that
 * entered the screen put it, so an address naming no agent makes no call at all
 * rather than asking about an agent nobody chose. The *plan* takes its id from
 * the same place and never from the answer above it: an answer is a record of
 * one moment, and a plan computed from it would plan whatever was on screen at
 * the time, while an address carries the id and so reproduces the plan.
 *
 * A retry is an action with no call of its own: `refresh` and nothing else. The
 * read is a name, so the press that fetches a list again is the same declaration
 * the runtime already runs, and not a second copy of it free to drift.
 */
import { NAV_ROOT, type EffectUiView } from "@effect-agent/effect-ui"
import { agentRoom } from "./effect-ui-agent-room.ts"
import { fleetScreen } from "./effect-ui-fleet.ts"
import { launchesScreen } from "./effect-ui-launches.ts"
import { machineRoom } from "./effect-ui-machine-room.ts"
import {
  AGENT_LAUNCH, AGENT_PLAN, AGENT_RESOLUTION, AGENT_SCREEN, LAUNCHES_SCREEN, LAUNCHES_SOURCE, MACHINE_BINDING,
  MACHINE_PLAN, MACHINE_SCREEN, PROMPT, SERVERS_SCREEN, STATUS_SOURCE, WORKDIR,
} from "./effect-ui-paths.ts"
import { serversScreen } from "./effect-ui-servers.ts"

/** The id an entered room was opened with, which is where its own read takes it from. */
const opened = (name: string) => ({ [name]: { state: `${NAV_ROOT}/${name}` } }) as const

export const effectUiView: EffectUiView = {
  viewId: "agentd-console",
  title: "agentd",
  state: {
    status: { machines: [], agents: [], servers: [], sets: [] },
    launch: { workdir: "", prompt: "" },
    launches: { launches: [] },
  },
  sources: [
    { id: STATUS_SOURCE, url: "/agentd", state: "/status", refreshMs: 10000 },
    { id: LAUNCHES_SOURCE, url: "/agentd/launch", state: "/launches", refreshMs: 8000 },
  ],
  actions: [
    // A row that opens a room picks the record and nothing else: what fills the
    // room is the read the screen names, run on arrival.
    { name: "agentd.openAgent", opens: AGENT_SCREEN },
    { name: "agentd.openMachine", opens: MACHINE_SCREEN },
    { name: "agentd.openLaunches", opens: LAUNCHES_SCREEN },
    { name: "agentd.openServers", opens: SERVERS_SCREEN },
    // A room's own read. The answers to the last room's presses are cleared with
    // it, because a plan or a launch about the agent that was open before this
    // one is not about this one, and a room that kept it would show the previous
    // agent's push under this agent's name.
    { name: "agentd.desired", method: "GET", url: "/agentd/desired?agentId={agentId}", params: opened("agentId"),
      result: AGENT_RESOLUTION, clear: [AGENT_PLAN, AGENT_LAUNCH] },
    { name: "agentd.plan", method: "GET", url: "/agentd/plan?agentId={agentId}", params: opened("agentId"),
      result: AGENT_PLAN },
    // The draft is consumed and the queue is read again; the working directory
    // stays, because it is a place the operator is working in rather than a
    // value the turn took with it.
    { name: "agentd.launch", method: "POST", url: "/agentd/launch",
      params: { ...opened("agentId"), workdir: { state: WORKDIR }, prompt: { state: PROMPT } },
      result: AGENT_LAUNCH, clear: [PROMPT], refresh: [LAUNCHES_SOURCE] },
    { name: "agentd.node", method: "GET", url: "/agentd/node?nodeId={nodeId}", params: opened("nodeId"),
      result: MACHINE_BINDING, clear: [MACHINE_PLAN] },
    { name: "agentd.nodePlan", method: "GET", url: "/agentd/node/plan?nodeId={nodeId}", params: opened("nodeId"),
      result: MACHINE_PLAN },
    // The two retries. Each has no call of its own: the read it names is the
    // whole of the press, so the list is fetched again by the declaration that
    // fetched it and the verdict the failure notice reports is the one that
    // notice belongs to.
    { name: "agentd.retryStatus", refresh: [STATUS_SOURCE] },
    { name: "agentd.retryLaunches", refresh: [LAUNCHES_SOURCE] },
  ],
  nodes: fleetScreen,
  screens: [
    { id: AGENT_SCREEN, title: "Fleet agent", onEnter: "agentd.desired", nodes: agentRoom },
    { id: MACHINE_SCREEN, title: "Machine", onEnter: "agentd.node", nodes: machineRoom },
    { id: LAUNCHES_SCREEN, title: "Launches", nodes: launchesScreen },
    { id: SERVERS_SCREEN, title: "MCP servers", nodes: serversScreen },
  ],
}
