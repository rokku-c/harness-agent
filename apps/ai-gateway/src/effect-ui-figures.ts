import type { UiCondition, UiNodeSpec } from "@effect-agent/effect-ui"
import { sourceStatusPath, text } from "@effect-agent/effect-ui"
import { USAGE_WINDOW } from "./models-usage.ts"
import { MODEL_SOURCE, caption, monoBind } from "./effect-ui-nodes.ts"

const AVERAGE = "/models/usage/averageDurationMs"

const answered: UiCondition = { source: { state: `${sourceStatusPath(MODEL_SOURCE)}/answered` } }

const reading = (name: string, value: readonly UiNodeSpec[]): UiNodeSpec => ({
  component: "DataList.Item",
  children: [
    { component: "DataList.Label", children: [text(name, { size: "1" })] },
    { component: "DataList.Value", children: [...value] },
  ],
})

const average: UiNodeSpec = reading("Average duration (ms)", [
  { ...monoBind(AVERAGE), visible: { source: { state: AVERAGE }, equals: null, not: true } },
  { ...text("No exchange has completed in this window.", { size: "2", color: "gray" }),
    visible: { source: { state: AVERAGE }, equals: null } },
])

export const usageFigures: readonly UiNodeSpec[] = [
  caption(`Counted over the most recent ${USAGE_WINDOW} recorded events.`),
  {
    component: "DataList.Root", props: { orientation: "horizontal", size: "2" }, visible: answered,
    children: [
      reading("Requests", [monoBind("/models/usage/requests")]),
      reading("Responses", [monoBind("/models/usage/responses")]),
      reading("Errors", [monoBind("/models/usage/errors")]),
      average,
    ],
  },
]
