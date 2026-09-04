/**
 * tools/build/appends.ts - GENERATED APPEND OPS per declared resource.
 *
 * Concept: one write op per workspace resource declaration (workspace.ts),
 * so adding a resource grows both the capability manifest and the op
 * surface from the same source. Each op is a Text write into that resource
 * kind with a bounded, explicit failure mode.
 */
import { Effect } from "effect"
import { Op, type Op as OpT } from "@effect-agent/core"
import { resourceAppendCapabilities } from "../../capabilities.ts"
import { WORKSPACE_RESOURCES } from "../../workspace.ts"
import { EntriesOut, manifestDescription, Text, toOut } from "../schemas.ts"
import { overRecordLimit } from "../contract.ts"
import type { NotesStore } from "../store.ts"

export const buildAppends = (notes: NotesStore): Record<string, OpT<any, any, any>> => {
  const appends: Record<string, OpT<any, any, any>> = {}
  for (const capability of resourceAppendCapabilities(WORKSPACE_RESOURCES)) {
    const target = WORKSPACE_RESOURCES.find((r) => r.kind === capability.kind)
    if (target === undefined) continue
    appends[capability.name] = Op.write({
      name: capability.name,
      description: manifestDescription(capability.name),
      input: Text,
      output: EntriesOut,
      execute: ({ text }) => {
        const over = overRecordLimit(text)
        if (over !== undefined) return Effect.fail(new Error(over))
        return Effect.succeed({ entries: toOut([notes.add(target.kind, text)]) })
      }
    })
  }
  return appends
}
