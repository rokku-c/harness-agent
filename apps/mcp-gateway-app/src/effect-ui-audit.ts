/**
 * What the door did, newest first.
 *
 * The rows are the gateway's own records rather than a log the console keeps: a
 * preview on the access screen and a live call produce one record shape, which
 * is the property that lets a preview be trusted at all (M4 step 2), and the
 * host's Activity reads the same store with the actor filter applied rather than
 * a second account of it (M6, J3).
 *
 * One row per event, keyed by the call it belongs to. A call leaves several —
 * the call itself, the access decision, a rule, the response — and they are
 * separate rows rather than one wide row because the door writes them as they
 * happen and a call that never finished has no response row to fold into. `Call`
 * is therefore the column that groups them, and it is the id the caller was
 * given, so an agent's own report and this table are matched by a value and not
 * by a timestamp.
 *
 * `At` is rendered exactly as the record carries it. An epoch millisecond is
 * what the operation answers with, and reformatting it in the view would be a
 * second value behind a name an agent calling the same operation reads as a
 * number — the one disagreement a console for this door must not have.
 */
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
