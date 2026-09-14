import { field, press, row, section, text, type UiNodeSpec } from "@effect-agent/effect-ui"
import { refused, retry } from "./effect-ui-refusal.ts"
import { DRAFT_DAYS, DRAFT_ID, DRAFT_KIND, DRAFT_NAME, ISSUE_DISMISSED, ISSUE_RESULT } from "./effect-ui-paths.ts"

const KINDS = ["app", "user", "system"]

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
