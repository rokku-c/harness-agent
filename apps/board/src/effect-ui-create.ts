import { heading, press, type UiNodeSpec } from "@effect-agent/effect-ui"
import { entry, memo, picker, refusal } from "./effect-ui-fields.ts"
import { outcome } from "./effect-ui-outcome.ts"

export const createScreen: readonly UiNodeSpec[] = [
  heading("New task", { size: "4" }),
  refusal("/createResult/error"),
  { component: "Flex", props: { direction: "column", gap: "3" }, children: [
    entry("Title", "/create/title"),
    memo("Body", "/create/body"),
    picker("/create/state"),
    outcome([
      press("Create task", "board.create", {
        title: { state: "/create/title" },
        body: { state: "/create/body" },
        state: { state: "/create/state" },
      }, { variant: "solid" }),
    ], [["/createResult/id", "Created"]]),
  ] },
]
