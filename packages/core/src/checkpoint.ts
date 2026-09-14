import { Context, Effect } from "effect"
import type { AgentError } from "./errors.ts"

export type Sensitivity =
  | { readonly _tag: "TimeSensitive" }
  | { readonly _tag: "ExternalEffects" }
  | { readonly _tag: "Custom"; readonly label: string }

export interface CheckpointRef {
  readonly runId: string
}

export interface StoredCheckpoint {
  readonly ref: CheckpointRef
  readonly agent: string
  readonly task: string
  readonly sensitivities: ReadonlyArray<Sensitivity>
  readonly savedAt: number
  readonly payload: unknown
}

export interface CheckpointStoreService {
  readonly put: (stored: StoredCheckpoint) => Effect.Effect<void, AgentError>
  readonly get: (ref: CheckpointRef) => Effect.Effect<StoredCheckpoint | undefined, AgentError>
  readonly list: () => Effect.Effect<ReadonlyArray<StoredCheckpoint>, AgentError>
}

export class CheckpointStore extends Context.Tag("core/CheckpointStore")<CheckpointStore, CheckpointStoreService>() {}
