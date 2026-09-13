/**
 * How a press's outcome is shown, in the section that holds the button.
 *
 * Two failure shapes reach a view. The runtime writes `{ ok: false, error }`
 * for anything that fails at the transport or HTTP level; a route that refuses
 * a well-formed request instead answers 200 with its own `{ ok: false, detail }`.
 * Both are failures an operator has to see, and each readout is guarded by the
 * path it binds — an unguarded one renders as an empty chip before the press.
 */

import { failureBadge, row, type UiNodeSpec } from "@effect-agent/effect-ui"

/** A press the app accepted. It either happened or it did not, so it can carry a colour. */
export const acceptedBadge = (guard: string, label: string): UiNodeSpec =>
  ({ component: "Badge", props: { variant: "soft", color: "green", value: label },
    visible: { source: { state: guard }, equals: true } })

/** The runtime's failure shape, which always carries a readable `error`. */
export const errorBadge = (result: string): UiNodeSpec => failureBadge(`${result}/error`)

/** A refusal the route itself answered: a 200, with the reason in `detail`. */
export const refusalBadge = (result: string): UiNodeSpec => failureBadge(`${result}/detail`)

/**
 * The refusal of a write whose own success answers with `detail` too: the delete
 * says "deleted <id>" when it worked, so a `detail` on its own is not a refusal
 * and needs a false `ok` beside it. The runtime's failure shape has no `detail`
 * at all, so that guard hangs on a wrapper rather than on the badge — hiding the
 * whole readout instead of leaving an empty chip behind. The wrapper is a row,
 * not the column it looks like it wants: a column stretches the badge it holds
 * into a bar across the form.
 */
export const writeRefusalBadge = (result: string): UiNodeSpec => ({
  ...row([{ component: "Badge", props: { variant: "soft", color: "red" }, bind: `${result}/detail`,
    visible: { source: { state: `${result}/ok` }, equals: false } }]),
  visible: { source: { state: `${result}/error` }, not: true },
})
