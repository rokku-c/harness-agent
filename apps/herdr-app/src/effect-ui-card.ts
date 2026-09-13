/**
 * The fleet: one card per agent, and one press on it.
 *
 * A card carries what an operator recognizes an agent by — the title it runs
 * under, its lifecycle, its directory — and the last lines it printed, so that
 * watching a fleet is reading one page rather than opening twenty.
 *
 * The acts on an agent are not here. They are on the agent's own screen, which
 * this card is the door to, and that is the whole reason the console has a
 * second screen: `Send here` and `Esc` are presses whose answer is a line on
 * screen, and on a list of twenty cards that line has nowhere to be. One press
 * belongs on a list — the one that leaves it.
 *
 * The fleet is what its screen scrolls: a region takes the room the header left,
 * so a twenty-agent fleet scrolls inside its own box and the socket, the failure
 * and the doors above it stay where they are. The heading scrolls up with the
 * cards — that is what a region given a whole section does, and pinning a
 * heading to the top of one is a thing to want separately, not to assume here.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { chip, emptyRows, failureNotice, loadingRows, row, section, stateBadge } from "@effect-agent/effect-ui"
import { agentsSource, hasTail, press, rowsPath, terminal } from "./effect-ui-nodes.ts"

const card: UiNodeSpec = {
  component: "Card",
  props: { size: "1", variant: "surface" },
  children: [{ component: "Flex", props: { direction: "column", gap: "2" }, children: [
    { component: "Flex", props: { justify: "between", align: "center", gap: "2" }, children: [
      { component: "Text", props: { weight: "medium", truncate: true }, item: "terminal_title_stripped" },
      stateBadge("agent_status"),
    ] },
    row([chip("pane_id"), { component: "Text", props: { size: "1", color: "gray", truncate: true }, item: "foreground_cwd" }]),
    { component: "Code", props: terminal("8rem"), item: "tail/text", visible: hasTail },
    // The read and the screen it opens are one press: what the screen shows is
    // the answer this press just fetched, so a cold URL and a tap differ in
    // nothing.
    press("Open", "herdr.agentOutput", { target: { item: "pane_id" } }, { variant: "solid" }),
  ] }],
}

export const agentNodes: readonly UiNodeSpec[] = [
  section("Agents", [
    loadingRows(agentsSource, 3), failureNotice(agentsSource),
    emptyRows(agentsSource, rowsPath(agentsSource), "No coding agent is running. Start one from the row above."),
    { component: "Grid", props: { columns: { initial: "1", sm: "2" }, gap: "3", align: "start" },
      repeat: { source: { state: rowsPath(agentsSource) }, key: "pane_id" }, children: [card] },
  ]),
]
