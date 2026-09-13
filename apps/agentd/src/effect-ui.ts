/**
 * The agentd console: the control plane's machines and agents on one page.
 *
 * The order is the three questions the standard asks, in the order it asks
 * them. What this is, then the agents and the machines themselves — the state
 * an operator came to read, each row opening its own card, and on an agent's
 * card the one write that starts work — then the queue that write feeds, and
 * only then the registry those rows are assembled from.
 *
 * A press and its answer stay in the card that holds the row: an operator who
 * presses Open reads the answer under the list they pressed in, and the action
 * that loads a config blanks the plan and the launch built for the last one, so
 * no answer on the page can be about an entity another card is showing.
 */
import type { EffectUiView } from "@effect-agent/effect-ui"
import { region } from "@effect-agent/effect-ui"
import { agentsSection } from "./effect-ui-agents.ts"
import { launchesSection } from "./effect-ui-launch.ts"
import { livenessSection } from "./effect-ui-liveness.ts"
import { machinesSection } from "./effect-ui-machines.ts"
import { STATUS_SOURCE, heading, text } from "./effect-ui-nodes.ts"
import { serverSection, setSection } from "./effect-ui-registry.ts"

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
    { name: "agentd.desired", method: "GET", url: "/agentd/desired", result: "/inspect/desired", clear: ["/inspect/plan", "/inspect/launch"] },
    { name: "agentd.plan", method: "GET", url: "/agentd/plan", result: "/inspect/plan" },
    // The draft the press consumed is emptied and the queue is read again; the
    // workdir stays, because it is a place the operator is working in rather
    // than a value the turn took with it.
    { name: "agentd.launch", method: "POST", url: "/agentd/launch", result: "/inspect/launch", clear: ["/launch/prompt"], refresh: [LAUNCHES_SOURCE] },
    { name: "agentd.node", method: "GET", url: "/agentd/node", result: "/inspect/node", clear: ["/inspect/nodePlan"] },
    { name: "agentd.nodePlan", method: "GET", url: "/agentd/node/plan", result: "/inspect/nodePlan" },
  ],
  nodes: [
    heading("Agentd", { size: "6" }),
    text("Machine and agent configuration center: what each is bound to run.", { size: "2", color: "gray" }),
    // Four inventories of one fleet, each as long as the fleet is. They scroll
    // together in their own box so the title and the line under it stay put.
    region([
      agentsSection,
      machinesSection,
      livenessSection,
      launchesSection,
      serverSection,
      setSection,
    ]),
  ],
}
