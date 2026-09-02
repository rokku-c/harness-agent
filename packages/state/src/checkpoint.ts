/**
 * Checkpoint persistence (E11): a Store-backed implementation of the core
 * CheckpointStore protocol. Any Store (memory/jsonl/sqlite) can back it -
 * swap the Store, keep the checkpoint semantics.
 */
import { Effect } from "effect"
import { AgentFailure, type AgentError } from "@effect-agent/core"
import type { CheckpointStoreService, StoredCheckpoint } from "@effect-agent/core"
import type { StoreService } from "./store.ts"

const failure = (cause: unknown): AgentError =>
  new AgentFailure({ agent: "checkpoint", cause, message: String(cause) })

export const StoreBackedCheckpointStore = (store: StoreService): CheckpointStoreService => ({
  put: (stored: StoredCheckpoint) =>
    store.put("checkpoint/" + stored.ref.runId, { type: "checkpoint", ...stored }).pipe(
      Effect.mapError(failure)
    ),
  get: (ref) =>
    store.get("checkpoint/" + ref.runId).pipe(
      Effect.map((value) => (value === undefined ? undefined : (value as StoredCheckpoint))),
      Effect.mapError(failure)
    ),
  list: () =>
    store.query({ type: "checkpoint" }).pipe(
      Effect.map((values) => values.map((value) => value as StoredCheckpoint)),
      Effect.mapError(failure)
    )
})
