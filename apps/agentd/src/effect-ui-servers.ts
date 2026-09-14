/**
 * What the fleet can be assembled from: the MCP servers the center knows, and
 * the sets those servers are grouped into.
 *
 * Neither is a fact about one node, which is why they are a screen of their own
 * rather than another column of the machine list. A set is what a fleet agent is
 * bound to, so the agent's own room is where that binding is read; what an
 * operator comes here for is the vocabulary the binding is written in.
 *
 * This screen is not where access to a server is granted. That is the MCP
 * Gateway's job, and a server read here is a server governed there, so every row
 * carries the way over. The gateway's own topology screen is named on each row
 * rather than the server, and that is a limit of the language and not a choice:
 * a declared node's props are static, nothing here can put a row's own id into
 * an address, and a link that claimed to open one server would be a lie about
 * where it goes. What the row can honestly offer is the screen where servers are
 * bound, and the line above the table carries the gateway's operation list,
 * where a server is picked out by name rather than by address.
 *
 * The endpoint is drawn as a key and not as the literal badge rule 4 would
 * allow: it is an address read character by character against a config file,
 * which is what mono is for. The literal rule is carried by the transport beside
 * it, and by the credential reference, which is one of a small closed set.
 */
import { chipList, emptyRows, row, sourceStatusPath, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { SERVERS, SETS, STATUS_SOURCE } from "./effect-ui-paths.ts"
import { readFailure, reading, sourceFailed } from "./effect-ui-read.ts"
import { block, cellOf, chip, figure, linkCell, screenHead, table } from "./effect-ui-rows.ts"
import { infoOf } from "./effect-ui-tone.ts"

/** Where a server's binding and its grants are edited: the MCP Gateway's own topology screen. */
const BINDING_EDITOR = "#app/mcp-gateway/topology"
/** The same app's operation list: the nearest thing to a link at one named server. */
const OPERATIONS = "#tools/mcp-gateway"

const servers: UiNodeSpec = block(
  "Servers",
  "Every server a set can name, the endpoint it is reached at, and the credential it is reached with.",
  [
    row([{ component: "Link", props: { href: OPERATIONS, value: "MCP Gateway operations", size: "2" } }]),
    reading(STATUS_SOURCE, 5),
    emptyRows(STATUS_SOURCE, SERVERS, "No MCP server is registered. agentd's configuration names the servers a fleet agent can be given, so one appears here once it is added there."),
    whenRows(stateRows(SERVERS), table(
      ["Server", "Transport", "Endpoint", "Credential", "Binding editor"],
      [chip("serverId"), infoOf("transport"), chip("endpoint"), figure("authRef", "authRef", "None"), linkCell(BINDING_EDITOR, "Open")],
      { source: { state: SERVERS }, key: "serverId" },
    )),
  ],
)

const sets: UiNodeSpec = block(
  "Sets",
  "The groups those servers are bound in; a fleet agent's room names the sets it is bound to.",
  [
    reading(STATUS_SOURCE, 3, 4),
    emptyRows(STATUS_SOURCE, SETS, "No set is registered. A set appears here once agentd's configuration groups servers into one."),
    whenRows(stateRows(SETS), table(
      ["Set", "Id", "Servers"],
      [
        cellOf([{ component: "Badge", props: { variant: "soft" }, item: "name" }]),
        chip("setId"),
        cellOf([chipList({ source: { item: "servers" } }, "")]),
      ],
      { source: { state: SETS }, key: "setId" },
    )),
  ],
)

export const serversScreen: readonly UiNodeSpec[] = [
  screenHead("MCP servers", "What a fleet agent's sets can reach, and the groups those servers are declared in."),
  readFailure(sourceFailed(STATUS_SOURCE), "Could not read the MCP servers.",
    `${sourceStatusPath(STATUS_SOURCE)}/error`, "agentd.retryStatus"),
  servers,
  sets,
]
