/**
 * What the control plane can deploy with: the MCP servers it knows, and the
 * sets those servers are grouped into.
 *
 * Neither is per-node, which is why they are a file of their own rather than
 * another block in the machine lists: a set is bound to an agent, and the
 * agent's own row is where that binding is read.
 *
 * Both lists are read by the fleet's one source, so this screen states that
 * read's two states once above them — a screen is a surface, and the states of
 * the read belong to it rather than to each list under it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyRows, failureNotice, loadingRows, stateRows, whenRows } from "@effect-agent/effect-ui"
import { badgeCell, cell, cellOf, chip, listed } from "./effect-ui-cells.ts"
import { STATUS_SOURCE, section, table, text } from "./effect-ui-nodes.ts"

export const serverSection: UiNodeSpec = section("MCP servers", [
  text("Every server an agent's set can reach, and the endpoint it is reached at.", { size: "2", color: "gray" }),
  emptyRows(STATUS_SOURCE, "/status/servers", "No MCP servers are registered."),
  whenRows(stateRows("/status/servers"), table(["Server", "Transport", "Endpoint"], [
    cellOf([chip("serverId")]), badgeCell("transport"), cell("endpoint"),
  ], "/status/servers", "serverId")),
])

export const setSection: UiNodeSpec = section("Sets", [
  text("The groups those servers are bound in; an agent's row names the sets it is bound to.", { size: "2", color: "gray" }),
  emptyRows(STATUS_SOURCE, "/status/sets", "No sets are registered."),
  whenRows(stateRows("/status/sets"), table(["Set", "Id", "Servers"], [
    badgeCell("name"), cellOf([chip("setId")]), listed("servers", [chip("")]),
  ], "/status/sets", "setId")),
])

/** The registry, as a destination: what can be deployed with, entered from the fleet that uses it. */
export const registryNodes: readonly UiNodeSpec[] = [
  loadingRows(STATUS_SOURCE, 3),
  failureNotice(STATUS_SOURCE),
  serverSection,
  setSection,
]
