/**
 * What the server has observed about each machine, beside what the machine
 * claims about itself.
 *
 * The leases are derived from the registered machines, so this list has a first
 * row exactly when the machines list above it does. The block appears with them
 * rather than saying "no machines are declared" a second time: a node that
 * stopped reporting is the whole point of the list, and there is nothing to
 * observe before there is a node.
 *
 * Presence carries tones because both of its readings are design system cases:
 * up is health and down is a failure. Withdrawal carries one only on the
 * affirmative reading, because a withdrawal is neither: it is the machine
 * leaving on its own terms, which is a deploy rather than an incident, and it is
 * a fact worth telling apart from both of the others.
 */
import { row, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { NODES } from "./effect-ui-paths.ts"
import { block, cellOf, chip, table } from "./effect-ui-rows.ts"
import { failed, info, ok, whenFalse, whenTrue } from "./effect-ui-tone.ts"

/**
 * The two readings of one boolean, each with the tone its reading earns.
 *
 * Withdrawal gets both readings for the same reason presence does: a cell that
 * is blank for the usual case reads as a column the read did not carry, and
 * "No" is the answer to the question the heading asks. Presence carries a tone
 * on each side because up and down are the design system's health and failure;
 * withdrawal carries one only on the affirmative, because not having withdrawn
 * is not a state anyone needs told apart.
 */
const presence: UiNodeSpec = cellOf([row([
  whenTrue(ok("Online"), "online"),
  whenFalse(failed("Offline"), "online"),
])])

const cells: readonly UiNodeSpec[] = [
  cellOf([chip("nodeId")]),
  presence,
  cellOf([row([
    whenTrue(info("Withdrawn"), "withdrawn"),
    { component: "Text", props: { value: "No", size: "2", color: "gray" },
      visible: { source: { item: "withdrawn" }, not: true } },
  ])]),
]

const liveness: UiNodeSpec = block(
  "Liveness",
  "What the server has observed rather than what a machine claims: a lease is renewed, or it lapses.",
  [
    table(["Node", "Presence", "Withdrawn"], cells, { source: { state: NODES }, key: "nodeId" }),
  ],
)

/** Guarded on the list it draws, so the block cannot outlive the rows it is about. */
export const livenessBlock: UiNodeSpec = whenRows(stateRows(NODES), liveness)
