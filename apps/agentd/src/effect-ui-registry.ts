/**
 * What the control plane can deploy with: the MCP servers it knows, and the
 * sets those servers are grouped into.
 *
 * Neither is per-node, which is why they are a file of their own rather than
 * another block in the machine lists: a set is bound to an agent, and the
 * agent's own row is where that binding is read.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { badgeCell, cell, cellOf, chip, listed } from "./effect-ui-cells.ts"
import { listStates, section, table, text } from "./effect-ui-nodes.ts"

export const serverSection: UiNodeSpec = section("MCP servers", [
  text("Every server an agent's set can reach, and the endpoint it is reached at.", { size: "2", color: "gray" }),
  ...listStates("/status/servers", "No MCP servers are registered."),
  table(["Server", "Transport", "Endpoint"], [
    cellOf([chip("serverId")]), badgeCell("transport"), cell("endpoint"),
  ], "/status/servers", "serverId"),
])

export const setSection: UiNodeSpec = section("Sets", [
  text("The groups those servers are bound in; an agent's row names the sets it is bound to.", { size: "2", color: "gray" }),
  ...listStates("/status/sets", "No sets are registered."),
  table(["Set", "Id", "Servers"], [
    badgeCell("name"), cellOf([chip("setId")]), listed("servers", [chip("")]),
  ], "/status/sets", "setId"),
])
