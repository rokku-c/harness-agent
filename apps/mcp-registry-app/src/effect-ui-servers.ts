import { cellOf, chipList, press, row, toneField, type Tone, type UiNodeSpec } from "@effect-agent/effect-ui"
import { SERVERS } from "./effect-ui-registry-source.ts"

const status = (value: string, tone: Tone): UiNodeSpec =>
  ({ ...toneField(tone, "status"), visible: { source: { item: "status" }, equals: value } })

const resources: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "1" },
  visible: { source: { item: "apps/0" } },
  children: [
    { component: "Text", props: { value: "ui:// resources", size: "1", color: "gray" } },
    chipList({ source: { item: "apps" } }, ""),
  ],
}

const identity: UiNodeSpec = cellOf({
  component: "Flex",
  props: { direction: "column", gap: "1", align: "start" },
  children: [
    { component: "Text", props: { weight: "medium" }, item: "name" },
    { component: "Code", item: "serverId" },
    resources,
  ],
})

const doors: UiNodeSpec = cellOf(row([
  press("Preview", "registry.openPreview", { serverId: { item: "serverId" } }, { size: "1", variant: "soft" }),
  press("Withdraw", "registry.openWithdraw", { serverId: { item: "serverId" } }, { size: "1", variant: "soft" }),
]))

const column = (value: string): UiNodeSpec =>
  ({ component: "Table.ColumnHeaderCell", children: [{ component: "Text", props: { value, size: "1", weight: "medium" } }] })

const cells: readonly UiNodeSpec[] = [
  identity,
  cellOf({ component: "Code", item: "version" }),
  cellOf(toneField("info", "era")),
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
