/**
 * The readout: what a press reported, shown only while there is something to show.
 *
 * An action's answer lands at a path — the runtime writes `error` when the call
 * failed, a route writes `detail` when it refused a well-formed request. The node
 * that shows that answer has to be hidden until the answer exists, or it paints
 * as an empty red box before the first press. So the guard is not a second
 * argument: a readout is visible exactly when the path it binds carries
 * something, and bind and guard being one path is the whole mechanism.
 *
 * Two presentations, because a sentence and a chip sit differently in a layout: a
 * callout where the message is the point, a badge beside the button that produced
 * it. Both are red — colour is the signal here, not a choice a view makes.
 *
 * `source-status.ts` is the same shape for a list's read state. That one is a
 * record the runtime keeps per declared source; this one is one action's answer,
 * which is why it needs no id and no reserved root.
 */

import type { UiNodeSpec } from "./spec.ts"

/**
 * What a failed call said, at full width. The answer is the sentence, so nothing
 * is written here on the view's behalf.
 */
export const failureCallout = (bind: string): UiNodeSpec =>
  ({ component: "Callout.Root", props: { color: "red", size: "1" },
    visible: { source: { state: bind } }, children: [{ component: "Callout.Text", bind }] })

/**
 * The same readout as a chip, for a row that has no room for a sentence. The
 * badge carries the message rather than a state name — that is the one job it is
 * asked to do here.
 */
export const failureBadge = (bind: string): UiNodeSpec =>
  ({ component: "Badge", props: { variant: "soft", color: "red" },
    bind, visible: { source: { state: bind } } })
