/**
 * The two things the access question is asked about, each a choice rather than
 * a box.
 *
 * An identity is a key the door verified, and every other fact on this console
 * is filed under that same key — the binding, the credential, the audit line. A
 * typed box would let an operator ask about an identity that does not exist and
 * be answered "Denied", which is a true answer to a question nobody meant; so
 * the choices are the principals the door can name, offered as they are written.
 *
 * A tool is named the way the door names it in `tools/list`, so the list is the
 * catalog itself and the answer is about the same pair a call would route
 * through. Choosing no tool yet asks about the identity alone, which is what the
 * control says while nothing is chosen.
 *
 * A list with nothing in it is a question that cannot be asked yet, so it says
 * where the list comes from rather than leaving a control with nothing in it.
 * Neither notice draws a control of its own: the door to each of those screens
 * is already under the heading, and a second one would be a second control for
 * one destination.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { principalsPath, text } from "./effect-ui-nodes.ts"

/**
 * A control that is a choice: what it holds is the key the record is filed
 * under, and what it offers is a list already read for the screen. The value is
 * the item's own field, never its label — a label is what a person reads, and
 * the string a call is made with is not.
 */
const chooser = (held: string, options: string, item: string, placeholder: string): UiNodeSpec => ({
  component: "Select.Root", bind: held,
  visible: { source: { state: `${options}/0` } },
  children: [
    { component: "Select.Trigger", props: { placeholder } },
    { component: "Select.Content", children: [
      { component: "Flex", props: { direction: "column" }, repeat: { source: { state: options }, key: item },
        children: [{ component: "Select.Item", item, as: "value", children: [{ component: "Text", item }] }] },
    ] },
  ],
})

const missing = (notice: string, options: string): UiNodeSpec => ({
  ...text(notice, { size: "2", color: "gray" }),
  visible: { source: { state: `${options}/0` }, not: true },
})

export const identityChooser = chooser("/access/agent", principalsPath, "key", "Choose an identity")
export const emptyIdentities = missing(
  "No identity yet. The door names whoever holds a credential; issue one on Identities.", principalsPath)
export const toolChooser = chooser("/access/tool", "/gateway/tools", "advertised", "Any tool")
export const emptyTools = missing(
  "No tool yet. A server registers and answers a listing before the gateway can offer one. Topology names what each server answered.", "/gateway/tools")
