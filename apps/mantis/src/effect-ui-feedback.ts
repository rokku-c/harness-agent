/**
 * What a press reported, in the design system's own tones.
 *
 * A press here has three answers, and they are three facts rather than one fact
 * restated: the route accepted it; the route refused a well-formed request with
 * its own `detail` on a 200; or the call never reached the route at all and the
 * runtime wrote `{ ok: false, error }` at the result path. The two failures are
 * the package's `failureBadge` — one red chip, guarded on the very path it binds,
 * so it is shown exactly when it has a sentence to show. The two names below only
 * say which path is which fact; a screen that reads the wrong one reports a
 * failure that did not happen.
 *
 * The accepted answer and the refused *write* are this app's, and both are here
 * for the same reason: neither is a plain failure. Accepting is the accent's
 * second meaning — the console's own answer is yes — so it is the `ok` tone and
 * never a green the accent does not own; and a write whose success answers with a
 * sentence of its own needs the second condition `refusedWriteBadge` explains.
 */

import { failureBadge, row, toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"

/** A refusal the route itself answered: a 200, with the reason in `detail`. */
export const refusedBadge = (result: string): UiNodeSpec => failureBadge(`${result}/detail`)

/** The call never reached the route: the runtime's own `{ ok: false, error }`. */
export const failedBadge = (result: string): UiNodeSpec => failureBadge(`${result}/error`)

/**
 * The refusal of a write whose success answers with `detail` too: deleting a
 * record answers `{ ok: true, detail: "deleted <id>" }`, so a `detail` on its own
 * is not a refusal and needs a false `ok` beside it.
 *
 * Two conditions on one node are not expressible — a view's `visible` is one
 * comparison, or an `any` of them — so the second is the wrapper. The wrapper is a
 * row and not a column, because a column stretches what it holds and a stretched
 * badge is a bar across the form rather than the chip it is; and a row whose
 * children are all hidden takes no height, so the failure shape leaves no gap.
 */
export const refusedWriteBadge = (result: string): UiNodeSpec => ({
  ...row([failureBadge(`${result}/detail`)]),
  visible: { source: { state: `${result}/ok` }, equals: false },
})

/**
 * The three answers of one press, in the order they can arrive. They share a row
 * so a form states its outcome in one place whatever the outcome was, and each
 * hides itself while it has nothing to say.
 */
export const outcome = (result: string, accepted: string, label: string): readonly UiNodeSpec[] =>
  [{ ...toneBadge("ok", label), visible: { source: { state: accepted }, equals: true } },
    refusedBadge(result), failedBadge(result)]
