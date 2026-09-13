/**
 * What one list says when its source answered and carried no rows for it.
 *
 * `sourceStates` is the whole answer for a source that carries one list. It is
 * the wrong answer for a source that carries several, and the trap is quiet: the
 * runtime decides "empty" from *every* array an answer holds, so a source with a
 * registry, a set list, and a binding list reads `ready` while all three are
 * empty — as long as any one of them, or any other array in the same body, has a
 * row. The source's verdict can then never say this list is empty, and a list
 * with nothing in it draws a bare header, which reads as broken.
 *
 * So each list inside such a source asks its own first row instead: the source
 * has answered, and this list has no first row. That is the one node below.
 *
 * Loading and failure are deliberately NOT here. Those are about the read rather
 * than about what it carried, so they belong to the source — put `loadingRows`
 * and `failureNotice` for the source once on the page, and `emptyRows` per list.
 * Repeating them per list states one failed read three times on one page.
 */
import type { UiNodeSpec } from "./spec.ts"
import { sourceStatusPath } from "./source-status.ts"

/**
 * The primitive: "this list has no first row yet", said in place of the rows.
 *
 * It carries no guard of its own about whether anything was read, so it belongs
 * under something that already answered — `emptyRows` below for a source, or a
 * node guarded on the action result that was just loaded. Guarded on nothing, it
 * announces an empty list before the read has happened.
 *
 * @param path the list's own path, e.g. `/gateway/servers`
 */
export const emptyMessage = (path: string, message: string): UiNodeSpec => ({
  component: "Text",
  props: { value: message, color: "gray", size: "2" },
  visible: { source: { state: `${path}/0` }, not: true },
})

/**
 * @param id the source's declared id — where its verdict is kept
 * @param path the list's own path inside that source, e.g. `/gateway/servers`
 * @param message what an operator reads in place of the rows
 */
export const emptyRows = (id: string, path: string, message: string): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column" },
  // without a verdict there is nothing to report: an unanswered source is
  // showing its skeletons rather than an answer, and a failed one says so above
  visible: { source: { state: `${sourceStatusPath(id)}/answered` }, equals: true },
  children: [emptyMessage(path, message)],
})
