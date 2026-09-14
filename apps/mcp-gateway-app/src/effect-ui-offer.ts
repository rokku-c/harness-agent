import { cellOf, chip, emptyRows, section, stateRows, toneWhen, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { titled } from "./effect-ui-cells.ts"
import { filtered, filteredTable } from "./effect-ui-filtered.ts"
import { NAV_SERVER, SERVERS, TOOLS, TOPOLOGY } from "./effect-ui-paths.ts"

const statuses: readonly UiNodeSpec[] = [
  toneWhen("status", "healthy", "ok", "Healthy"),
  toneWhen("status", "warn", "pending", "Warn"),
  toneWhen("status", "offline", "failed", "Offline"),
]

const listed: readonly UiNodeSpec[] = [
  toneWhen("listing/state", "listed", "ok", "Listed"),
  toneWhen("listing/state", "failed", "failed", "Listing failed"),
  toneWhen("listing/state", "not asked", "info", "Not asked"),
  { component: "Text", item: "listing/detail", props: { size: "1", color: "gray" },
    visible: { source: { item: "listing/detail" } } },
]

const servers: UiNodeSpec = section("Servers", [
  { component: "Text", props: { value: "A tool is offered only when its server is registered, healthy and declares it.", size: "1", color: "gray" } },
  emptyRows(TOPOLOGY, SERVERS, "No MCP server is registered. A server appears here once the MCP Registry app holds one."),
  whenRows(stateRows(SERVERS), filteredTable(
    ["Server", "Status", "Tools listed"],
    [titled("name", "serverId"), cellOf(statuses), cellOf(listed)],
    { source: { state: SERVERS } },
    filtered(NAV_SERVER, "serverId"),
  )),
])

const tools: UiNodeSpec = section("Tools the door offers", [
  { component: "Text", props: { value: "Each name is the one tools/list answers with, and it already carries the server it comes from.", size: "1", color: "gray" } },
  emptyRows(TOPOLOGY, TOOLS, "The door offers no tool. A tool appears here once a healthy server declares it."),
  whenRows(stateRows(TOOLS), filteredTable(
    ["Tool", "Server", "Declared as", "Description"],
    [
      cellOf(chip("advertised")),
      cellOf(chip("serverId")),
      cellOf(chip("tool")),
      cellOf({ component: "Text", item: "description", props: { size: "2", color: "gray" } }),
    ],
    { source: { state: TOOLS } },
    filtered(NAV_SERVER, "serverId"),
  )),
])

export const offerTables: readonly UiNodeSpec[] = [servers, tools]
