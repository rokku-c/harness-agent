/**
 * Every press the console can make.
 *
 * One list, because a press is one call and the panels that draw its button
 * should not each be restating where it goes. A target the url carries as a path
 * segment travels only there: the runtime strips a consumed key from the body,
 * because a parameter the server already has in the path arrives as an unknown
 * field to a strict schema and the whole request is refused over it.
 *
 * A press supplies what it alone knows — which agent it is pointed at, which key
 * it sends — and the action supplies the rest. That is why `herdr.agentPrompt`
 * declares no text: the card's press takes the message being typed, and the
 * opened panel's takes the same one, so the parameter belongs to whichever press
 * is doing the sending.
 *
 * Two of these enter a screen and call nothing. They are actions all the same,
 * because a press runs a named behaviour and entering a screen is one — the
 * alternative is a second way to say what a press does, and there is exactly one.
 */
import type { UiActionSpec } from "@effect-agent/effect-ui"
import { agentsSource, draft, outcome, workspacesSource } from "./effect-ui-nodes.ts"

export const herdrActions: readonly UiActionSpec[] = [
  // the screen is the thing being started: nothing to read first
  { name: "herdr.openStart", opens: "start" },
  { name: "herdr.openWorkspaces", opens: "workspaces" },
  {
    name: "herdr.agentStart", method: "POST", url: "/herdr/agents",
    params: { name: { state: draft("startName") }, kind: { state: draft("startKind") },
      workspaceId: { state: draft("startWorkspace") } },
    result: outcome("agentStart"), clear: [draft("startName")], refresh: [agentsSource, workspacesSource],
  },
  {
    name: "herdr.agentPrompt", method: "POST", url: "/herdr/agents/{target}/prompt",
    result: outcome("agentPrompt"), clear: [draft("message")], refresh: [agentsSource],
  },
  {
    // the screen as it stands, and the 200 lines of scrollback behind it — and
    // then the screen that shows it, which is what a card's one press does
    name: "herdr.agentOutput", method: "GET", url: "/herdr/agents/{target}/output",
    params: { source: "recent", lines: 200 }, result: outcome("agentOutput"), opens: "agent",
  },
  {
    name: "herdr.agentFocus", method: "POST", url: "/herdr/agents/{target}/focus",
    result: outcome("agentFocus"), refresh: [agentsSource, workspacesSource],
  },
  {
    name: "herdr.agentKeys", method: "POST", url: "/herdr/agents/{target}/keys",
    result: outcome("agentKeys"), refresh: [agentsSource],
  },
]
