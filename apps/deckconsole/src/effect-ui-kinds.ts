/**
 * The kinds on offer when an operator opens a session.
 *
 * They are whatever the deck serves — the gateways it registered, then the CLI
 * presets it can invoke — so a kind added at boot shows up here and a literal
 * list of four could only ever be wrong. Two repeats because the deck serves
 * those two halves separately; the dropdown the operator sees is one list.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"

/**
 * One served agent kind, as a selectable item: the kind itself is the item's
 * value — `Select.Item`'s own `value` is part of its contract, so it cannot be
 * the content the `item` binding would otherwise become — and the same string
 * again as the label the operator reads.
 */
const kindOption = (field: string): UiNodeSpec => ({
  component: "Select.Item",
  item: field,
  as: "value",
  children: [{ component: "Text", item: field }],
})

export const kindPicker: UiNodeSpec = {
  component: "Select.Root",
  bind: "/create/kind",
  children: [
    { component: "Select.Trigger", props: { placeholder: "Select an agent kind" } },
    { component: "Select.Content", children: [
      { component: "Select.Group", repeat: { source: { state: "/deck/kinds" } }, children: [kindOption("")] },
      { component: "Select.Group", repeat: { source: { state: "/presets/presets" } }, children: [kindOption("kind")] },
    ] },
  ],
}
