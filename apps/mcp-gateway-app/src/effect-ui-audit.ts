import {
  cellOf, emptyRows, heading, loadingRows, region, section, stateBadge, stateRows, table, text, toneWhen, whenRows,
  type UiNodeSpec,
} from "@effect-agent/effect-ui"
import { chipRow, chipWhen } from "./effect-ui-cells.ts"
import { readFailed } from "./effect-ui-refusal.ts"
import { AUDIT, RECORDS } from "./effect-ui-paths.ts"

const head: UiNodeSpec = {
  component: "Flex", props: { direction: "column", gap: "3" },
  children: [
    heading("Audit", { size: "4" }),
    text("One row per thing that happened to one call. The host's Activity reads the same records with the actor filter applied.", { size: "2", color: "gray" }),
  ],
}

const events: UiNodeSpec = section("Decisions", [
  emptyRows(AUDIT, RECORDS, "Nothing has been decided yet. A row appears the moment the door carries a call."),
  whenRows(stateRows(RECORDS), table(
    ["At (epoch ms)", "Call", "Kind", "Principal", "Subject", "Verdict", "Outcome"],
    [
      cellOf(chipWhen("at")),
      cellOf(chipWhen("callId")),
      cellOf(stateBadge("type")),
      cellOf(chipWhen("principal")),
      cellOf(chipRow(["tool", "serverId", "setId"])),
      cellOf([
        toneWhen("decision", "allow", "ok", "Allow"),
        toneWhen("decision", "deny", "denied", "Deny"),
        toneWhen("decision", "log", "info", "Log"),
      ]),
      cellOf([
        chipWhen("status"),
        { component: "Text", item: "detail", props: { size: "2", color: "gray" },
          visible: { source: { item: "detail" } } },
      ]),
    ],
    { source: { state: RECORDS } },
  )),
])

export const auditScreen: readonly UiNodeSpec[] = [
  head,
  region([loadingRows(AUDIT, 6), readFailed("The audit could not be read.", AUDIT, "gateway.readAudit"), events]),
]
