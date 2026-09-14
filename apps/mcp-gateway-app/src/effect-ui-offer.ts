/**
 * What the door can offer, and why anything is missing from it.
 *
 * M2 step 4 is the reason this is two tables and not one: a tool is exposed only
 * when its server is registered, that server is healthy, and the tool is
 * declared by that server's own declaration — so "why is this tool not in my
 * list" is a question about a *server*, and it is answered in the server's row.
 * `Listing failed` carries the lister's own words underneath, because a server
 * that answered with an error and a server that answered with nothing are two
 * different repairs.
 *
 * The three listing states are exactly the three answers the catalog rebuild
 * gives, and none is invented here: `listed` was asked and answered, `failed`
 * was asked and refused, and `not asked` is a server that is offline — the state
 * an operator meets most often, and the one a report of only successes and
 * failures would leave unexplained. A server that is `warn` has a heartbeat
 * going stale: not yet gone, and no longer current.
 *
 * Both tables answer the address's `serverId`, which is how a server read in
 * another app arrives here already narrowed to itself (J6).
 */
import { cellOf, chip, emptyRows, section, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { titled } from "./effect-ui-cells.ts"
import { filtered, filteredTable } from "./effect-ui-filtered.ts"
import { toneFor } from "./effect-ui-tone.ts"
import { NAV_SERVER, SERVERS, TOOLS, TOPOLOGY } from "./effect-ui-paths.ts"

const statuses: readonly UiNodeSpec[] = [
  toneFor("status", "healthy", "ok", "Healthy"),
  toneFor("status", "warn", "pending", "Warn"),
  toneFor("status", "offline", "failed", "Offline"),
]

const listed: readonly UiNodeSpec[] = [
  toneFor("listing/state", "listed", "ok", "Listed"),
  toneFor("listing/state", "failed", "failed", "Listing failed"),
  toneFor("listing/state", "not asked", "info", "Not asked"),
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
