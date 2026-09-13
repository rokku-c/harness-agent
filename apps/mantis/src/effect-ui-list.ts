/**
 * The four states of a list, for a list whose source carries more than one.
 *
 * `sourceStates()` speaks from the source's own verdict, which is the whole
 * story where a source carries one list — the event poll does. It cannot say it
 * for a source that carries several: the console state holds conversations *and*
 * pending approvals, the workspace holds resources *and* the capability surface,
 * so one count stands for all of them, and a verdict of "ready" would leave the
 * approvals table a bare header the moment any conversation exists. Such a list
 * asks its own first row instead. Loading and failed stay with the source, since
 * those are about the read rather than about what it carried.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { failureNotice, loadingRows, sourceStatusPath } from "@effect-agent/effect-ui"

/** A list with no first row, said out loud — but only once a source has answered. */
export const emptyList = (id: string, list: string, message: string): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column" },
  visible: { source: { state: `${sourceStatusPath(id)}/answered` }, equals: true },
  children: [{ component: "Text", props: { value: message, color: "gray", size: "2" },
    visible: { source: { state: `${list}/0` }, not: true } }],
})

/** All three, in the order a list wants them, for a source several lists read. */
export const sharedSourceStates = (id: string, list: string, message: string, rows = 3): readonly UiNodeSpec[] =>
  [loadingRows(id, rows), emptyList(id, list, message), failureNotice(id)]
