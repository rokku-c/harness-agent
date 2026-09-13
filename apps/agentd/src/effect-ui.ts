/**
 * The agentd console: the fleet on the first screen, and the four places an
 * operator goes from it.
 *
 * The first screen is the fleet itself — every agent, the machine each runs on,
 * and what the server has observed of those machines — because that is what an
 * operator comes back to read, and a fleet behind a menu door is a fleet that
 * costs a press to see. The four others are jobs: work one agent, work one
 * machine, read the queue those jobs feed, and read the registry they are
 * assembled from. Each is entered and come back from (Journey 3,
 * `docs/flows.md`), and each states the verdict of the read behind it once,
 * above every list that read feeds.
 *
 * The two rooms carry the id they were entered with in the address, so a row's
 * Open and an address pasted into the bar are the same arrival — and the read
 * that fills a room is the room's own, which is what keeps one agent's answer
 * from being written under the list of all of them.
 */
import type { EffectUiView } from "@effect-agent/effect-ui"
import { NAV_ROOT, failureNotice, loadingRows, region } from "@effect-agent/effect-ui"
import { agentRoom } from "./effect-ui-agent-room.ts"
import { agentsSection } from "./effect-ui-agents.ts"
import { agentdHeader } from "./effect-ui-header.ts"
import { launchesScreen } from "./effect-ui-launch.ts"
import { livenessSection } from "./effect-ui-liveness.ts"
import { machineRoom } from "./effect-ui-machine-room.ts"
import { machinesSection } from "./effect-ui-machines.ts"
import { STATUS_SOURCE } from "./effect-ui-nodes.ts"
import { registryNodes } from "./effect-ui-registry.ts"

/** The queue's own read. A launch moves it, so the press that queued one re-runs it. */
const LAUNCHES_SOURCE = "launches"

export const effectUiView: EffectUiView = {
  viewId: "agentd-console",
  title: "agentd",
  state: {
    status: { machines: [], agents: [], servers: [], sets: [] },
    inspect: {},
    launch: { workdir: "", prompt: "" },
    launches: { launches: [] },
  },
  sources: [
    { id: STATUS_SOURCE, url: "/agentd", state: "/status", refreshMs: 10000 },
    { id: LAUNCHES_SOURCE, url: "/agentd/launch", state: "/launches", refreshMs: 8000 },
  ],
  actions: [
    // Both rows of the fleet open a room and nothing else: a room is filled by
    // the read it names below, so a press that picks an entity only picks it.
    { name: "agentd.openAgent", opens: "agent" },
    { name: "agentd.openMachine", opens: "machine" },
    { name: "agentd.openLaunches", opens: "launches" },
    { name: "agentd.openRegistry", opens: "registry" },
    // A room's own read. The id comes from the address, which is where a press
    // put it, so a row's Open and a pasted address are one read with two doors
    // (`Formal/Door.lean`) — and it is the path that names the entity, so an
    // address naming none makes no call at all rather than asking about an
    // agent nobody chose.
    { name: "agentd.desired", method: "GET", url: "/agentd/desired?agentId={agentId}", result: "/inspect/desired",
      params: { agentId: { state: `${NAV_ROOT}/agentId` } }, clear: ["/inspect/plan", "/inspect/launch"] },
    { name: "agentd.plan", method: "GET", url: "/agentd/plan", result: "/inspect/plan" },
    // The draft the press consumed is emptied and the queue is read again; the
    // workdir stays, because it is a place the operator is working in rather
    // than a value the turn took with it.
    { name: "agentd.launch", method: "POST", url: "/agentd/launch", result: "/inspect/launch", clear: ["/launch/prompt"], refresh: [LAUNCHES_SOURCE] },
    { name: "agentd.node", method: "GET", url: "/agentd/node?nodeId={nodeId}", result: "/inspect/node",
      params: { nodeId: { state: `${NAV_ROOT}/nodeId` } }, clear: ["/inspect/nodePlan"] },
    { name: "agentd.nodePlan", method: "GET", url: "/agentd/node/plan", result: "/inspect/nodePlan" },
  ],
  nodes: [
    agentdHeader,
    // The fleet is three inventories, each as long as the fleet is, and how long
    // that is is not the surface's business: they scroll in their own box, under
    // a header that holds the doors and stays where it was.
    region([
      // the read behind all three lists, stated once above them
      loadingRows(STATUS_SOURCE, 3),
      failureNotice(STATUS_SOURCE),
      agentsSection,
      machinesSection,
      livenessSection,
    ]),
  ],
  screens: [
    { id: "agent", title: "Agent", onEnter: "agentd.desired", nodes: agentRoom },
    { id: "machine", title: "Machine", onEnter: "agentd.node", nodes: machineRoom },
    { id: "launches", title: "Launches", nodes: launchesScreen },
    { id: "registry", title: "MCP registry", nodes: registryNodes },
  ],
}
