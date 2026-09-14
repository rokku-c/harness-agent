import {
  chipList, emptyRows, row, sourceStatusPath, stateRows, toneField, whenRows, type UiNodeSpec,
} from "@effect-agent/effect-ui"
import { SERVERS, SETS, STATUS_SOURCE } from "./effect-ui-paths.ts"
import { readFailure, reading, sourceFailed } from "./effect-ui-read.ts"
import { block, cellOf, chip, figure, linkCell, screenHead, table } from "./effect-ui-rows.ts"

const BINDING_EDITOR = "#app/mcp-gateway/topology"
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
      [chip("serverId"), toneField("info", "transport"), chip("endpoint"), figure("authRef", "authRef", "None"), linkCell(BINDING_EDITOR, "Open")],
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
