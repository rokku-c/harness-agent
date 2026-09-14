/**
 * The form that opens a session, and the consent policy it opens under.
 *
 * The policy half is why this screen is not three fields. `flows.md` §7.8 records
 * that the deck's legacy page opened a session under a consent policy and that
 * the declarative `new` screen had only kind, id and prompt — so the console
 * opened every session under a policy the operator could not choose. `plan.md`
 * §8 row 6 names this the one row of the redesign where not carrying a capability
 * *loses* it rather than moving it, because §5 deletes the page that had it.
 *
 * Both fields are the deck's own: `defaultDecision` is what a call with no other
 * rule gets, and `autoApproveTools` is the list that runs without asking. The
 * press sends `/create/config` whole — the object `POST /api/session` already
 * takes — so a field added to this form later is carried without a second
 * declaration, and so the policy cannot arrive half-set.
 *
 * The four tool fields are four because the language writes into an array only by
 * path, one index at a time (`effect-ui-state.ts` explains why). Four names is a
 * cap, and it is the one thing this screen cannot carry across from the legacy
 * page, whose single comma-separated field had no cap at all; the reader is told
 * the mechanic in the line under the fields rather than left to discover it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { field, press, readout, row, section, text, tryAgain } from "./effect-ui-nodes.ts"

const POLICY = "/create/config/consent"

/** The value is the deck's own word — a label of ours would have to be translated back before it was sent. */
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

export const newSession: readonly UiNodeSpec[] = [
  section("Open session", [
    field("Agent kind", kindPicker),
    // the deck names a session itself when this is left empty, so an empty string
    // here means "no id" and not "the session called nothing"
    field("Session id (optional)", { component: "TextField.Root", bind: "/create/sessionId" }),
    field("Prompt", { component: "TextArea", bind: "/create/prompt" }),
    row([press("Open session", "deck.create", createParams)]),
    // The deck refuses an id already in use and names the session holding it. The
    // refusal is read here, under the fields that caused it, with the form's own
    // values still in the store — so `Try again` repeats exactly that request.
    // Which kind of refusal it was is the deck's sentence to say: nothing in this
    // layer may read a reason out of free text (`design-system.md` §3.5).
    readout("/result/open/error", tryAgain("deck.create", createParams)),
  ]),
  section("Consent policy", [
    text("What this session may run without asking. The policy lasts exactly as long as the session.", { size: "2", color: "gray" }),
    field("A call with no other rule", defaultDecision),
    field("Tools that run without asking", autoApprove),
    text("One tool name per field, up to four. A field left empty names no tool.", { size: "2", color: "gray" }),
  ]),
]
