import { Context, Effect } from "effect"
import type { AgentError } from "./errors.ts"

/**
 * Checkpoints: the storage protocol for recorded runs. Any state-declaring
 * run is storable BY DEFAULT - the loop snapshots its logical state at every
 * step boundary whenever a store is present, a Pause signal archives it, and
 * a resume hydrates from the archive. Recovery policies ride along as
 * SENSITIVITY declarations: the checkpoint records what the run declared
 * itself sensitive to (time, external effects, custom), and resume injects
 * the matching recovery note into the fresh context.
 */
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
  /** The task the run started with - resume seeds the same goal unless overridden. */
  readonly task: string
  readonly sensitivities: ReadonlyArray<Sensitivity>
  /** Wall clock at save time - recovery policies translate it for the resumed run. */
  readonly savedAt: number
  /** Driver-opaque logical state: the loop's context, thread and step. */
  readonly payload: unknown
}

export interface CheckpointStoreService {
  readonly put: (stored: StoredCheckpoint) => Effect.Effect<void, AgentError>
  readonly get: (ref: CheckpointRef) => Effect.Effect<StoredCheckpoint | undefined, AgentError>
  readonly list: () => Effect.Effect<ReadonlyArray<StoredCheckpoint>, AgentError>
}

export class CheckpointStore extends Context.Tag("core/CheckpointStore")<CheckpointStore, CheckpointStoreService>() {}

