/**
 * What the server has observed about each machine, beside what the machine
 * claims about itself.
 *
 * The leases are derived from the registered machines, so this list has a first
 * row exactly when the machines list above it does. The card appears with them
 * rather than saying "no machines are registered" a second time: a node that
 * stopped reporting is the whole point of the list, and there is nothing to
 * observe before there is a node.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, chip } from "./effect-ui-cells.ts"
import { section, table, text } from "./effect-ui-nodes.ts"
import { itemSignal } from "./effect-ui-signals.ts"

/** What one lease says: it is renewed, it lapsed, or the node said goodbye. */
const presence: UiNodeSpec = cellOf([
  itemSignal("Online", "online", "green", true),
  itemSignal("Offline", "online", "red", false),
])

const liveness: UiNodeSpec = section("Liveness", [
  text("What the server has observed, rather than what a node claims: a lease is renewed, or it lapses.", { size: "2", color: "gray" }),
  table(["Node", "Presence", "Withdrawn"], [
    cellOf([chip("nodeId")]), presence, cellOf([itemSignal("Withdrawn", "withdrawn", "amber", true)]),
  ], "/status/nodeLiveness/nodes", "nodeId"),
])

/** Shown once there is a machine to be up or down. */
export const livenessSection: UiNodeSpec = { ...liveness, visible: { source: { state: "/status/machines/0" } } }
