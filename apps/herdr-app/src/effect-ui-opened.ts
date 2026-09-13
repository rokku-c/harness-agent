/**
 * The agent in hand: one panel, one agent deep.
 *
 * It is a panel of its own rather than a bigger card, because the read is one
 * agent deep — opening another replaces it, and a grid that grew its own cards
 * would have to say which of them the read belonged to.
 *
 * This is the screen a press on a card lands on, and an agent's controls are
 * here and nowhere else — which is the point of it being a screen: an operator
 * who presses `Open` gets the terminal, the message box and the answer to
 * whatever they press next, in one area, with nothing to scroll past to find it.
 * The outcome rows sit here for the same reason, and once per act rather than
 * once per agent, since a card would say the same failure for every agent on the
 * list.
 */
import type { UiActionParam, UiNodeSpec } from "@effect-agent/effect-ui"
import { field, heading, row } from "@effect-agent/effect-ui"
import { failure, keySeq, message, openedAgent, outcome, outcomeRow, press, readPart, terminal } from "./effect-ui-nodes.ts"

/** The controls of the opened panel: the same acts as a card's, pointed at the agent in hand. */
const panelControls = (target: UiActionParam): UiNodeSpec => row([
  press("Send", "herdr.agentPrompt", { target, text: { state: message } }, { variant: "solid" }),
  press("Esc", "herdr.agentKeys", { target, keys: { state: keySeq("escape") } }),
  press("Interrupt", "herdr.agentKeys", { target, keys: { state: keySeq("interrupt") } }, { color: "red" }),
  press("Focus", "herdr.agentFocus", { target }),
])

/**
 * Guarded on the whole answer rather than on its success: a read that failed
 * left one here too, and hiding the panel under its own failure would be the one
 * outcome the operator most needs to see.
 */
const opened: UiNodeSpec = {
  component: "Card",
  visible: { source: { state: outcome("agentOutput") } },
  children: [{ component: "Flex", props: { direction: "column", gap: "3" }, children: [
    row([
      heading("Opened agent", { size: "3" }),
      { component: "Code", props: { size: "2" }, bind: openedAgent, visible: { source: { state: openedAgent } } },
      { component: "Badge", props: { variant: "soft", value: "truncated" },
        visible: { source: { state: readPart("truncated") }, equals: true } },
      failure("agentOutput"),
    ]),
    { component: "Code", props: terminal("28rem"), bind: readPart("text"), visible: { source: { state: readPart("text") } } },
    field("Message", { component: "TextArea", props: { placeholder: "what to say to it" }, bind: message }),
    panelControls({ state: openedAgent }),
    outcomeRow("agentPrompt", "sent"),
  ] }],
}

export const openedNodes: readonly UiNodeSpec[] = [
  opened,
  outcomeRow("agentFocus", "focused"), outcomeRow("agentKeys", "keys sent"),
]
