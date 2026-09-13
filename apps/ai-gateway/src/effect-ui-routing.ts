/**
 * The two read-only lists behind the provider table: which rules rewrite a
 * request, and which paths the gateway answers on.
 *
 * Both are configuration rather than activity, so they sit under the things an
 * operator acts on. A rule is identified by the id config gives it, which is
 * the only name it has — a chip, not prose in the first column.
 */
import { emptyRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { cell, cellOf, chip, MODEL_SOURCE, section, table } from "./effect-ui-nodes.ts"

const ruleCells: readonly UiNodeSpec[] =
  [cellOf([chip("ruleId")]), cell("match/agent"), cell("inject/content"), cell("inject/position")]

export const rulesSection: UiNodeSpec = section("Routing rules", [
  emptyRows(MODEL_SOURCE, "/models/rules", "No routing rules are configured."),
  table(["Rule", "Match agent", "Injected content", "Position"], ruleCells, "/models/rules", "ruleId"),
])

/** The list is bare strings, so the item itself is what each row shows. */
export const endpointsSection: UiNodeSpec = section("Upstream endpoints", [
  emptyRows(MODEL_SOURCE, "/models/endpoints", "No upstream endpoints are registered."),
  table(["Path"], [cellOf([chip("")])], "/models/endpoints"),
])
