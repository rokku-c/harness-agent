/**
 * tools/ops.ts - ASSEMBLING the mantis op surface.
 *
 * Concept: pull every op from its domain builder (catalog/enable, workspace
 * reads + mutations, ui_render, generated resource appends) and assemble
 * them in exactly the capability-manifest order - the surface = the
 * manifest. The configured ApprovalPolicy wraps every op (default: none, so
 * nothing is approved/denied unless a policy protects it).
 */
import type { Op as OpT } from "@effect-agent/core"
import { MANTIS_CAPABILITIES } from "../capabilities.ts"
import { noApproval, withApproval } from "../approval.ts"
import { buildCatalogEnable } from "./build/catalog.ts"
import { buildRecall, buildRead, buildUpdateDelete } from "./build/records.ts"
import { buildUiRender } from "./build/ui.ts"
import { buildAppends } from "./build/appends.ts"
import type { MantisToolsDeps } from "./schemas.ts"

export const makeMantisOps = (deps: MantisToolsDeps): ReadonlyArray<OpT<any, any, any>> => {
  const { supply, notes } = deps
  const approvals = deps.approvals ?? noApproval
  const [tools_catalog, enable] = buildCatalogEnable(supply, deps.onEnabled)
  const recall_notes = buildRecall(notes)
  const note_read = buildRead(notes)
  const { update_record, delete_record } = buildUpdateDelete(notes) as Record<string, OpT<any, any, any>>
  const ui_render = buildUiRender(deps.ui?.push)
  const opsByName: Record<string, OpT<any, any, any, never>> = {
    tools_catalog,
    enable,
    recall_notes,
    note_read,
    update_record,
    delete_record,
    ...(buildAppends(notes) as Record<string, OpT<any, any, any, never>>),
    ui_render
  }
  return MANTIS_CAPABILITIES.map((capability) => withApproval(opsByName[capability.name]! as OpT<any, any, never, never>, approvals))
}
