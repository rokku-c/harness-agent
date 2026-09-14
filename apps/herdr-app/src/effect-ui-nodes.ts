/**
 * What the herdr console calls its own: the two reads behind every screen, and
 * the paths a press writes its answer to.
 *
 * A list and its verdict are one read, so both halves are written down once: the
 * rows a screen draws come from `/herdr/agents/agents`, and whether that read is
 * still running, came back empty or failed comes from `/_sources/agents`. A
 * second spelling of either is how a screen ends up saying a read failed while
 * the rows under it are that read's last good answer.
 *
 * The rest is the framework's vocabulary, re-exported so a screen imports this
 * console and one package rather than both.
 */

export {
  cell, cellOf, emptyRows, field, heading, listCard, loadingRows, press, region, row, section, sourceStatusPath, text,
} from "@effect-agent/effect-ui"

/** The fleet read: every agent Herdr has recognized, each with the last lines it printed. */
export const AGENTS_SOURCE = "agents"
/** The workspaces read: where an agent may be started, and which server answered. */
export const WORKSPACES_SOURCE = "workspaces"

/**
 * A source's rows. The answer lands at the state path the view declares for the
 * source and the list is one field of that answer, so the path names the source
 * twice: reading `/herdr/agents` would be reading the envelope, not the agents.
 */
export const rowsPath = (id: string): string => `/herdr/${id}/${id}`

/**
 * The agent a screen was entered for. A press that enters a screen puts its
 * parameters under `/_nav` (`screen.ts:15`) and the screen reads them as ordinary
 * state, so a row's Open and an address pasted into the bar are one arrival — and
 * the read that fills the screen is addressed by this path, which is why a link
 * naming no agent makes no call rather than asking about an agent nobody chose.
 */
export const navTarget = "/_nav/target"

/** The message being typed at an agent, and the three values a start form sends. */
export const draft = (name: "message" | "startName" | "startKind" | "startWorkspace"): string =>
  `/herdr/draft/${name}`

/**
 * A key sequence, read out of view state.
 *
 * The sequence is an array on the wire and an action's parameter cannot be one
 * (`value-spec.ts:4`), so a press hands over the path that holds it rather than
 * spelling it — and the sequences themselves are state, in `effect-ui.ts`.
 */
export const keySeq = (name: "escape" | "interrupt"): string => `/herdr/keys/${name}`

/**
 * Where one press's answer lands, named for the press that wrote it. One path per
 * action, so two presses can never overwrite each other's answer: the failure of
 * the press an operator did not make cannot appear under the one they did.
 */
export const outcome = (action: string): string => `/herdr/result/${action.replace(/^herdr\./, "")}`
export const outcomeOk = (action: string): string => `${outcome(action)}/ok`
export const outcomeError = (action: string): string => `${outcome(action)}/error`

/** One field of a read's answer — a pane read answers with a `read` record. */
export const readField = (action: string, field: string): string => `${outcome(action)}/read/${field}`
