import type { UiActionParam, UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyNotice, failureBadge, failureCallout, failureNotice, loadingRows, press, row, sourceStatusPath } from "@effect-agent/effect-ui"

export {
  cell, cellOf, emptyMessage, emptyRows, field, line, loadingRows, press, row, section, stateBadge,
  stateRows, table, text, whenRows,
} from "@effect-agent/effect-ui"

export const code = (item: string): UiNodeSpec => ({ component: "Code", item })

export const codeAt = (bind: string): UiNodeSpec => ({ component: "Code", bind })

export const tryAgain = (onPress: string, params?: Readonly<Record<string, UiActionParam>>): UiNodeSpec =>
  press("Try again", onPress, params, { variant: "soft", size: "1" })

export const door = (label: string, onPress: string): UiNodeSpec =>
  press(label, onPress, undefined, { variant: "soft", size: "1" })

export const doorRow = (label: string, children: readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Flex", props: { gap: "2", wrap: "wrap", "aria-label": label }, children: [...children] })

export const readout = (bind: string, retry: UiNodeSpec): UiNodeSpec => row([failureBadge(bind), retry])

export const failureReadout = (bind: string, retry: UiNodeSpec): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "2", align: "start" },
    visible: { source: { state: bind } }, children: [failureCallout(bind), row([retry])] })

export const sourceRead = (id: string, retry: UiNodeSpec): UiNodeSpec =>
  ({ component: "Flex", props: { direction: "column", gap: "2", align: "start" },
    visible: { source: { state: `${sourceStatusPath(id)}/state` }, equals: "failed" },
    children: [failureNotice(id), row([retry])] })

export const sourceStatesRetry = (id: string, empty: string, retry: UiNodeSpec, rows = 3): readonly UiNodeSpec[] =>
  [loadingRows(id, rows), emptyNotice(id, empty), sourceRead(id, retry)]
