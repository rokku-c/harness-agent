/**
 * tools/schemas.ts - SHARED OP SCHEMAS + deps + manifest descriptions.
 *
 * Concept: the input/output contracts shared by many mantis ops (entries,
 * enable, catalog) and the dependency bundle makeMantisOps receives.
 * Descriptions come from the capability manifest - the manifest is the
 * single source of tool text (no drift between catalog and ops).
 */
import { Schema } from "effect"
import { notationText, type NotationText } from "@effect-agent/core"
import { MANTIS_CAPABILITIES } from "../capabilities.ts"
import { WORKSPACE_RESOURCES } from "../workspace.ts"
import type { NotesStore } from "./store.ts"
import type { ToolSupply } from "../supply.ts"
import type { ApprovalPolicy } from "../approval.ts"
import type { Entry } from "./contract.ts"

/** description helper: op text comes from the capability manifest (single source) */
export const manifestDescription = (name: string): NotationText => {
  const capability = MANTIS_CAPABILITIES.find((ch) => ch.name === name)
  if (capability === undefined) throw new Error("capability manifest has no entry for op " + name)
  return notationText(capability.description)
}

export const Text = Schema.Struct({ text: Schema.String })
export const EntriesOut = Schema.Struct({
  entries: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      kind: Schema.Literal(...WORKSPACE_RESOURCES.map((r) => r.kind)),
      text: Schema.String,
      source: Schema.Literal("agent", "ui")
    })
  )
})
export const EnableIn = Schema.Struct({ name: Schema.String })
export const EnableOut = Schema.Struct({ ok: Schema.Boolean, detail: Schema.String })
export const CatalogOut = Schema.Struct({
  core: Schema.Array(Schema.String),
  extended: Schema.Array(Schema.Struct({ name: Schema.String, description: Schema.String }))
})

/** every record's public fields - the shape recall/read ops return */
export const toOut = (entries: ReadonlyArray<Entry>) =>
  entries.map((entry) => ({ id: entry.id, kind: entry.kind, text: entry.text, source: entry.source }))

export interface MantisToolsDeps {
  readonly supply: ToolSupply
  readonly notes: NotesStore
  /** which calls need approval (default: none - writes execute) */
  readonly approvals?: ApprovalPolicy
  /** called after an extended tool enable succeeds (host persists the surface) */
  readonly onEnabled?: (name: string) => void
}
