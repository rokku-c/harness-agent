/**
 * Every press this console can make.
 *
 * One list, because a press is one call and the blocks that draw its button should
 * not each be restating where it goes. Every value an action sends is declared
 * here rather than supplied by the press, so a press is a button and its retry is
 * the same button; the one exception is a row's Open, which sends the id of the
 * row it stands on because that is a value only the row has.
 *
 * Three of these enter a screen and call nothing. They are actions all the same,
 * because a press runs a named behaviour and entering a screen is one — the
 * alternative is a second way to say what a press does, and there is exactly one.
 * What fills a screen is the screen's own read (`onEnter`), so a row's Open and an
 * address pasted into the bar are the same arrival with one read behind both.
 *
 * A target that the url carries as a path segment travels only there: the runtime
 * strips a consumed key from the body, because a parameter the server already has
 * in the path arrives as an unknown field to a strict schema and the whole request
 * is refused over it.
 */
import type { UiActionSpec } from "@effect-agent/effect-ui"
import { AGENTS_SOURCE, WORKSPACES_SOURCE, draft, keySeq, navTarget, outcome } from "./effect-ui-nodes.ts"
import { FLEET_URL, SCROLLBACK_LINES, WORKSPACES_URL } from "./effect-ui-reads.ts"

export const herdrActions = [
  { name: "herdr.openStart", opens: "start" },
  { name: "herdr.openWorkspaces", opens: "workspaces" },
  { name: "herdr.openAgent", opens: "agent" },

  // The two reads a press can make again. A source is read on its own timer and no
  // press can re-run one, so "Try again" makes the read's own call and then
  // refreshes the source: the call is what the failure was about and the refresh
  // is the write that clears the failed verdict.
  { name: "herdr.readFleet", method: "GET", url: FLEET_URL, refresh: [AGENTS_SOURCE] },
  { name: "herdr.readWorkspaces", method: "GET", url: WORKSPACES_URL, refresh: [WORKSPACES_SOURCE] },

  // The screen's own read, addressed by the pane a press put in the address — so
  // it runs the same whether a row was pressed or the URL was pasted, and a link
  // naming no pane makes no call at all rather than reading someone else's pane.
  { name: "herdr.agentOutput", method: "GET", url: "/herdr/agents/{target}/output",
    params: { target: { state: navTarget }, source: "recent", lines: SCROLLBACK_LINES },
    result: outcome("herdr.agentOutput") },

  // The message is emptied once the turn has it: a box that keeps what it already
  // sent invites the same press twice, and an agent prompted twice is a different
  // outcome, not a repeat.
  { name: "herdr.agentPrompt", method: "POST", url: "/herdr/agents/{target}/prompt",
    params: { target: { state: navTarget }, text: { state: draft("message") } },
    result: outcome("herdr.agentPrompt"), clear: [draft("message")], refresh: [AGENTS_SOURCE] },

  // Nothing is cleared here, and that is the decision: a name and a kind are what
  // an operator reuses when the next start is the same agent again, and Herdr
  // refuses a name that is already running rather than starting a second one.
  { name: "herdr.agentStart", method: "POST", url: "/herdr/agents",
    params: { name: { state: draft("startName") }, kind: { state: draft("startKind") },
      workspaceId: { state: draft("startWorkspace") } },
    result: outcome("herdr.agentStart"), refresh: [AGENTS_SOURCE, WORKSPACES_SOURCE] },

  { name: "herdr.agentFocus", method: "POST", url: "/herdr/agents/{target}/focus",
    params: { target: { state: navTarget } }, result: outcome("herdr.agentFocus"),
    refresh: [AGENTS_SOURCE, WORKSPACES_SOURCE] },

  // The keystroke escape hatch, one action per sequence rather than one action
  // reading a sequence a press supplies: two presses sharing a result path would
  // overwrite each other's answer, and §9.4 writes an answer where the press was.
  { name: "herdr.agentEscape", method: "POST", url: "/herdr/agents/{target}/keys",
    params: { target: { state: navTarget }, keys: { state: keySeq("escape") } },
    result: outcome("herdr.agentEscape"), refresh: [AGENTS_SOURCE] },
  { name: "herdr.agentInterrupt", method: "POST", url: "/herdr/agents/{target}/keys",
    params: { target: { state: navTarget }, keys: { state: keySeq("interrupt") } },
    result: outcome("herdr.agentInterrupt"), refresh: [AGENTS_SOURCE] },
] as const satisfies readonly UiActionSpec[]

/**
 * The presses this console declares, as a union of their names.
 *
 * A press names a behaviour, and a name nothing declares is a button that does
 * nothing at all in the browser — the failure `scripts/check-ui.ts` exists to
 * catch, and one it can only catch where a press is written out as a literal. The
 * presses here are built by helpers, so the same guarantee is carried by the type
 * instead: a command that named `herdr.focusAgent` would not compile.
 */
export type HerdrAction = (typeof herdrActions)[number]["name"]
