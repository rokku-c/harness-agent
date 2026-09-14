/**
 * The form that opens a session, and the two facts it has to report afterwards.
 *
 * A press that creates cannot itself say where to go: its parameters are resolved
 * *before* its call, so the id its own call is about to produce has no value yet
 * to carry (the same fact `board`'s create screen records). So the form says what
 * happened where the press was made, and offers the door. It has to: the new
 * session appears in the sessions list on the *other* screen, which a reader on a
 * narrow console cannot see, and a press that changes nothing visible is the
 * defect the screen model exists to remove.
 *
 * The refusal is read there for the same reason and from the same place. The deck
 * refuses an id already in use and names the session holding it; that sentence
 * belongs under the fields that caused it, with the form's own values still in
 * the store, so `Try again` repeats exactly that request. Which kind of refusal
 * it was is the deck's sentence to say — nothing in this layer may read a reason
 * out of free text (`design-system.md` §3.5).
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { toneBadge } from "@effect-agent/effect-ui"
import { consentSection } from "./effect-ui-consent.ts"
import { field, press, readout, row, section, text, tryAgain } from "./effect-ui-nodes.ts"

/**
 * One selectable kind, as the deck serves it. The kind itself is the item's
 * value — `Select.Item`'s own `value` is part of its contract, so it cannot be
 * the content the `item` binding would otherwise become — and the same string
 * again is the label the operator reads.
 */
const kindOption = (field: string): UiNodeSpec =>
  ({ component: "Select.Item", item: field, as: "value", children: [{ component: "Text", item: field }] })

const kindPicker: UiNodeSpec = {
  component: "Select.Root", bind: "/create/kind",
  children: [
    { component: "Select.Trigger", props: { placeholder: "Select an agent kind" } },
    { component: "Select.Content", children: [
      // the deck serves what it knows and what an operator registered as two
      // lists; the dropdown is one list and says which half each came from
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

/**
 * The id the deck answered a create with, and the two things that read it.
 *
 * Read off the write's own answer and never off `deck`'s list of sessions: an id
 * appearing in a read is not a create this press made.
 */
const created = "/result/open/session/sessionId"

/** Shown only once the deck has answered with an id, so a create that has not happened leaves no gap. */
const afterCreate = (node: UiNodeSpec): UiNodeSpec => ({ ...node, visible: { source: { state: created } } })

export const newSession: readonly UiNodeSpec[] = [
  section("Open session", [
    field("Agent kind", kindPicker),
    // the deck names a session itself when this is left empty, so an empty string
    // here means "no id" and not "the session called nothing"
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
