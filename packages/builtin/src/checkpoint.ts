/**
 * The default checkpoint store (in-memory, scoped to the runtime) and the
 * recovery-policy wiring: at resume, the checkpoint's sensitivity
 * declarations turn into concrete recovery notes injected into the fresh
 * context. Time sensitivity translates wall-clock drift; external-effect
 * sensitivity demands re-validation; custom sensitivities carry their own
 * label.
 */
import { Effect, Layer, Ref } from "effect"
import { CheckpointStore, type Content, type StoredCheckpoint } from "@effect-agent/core"

export const CheckpointStoreLayer = Layer.effect(
  CheckpointStore,
  Effect.gen(function* () {
    const store = yield* Ref.make<ReadonlyMap<string, StoredCheckpoint>>(new Map())
    return {
      put: (stored) => Ref.update(store, (map) => new Map(map).set(stored.ref.runId, stored)),
      get: (ref) => Effect.map(Ref.get(store), (map) => map.get(ref.runId)),
      list: () => Effect.map(Ref.get(store), (map) => [...map.values()])
    }
  })
)

/** Sensitivity declarations -> the recovery content a resumed run sees first. */
export const recoveryContent = (stored: StoredCheckpoint): ReadonlyArray<Content> => {
  const elapsed = Date.now() - stored.savedAt
  const notes = stored.sensitivities.map((sensitivity) =>
    sensitivity._tag === "TimeSensitive"
      ? "[resume] time-sensitive: " + elapsed + "ms have passed since the checkpoint; re-check anything time-dependent before acting."
      : sensitivity._tag === "ExternalEffects"
        ? "[resume] external-effects-sensitive: the world may have changed since the checkpoint; verify prior assumptions and avoid repeating side effects."
        : "[resume] " + sensitivity.label + "-sensitive: re-validate the assumptions recorded before the checkpoint."
  )
  if (notes.length === 0) notes.push("[resume] state restored from checkpoint; continue where the thread left off.")
  return [{ _tag: "Text", text: notes.join(" ") }]
}

