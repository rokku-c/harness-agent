/** domain/executors.ts - the MULTI-AGENT SURFACE.
 *  Concept: an executor is registered by the connector (claude-code,
 *  claude-global or the builtin coordinator) with the capability labels it
 *  can take; status + lastSeen drive liveness in the web panel. */
export type ExecutorKind = "builtin" | "external"

export interface Executor {
  readonly executorId: string
  readonly kind: ExecutorKind
  readonly name: string
  /** capabilities (labels this executor can take: release, docs, ...) */
  readonly capability: ReadonlyArray<string>
  readonly status: "idle" | "busy" | "offline"
  readonly lastSeen: number
}
