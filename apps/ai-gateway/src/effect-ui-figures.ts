/**
 * What the gateway has carried, as the one source counts it.
 *
 * Four readings of one window, taken from the same answer the provider table
 * comes from, so a figure and the rows under it cannot disagree about the same
 * traffic. They are a run of key and value pairs rather than four blocks: a
 * figure has no identity and no controls of its own, which is what a card is
 * for, and the design system leaves a run of pairs as plain space.
 *
 * The guard on the whole run is the reason it has one. Before the first answer
 * every count is zero and the average is null, and a zero is a claim about
 * traffic — nothing has come through — where the truth is that nothing has been
 * read. Zeroes under a read that failed are the same claim in a longer form,
 * which is why the guard is `answered` and not "the read is in flight": a first
 * read that failed is not loading, and the framework's loading rows, which are
 * stated once at the top of the screen, are gone by then.
 */
import type { UiCondition, UiNodeSpec } from "@effect-agent/effect-ui"
import { sourceStatusPath, text } from "@effect-agent/effect-ui"
import { USAGE_WINDOW } from "./models-usage.ts"
import { MODEL_SOURCE, caption, monoBind } from "./effect-ui-nodes.ts"

const AVERAGE = "/models/usage/averageDurationMs"

/** Whether any answer has ever landed. A fact about the read, kept at its reserved root. */
const answered: UiCondition = { source: { state: `${sourceStatusPath(MODEL_SOURCE)}/answered` } }

const reading = (name: string, value: readonly UiNodeSpec[]): UiNodeSpec => ({
  component: "DataList.Item",
  children: [
    { component: "DataList.Label", children: [text(name, { size: "1" })] },
    { component: "DataList.Value", children: [...value] },
  ],
})

/**
 * The average carries a case the counts do not. No exchange finished inside the
 * window, and the API answers null — and a null bound into a value draws
 * nothing at all, which is a figure that failed to load in the place a figure
 * goes. So the absence is said out loud. The guard is equality with null and
 * not falsiness, because a measured average of zero milliseconds is a reading.
 */
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
