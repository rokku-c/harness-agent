import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { toneBadge } from "@effect-agent/effect-ui"
import { consentSection } from "./effect-ui-consent.ts"
import { field, press, readout, row, section, text, tryAgain } from "./effect-ui-nodes.ts"

const kindOption = (field: string): UiNodeSpec =>
  ({ component: "Select.Item", item: field, as: "value", children: [{ component: "Text", item: field }] })

const kindPicker: UiNodeSpec = {
  component: "Select.Root", bind: "/create/kind",
  children: [
    { component: "Select.Trigger", props: { placeholder: "Select an agent kind" } },
    { component: "Select.Content", children: [
      { component: "Select.Label", children: [text("Served by this deck")] },
      { component: "Select.Group", repeat: { source: { state: "/deck/kinds" } }, children: [kindOption("")] },
      { component: "Select.Label", children: [text("CLI presets")] },
      { component: "Select.Group", repeat: { source: { state: "/presets/presets" } }, children: [kindOption("kind")] },
    ] },
  ],
}

const createParams = {
  kind: { state: "/create/kind" }, sessionId: { state: "/create/sessionId" },
  prompt: { state: "/create/prompt" }, config: { state: "/create/config" },
}

const created = "/result/open/session/sessionId"

const afterCreate = (node: UiNodeSpec): UiNodeSpec => ({ ...node, visible: { source: { state: created } } })

export const newSession: readonly UiNodeSpec[] = [
  section("Open session", [
    field("Agent kind", kindPicker),
    field("Session id (optional)", { component: "TextField.Root", bind: "/create/sessionId" }),
    field("Prompt", { component: "TextArea", bind: "/create/prompt" }),
    row([
      press("Open session", "deck.create", createParams),
      afterCreate(toneBadge("ok", "Opened")),
      afterCreate(press("Read it", "deck.openCreated", undefined, { variant: "soft", size: "1" })),
    ]),
    readout("/result/open/error", tryAgain("deck.create", createParams)),
  ]),
  consentSection,
]
