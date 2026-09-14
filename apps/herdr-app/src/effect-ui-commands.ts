import type { UiNodeSpec } from "@effect-agent/effect-ui"
import type { HerdrAction } from "./effect-ui-actions.ts"
import { command } from "./effect-ui-command.ts"
import { draft, field, row, section, text } from "./effect-ui-nodes.ts"

const key = (label: string, action: HerdrAction, sentence: string): UiNodeSpec =>
  command({ label, action, sentence, done: "sent" })

export const agentCommands: UiNodeSpec = section("Work this agent", [
  field("Message", {
    component: "TextArea",
    props: { placeholder: "What should it do next?", rows: "2" },
    bind: draft("message"),
  }),
  row([command({ label: "Send", action: "herdr.agentPrompt", variant: "solid", sentence: "Send was refused.", done: "sent" })]),
  text("Herdr types this into the agent's pane and presses return; it is not a queue the agent reads later.", { size: "1", color: "gray" }),
  field("Keys", row([key("Esc", "herdr.agentEscape", "Sending Esc was refused."),
    key("Ctrl+C", "herdr.agentInterrupt", "Sending Ctrl+C was refused.")])),
  text("Herdr recognizes an agent's approval prompt itself. These are for the one it did not.", { size: "1", color: "gray" }),
  row([command({ label: "Bring to front", action: "herdr.agentFocus", sentence: "Could not bring the agent forward.", done: "in front" })]),
  text("Herdr brings the agent's tab forward in its own UI, which is also what marks its finished work as seen.", { size: "1", color: "gray" }),
])
