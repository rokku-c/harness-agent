/**
 * The screen one terminal agent is opened on: what it is printing, what it last
 * printed in full, and the three ways an operator moves it forward.
 *
 * It is a screen rather than an expansion of the row because working an agent is
 * a job — read it, answer it, send it a key — and a job is entered and come back
 * from, past a fleet that grows with every agent the server recognizes.
 *
 * What it is about is read from the address and not from an answer. The answer is
 * absent while a read is in flight and again for good when one failed; the address
 * is there from the moment the press put it there, so the line naming the pane
 * cannot blink out, and a link pasted cold says what it is missing instead of
 * showing an empty screen.
 *
 * The region holds the output and stops above the controls: an agent that is
 * printing is exactly when its output is longest, and the message box is wanted at
 * that moment, not scrolled off the bottom of it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { agentCommands } from "./effect-ui-commands.ts"
import { navTarget, region, row, text } from "./effect-ui-nodes.ts"
import { liveOutput, scrollback } from "./effect-ui-output.ts"

/** Present exactly when an agent is: every block below reads this, so they agree. */
const named: UiNodeSpec["visible"] = { source: { state: navTarget } }

/** Which pane this screen is reading, in the form every call and every keypress is addressed by. */
const address: UiNodeSpec = row([
  text("Pane", { size: "1", color: "gray" }),
  { component: "Code", props: { size: "2", variant: "soft" }, bind: navTarget, visible: named },
  // the screen is reachable by a link with no id in it, and that arrival has to
  // say how it fills rather than draw an agent-shaped hole
  { component: "Text", props: { value: "No agent is named in this address. Open one from the fleet.", size: "2", color: "gray" },
    visible: { source: { state: navTarget }, not: true } },
])

export const agentScreen: readonly UiNodeSpec[] = [
  address,
  { ...region([liveOutput, scrollback]), visible: named },
  { ...agentCommands, visible: named },
]
