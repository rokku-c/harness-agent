/**
 * Asking one agent for one turn, and reading what has been asked of the fleet.
 *
 * The press is not a picker: it lives inside the agent's own answer, so the
 * identity it carries is the one the answer just named — the same rule the
 * center enforces one layer down (§F10), applied at the tier the operator
 * works at. A launch that named its agent through a second control would be a
 * second way to say what the row already said.
 *
 * The answer to the press is what the center resolved, and that is the whole
 * point of showing it: the machine is read from the fleet record of that
 * identity, so an operator who reads it back sees where the work actually went
 * rather than where they might have guessed. It stays in the card the press was
 * made in (F4), which is the card the row was opened in.
 *
 * The queue is a different fact and is drawn in a different place: it is the
 * fleet's durable record of every intent, asked for by a press or not, and a
 * card with nothing to press is a panel — panels stay on the first screen. What
 * the press owes it is that it be current, so the press names it among the reads
 * to run again: the row is there the moment the press returns rather than at the
 * next poll. Which intent a press created is answered where the press was; what
 * became of every intent is answered beside the rest of the fleet.
 *
 * The form asks for a directory and a prompt and nothing else. A task node is
 * the one thing this surface does not name: a turn started by hand belongs to
 * no task, and `nodeId` is absent rather than empty for exactly that reason —
 * a caller that has one (an agent picking up board work) names it, and this is
 * not that caller.
 */
import { failureBadge, press, row, sourceStates, stateBadge, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { boundChip, cellOf, chip } from "./effect-ui-cells.ts"
import { field, section, table, text } from "./effect-ui-nodes.ts"
import { answer } from "./effect-ui-request.ts"

/** The turn this agent is asked for, rendered inside the answer that named it. */
export const launchForm: readonly UiNodeSpec[] = [
  field("Working directory", { component: "TextField.Root", props: { placeholder: "/absolute/path" }, bind: "/launch/workdir" }),
  field("Prompt", { component: "TextArea", props: { placeholder: "what this agent should do" }, bind: "/launch/prompt" }),
  row([press("Run a turn", "agentd.launch", {
    agentId: { state: "/inspect/desired/desired/agent/agentId" },
    workdir: { state: "/launch/workdir" },
    prompt: { state: "/launch/prompt" },
  })]),
  answer("/inspect/launch/ok", [
    field("Queued", row([
      { component: "Badge", props: { variant: "soft" }, bind: "/inspect/launch/launch/state" },
      boundChip("/inspect/launch/launch/machineId"),
    ])),
  ]),
  row([failureBadge("/inspect/launch/error")]),
]

/**
 * A command has no agent, and a cell that is blank for one reads as a column the
 * read did not carry. The row says which of the two it is in the column that
 * would have held an identity.
 */
const agentCell: UiNodeSpec = cellOf([
  chip("agentId"),
  { component: "Text", props: { value: "a command", size: "2", color: "gray" },
    visible: { source: { item: "agentId" }, not: true } },
])

/** What the machine said when it settled, or the fact that it has not said anything yet. */
const resultCell: UiNodeSpec = cellOf([
  { component: "Text", props: { size: "2" }, item: "detail" },
  { component: "Text", props: { value: "—", size: "2", color: "gray" },
    visible: { source: { item: "detail" }, not: true } },
])

/**
 * The queue, as the operator's record of the whole journey: an intent is queued,
 * claimed, run, and settled, and this is the one place all four states are read
 * together. Its read states belong to its source, which feeds this list alone,
 * so they are stated once above it rather than per list.
 */
export const launchesSection: UiNodeSpec = section("Launches", [
  text("Every intent asked of a machine, and what became of it.", { size: "2", color: "gray" }),
  ...sourceStates("launches", "Nothing has been asked of a machine yet.", 2),
  whenRows(stateRows("/launches/launches"), table(
    ["Agent", "Machine", "State", "Result"],
    [agentCell, cellOf([chip("machineId")]), cellOf([stateBadge("state")]), resultCell],
    "/launches/launches", "intentId")),
])
