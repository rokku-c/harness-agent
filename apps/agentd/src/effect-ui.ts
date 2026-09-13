/**
 * The agentd console: the control plane's machines and agents on one page.
 *
 * The order is the three questions the standard asks, in the order it asks
 * them. What this is, then the agents and the machines themselves — the state
 * an operator came to read, each row carrying what it is bound to against what
 * it reported, and the one action that answers a question about it — and only
 * then the registry those rows are assembled from.
 *
 * A press and its answer stay in the card that holds the row: an operator who
 * presses Inspect reads the answer under the list they pressed in, and the
 * action that loads a config blanks the plan built for the last one, so no
 * answer on the page can be about an entity another card is showing.
 */
import type { EffectUiView } from "@effect-agent/effect-ui"
import { region } from "@effect-agent/effect-ui"
import { agentsSection } from "./effect-ui-agents.ts"
import { livenessSection } from "./effect-ui-liveness.ts"
import { machinesSection } from "./effect-ui-machines.ts"
import { STATUS_SOURCE, heading, text } from "./effect-ui-nodes.ts"
import { serverSection, setSection } from "./effect-ui-registry.ts"

export const effectUiView: EffectUiView = {
  viewId: "agentd-console",
  title: "agentd",
  state: {
    status: { machines: [], agents: [], servers: [], sets: [] },
    inspect: {},
  },
  sources: [{ id: STATUS_SOURCE, url: "/agentd", state: "/status", refreshMs: 10000 }],
  actions: [
    { name: "agentd.desired", method: "GET", url: "/agentd/desired", result: "/inspect/desired", clear: ["/inspect/plan"] },
    { name: "agentd.plan", method: "GET", url: "/agentd/plan", result: "/inspect/plan" },
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
      serverSection,
      setSection,
    ]),
  ],
}
