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
