/**
 * The host node's privileged plane, declared as data
 * (docs/architecture-rework.md §4: "host 节点与 app 节点共用同一张表").
 *
 * These operations are not new — they are the `/-/planes` control surface that
 * `control.ts` used to match with ad-hoc regexes. Declaring them once, with
 * schemas, is what lets the node operation table (effect-apps) enumerate the
 * host alongside its apps without a second copy of the path shapes drifting
 * away from the first. `control.ts` is now just the executor of this table.
 *
 * This file is the contract only: what an operation is, and what executing one
 * needs of a host. The declarations themselves are in operation-table.ts, path
 * matching in operation-match.ts, execution in operation-run.ts.
 *
 * Privileged by construction: a plugin that wanted these would have to hold the
 * lifecycle, which only the host has. App nodes get the same *shape* of entry
 * with `privileged: false` — see effect-apps' operations.ts.
 */

/** A JSON Schema literal (object for inputs, object/array for outputs). */
export type JsonSchema = Readonly<Record<string, unknown>>

export interface HostOperation {
  readonly name: "list" | "enable" | "disable" | "reload" | "unregister"
  readonly plane: "lifecycle"
  readonly description: string
  readonly method: "GET" | "POST" | "DELETE"
  /** Control path template; `:id` is the target plugin id. */
  readonly path: string
  readonly inputSchema: JsonSchema
  readonly outputSchema: JsonSchema
}

/**
 * What one reload attempt answers, structurally.
 *
 * "Refused, still serving" is a *result*, not an error, so `ok: false` carries a
 * reason rather than throwing. effect-server's fuller outcome — generations, the
 * upgrade report — is a supertype of this, which is how the host package reads an
 * answer without depending on the package that produces it.
 */
export interface HostReloadResult {
  readonly ok: boolean
  /** Why not: "not-loaded", "no-module", "rejected", "failed". */
  readonly reason?: string
  readonly generation?: number
  readonly error?: unknown
  readonly report?: unknown
}

/** What `runHostOperation` needs — the lifecycle, or any host that exposes one. */
export interface HostOperationTarget {
  list(): ReadonlyArray<{ readonly id: string; readonly enabled: boolean; readonly priority: number }>
  enable(id: string): Promise<boolean>
  disable(id: string): Promise<boolean>
  unregister(id: string): Promise<boolean>
  isEnabled(id: string): boolean
  /**
   * Re-read one node's code from source in place. Absent on a host that does not
   * own sources — the operation then says so rather than reporting a reload that
   * did not happen.
   */
  reload?(id: string): Promise<HostReloadResult>
}
