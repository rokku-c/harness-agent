/**
 * The view vocabulary that is Herdr's own.
 *
 * Everything a console has an opinion about in general — a field is its label
 * above its control, a section is a card, a state name is a badge — is
 * `@effect-agent/effect-ui`'s and is used from there rather than restated. What
 * is here is what only this console needs: where its two reads keep their
 * answers, how a press's outcome is shown, and the key sequences a press sends.
 */
import { failureBadge, row, type UiActionParam, type UiNodeSpec, type UiVisibilitySpec } from "@effect-agent/effect-ui"

/**
 * The two reads. A source's body lands at `/herdr/<id>` and the list inside it
 * at `/herdr/<id>/<id>`: Herdr names its own answer's list after the thing it
 * lists (`{agents: [...]}`), and a source named after its list is the one naming
 * that cannot drift from what is read.
 */
export const agentsSource = "agents"
export const workspacesSource = "workspaces"

/** Where a source's whole answer is. */
export const sourcePath = (id: string): string => `/herdr/${id}`
/** Where the list inside it is — what a grid repeats. */
export const rowsPath = (id: string): string => `/herdr/${id}/${id}`
/** Where a form keeps what has been typed but not sent. */
export const draft = (name: string): string => `/herdr/draft/${name}`

/**
 * The message being typed, wherever it is typed. One box, several destinations:
 * a card sends to its own agent and the opened panel sends to the one it holds,
 * but there is only ever one thing being typed.
 */
export const message = draft("message")
/** Where one press's answer lands. */
export const outcome = (name: string): string => `/herdr/result/${name}`

/** The agent whose output was last read: a read names the pane it came from. */
export const openedAgent = `${outcome("agentOutput")}/read/pane_id`
/** One field of that read, for the panel that shows it whole. */
export const readPart = (field: string): string => `${outcome("agentOutput")}/read/${field}`

/**
 * The key sequences the console can send, held in view state because a press
 * carries scalars and `agent.send_keys` takes a list. The names are the
 * terminal's, not this page's — Herdr recognizes these keys itself.
 */
export const keys = { escape: ["esc"], interrupt: ["ctrl+c"] }
export const keySeq = (name: keyof typeof keys): string => `/herdr/keys/${name}`

/** A press, sized to its label rather than to the column it was put in. */
export const press = (
  label: string, onPress: string,
  params?: Readonly<Record<string, UiActionParam>>,
  props: Readonly<Record<string, unknown>> = {},
): UiNodeSpec =>
  ({ component: "Button", props: { value: label, size: "1", variant: "soft", ...props }, onPress,
    ...(params === undefined ? {} : { params }) })

/** A press that failed: the runtime's own shape, which always carries a readable `error`. */
export const failure = (name: string): UiNodeSpec => failureBadge(`${outcome(name)}/error`)

/** A press the app accepted. It either happened or it did not, so it can carry a colour. */
const accepted = (name: string, label: string): UiNodeSpec =>
  ({ component: "Badge", props: { variant: "soft", color: "green", value: label },
    visible: { source: { state: `${outcome(name)}/ok` }, equals: true } })

/** One press's outcome, both ways round, in a row that takes no height while it is empty. */
export const outcomeRow = (name: string, label: string): UiNodeSpec => row([accepted(name, label), failure(name)])

/**
 * An agent's tail, shown only once there is one. A card that reserved the space
 * before a read had answered would be showing a blank terminal as a fact.
 */
export const hasTail: UiVisibilitySpec = { source: { item: "tail/text" } }

/** Terminal text is the one text on this page whose spacing carries meaning. */
export const terminal = (maxHeight: string): Readonly<Record<string, unknown>> =>
  ({ size: "1", style: { whiteSpace: "pre-wrap", maxHeight, overflow: "auto" } })
