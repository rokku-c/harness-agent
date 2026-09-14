/**
 * Issuing a credential, and holding the one look at it.
 *
 * The reveal is the dead end M3 fixes, and its shape follows from what the
 * gateway can honestly promise. The token is answered once and stored only as
 * its hash, so there is no second read of it and no screen that could show it
 * again: the reveal is not a view of a record, it is the record's only
 * appearance, and everything about the card says so before the operator leaves
 * it.
 *
 * It lives at a path of its own instead of beside the form because the form is
 * cleared on success — `clear` empties the draft the press consumed — and a
 * reveal kept in the draft would vanish with it. It survives every screen change
 * for the same reason the choice on the question does: it is view state, and the
 * store outlives the screen the press happened on. Changing app unmounts the
 * view and takes it, which is why the sentence names the recovery rather than
 * claiming the token is safe.
 *
 * `Copy` is not a control here, and its absence is deliberate: a press runs a
 * declared action, the console has no clipboard action, and a button that
 * claimed to copy and did not would be worse than a mono value the operator
 * selects. The sentence says which gesture it wants.
 *
 * Dismissing means what it says — the next press of `Issue` answers a new token
 * — so the copy under the value states the consequence rather than the action.
 */
import { field, press, row, section, text, type UiNodeSpec } from "@effect-agent/effect-ui"
import { refused, retry } from "./effect-ui-refusal.ts"
import { DRAFT_DAYS, DRAFT_ID, DRAFT_KIND, DRAFT_NAME, ISSUE_DISMISSED, ISSUE_RESULT } from "./effect-ui-paths.ts"

const KINDS = ["app", "user", "system"]

/** The kinds on offer are the three the engine knows, and they are literal: nothing serves a list of them. */
const kindPicker: UiNodeSpec = {
  component: "Select.Root",
  bind: DRAFT_KIND,
  children: [
    { component: "Select.Trigger", props: { placeholder: "Select a kind" } },
    { component: "Select.Content", children: KINDS.map((kind): UiNodeSpec =>
      ({ component: "Select.Item", props: { value: kind }, children: [{ component: "Text", props: { value: kind } }] })) },
  ],
}

const entry: UiNodeSpec = section("Issue a token", [
  text("Issuing registers the principal if it is new, and reactivates one that was turned off.", { size: "2", color: "gray" }),
  field("Kind", kindPicker),
  field("Id", { component: "TextField.Root", bind: DRAFT_ID, props: { placeholder: "writer" } }),
  field("Display name", { component: "TextField.Root", bind: DRAFT_NAME, props: { placeholder: "Optional" } }),
  field("Days until expiry", { component: "TextField.Root", bind: DRAFT_DAYS, props: { placeholder: "Leave empty for a token that does not expire" } }),
  row([press("Issue", "gateway.issueToken", undefined, { variant: "solid", size: "2" })]),
])

/** A labelled value, shown only where the answer carried one — an expiry the token does not have leaves no label behind. */
const named = (label: string, path: string, visible?: UiNodeSpec["visible"]): UiNodeSpec =>
  ({ ...row([text(label, { size: "1", color: "gray" }), { component: "Code", bind: path }]),
    ...(visible === undefined ? {} : { visible }) })

const reveal: UiNodeSpec = {
  ...section("The token", [
    named("Principal", `${ISSUE_RESULT}/principalKey`),
    { component: "Code", bind: `${ISSUE_RESULT}/token` },
    named("Listed as", `${ISSUE_RESULT}/fingerprint`),
    named("Expires", `${ISSUE_RESULT}/expires`, { source: { state: `${ISSUE_RESULT}/expires` } }),
    { ...text("This principal was turned off and is active again.", { size: "2", color: "gray" }),
      visible: { source: { state: `${ISSUE_RESULT}/reactivated` }, equals: true } },
    text("Select the token to copy it. You will not see this token again. Revoke and re-issue if you lose it.", { size: "2" }),
    row([press("Dismiss", "gateway.dismissToken", undefined, { variant: "soft", size: "2" })]),
    refused("The token is still on screen; it was not dismissed.", `${ISSUE_DISMISSED}/error`, retry("gateway.dismissToken")),
  ]),
  visible: { source: { state: `${ISSUE_RESULT}/token` } },
}

export const issueNodes: readonly UiNodeSpec[] = [
  entry,
  refused("Issue was refused.", `${ISSUE_RESULT}/error`, retry("gateway.issueToken")),
  reveal,
]
