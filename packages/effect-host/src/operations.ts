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
 * Privileged by construction: a plugin that wanted these would have to hold the
 * lifecycle, which only the host has. App nodes get the same *shape* of entry
 * with `privileged: false` — see effect-apps' operations.ts.
 */

import { errorDetail } from "./response.ts"

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

const idParam = { type: "string", description: "target plugin id" } as const

const byId = {
  type: "object",
  properties: { id: idParam },
  required: ["id"],
  additionalProperties: false,
} as const

const enabledResult = {
  type: "object",
  properties: { ok: { type: "boolean" }, id: { type: "string" }, enabled: { type: "boolean" } },
  required: ["ok", "id", "enabled"],
} as const

export const HOST_OPERATIONS: readonly HostOperation[] = [
  {
    name: "list",
    plane: "lifecycle",
    method: "GET",
    path: "/-/planes",
    description: "List every registered plugin with its enabled flag and dispatch priority.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, enabled: { type: "boolean" }, priority: { type: "number" } },
        required: ["id", "enabled", "priority"],
      },
    },
  },
  {
    name: "enable",
    plane: "lifecycle",
    method: "POST",
    path: "/-/planes/:id/enable",
    description: "Load a registered plugin. ok is false when the id is unknown, already enabled, or its load() failed.",
    inputSchema: byId,
    outputSchema: enabledResult,
  },
  {
    name: "disable",
    plane: "lifecycle",
    method: "POST",
    path: "/-/planes/:id/disable",
    description: "Unload a plugin but keep it registered. ok is false when the id is unknown or already disabled.",
    inputSchema: byId,
    outputSchema: enabledResult,
  },
  {
    name: "reload",
    plane: "lifecycle",
    method: "POST",
    path: "/-/planes/:id/reload",
    description: "Re-read one app's code from source and serve it in place, without restarting the host. "
      + "ok is false when the id is unknown, was never loaded, or the incoming generation was refused or failed to load — "
      + "and in every one of those cases the generation already serving keeps serving.",
    inputSchema: byId,
    outputSchema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        id: { type: "string" },
        generation: { type: "number", description: "the generation now serving; 0 is what boot loaded" },
        reason: { type: "string" },
        detail: { type: "string" },
        report: { type: "object" },
      },
      required: ["ok", "id"],
    },
  },
  {
    name: "unregister",
    plane: "lifecycle",
    method: "DELETE",
    path: "/-/planes/:id",
    description: "Unload a plugin and drop it from the registry. ok is false when the id is unknown.",
    inputSchema: byId,
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
  },
]

/** Turn a path template into an anchored matcher, leaving literals escaped. */
const patternOf = (template: string): RegExp =>
  new RegExp(
    "^" +
      template
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, "([^/]+)") +
      "$",
  )

const namesOf = (template: string): readonly string[] =>
  [...template.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1])

const matchers = HOST_OPERATIONS.map((operation) => ({
  operation,
  pattern: patternOf(operation.path),
  names: namesOf(operation.path),
}))

export interface HostOperationMatch {
  readonly operation: HostOperation
  /** Template parameters, URL-decoded — `{ id: "board" }` for `/-/planes/board/enable`. */
  readonly params: Readonly<Record<string, string>>
}

/** Match a control-surface request against the declaration; undefined = not a control path. */
export const matchHostOperation = (method: string, path: string): HostOperationMatch | undefined => {
  for (const { operation, pattern, names } of matchers) {
    if (operation.method !== method) continue
    const match = pattern.exec(path)
    if (match === null) continue
    const params: Record<string, string> = {}
    names.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1])
    })
    return { operation, params }
  }
  return undefined
}

/** Execute one declared operation. IO lives in the lifecycle, not here. */
export const runHostOperation = async (
  operation: HostOperation,
  params: Readonly<Record<string, string>>,
  target: HostOperationTarget,
): Promise<unknown> => {
  const id = params.id
  switch (operation.name) {
    case "list":
      return target.list()
    case "enable":
    case "disable": {
      const ok = operation.name === "enable" ? await target.enable(id) : await target.disable(id)
      return { ok, id, enabled: target.isEnabled(id) }
    }
    case "reload": {
      if (target.reload === undefined) return { ok: false, id, detail: "this host does not own app sources" }
      const { ok, reason, generation, error, report } = await target.reload(id)
      return {
        ok, id,
        ...(reason === undefined ? {} : { reason }),
        ...(generation === undefined ? {} : { generation }),
        ...(error === undefined ? {} : { detail: errorDetail(error) }),
        ...(report === undefined ? {} : { report }),
      }
    }
    case "unregister":
      return { ok: await target.unregister(id) }
  }
}
