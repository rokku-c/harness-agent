/**
 * The Herdr console: the agents of one running server, live.
 *
 * Two reads, each on its own timer, because they change on different clocks — a
 * workspace is opened once an hour, and an agent's state changes while you are
 * reading its card. Everything on the page is drawn from those two answers; the
 * only other state is what a form has been typed and what the last press
 * answered, and both are named for what they are.
 *
 * The agent read carries a tail, which is what makes the fleet itself live: a
 * view source fetches a fixed url, so a source pointed at one agent would be
 * pointed at whichever agent was selected when the page loaded and never
 * another. The tail rides on the listing instead. That is also why the listing
 * polls faster than the workspaces do — it is the thing being watched.
 *
 * The console is four screens, one per function: the fleet, the agent you picked
 * out of it, starting one, and the workspaces this server has open. The first is
 * `nodes`, and the rest are entered from it by a press that says which screen it
 * opens. On a laptop two of them sit side by side, and on a phone each takes the
 * whole area — the same view, laid out by the width rather than restated for it.
 *
 * The socket is named in the header rather than left implicit: this console can
 * be pointed at any Herdr server on the machine, and a page listing agents
 * should say which server it is listing.
 */
import type { EffectUiView } from "@effect-agent/effect-ui"
import { failureNotice, heading, loadingRows, region, row, text } from "@effect-agent/effect-ui"
import { herdrActions } from "./effect-ui-actions.ts"
import { agentNodes } from "./effect-ui-card.ts"
import { agentsSource, keys, press, sourcePath, workspacesSource } from "./effect-ui-nodes.ts"
import { openedNodes } from "./effect-ui-opened.ts"
import { startNodes } from "./effect-ui-start.ts"
import { workspaceNodes } from "./effect-ui-workspaces.ts"

/** Where the server this page read is named. `server` is written by the workspaces read. */
const socket = `${sourcePath(workspacesSource)}/server/socketPath`

/** The two screens the fleet itself does not lead to: neither is about an agent that already exists. */
const doors = row([
  press("Start an agent", "herdr.openStart", undefined, { variant: "solid" }),
  press("Workspaces", "herdr.openWorkspaces"),
])

/**
 * The fleet is what its screen scrolls, and it is the *only* thing that screen
 * scrolls: the region takes the room the header left, so the reads above it —
 * the socket, the failure, the doors — keep their place while twenty cards go by.
 */
export const effectUiView: EffectUiView = {
  viewId: "herdr-console",
  title: "Herdr",
  state: {
    herdr: {
      workspaces: { workspaces: [] },
      agents: { agents: [] },
      draft: { startName: "", startKind: "", startWorkspace: "", message: "" },
      keys,
      result: {},
    },
  },
  sources: [
    { id: workspacesSource, url: "/herdr/workspaces", state: sourcePath(workspacesSource), refreshMs: 30_000 },
    { id: agentsSource, url: "/herdr/agents?tail=12", state: sourcePath(agentsSource), refreshMs: 5000 },
  ],
  actions: herdrActions,
  nodes: [
    heading("Herdr", { size: "6" }),
    text("The agents of a running Herdr server, read over its socket API: watch them work, talk to them, start one.", { size: "2", color: "gray" }),
    row([
      text("Socket", { size: "2", color: "gray" }),
      { component: "Code", props: { size: "2" }, bind: socket, visible: { source: { state: socket } } },
    ]),
    doors,
    failureNotice(agentsSource),
    loadingRows(agentsSource, 2),
    region(agentNodes),
  ],
  /**
   * One screen per act. `agent` is where a press on a card lands, and it is the
   * only place holding that agent's controls — which is the point: a press and
   * the line saying what it did are on the same screen, so nothing an operator
   * does reports below the fold.
   */
  screens: [
    { id: "agent", title: "Agent", nodes: openedNodes },
    { id: "start", title: "Start an agent", nodes: startNodes },
    { id: "workspaces", title: "Workspaces", nodes: workspaceNodes },
  ],
}
