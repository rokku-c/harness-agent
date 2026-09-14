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
      agents: { agents: [] },
      workspaces: { workspaces: [] },
      draft: { startName: "", startKind: "", startWorkspace: "", message: "" },
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
    { id: "agent", title: "Terminal agent", nodes: agentScreen },
    { id: "start", title: "Start an agent", nodes: startScreen },
    { id: "workspaces", title: "Workspaces", nodes: workspacesScreen },
  ],
}
