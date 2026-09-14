import { Schema } from "effect"
import { notationText, type NotationText } from "@effect-agent/core"
import { MANTIS_CAPABILITIES } from "../capabilities.ts"
import { WORKSPACE_RESOURCES } from "../workspace.ts"
import type { NotesStore } from "./store.ts"
import type { ToolSupply } from "../supply.ts"
import type { ApprovalPolicy } from "../approval.ts"
import type { Entry } from "./contract.ts"

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

export const toOut = (entries: ReadonlyArray<Entry>) =>
  entries.map((entry) => ({ id: entry.id, kind: entry.kind, text: entry.text, source: entry.source }))

export interface MantisToolsDeps {
  readonly supply: ToolSupply
  readonly notes: NotesStore
  readonly approvals?: ApprovalPolicy
  readonly onEnabled?: (name: string) => void
}
