/**
 * The topology screen: what the door can offer, and the grants it decides with.
 *
 * The read behind it is the catalog rebuild itself rather than a second opinion
 * about it — asking here is the same call `tools/list` makes — so a server drawn
 * as listed is one a call would actually route through, and a set drawn as
 * reaching a server is one the engine would route through. A console that
 * derived its own answer would be able to disagree with the door it describes,
 * which is the one thing this screen must not do.
 *
 * The address may name one server (`?serverId=`), which is how a server read in
 * another app arrives here already narrowed to itself (J6). The filter is shown
 * above the tables and never only inside them: a narrowed list with nothing
 * saying why it is short is indistinguishable from a gateway that lost its
 * servers, and the way out is a press rather than a second address to know.
 *
 * Nothing here is in a region but the reads. The heading, the grant revision and
 * the filter strip stay where they are while a topology of any size scrolls
 * under them, so the answer to "which revision am I looking at" is not something
 * the operator has to scroll back up to find.
 */
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

/**
 * A door to this same screen with no parameters, which is what drops the filter.
 *
 * It stands above the tables rather than standing in for them when they come out
 * empty, and that is the one place this screen departs from §9.1's "empty
 * because of a filter" copy. The filter decides row by row, so a view that cannot
 * count the rows it filtered cannot tell "this server owns nothing" from "this
 * server is not registered" — and a strip that named the filter, on every state,
 * says the true thing in both without inventing the count it does not have.
 */
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
