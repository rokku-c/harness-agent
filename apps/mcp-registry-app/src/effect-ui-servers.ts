/**
 * The registered servers, one row each.
 *
 * A row declares ui:// resources or it declares none, so they are read inside
 * the row's identity rather than in a column that would be empty on nearly every
 * line, where the one thing a reader is looking for is the one thing they have
 * to hunt for.
 *
 * The root is named here rather than built by the vocabulary's `table`, which
 * carries no size. §5's dense row is `Table size="1"`: the system's 14 px type
 * over `--space-2` of cell padding, which the system's own default of `2` does
 * not reach. The cells, chips and rows are the vocabulary's.
 */
import { cellOf, chipList, press, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { SERVERS } from "./effect-ui-registry-source.ts"
import { toneBadgeOf, type Tone } from "./effect-ui-tone.ts"

/**
 * One status value's badge, guarded on its own value — a tone belongs to a
 * declared field, so the three the contract can carry are three nodes and a
 * status nobody declared renders as nothing rather than as the wrong tone.
 */
const status = (value: string, tone: Tone): UiNodeSpec =>
  ({ ...toneBadgeOf(tone, "status"), visible: { source: { item: "status" }, equals: value } })

/**
 * The resources a row declares, under the id it declares them from. Guarded on
 * the first entry rather than on the array: an empty array is truthy, and the
 * label would stand over nothing.
 */
const resources: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "1" },
  visible: { source: { item: "apps/0" } },
  children: [
    { component: "Text", props: { value: "ui:// resources", size: "1", color: "gray" } },
    chipList({ source: { item: "apps" } }, ""),
  ],
}

/** The name a person reads, over the id the server is addressed by. */
const identity: UiNodeSpec = cellOf({
  component: "Flex",
  props: { direction: "column", gap: "1", align: "start" },
  children: [
    { component: "Text", props: { weight: "medium" }, item: "name" },
    { component: "Code", item: "serverId" },
    resources,
  ],
})

/**
 * Both doors name the server the row already stands on, so neither asks for an
 * id the operator can see. Withdraw is a door and not a press: removing a server
 * is authorized by that server's own token, and this row has nowhere to enter
 * one — the screen it opens is where the token and the record meet.
 */
const doors: UiNodeSpec = cellOf(row([
  press("Preview", "registry.openPreview", { serverId: { item: "serverId" } }, { size: "1", variant: "soft" }),
  press("Withdraw", "registry.openWithdraw", { serverId: { item: "serverId" } }, { size: "1", variant: "soft" }),
]))

/** §2's column header: one step under the row it labels, and never bold by accident. */
const column = (value: string): UiNodeSpec =>
  ({ component: "Table.ColumnHeaderCell", children: [{ component: "Text", props: { value, size: "1", weight: "medium" } }] })

const cells: readonly UiNodeSpec[] = [
  identity,
  cellOf({ component: "Code", item: "version" }),
  cellOf(toneBadgeOf("info", "era")),
  cellOf(row([status("healthy", "ok"), status("warn", "pending"), status("offline", "failed")])),
  doors,
]

export const serversTable: UiNodeSpec = {
  component: "Table.Root",
  props: { variant: "surface", size: "1" },
  children: [
    { component: "Table.Header", children: [{
      component: "Table.Row",
      children: ["Server", "Version", "Era", "Status", "Actions"].map(column),
    }] },
    { component: "Table.Body", repeat: { source: { state: SERVERS }, key: "serverId" },
      children: [{ component: "Table.Row", children: [...cells] }] },
  ],
}
