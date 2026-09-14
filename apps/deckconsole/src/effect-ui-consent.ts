import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { field, section, text } from "./effect-ui-nodes.ts"

const POLICY = "/create/config/consent"

const defaultDecision: UiNodeSpec = {
  component: "SegmentedControl.Root", bind: `${POLICY}/defaultDecision`,
  children: [
    { component: "SegmentedControl.Item", props: { value: "ask" }, children: [text("Ask each time")] },
    { component: "SegmentedControl.Item", props: { value: "allow" }, children: [text("Allow")] },
    { component: "SegmentedControl.Item", props: { value: "deny" }, children: [text("Deny")] },
  ],
}

const autoApprove: UiNodeSpec = {
  component: "Flex", props: { direction: "column", gap: "2" },
  children: [0, 1, 2, 3].map((slot): UiNodeSpec => ({
    component: "TextField.Root", bind: `${POLICY}/autoApproveTools/${slot}`,
    props: { placeholder: "Tool name, for example Read" },
  })),
}

export const consentSection: UiNodeSpec = section("Consent policy", [
  text("What this session may run without asking. The policy lasts exactly as long as the session.", { size: "2", color: "gray" }),
  field("A call with no other rule", defaultDecision),
  field("Tools that run without asking", autoApprove),
  text("One tool name per field, up to four. A field left empty names no tool.", { size: "2", color: "gray" }),
])
