import { heading, NAV_ROOT, press, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { refusal } from "./effect-ui-fields.ts"
import { outlineEdits } from "./effect-ui-outline-edits.ts"
import { outlineTree } from "./effect-ui-outline-tree.ts"

const nothingOpen: UiNodeSpec = {
  component: "Text",
  props: { value: "No document is open. Pick one from Documents.", size: "2", color: "gray" },
  visible: { source: { state: `${NAV_ROOT}/docId` }, not: true },
}

const retryRead: UiNodeSpec = {
  ...row([press("Read it again", "board.loadDocument", undefined, { variant: "soft", size: "1" })]),
  visible: { any: [
    { source: { state: "/outline/read/error" } },
    { source: { state: "/outlineResult/error" } },
  ] },
}

const document: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  visible: { source: { state: "/outline/read/docId" } },
  children: [
    { component: "Heading", props: { size: "3" }, bind: "/outline/read/title" },
    row([
      { component: "Text", props: { value: "Read at version", size: "1", color: "gray" } },
      { component: "Code", props: { size: "1" }, bind: "/outline/read/version" },
    ]),
    outlineTree,
  ],
}

export const outlineScreen: readonly UiNodeSpec[] = [
  heading("Outline", { size: "4" }),
  nothingOpen,
  refusal("/outline/read/error"),
  refusal("/outlineResult/error"),
  retryRead,
  document,
  ...outlineEdits,
]
