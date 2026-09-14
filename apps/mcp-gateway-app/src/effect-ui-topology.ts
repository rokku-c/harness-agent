import {
  heading, loadingRows, press, region, row, text, type UiNodeSpec,
} from "@effect-agent/effect-ui"
import { offerTables } from "./effect-ui-offer.ts"
import { bindingsTable, setsTable } from "./effect-ui-grants.ts"
import { readFailed } from "./effect-ui-refusal.ts"
import { GRANTS_REVISION, NAV_SERVER, TOPOLOGY } from "./effect-ui-paths.ts"

const head: UiNodeSpec = {
  component: "Flex", props: { direction: "column", gap: "3" },
  children: [
    heading("Topology", { size: "4" }),
    text("What the door can offer, and the sets and bindings it decides with. Sets and bindings are declared in the agentd center and read here.", { size: "2", color: "gray" }),
    row([text("Grants at revision", { size: "1", color: "gray" }), { component: "Code", bind: GRANTS_REVISION }]),
  ],
}

const strip: UiNodeSpec = {
  component: "Flex", props: { gap: "2", align: "center", wrap: "wrap" },
  visible: { source: { state: NAV_SERVER } },
  children: [
    text("Showing rows for one server only.", { size: "2", color: "gray" }),
    { component: "Code", bind: NAV_SERVER },
    press("Show all", "gateway.showEveryServer", undefined, { size: "1", variant: "soft" }),
  ],
}

export const topologyScreen: readonly UiNodeSpec[] = [
  head,
  strip,
  region([
    loadingRows(TOPOLOGY, 6),
    readFailed("The topology could not be read.", TOPOLOGY, "gateway.readTopology"),
    ...offerTables,
    setsTable,
    bindingsTable,
  ]),
]
