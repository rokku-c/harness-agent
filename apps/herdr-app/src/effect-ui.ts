/**
 * The herdr console: the terminal agents a running Herdr server owns, and the one
 * screen where an operator works one of them.
 *
 * The first screen is the fleet, because that is the question this app answers —
 * what is running on this server and what state is it in — and a fleet behind a
 * door costs a press to see. The other three are jobs: start an agent, read the
 * workspaces one can be started in, and work the agent picked out of the fleet.
 *
 * Two reads cover the whole view rather than one per screen. The fleet carries
 * each agent's last lines, which is what makes the agent screen live without a
 * read of its own, and the workspaces are what the fleet's rows and the start
 * form both name. A source is a fixed url (`schema-parts.ts:25`) fetched verbatim,
 * so which agent a read is about cannot ride in the url — the agent's own screen
 * reads that one on arrival, addressed by the id the press put in the address.
 */
import type { EffectUiView } from "@effect-agent/effect-ui"
import { herdrActions } from "./effect-ui-actions.ts"
import { agentScreen } from "./effect-ui-agent.ts"
import { readFailure, retry } from "./effect-ui-failures.ts"
import { fleetCard } from "./effect-ui-fleet.ts"
import { consoleHeader } from "./effect-ui-header.ts"
import { AGENTS_SOURCE, WORKSPACES_SOURCE, loadingRows, region } from "./effect-ui-nodes.ts"
import { AGENTS_REFRESH_MS, FLEET_URL, WORKSPACES_REFRESH_MS, WORKSPACES_URL } from "./effect-ui-reads.ts"
import { startScreen } from "./effect-ui-start.ts"
import { workspacesScreen } from "./effect-ui-workspaces.ts"

export const effectUiView: EffectUiView = {
  viewId: "herdr-console",
  title: "Herdr",
  state: {
    herdr: {
      // where the two reads land, so a list has a shape to render before the first
      // answer rather than a path nothing has written yet
      agents: { agents: [] },
      workspaces: { workspaces: [] },
      draft: { startName: "", startKind: "", startWorkspace: "", message: "" },
      // The key sequences are state because an action's parameter cannot be an
      // array (`value-spec.ts:4`) and the wire wants one; this is the one place
      // they are written down, and a press reads them by path.
      keys: { escape: ["esc"], interrupt: ["ctrl+c"] },
      result: {},
    },
  },
  sources: [
    { id: AGENTS_SOURCE, url: FLEET_URL, state: "/herdr/agents", refreshMs: AGENTS_REFRESH_MS },
    { id: WORKSPACES_SOURCE, url: WORKSPACES_URL, state: "/herdr/workspaces", refreshMs: WORKSPACES_REFRESH_MS },
  ],
  actions: herdrActions,
  nodes: [
    consoleHeader,
    region([
      loadingRows(AGENTS_SOURCE, 6),
      readFailure(AGENTS_SOURCE, "Could not read the terminal agents.", retry("herdr.readFleet")),
      fleetCard,
    ]),
  ],
  screens: [
    { id: "agent", title: "Terminal agent", onEnter: "herdr.agentOutput", nodes: agentScreen },
    { id: "start", title: "Start an agent", nodes: startScreen },
    { id: "workspaces", title: "Workspaces", nodes: workspacesScreen },
  ],
}
