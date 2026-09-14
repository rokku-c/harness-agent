/**
 * Issuing a credential: the form, and the one moment the token is readable.
 *
 * What the token will be is said *before* the press rather than beside the
 * answer. "Shown once" is the expectation the operator acts on — whether to have
 * somewhere to paste it ready — and a warning that arrives with the token
 * arrives after the decision it was there to inform.
 *
 * The token itself is a read-only field rather than a block of code, because the
 * one thing to do with it is copy it, and a field is the design system's own
 * control that selects and copies. The fingerprint beside it is the same eight
 * characters the list below shows on the record, so a token in hand can be
 * matched with the row it belongs to.
 *
 * The id is cleared once a token has been issued, and nothing else is: the press
 * consumed that id — an identity now exists — while a kind and a lifetime are
 * settings the next identity is likely to share. It is also what makes a stray
 * second press impossible rather than merely unlikely, and a second token nobody
 * saw would be a credential that is live and unholdable.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { draft, failureCallout, field, issueResult, press, row, section, text } from "./effect-ui-nodes.ts"

/** Most identities are apps; the other two are offered because the door verifies them too. */
const kinds = ["app", "user", "system"] as const

const kindPicker: UiNodeSpec = {
  component: "Select.Root",
  bind: draft("kind"),
  children: [
    { component: "Select.Trigger", props: { placeholder: "Select a kind" } },
    { component: "Select.Content", children: kinds.map((kind): UiNodeSpec => ({
      component: "Select.Item", props: { value: kind }, children: [text(kind)],
    })) },
  ],
}

/** Two fields to a line where there is room: the four answers are short, and the list below wants the height. */
const form: UiNodeSpec = {
  component: "Grid",
  props: { columns: { initial: "1", sm: "2" }, gap: "3" },
  children: [
    field("Kind", kindPicker),
    field("Id", { component: "TextField.Root", props: { placeholder: "builder-2" }, bind: draft("id") }),
    field("Name (optional)", { component: "TextField.Root", bind: draft("name") }),
    field("Expires in days (optional)", { component: "TextField.Root", props: { placeholder: "never" }, bind: draft("days") }),
  ],
}

/** Where the deadline is shown only when there is one: a lone label over nothing reads as a value that failed to load. */
const expires: UiNodeSpec = {
  ...row([
    text("Expires", { size: "1", color: "gray" }),
    { component: "Text", props: { size: "1", color: "gray" }, bind: `${issueResult}/expires` },
  ]),
  visible: { source: { state: `${issueResult}/expires` } },
}

/**
 * The answer, and it is guarded on the token rather than on the action's `ok`:
 * the token is the only thing this card has to show that a read of the same path
 * could not also be, so the guard is the thing itself rather than a verdict
 * about it.
 */
const issued: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "2" },
  visible: { source: { state: `${issueResult}/token` } },
  children: [
    row([
      { component: "Code", props: { size: "2" }, bind: `${issueResult}/principalKey` },
      { component: "Code", props: { size: "1", color: "gray" }, bind: `${issueResult}/fingerprint` },
    ]),
    field("Token", { component: "TextField.Root", props: { readOnly: true }, bind: `${issueResult}/token` }),
    expires,
    { component: "Text", props: { value: "This identity had been turned off; it is active again.", size: "1", color: "amber" },
      visible: { source: { state: `${issueResult}/reactivated` }, equals: true } },
  ],
}

export const issueSection: UiNodeSpec = section("Issue a token", [
  form,
  text("A token is shown once, here, and stored only as its hash. Copy it before you leave this card.", { size: "1", color: "gray" }),
  row([press("Issue token", "gateway.issueToken", undefined, { variant: "solid" })]),
  failureCallout(`${issueResult}/error`),
  issued,
])
